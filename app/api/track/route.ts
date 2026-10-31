// app/api/track/route.ts
//
// Rebuilt from zero. Receives one POST per page view from
// public/sitevento.js (the loader embedded via the <meta name="sitevento">
// + <script data-site> install tag). For every visit it records:
//
//   - country + city        (derived server-side from Vercel's geo
//                             headers — never asked of / sent by the
//                             browser)
//   - device / browser / OS (parsed server-side from User-Agent)
//   - visitorId              a stable per-visitor id (see below) so the
//                             dashboard can tell "1 person, 5 views" from
//                             "5 different people"
//
// and writes it with the Firebase Admin SDK into
//   users/{uid}/sites/{siteId}/visits/{autoId}
// which is the exact path the dashboard's existing onSnapshot listener
// (hooks/useActiveSiteData.ts) already reads — so visits show up live,
// with no changes needed on the dashboard side.
//
// ── Enforcing blocks (visitor + country) ─────────────────────────────
// Two independent reasons a visitor can be blocked, both decided HERE,
// server-side, since this is the only place that already knows both
// the visitor's identity and their geo-derived country:
//   1. Per-visitor block — users/{uid}/sites/{siteId}/blockedVisitors/
//      {visitorId} (existing; was already computed into `isBlocked`
//      but never surfaced to the client).
//   2. Country block — the site's AI Agent config, at
//      users/{uid}/sites/{siteId}/agent/config (see lib/agent.ts's
//      AgentConfig). Only enforced when `active` is true AND
//      'country-block' is in `enabledFeatureIds` (the feature's own
//      on/off switch; blockedCountries alone doesn't mean enforce).
// Either reason sets `blocked: true` on the visit doc (as before) and
// now ALSO returns a `blocked`/`blockReason` pair in the JSON response
// so public/sitevento.js can show the full-screen block banner. This
// route still always answers 200 with CORS wide open — a block is
// communicated in the body, never via HTTP status, so it can't look
// like a network failure to the embedded script.
//
// ── Identifying "the same visitor" ─────────────────────────────────
// The loader generates a random id and stores it in the visitor's own
// localStorage (sv_vid), sending it on every call. That's the primary
// signal: it survives across sessions/days on the same browser.
//
// DURABLE RECOGNITION (device recovery): when the client sends NO
// usable visitorId — because localStorage was cleared, storage is
// blocked, or this is private browsing — this route no longer treats
// that visitor as unrecoverable. It builds a coarse deviceSignature
// (IP /24 + OS family + browser family/major version + language +
// timezone offset — see buildDeviceSignature below) and looks it up in
// users/{uid}/sites/{siteId}/deviceIndex/{deviceSignature}. If that
// signature was seen before, the visitor's ORIGINAL visitorId is
// reused (and returned to the client as resolvedVisitorId, so the
// loader re-seeds its own storage) instead of minting a new one — so a
// storage clear no longer fragments one real person into multiple
// "visitors" or silently merges them into a stranger. First time a
// signature is seen, a fresh id is minted exactly as before and the
// signature is remembered for next time. A client that DID send a
// valid visitorId skips all of this and is trusted as-is. Either way,
// nothing reversible to the visitor's real IP is stored — the raw IP
// itself is never written to Firestore, only its /24 inside the
// one-way signature hash.
//
// ── Contract ─────────────────────────────────────────────────────────
// This is called via sendBeacon/fetch-keepalive from arbitrary
// third-party pages: CORS is wide open and this ALWAYS returns 200,
// even on a bad payload or an unknown site. A tracking call must never
// surface an error to a site visitor or block the host page.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { assertWidgetWriteAllowed, pausedWidgetResponse, WidgetWriteBlockedError } from '@/lib/serverAuth';
import type { AgentConfig } from '@/lib/agent';
import type { DeviceIndexEntry } from '@/lib/types';
import { getBotShieldConfig } from '@/lib/botShieldConfig';
import { applyBotShield } from '@/lib/botShieldEnforce';

export const maxDuration = 10;
export const runtime = 'nodejs';

