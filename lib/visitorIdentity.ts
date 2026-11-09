// lib/visitorIdentity.ts
//
// ── Visitor identity is now SERVER-side, not client-side ────────────
//
// Previously (see public/sitevento.js's old VISITOR_KEY block and this
// repo's git history): the embedded loader minted its own visitorId —
// 'v' + Date.now().toString(36) + Math.random()... — stuffed it into
// localStorage, and the server (/api/track) only ever reacted to
// whatever the client happened to send: trusted it outright if it
// matched a shape regex, and otherwise fell back to a device-signature
// recovery lookup or a fresh mint. The CLIENT was the source of truth;
// the server was just validating shape, never asserting ownership.
//
// That made two things impossible to build correctly:
//   1. Anything that has to be reliable per-unique-person — e.g.
//      EmailCaptureWidget's "never show again once submitted" rule —
//      because a client-generated id can be forged, replayed, or
//      simply regenerated the moment storage is cleared, and nothing
//      stops a widget from reading it before the server has even seen
//      this visitor for the first time.
//   2. Any guarantee that two different beacons claiming the same
//      visitorId are actually produced by the same server-side mint
//      path — a malicious page could fabricate a well-formed-looking
//      id and splice itself into someone else's history.
//
// This module is the fix: it's what makes a visitorId a credential the
// SERVER issued, not a fact the client asserts. The contract:
//
//   - The server picks the actual visitorId (reusing the client's
//     previous one when it checks out, recovering via deviceIndex,
//     or minting fresh — see resolveServerVisitorId in app/api/track's
//     route) and HMAC-signs it (plus the siteId it belongs to, so a
//     token minted for one site can't be replayed against another)
//     with a server-only secret the browser never sees.
//   - That signed token — not the bare id — is what's returned to the
//     client on every single /api/track response (not just the old
//     "recovery" case) as `visitorToken`, and the client stores the
//     WHOLE token, not just the id half.
//   - On every later beacon, the client sends that token back instead
//     of a bare id. The server verifies the signature here; only a
//     token this exact server minted is ever honored. A tampered,
//     expired-looking, or outright invented token is rejected outright
//     and treated exactly like "no token" (full recovery path, same as
//     before) — never trusted at face value the way a bare id used to
//     be. See verifyVisitorToken below.
//   - A client with no token at all (first-ever visit, storage
//     cleared, private mode) still gets one: the server mints/
//     recovers a plain id as before, then signs it before sending it
//     back — the browser never invents its OWN id anymore, full stop.
//
// The token is base64url(visitorId + '.' + siteId + '.' + hmacHex),
// kept flat and short (well under the 8KB beacon body cap) — not a JWT,
// since there's no need for the extra header/algorithm-negotiation
// surface a JWT brings for a single first-party HMAC check.
import { createHmac, timingSafeEqual } from 'crypto';

// Same id shape the loader used to generate client-side — kept
// unchanged so existing visitorProfiles/visits/deviceIndex docs (and
// every dashboard query keyed on this shape) don't need a migration.
// Still only ever produced server-side now (see mintVisitorId below).
const VISITOR_ID_RE = /^v[a-z0-9]{6,40}$/i;

// Also exported for app/api/track's own recovered/legacy-id validation
// (deviceIndex entries written before this change are bare ids in this
// same shape) — one shared definition instead of two copies drifting
// apart.
export { VISITOR_ID_RE };

// Falls back to a fixed dev-only string so local development and any
// deployment that hasn't set this yet doesn't hard-crash every beacon
// — but logs loudly, once per cold start, so a real deployment missing
// this in production is impossible to miss in the logs. A token signed
// with the fallback secret still only verifies against itself, so
// nothing is silently insecure in a way that corrupts data; it's only
// a problem if it ships to production unset.
function getSecret(): string {
  const configured = process.env.VISITOR_ID_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[visitorIdentity] VISITOR_ID_SECRET is not set (or too short) in production — ' +
        'visitor tokens are being signed with an insecure fallback secret. Set ' +
        'VISITOR_ID_SECRET to a long random string in this deployment\'s env vars.'
    );
  }
  return 'sitevento-dev-only-insecure-fallback-secret-do-not-ship';
}

function hmacHex(visitorId: string, siteId: string): string {
  return createHmac('sha256', getSecret()).update(`${visitorId}.${siteId}`).digest('hex');
}