// Forces this route to run per-request rather than being eligible for
// Next's static-optimization path. Without this, a Route Handler that
// reads nothing from the request — which OPTIONS below doesn't — can
// get its response frozen into a single cached response at build time,
// including whatever CORS headers were (or weren't) wired up at that
// moment. A stale/incomplete cached OPTIONS response has no
// Access-Control-Allow-* headers for the browser to approve the real
// POST against, so every preflight across every embedding site fails
// and the browser silently drops the follow-up POST — sendBeacon and
// fetch().catch() both swallow that failure client-side, so nothing
// here ever looks broken even though no beacon is ever recorded. This
// is the single most likely explanation for "nothing ever tracks."
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

// Keep the body small — this is a beacon, not a file upload. Guards
// against a malformed/malicious client sending megabytes of junk.
const MAX_BODY_BYTES = 8 * 1024;

// ── User-Agent parsing ───────────────────────────────────────────────
// Hand-rolled on purpose — this only needs to be "good enough for a
// dashboard column", not a full UA database. Order matters: Edge/Opera
// both contain "Chrome" in their UA string, so Edge/Opera are checked
// first. Known gap: iPadOS 13+ reports as a desktop Mac UA by default
// and will show as "Desktop" here — detecting that reliably needs a
// client-side signal (navigator.maxTouchPoints) this server-only parser
// doesn't have access to.

function classifyDevice(ua: string): string {
  if (!ua) return 'Unknown device';
  const s = ua.toLowerCase();
  if (/ipad|tablet(?!.*mobile)/.test(s)) return 'Tablet';
  if (/mobi|iphone|android.*mobile|windows phone/.test(s)) return 'Mobile';
  return 'Desktop';
}

function classifyBrowser(ua: string): string {
  if (!ua) return 'Unknown';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/crios\//i.test(ua)) return 'Chrome';
  if (/fxios\//i.test(ua)) return 'Firefox';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua) && /version\//i.test(ua)) return 'Safari';
  if (/msie|trident/i.test(ua)) return 'Internet Explorer';
  return 'Unknown';
}

function classifyOS(ua: string): string {
  if (!ua) return 'Unknown';
  if (/windows nt/i.test(ua)) return 'Windows';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

// One-way fallback id when the client has no persisted visitorId to
// send (storage blocked, first beacon racing localStorage, etc). Not
// reversible to the IP alone; same IP+UA pair always collapses to the
// same fallback id so a burst of views without JS storage still groups
// as one visitor rather than many.
function hashVisitor(parts: string[]): string {
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return 'h' + hash.toString(36);
}

// ── Durable device recognition ──────────────────────────────────────
// Goal: when a visitor's localStorage gets cleared (so the loader sends
// NO visitorId at all, not even a stale one), still recognize them as
// the SAME visitor they were before — rather than either (a) minting a
// brand-new visitorId, which inflates "new visitor" counts and loses
// their history, or (b) the old hashVisitor(ip, ua) fallback, which
// collapses every visitor behind one office NAT/VPN into a single
// "visitor" and reclassifies a real person as "new" the instant their
// ISP rotates their IP.
//
// This is deliberately coarse, not a fingerprint: it combines a handful
// of LOW-entropy, already-available signals into a bucket key, then
// uses that bucket only as a lookup into deviceIndex (see
// DeviceIndexEntry in lib/types.ts) to recover the visitor's ORIGINAL
// visitorId — it is never itself stored or shown as the visitorId. No
// canvas/WebGL/audio fingerprinting, no new client-side collection: IP
// is truncated to its /24 (so a dynamic IP reassigned within the same
// ISP block still matches), and the UA is reduced to OS + browser
// family + major version (so a browser point-release doesn't break the
// match) rather than the full UA string.
//
// This is a RECOVERY path only — it runs exclusively when the client
// sent no usable visitorId. A client that still has its id (the common
// case) is never routed through this at all, so this can't merge two
// genuinely different people who happen to share a signature as long as
// either one still has their original id.
function classifyOSFamily(ua: string): string {
  const s = ua.toLowerCase();
  if (/windows nt/.test(s)) return 'win';
  if (/iphone|ipad|ipod/.test(s)) return 'ios';
  if (/mac os x/.test(s)) return 'mac';
  if (/android/.test(s)) return 'android';
  if (/cros/.test(s)) return 'cros';
  if (/linux/.test(s)) return 'linux';
  return 'unk';
}

function classifyBrowserMajor(ua: string): string {
  // Major version only (e.g. "chrome131") — a patch update to the same
  // browser must not break the match, but a different browser, or a
  // many-version-old one (different device/reinstall), should.
  const patterns: Array<[RegExp, string]> = [
    [/edg\/(\d+)/i, 'edge'],
    [/opr\/(\d+)/i, 'opera'],
    [/crios\/(\d+)/i, 'chrome'],
    [/fxios\/(\d+)/i, 'firefox'],
    [/firefox\/(\d+)/i, 'firefox'],
    [/chrome\/(\d+)/i, 'chrome'],
    [/version\/(\d+).*safari/i, 'safari'],
  ];
  for (const [re, name] of patterns) {
    const m = ua.match(re);
    if (m) return name + m[1];
  }
  return 'unk';
}

// /24 for IPv4 (zero the last octet); /48-ish grouping for IPv6 (keep
// the first 3 hextets) — both intentionally coarse so a single visitor
// bouncing between nearby addresses in the same allocation still
// matches, at the cost of also grouping other nearby devices. That's
// an accepted trade: this signature is a recovery hint, not an
// identity by itself, and only ever resolves to a visitorId that was
// ALREADY seen from that same bucket before.
function coarsenIp(ip: string): string {
  if (!ip) return '';
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return parts.slice(0, 3).join(':') + '::/48';
  }
  const octets = ip.split('.');
  if (octets.length === 4) {
    octets[3] = '0';
    return octets.join('.') + '/24';
  }
  return ip;
}

function hashDeviceSignature(parts: string[]): string {
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  // Run it twice with a different seed mixed in to widen the effective
  // keyspace a bit beyond a single 32-bit hash, since this doubles as a
  // Firestore document id and collisions here would silently merge two
  // unrelated visitors.
  let hash2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    hash2 = (hash2 * 33 + str.charCodeAt(i)) >>> 0;
  }
  return 'd' + hash.toString(36) + hash2.toString(36);
}

function buildDeviceSignature(opts: { ip: string; ua: string; lang: string; tzOffset: string }): string {
  return hashDeviceSignature([
    coarsenIp(opts.ip),
    classifyOSFamily(opts.ua),
    classifyBrowserMajor(opts.ua),
    clip(opts.lang, 10).toLowerCase(),
    opts.tzOffset,
  ]);
}

// ── Unique-visitor profiles (powers /dashboard/users) ────────────────
// A `visits` doc is written per PAGE VIEW — the same person generates
// many of them. This maintains exactly one roll-up doc per UNIQUE
// visitorId, in users/{uid}/sites/{siteId}/visitorProfiles/{visitorId}
// (see VisitorProfile in lib/types.ts), so the Users page can list
// unique people directly instead of deriving them by grouping/deduping
// the visits collection on every load.
//
// `number` ("User #N") is assigned exactly once, inside a transaction
// against the site doc's own nextVisitorNumber counter, so two beacons
// from two different brand-new visitors arriving in the same instant
// can never be handed the same number — the transaction forces one of
// them to retry against the now-incremented counter. An EXISTING
// profile is only ever updated (lastSeenAt, visitCount, latest
// geo/device snapshot), never renumbered.
//
// Fire-and-forget, same as the stats.totalVisits increment right below
// where this is called: never awaited beyond kicking it off, and any
// failure here must not affect the beacon's 200 response or delay it.
async function upsertVisitorProfile(
  db: FirebaseFirestore.Firestore,
  siteRef: FirebaseFirestore.DocumentReference,
  visitorId: string,
  snapshot: { country: string; city: string | null; device: string; browser: string; os: string; blocked: boolean }
): Promise<void> {
  const profileRef = siteRef.collection('visitorProfiles').doc(visitorId);

  await db.runTransaction(async (tx) => {
    const [profileSnap, siteSnap] = await Promise.all([tx.get(profileRef), tx.get(siteRef)]);

    if (profileSnap.exists) {
      // Returning visitor (by this same unique id) — update the
      // rolling fields only. Never touch `number`, `firstSeenAt`, or
      // `blocked`/`deletedAt` here: those are owned by, respectively,
      // this doc's own history, its creation, and the dedicated
      // block/restrict/delete actions in app/api/user-action — a
      // tracking beacon must never silently un-delete or un-block a
      // visitor the owner acted on.
      tx.update(profileRef, {
        lastSeenAt: FieldValue.serverTimestamp(),
        visitCount: FieldValue.increment(1),
        country: snapshot.country,
        city: snapshot.city,
        device: snapshot.device,
        browser: snapshot.browser,
        os: snapshot.os,
      });
      return;
    }

    // Brand-new unique visitor for this site — claim the next number
    // atomically off the site doc, inside this same transaction, so a
    // concurrent first-visit from someone else can't collide with it.
    const currentNext = (siteSnap.exists && typeof siteSnap.data()?.nextVisitorNumber === 'number')
      ? (siteSnap.data()!.nextVisitorNumber as number)
      : 1;
    tx.set(siteRef, { nextVisitorNumber: currentNext + 1 }, { merge: true });
    tx.set(profileRef, {
      visitorId,
      number: currentNext,
      country: snapshot.country,
      city: snapshot.city,
      device: snapshot.device,
      browser: snapshot.browser,
      os: snapshot.os,
      firstSeenAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
      visitCount: 1,
      blocked: snapshot.blocked,
    });
  });
}