function base64urlEncode(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function base64urlDecode(str: string): string | null {
  try {
    return Buffer.from(str, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Mints a fresh, server-chosen visitorId. This is the ONLY place a new
 * visitorId is ever created now — public/sitevento.js no longer has an
 * id-generation branch at all. Same shape as the old client-generated
 * ids (see VISITOR_ID_RE) so every downstream reader (visitorProfiles,
 * visits, deviceIndex, dashboard queries) needs no migration.
 */
export function mintVisitorId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return 'v' + Date.now().toString(36) + rand();
}

/**
 * Signs a (visitorId, siteId) pair into an opaque token for the client
 * to store and send back verbatim on every later beacon. Scoped to one
 * site: a token minted while visiting site A can't be replayed as a
 * valid token for site B, even though sitevento.js is the same shared
 * script across every embedding site.
 */
export function signVisitorToken(visitorId: string, siteId: string): string {
  return base64urlEncode(`${visitorId}.${siteId}.${hmacHex(visitorId, siteId)}`);
}

export interface VerifiedVisitor {
  visitorId: string;
}

// ── Site token: lets end-of-visit beacons skip the siteIndex read ───
//
// Every beacon that needs to write to Firestore has to resolve
// siteId -> uid first (users/{uid}/sites/{siteId} is where everything
// actually lives — see every route's own `db.collection('siteIndex')
// .doc(siteId).get()` call). /api/track already does this resolution
// on EVERY page view, as the very first real Firestore read it does.
// app/api/visit-end and app/api/heatmap-sample — which only ever fire
// AFTER /api/track has already run for that same page view (visit-end
// patches the doc /api/track just created; heatmap-sample's
// visitorToken could only exist because /api/track minted it) — were
// each redoing that exact same siteIndex lookup themselves, for a uid
// the server had already resolved moments earlier in the same page
// view. One avoidable read per visit, system-wide, purely because the
// client had no way to hand back an answer the server already gave it.
//
// This closes that gap the same way visitor identity already does:
// /api/track signs (siteId, uid) into an opaque, short-lived token and
// hands it back in its response; the client stores it for the
// duration of the page view and echoes it on visit-end/heatmap-sample;
// those routes verify the signature and read `uid` straight off it —
// zero Firestore reads to get there. A missing/invalid/expired token
// (old cached loader, token literally never arrived, clock skew,
// tampering) is never fatal: every caller falls back to the exact same
// siteIndex lookup these routes always did, so this is a pure
// optimization with no new way to fail. Deliberately NOT reused for
// anything security-sensitive beyond "which account does this siteId
// belong to" — visit-end and heatmap-sample already treat uid as
// non-secret routing information, not an authorization boundary (the
// real safety property on those routes is the visit/visitor id itself,
// scoped under that uid's own siteRef).
//
// Short TTL (one page view is minutes, not hours) so a leaked/replayed
// token has a tight, self-limiting blast radius — this is routing
// information, not a capability worth protecting indefinitely.
const SITE_TOKEN_TTL_MS = 30 * 60_000; // 30 minutes — generous for one page view, including a visitor who leaves a tab open a while before navigating away

function hmacHexSite(siteId: string, uid: string, issuedAt: number): string {
  return createHmac('sha256', getSecret()).update(`${siteId}.${uid}.${issuedAt}`).digest('hex');
}

export interface VerifiedSite {
  uid: string;
}

/**
 * Signs (siteId, uid, issuedAt) into an opaque token for the client to
 * store and echo back on this same page view's later beacons
 * (visit-end, heatmap-sample). Scoped to one siteId the same way
 * visitor tokens are — see signVisitorToken above — so it can never be
 * replayed to resolve a DIFFERENT site's uid.
 */
export function signSiteToken(siteId: string, uid: string): string {
  const issuedAt = Date.now();
  return base64urlEncode(`${siteId}.${uid}.${issuedAt}.${hmacHexSite(siteId, uid, issuedAt)}`);
}

/**
 * Verifies a site token the client sent back, scoped to the given
 * siteId. Returns the uid it carries only if the signature matches AND
 * the token hasn't aged past SITE_TOKEN_TTL_MS — any failure (garbage
 * input, wrong siteId, tampered fields, expired) returns null, and the
 * CALLER must fall back to the normal siteIndex lookup exactly as if
 * no token had been sent at all, never partially trust it.
 */
export function verifySiteToken(token: unknown, siteId: string): VerifiedSite | null {
  if (typeof token !== 'string' || !token || token.length > 400) return null;
  const decoded = base64urlDecode(token);
  if (!decoded) return null;

  const parts = decoded.split('.');
  if (parts.length !== 4) return null;
  const [tokenSiteId, uid, issuedAtStr, mac] = parts;
  if (tokenSiteId !== siteId) return null;
  if (!uid) return null;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SITE_TOKEN_TTL_MS) return null; // expired — treat exactly like no token

  const expected = hmacHexSite(siteId, uid, issuedAt);
  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return { uid };
}

/**
 * Verifies a token the client sent back against the given siteId.
 * Returns the visitorId it carries only if the signature actually
 * matches — any mismatch (wrong secret generation, tampered id,
 * token minted for a different siteId, garbage input) returns null
 * and the CALLER must treat that exactly like "no token at all" (i.e.
 * fall through to device recovery / mint a fresh one), never partially
 * trust the id embedded in a token that failed verification.
 */
export function verifyVisitorToken(token: unknown, siteId: string): VerifiedVisitor | null {
  if (typeof token !== 'string' || !token || token.length > 400) return null;
  const decoded = base64urlDecode(token);
  if (!decoded) return null;

  const parts = decoded.split('.');
  if (parts.length !== 3) return null;
  const [visitorId, tokenSiteId, mac] = parts;
  if (!VISITOR_ID_RE.test(visitorId)) return null;
  if (tokenSiteId !== siteId) return null; // not minted for this site — never cross-honor

  const expected = hmacHex(visitorId, siteId);
  // Constant-time compare — this is a signature check, not a plain
  // string equality, and both sides must be equal-length buffers of
  // the same encoding or timingSafeEqual throws; a length mismatch
  // just means "not a match" here, not an error worth surfacing.
  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return { visitorId };
}