function clip(v: unknown, max: number): string {
  return typeof v === 'string' && v ? v.slice(0, max) : '';
}

// A client-supplied visitorId must look like the id the loader actually
// generates (see public/sitevento.js) — short, opaque, alphanumeric.
// Anything else is ignored and the server falls back to the IP+UA hash,
// so a malicious caller can't inject an arbitrary string to pose as a
// specific existing visitor.
const VISITOR_ID_RE = /^v[a-z0-9]{6,40}$/i;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    // Reject oversized bodies before even parsing JSON.
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, reason: 'payload too large' }, { status: 200, headers: CORS_HEADERS });
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      console.log('[track] reject: payload too large', raw.length);
      return NextResponse.json({ ok: false, reason: 'payload too large' }, { status: 200, headers: CORS_HEADERS });
    }

    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch {
      console.log('[track] reject: invalid json, raw head:', raw.slice(0, 120));
      return NextResponse.json({ ok: false, reason: 'invalid json' }, { status: 200, headers: CORS_HEADERS });
    }

    const { siteId, path, referrer, screen, lang, landing, sessionId, visitorId: clientVisitorId, tz: clientTz, ackMessage } = body || {};

    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      console.log('[track] reject: missing/invalid siteId. body was:', JSON.stringify(body).slice(0, 300));
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }

    console.log('[track] received beacon', { siteId, path, landing });

    // Abuse protection: cap beacons per IP+site. A tracking call still
    // always returns 200 (never surface an error to a visitor's page).
    // This only guards against one IP hammering one site; the daily
    // per-account write cap (checked below via assertWidgetWriteAllowed,
    // right before the actual visit write) is what skips the Firestore
    // write once the owner's account-wide limit is hit.
    const forwardedForHeader = req.headers.get('x-forwarded-for') || '';
    const callerIp = forwardedForHeader.split(',')[0].trim() || 'unknown';
    if (!allow(`track:${siteId}:${callerIp}`, 120, 60_000)) {
      console.log('[track] reject: rate limited', { siteId, callerIp });
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      // If this fires, the Admin SDK itself never initialized — almost
      // always missing/malformed FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL
      // / FIREBASE_PRIVATE_KEY in the deployment's env vars. Every beacon
      // would hit this same branch and nothing would ever reach Firestore,
      // while the client still only ever sees a 200.
      console.error('[track] FIREBASE ADMIN INIT FAILED — check FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars:', err);
      return NextResponse.json(
        { ok: false, reason: 'server not configured' },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // siteId alone doesn't tell us the owning uid — resolve via the
    // flat siteIndex/{siteId} doc (written once at site-creation time
    // in hooks/useConnectSiteWizard.ts, and relied on the same way by
    // /api/overlay-track and /api/overlay-notify), AND atomically check
    // the owner's account-wide daily write cap in the same call — this
    // visit doc is a real write (users/{uid}/sites/{siteId}/visits/
    // {autoId}), the same shape as a lead captured by email-capture or
    // overlay-notify, so it must be gated the same hard-pause way those
    // are, not left as a soft/uncapped signal.
    let resolved;
    try {
      resolved = await assertWidgetWriteAllowed(db, siteId);
    } catch (err) {
      if (err instanceof WidgetWriteBlockedError) {
        console.log('[track] reject: daily write limit reached for siteId:', siteId);
        return pausedWidgetResponse(CORS_HEADERS);
      }
      throw err;
    }
    if (!resolved) {
      console.log('[track] reject: unknown site — no siteIndex doc (or no uid field) for siteId:', siteId);
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }
    const { uid } = resolved;

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      console.log('[track] reject: unknown site — siteIndex pointed to uid', uid, 'but users/{uid}/sites/{siteId} doc missing for siteId:', siteId);
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

    const site = siteSnap.data()!;
    if (site.status !== 'verified') {
      // Don't log traffic for unverified sites — avoids a race where
      // someone pastes another account's tag before it's confirmed
      // theirs.
      console.log('[track] reject: site not verified. siteId:', siteId, 'status:', site.status);
      return NextResponse.json(
        { ok: false, reason: 'site not verified' },
        { status: 200, headers: CORS_HEADERS }
      );
    }
    if (site.paused === true) {
      // Owner-level pause (components/dashboard/SiteManagePage.tsx ->
      // hooks/useSites.ts's pauseSite) — distinct from verification.
      // A paused site keeps its tag installed and its history intact,
      // it just stops accumulating new visits until resumed.
      console.log('[track] reject: site paused. siteId:', siteId);
      return NextResponse.json(
        { ok: false, reason: 'site paused' },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Vercel populates these geo headers at the edge from the request
    // IP — no external geo-IP API call (and no extra latency/cost)
    // needed. Falls back gracefully off-Vercel (local dev, other hosts).
    const country = req.headers.get('x-vercel-ip-country') || 'Unknown';
    const cityHeader = req.headers.get('x-vercel-ip-city');
    const city = cityHeader ? decodeURIComponent(cityHeader) : null;

    const ip = callerIp !== 'unknown' ? callerIp : '';
    const ua = req.headers.get('user-agent') || '';

    // Prefer the persisted id the loader sent. Only when it's missing
    // or malformed do we go through device recovery below — a client
    // that still has its own id is trusted as-is and never touches
    // deviceIndex at all.
    const clientHadValidId = typeof clientVisitorId === 'string' && VISITOR_ID_RE.test(clientVisitorId);

    let visitorId: string;
    // Set only when we recovered a DIFFERENT id than the client sent
    // (i.e. the client had none), so the loader knows to re-seed its
    // own storage. Left undefined on the normal path to keep the
    // response body tiny for the overwhelming majority of beacons.
    let resolvedVisitorId: string | undefined;

    if (clientHadValidId) {
      visitorId = clientVisitorId;
    } else {
      const deviceSignature = buildDeviceSignature({ ip, ua, lang: clip(lang, 20), tzOffset: clip(clientTz, 10) });
      const deviceRef = siteRef.collection('deviceIndex').doc(deviceSignature);
      let recovered: string | null = null;
      try {
        const deviceSnap = await deviceRef.get();
        if (deviceSnap.exists) {
          const entry = deviceSnap.data() as DeviceIndexEntry;
          if (entry && typeof entry.visitorId === 'string' && VISITOR_ID_RE.test(entry.visitorId)) {
            recovered = entry.visitorId;
          }
        }
      } catch (err) {
        console.error('[track] deviceIndex lookup failed, falling back to legacy hash:', err);
      }

      if (recovered) {
        // Same device as before, storage was cleared — reuse their
        // ORIGINAL visitorId so this visit attaches to their existing
        // history instead of starting a new one.
        visitorId = recovered;
        resolvedVisitorId = recovered;
        deviceRef
          .set(
            { lastSeenAt: FieldValue.serverTimestamp(), recoveryCount: FieldValue.increment(1) },
            { merge: true }
          )
          .catch((err) => console.error('[track] deviceIndex recovery-count update failed:', err));
      } else {
        // First time we've ever seen this device signature for this
        // site (or the lookup itself failed) — mint a fresh id exactly
        // as before, and remember the signature so a FUTURE
        // storage-cleared visit from this same device can recover it.
        visitorId = hashVisitor([ip, ua]);
        deviceRef
          .set({
            visitorId,
            firstSeenAt: FieldValue.serverTimestamp(),
            lastSeenAt: FieldValue.serverTimestamp(),
            recoveryCount: 0,
          })
          .catch((err) => console.error('[track] deviceIndex write failed:', err));
      }
    }

    const [blockedSnap, agentSnap, profileSnap] = await Promise.all([
      siteRef.collection('blockedVisitors').doc(visitorId).get().catch(() => null),
      siteRef.collection('agent').doc('config').get().catch(() => null),
      siteRef.collection('visitorProfiles').doc(visitorId).get().catch(() => null),
    ]);
    const isVisitorBlocked = !!(blockedSnap && blockedSnap.exists);

    // ── Pending direct message (Users page "Message" quick action) ──
    // See VisitorMessage in lib/types.ts. At most one pending message
    // per visitor; delivered unread exactly once in the response body
    // below, then the VISITOR'S browser acks it on a later beacon
    // (ackMessage === sentAt, handled further down) so a refresh or a
    // second tab doesn't show the same popup forever. A message
    // already marked read (readAt set) is never re-sent — same
    // "shown once" contract as the promo overlay's `reshow: 'once'`.
    const profileData = profileSnap && profileSnap.exists ? profileSnap.data() : null;
    const pendingMessage =
      profileData && profileData.pendingMessage && !profileData.pendingMessage.readAt
        ? profileData.pendingMessage
        : null;

    // A visitor's own browser reports having shown a message back to
    // us via ackMessage: <that message's sentAt>. Only accept the ack
    // if it matches the sentAt we actually have on file right now —
    // guards against a stale/replayed beacon (e.g. a cached service
    // worker retry) clearing a DIFFERENT, newer message than the one
    // the visitor actually saw. Fire-and-forget, same treatment as the
    // stats increment/profile upsert below: must never slow down or
    // fail the beacon itself.
    if (
      typeof ackMessage === 'number' &&
      profileData &&
      profileData.pendingMessage &&
      profileData.pendingMessage.sentAt === ackMessage &&
      !profileData.pendingMessage.readAt
    ) {
      siteRef
        .collection('visitorProfiles')
        .doc(visitorId)
        .set({ pendingMessage: { ...profileData.pendingMessage, readAt: Date.now() } }, { merge: true })
        .catch((err) => console.error('[track] message ack write FAILED for', siteRef.path, visitorId, err));
    }

    // Country-block is only live when the agent's master switch is on
    // AND the 'country-block' feature is in enabledFeatureIds — matches
    // the same gating lib/agent.ts's AgentConfig and the dashboard UI
    // already apply; a saved-but-disabled blockedCountries list must
    // never silently start blocking visitors.
    const agentConfig = (agentSnap && agentSnap.exists ? agentSnap.data() : null) as AgentConfig | null;
    const isCountryBlocked = !!(
      agentConfig &&
      agentConfig.active &&
      Array.isArray(agentConfig.enabledFeatureIds) &&
      agentConfig.enabledFeatureIds.includes('country-block') &&
      Array.isArray(agentConfig.blockedCountries) &&
      agentConfig.blockedCountries.includes(country)
    );

    // ── Bot Shield, Widget 1: Refresh & Click Shield ────────────────
    // Only worth evaluating when the visitor isn't ALREADY blocked by
    // one of the two checks above — nothing to protect against on a
    // request that's already being turned away, and skipping it there
    // saves a transaction on every subsequent beacon from a visitor
    // who's already shut out. `landing === true` beacons are treated
    // as the 'pageview' kind here (a non-landing beacon on the same
    // page, e.g. an SPA route change sitevento.js also reports, is the
    // same signal for this purpose — a human only produces so many of
    // either per minute).
    let shieldBlockedJustNow = false;
    if (!isVisitorBlocked && !isCountryBlocked) {
      try {
        const shieldConfig = await getBotShieldConfig(db, siteRef);
        if (shieldConfig.refreshShieldEnabled) {
          const shieldResult = await applyBotShield({
            db,
            siteRef,
            subjectId: visitorId,
            isRealVisitorId: true,
            kind: 'pageview',
            enabled: true,
          });
          shieldBlockedJustNow = shieldResult.blocked;
        }
      } catch (err) {
        // Same "never let infra trouble fail a visitor's beacon"
        // principle as every other best-effort step in this route —
        // a Bot Shield hiccup should degrade to "not blocked this
        // time", never to an error surfaced to the visitor's page.
        console.error('[track] bot shield evaluation failed', err);
      }
    }

    // Per-visitor block takes priority in the reason reported to the
    // client (it's the more specific/intentional of the two pre-
    // existing reasons), but any of the three marks the visit doc as
    // blocked for dashboard stats. A Bot Shield block reports as
    // 'visitor' to the client/dashboard — it IS a per-visitor block,
    // just one Bot Shield created instead of the owner clicking
    // "Block" by hand; app/api/block-visitor's UI and this route's own
    // isVisitorBlocked check already treat every blockedVisitors doc
    // identically regardless of who/what created it.
    const isBlocked = isVisitorBlocked || isCountryBlocked || shieldBlockedJustNow;
    const blockReason: 'visitor' | 'country' | null = isVisitorBlocked || shieldBlockedJustNow
      ? 'visitor'
      : isCountryBlocked
        ? 'country'
        : null;

    const visitRef = siteRef.collection('visits').doc();
    const writePromise = visitRef
      .set({
        ts: FieldValue.serverTimestamp(),
        path: clip(path, 300) || '/',
        referrer: clip(referrer, 300) || 'Direct',
        device: classifyDevice(ua),
        browser: classifyBrowser(ua),
        os: classifyOS(ua),
        screen: clip(screen, 20) || null,
        lang: clip(lang, 20) || null,
        landing: landing === true,
        sessionId: clip(sessionId, 60) || null,
        country,
        city,
        visitorId,
        blocked: isBlocked,
      })
      .then(() => {
        console.log('[track] visit doc written OK:', visitRef.path);
      })
      .catch((err) => {
        // If this fires, every prior check passed (known site, verified,
        // not paused) but the actual Firestore write failed — almost
        // always an Admin SDK service-account permissions issue, not a
        // logic bug in this route.
        console.error('[track] VISIT WRITE FAILED for', visitRef.path, err);
      });

    // Fire-and-forget aggregate counters, so the dashboard can show
    // totals without summing every visit document. Never awaited beyond
    // this call — a failure here must not affect the 200 the client
    // already gets, and must not delay the response.
    siteRef
      .update({
        lastSeenAt: FieldValue.serverTimestamp(),
        'stats.totalVisits': FieldValue.increment(1),
      })
      .then(() => {
        console.log('[track] stats.totalVisits incremented OK for', siteRef.path);
      })
      .catch((err) => {
        console.error('[track] STATS INCREMENT FAILED for', siteRef.path, err);
      });

    // Keeps users/{uid}/sites/{siteId}/visitorProfiles/{visitorId} in
    // sync — see upsertVisitorProfile's header comment. Same
    // fire-and-forget treatment as the stats increment above: the
    // Users page is driven entirely off this collection, but a hiccup
    // here must never slow down or fail the visitor's own beacon.
    upsertVisitorProfile(db, siteRef, visitorId, { country, city, device: classifyDevice(ua), browser: classifyBrowser(ua), os: classifyOS(ua), blocked: isBlocked }).catch(
      (err) => {
        console.error('[track] visitorProfiles upsert FAILED for', siteRef.path, visitorId, err);
      }
    );

    await writePromise;

    // The account-wide daily write counter was already
    // checked-and-incremented above, by assertWidgetWriteAllowed,
    // BEFORE this write happened — not after the fact. That's what
    // makes the limit a real hard-pause for page views instead of
    // cosmetic bookkeeping.

    return NextResponse.json(
      { ok: true, blocked: isBlocked, blockReason, resolvedVisitorId, pendingMessage },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[track] UNCAUGHT handler error:', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
