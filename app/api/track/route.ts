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
import { assertWidgetVisitsAllowed, pausedVisitWidgetResponse, WidgetVisitBlockedError } from '@/lib/serverAuth';
import type { AgentConfig } from '@/lib/agent';
import type { DeviceIndexEntry } from '@/lib/types';
import { getBotShieldConfig } from '@/lib/botShieldConfig';
import { applyBotShield } from '@/lib/botShieldEnforce';
import { lookupNetworkIntel } from '@/lib/ipIntel';
import { mintVisitorId, signVisitorToken, verifyVisitorToken, VISITOR_ID_RE, signSiteToken } from '@/lib/visitorIdentity';

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

// hashVisitor (the old one-way IP+UA fallback id) is gone — a brand-
// new, never-seen-before device signature now gets a real server-
// minted id via mintVisitorId() (lib/visitorIdentity.ts) instead of a
// non-reversible hash of IP+UA. That id is immediately remembered in
// deviceIndex (see the resolution block below) so this exact path is
// only ever taken once per device signature anyway — the old hash
// function added nothing a mint doesn't already cover, and collapsing
// it to one id-creation path (mintVisitorId) is what lets every
// visitorId in the system share one shape and one place it's defined.

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

// Two more low-entropy, already-available-for-free signals, used ONLY
// as extra visit-doc/visitorProfile columns for the owner's own
// review — deliberately NOT folded into buildDeviceSignature above.
// Reasoning: the device-recovery signature's whole job is matching the
// SAME real visitor across a storage clear, so every input it uses has
// to be something that reliably stays identical for one person across
// visits. Sec-CH-UA-Platform and Accept-Language mostly satisfy that,
// but widening an already-shipped, already-relied-upon hash function
// risks silently breaking recovery for every visitor who was already
// mid-way through being tracked by the OLD signature shape the moment
// this deploys (their next visit would hash differently and fail to
// match their own prior bucket). Showing them as separate dashboard
// columns gets the same practical benefit — richer context per visit —
// with zero risk to the existing recovery mechanism.
function resolveDeviceLabel(chUaPlatform: string | null, isMobileHint: boolean, classifiedDevice: string): string {
  // Client Hints, when present (Chromium-family only), are a more
  // direct signal than UA sniffing for "is this actually a phone" —
  // specifically closes the iPadOS-reports-as-desktop-Mac gap this
  // file's own header comment on classifyDevice already calls out as a
  // known limitation of UA-only parsing.
  if (isMobileHint && classifiedDevice === 'Desktop') return 'Mobile';
  return classifiedDevice;
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
  snapshot: {
    country: string;
    city: string | null;
    device: string;
    browser: string;
    os: string;
    blocked: boolean;
    // Extra fingerprint context — all optional/nullable, same "missing
    // means unknown, never a red flag" contract as the visit doc's own
    // fields above. networkOrg/networkSuspect come from
    // lib/ipIntel.ts and are ALREADY RESOLVED by the time this is
    // called (the caller awaits networkIntelPromise first) — this
    // function stays a plain Firestore transaction with no outbound
    // network call of its own inside it.
    region?: string | null;
    timezone?: string | null;
    networkOrg?: string | null;
    networkSuspect?: boolean;
  }
): Promise<void> {
  const profileRef = siteRef.collection('visitorProfiles').doc(visitorId);

  await db.runTransaction(async (tx) => {
    const [profileSnap, siteSnap] = await Promise.all([tx.get(profileRef), tx.get(siteRef)]);

    const networkFields: Record<string, unknown> = {};
    if (snapshot.region !== undefined) networkFields.region = snapshot.region;
    if (snapshot.timezone !== undefined) networkFields.timezone = snapshot.timezone;
    if (snapshot.networkOrg !== undefined) networkFields.networkOrg = snapshot.networkOrg;
    if (snapshot.networkSuspect !== undefined) networkFields.networkSuspect = snapshot.networkSuspect;

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
        ...networkFields,
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
      ...networkFields,
    });
  });
}

function clip(v: unknown, max: number): string {
  return typeof v === 'string' && v ? v.slice(0, max) : '';
}

// VISITOR_ID_RE is now defined once, in lib/visitorIdentity.ts
// (imported above), and reused here — same shape check as before
// (short, opaque, alphanumeric), just no longer duplicated between the
// two files that both need it (this route's legacy-id migration path,
// and that module's own token verification).

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

    const {
      siteId,
      path,
      referrer,
      screen,
      lang,
      landing,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      sessionId,
      // visitorToken — the signed token this server issued on a prior
      // beacon (see lib/visitorIdentity.ts); the primary, trusted
      // identity signal now. visitorId — a BARE id, only ever honored
      // as the one-release legacy-loader migration path described
      // above; never trusted on its own once a token is present.
      visitorToken: clientVisitorToken,
      visitorId: clientVisitorId,
      tz: clientTz,
      ackMessage,
      connectionType,
    } = body || {};

    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      console.log('[track] reject: missing/invalid siteId. body was:', JSON.stringify(body).slice(0, 300));
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }

    console.log('[track] received beacon', { siteId, path, landing });

    // Abuse protection: cap beacons per IP+site. A tracking call still
    // always returns 200 (never surface an error to a visitor's page).
    // This only guards against one IP hammering one site; the monthly
    // per-account visit allowance (checked below via
    // assertWidgetVisitsAllowed, right before the actual visit write)
    // is what skips the Firestore write once the owner's account-wide
    // limit (plus any wallet overage cover) is exhausted.
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
    // the owner's account-wide monthly visit allowance in the same
    // call — this visit doc is a real write (users/{uid}/sites/{siteId}
    // /visits/{autoId}), the same shape as a lead captured by
    // email-capture or overlay-notify, so it must be gated the same
    // hard-pause way those are, not left as a soft/uncapped signal.
    // Charged at count=1 — this beacon IS the unit the new model
    // counts (one page view = one visit), unlike the old token system
    // where it was priced via tokenCost('visitCheck').
    let resolved;
    try {
      resolved = await assertWidgetVisitsAllowed(db, siteId, 1);
    } catch (err) {
      if (err instanceof WidgetVisitBlockedError) {
        console.log('[track] reject: monthly visit limit reached for siteId:', siteId);
        return pausedVisitWidgetResponse(CORS_HEADERS);
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

    // ── Extra free signals, server-side ─────────────────────────────
    // Everything below comes either from Vercel's own edge-populated
    // geo headers (no external call, no extra latency) or from headers
    // the browser sends on every request anyway (no new client-side
    // code needed to produce them) — both genuinely free. Used for (a)
    // richer device-recovery signature material (see
    // buildDeviceSignature below, unchanged in shape but now fed a
    // slightly wider set of stable inputs where available) and (b)
    // extra columns on the visitor record for the owner's own review,
    // same spirit as country/city/device/browser/os already are.
    // Deliberately NOT exhaustive scraping of every header that
    // exists — only ones that are both stable (don't change
    // request-to-request for the same real visitor) and genuinely
    // informative; a header that's identical for every visitor adds
    // noise, not signal.
    const region = req.headers.get('x-vercel-ip-country-region') || null;
    const timezoneHeader = req.headers.get('x-vercel-ip-timezone') || null;
    const acceptLanguageHeader = req.headers.get('accept-language') || null;
    // Client Hints (Sec-CH-UA*) — only sent by Chromium-family
    // browsers that opt in; absent everywhere else (Safari, Firefox),
    // so every use of these must tolerate null, never require them.
    const chUaPlatform = (req.headers.get('sec-ch-ua-platform') || '').replace(/"/g, '') || null;
    const chUaMobile = req.headers.get('sec-ch-ua-mobile'); // "?1" / "?0" / null
    const isMobileHint = chUaMobile === '?1';

    const ip = callerIp !== 'unknown' ? callerIp : '';
    const ua = req.headers.get('user-agent') || '';

    // ── Visitor identity: resolved and OWNED by the server ──────────
    // See lib/visitorIdentity.ts's header for the full contract. In
    // order of trust:
    //
    //   1. visitorToken — a token THIS SERVER previously signed (via
    //      signVisitorToken, scoped to this exact siteId) and handed
    //      back on a prior beacon. verifyVisitorToken checks the HMAC
    //      itself, not just the shape of the id inside it, so a client
    //      can no longer simply assert an id by sending a well-formed-
    //      looking string — only a token this server actually minted
    //      ever resolves to an existing identity.
    //   2. clientVisitorId — a BARE id with no token, honored only as
    //      a one-release migration path for loaders cached/fetched
    //      before this change shipped (they still send the old
    //      client-generated `visitorId` field and have no token yet).
    //      Accepted at face value exactly once more, then immediately
    //      re-issued as a signed token in the response below so this
    //      branch is never needed again for that same visitor.
    //   3. Neither present/valid — same device-recovery-or-mint path
    //      as before, except the id is now ALWAYS signed before it's
    //      sent back, so a future beacon from this same browser
    //      arrives as a verified token instead of another bare guess.
    //
    // Every branch below converges on one outcome: `visitorId` is set,
    // and `visitorToken` (always computed further down, after
    // visitorId is final) is what actually goes in the response —
    // never the bare id by itself.
    const verifiedToken = verifyVisitorToken(clientVisitorToken, siteId);
    const clientHadValidLegacyId = typeof clientVisitorId === 'string' && VISITOR_ID_RE.test(clientVisitorId);

    let visitorId: string;

    if (verifiedToken) {
      visitorId = verifiedToken.visitorId;
    } else if (clientHadValidLegacyId) {
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
        // Same device as before, storage was cleared (or this is the
        // very first beacon from a brand-new loader build that never
        // had a chance to receive a token yet) — reuse their ORIGINAL
        // visitorId so this visit attaches to their existing history
        // instead of starting a new one.
        visitorId = recovered;
        deviceRef
          .set(
            { lastSeenAt: FieldValue.serverTimestamp(), recoveryCount: FieldValue.increment(1) },
            { merge: true }
          )
          .catch((err) => console.error('[track] deviceIndex recovery-count update failed:', err));
      } else {
        // First time we've ever seen this device signature for this
        // site (or the lookup itself failed) — mint a fresh, SERVER-
        // chosen id (see mintVisitorId; this is now the only place a
        // visitorId is ever created, client-side generation is gone)
        // and remember the signature so a FUTURE storage-cleared visit
        // from this same device can recover it.
        visitorId = mintVisitorId();
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

    // Signed on EVERY response now, not just the old "recovery"
    // special case — this is what makes the client's stored identity a
    // credential the server issued rather than something it invented.
    // The client overwrites its stored token with this value on every
    // beacon; a mismatch between what it sent and what comes back here
    // is harmless (just re-saves the same token when nothing changed).
    const visitorToken = signVisitorToken(visitorId, siteId);
    // Kept only for the old loader-build migration path above: a
    // client that sent a bare legacy id (no token at all yet) still
    // needs to know to start sending `visitorToken` on its NEXT
    // beacon. A client that already sent a valid token doesn't need
    // this — it already knows its own id was honored as-is — so this
    // stays undefined on that (now overwhelmingly common) path to keep
    // the response body small.
    const resolvedVisitorId = verifiedToken ? undefined : visitorId;

    const [blockedSnap, agentSnap, profileSnap] = await Promise.all([
      siteRef.collection('blockedVisitors').doc(visitorId).get().catch(() => null),
      siteRef.collection('agent').doc('config').get().catch(() => null),
      siteRef.collection('visitorProfiles').doc(visitorId).get().catch(() => null),
    ]);
    // A blockedVisitors doc now means one of two things (see
    // lib/botShieldEnforce.ts's header for the full shape): a
    // permanent block (no restrictedUntil field — manual or a SECURITY
    // BOT 'severe' verdict), or a time-boxed restriction
    // (restrictedUntil set — manual via doRestrictVisitor, or a
    // SECURITY BOT 'moderate' verdict). The doc existing is no longer
    // enough on its own: an EXPIRED restriction must stop blocking the
    // visitor the moment it lapses, same as hooks/useActiveSiteData.ts's
    // isRestricted() already treats it on the dashboard side — without
    // this check, every restriction would silently behave as a
    // permanent block forever, which defeats the whole point of
    // "restricted for 1 hour" having an end.
    const blockedData = blockedSnap && blockedSnap.exists ? blockedSnap.data() : null;
    const restrictedUntilTs = typeof blockedData?.restrictedUntil === 'number' ? blockedData.restrictedUntil : null;
    const isVisitorBlocked = !!blockedData && (restrictedUntilTs === null || restrictedUntilTs > Date.now());

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

    // ── Email-capture state, read back for the widget ────────────────
    // visitCount here is the value BEFORE this beacon's own upsert
    // (upsertVisitorProfile runs later, fire-and-forget, and increments
    // it for next time) — i.e. "how many visits this person had before
    // this one", which for a brand-new visitor (profileSnap didn't
    // exist yet) is 0. EmailCaptureWidget.tsx's "every 10 visits"
    // re-show check (count > 0 && count % 10 === 0) is written to treat
    // THIS visit as the Nth one, so this is deliberately bumped by 1 to
    // count the current page view rather than reporting last visit's
    // total — matching how visitThreshold's existing client-side
    // counter already treats "this page load" as incrementing the
    // count before checking it, not after.
    //
    // submitted is a plain server-asserted boolean, never a timestamp,
    // on purpose: the widget has no legitimate use for WHEN it
    // happened, only THAT it happened, and there's no reason to hand a
    // third-party embedding page's iframe more precision than it needs.
    const priorVisitCount = typeof profileData?.visitCount === 'number' ? profileData.visitCount : 0;
    const emailCapture = {
      visitCount: priorVisitCount + 1,
      submitted: !!profileData?.emailCaptureSubmittedAt,
    };

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

    // ── SECURITY BOT, Widget 1: Refresh & Click Shield ──────────────
    // Pageview side: 5 refreshes within 60s restricts the visitor for
    // 1 hour, 10 within 60s blocks instantly and permanently — see
    // lib/botShield.ts's BOT_SHIELD_THRESHOLDS/RESTRICT_DURATION_MS.
    // Only worth evaluating when the visitor isn't ALREADY blocked by
    // one of the two checks above — nothing to protect against on a
    // request that's already being turned away, and skipping it there
    // saves a transaction on every subsequent beacon from a visitor
    // who's already shut out. `landing === true` beacons are treated
    // as the 'pageview' kind here (a non-landing beacon on the same
    // page, e.g. an SPA route change sitevento.js also reports, is the
    // same signal for this purpose — a human only produces so many of
    // either per minute). The click side of this same widget is
    // app/api/click-track, not this route.
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
            thresholdOverrides: shieldConfig.thresholds,
            callerIp,
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

    const deviceLabel = resolveDeviceLabel(chUaPlatform, isMobileHint, classifyDevice(ua));

    // Network intel (hosting/proxy/mobile ASN flag) — see
    // lib/ipIntel.ts's header for the full contract. This is launched
    // here but NOT awaited before the visit write: it's for the
    // DASHBOARD'S display/context only at this call site (the
    // enforcement-relevant lookup already happened, synchronously,
    // inside applyBotShield above, scoped to the SECURITY BOT decision
    // itself). Delaying the visit write — the thing that makes a
    // pageview actually show up live — for a third-party network call
    // would violate this route's own "never add latency to the beacon
    // for a best-effort signal" rule. The result is merged into the
    // visitorProfile update below instead, once it resolves.
    const networkIntelPromise = callerIp && callerIp !== 'unknown' ? lookupNetworkIntel(callerIp).catch(() => null) : Promise.resolve(null);

    const visitRef = siteRef.collection('visits').doc();
    const writePromise = visitRef
      .set({
        ts: FieldValue.serverTimestamp(),
        path: clip(path, 300) || '/',
        referrer: clip(referrer, 300) || 'Direct',
        device: deviceLabel,
        browser: classifyBrowser(ua),
        os: classifyOS(ua),
        screen: clip(screen, 20) || null,
        lang: clip(lang, 20) || null,
        landing: landing === true,
        // UTM fields: clipped like every other client-sent string
        // field above, but deliberately stored as `null` rather than
        // omitted when absent (not `|| undefined`, since Firestore
        // drops undefined fields anyway but an explicit null makes
        // "we checked, there was none" queryable/filterable the same
        // way as every other optional Visit field already is).
        utmSource: clip(utmSource, 200) || null,
        utmMedium: clip(utmMedium, 200) || null,
        utmCampaign: clip(utmCampaign, 200) || null,
        utmTerm: clip(utmTerm, 200) || null,
        utmContent: clip(utmContent, 200) || null,
        sessionId: clip(sessionId, 60) || null,
        country,
        city,
        // Extra free server-side signals — see this file's "Extra free
        // signals, server-side" comment above. Every one of these is
        // allowed to be null/missing (off-Vercel, non-Chromium
        // browser, no Accept-Language sent) and the dashboard must
        // treat a missing value as "unknown", never as a falsy
        // red flag.
        region,
        timezone: timezoneHeader,
        acceptLanguage: clip(acceptLanguageHeader, 200) || null,
        platformHint: chUaPlatform,
        // Sent by the client straight from navigator.connection.type
        // where the browser supports the Network Information API
        // (Chromium-family only) — see lib/types.ts's Visit.connectionType
        // for the full contract. Free: no extra request, no extra write,
        // just one more field on the beacon the client already sends.
        connectionType: clip(connectionType, 20) || null,
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
    // Chained off networkIntelPromise (rather than starting a second,
    // unrelated await chain) so the profile upsert carries whatever
    // network-intel reading resolved in time, without ever blocking
    // the visit write itself (writePromise, awaited separately below,
    // does not depend on this at all).
    networkIntelPromise
      .then((intel) =>
        upsertVisitorProfile(db, siteRef, visitorId, {
          country,
          city,
          device: deviceLabel,
          browser: classifyBrowser(ua),
          os: classifyOS(ua),
          blocked: isBlocked,
          region,
          timezone: timezoneHeader,
          networkOrg: intel?.asOrg ?? null,
          networkSuspect: intel ? intel.hosting || intel.proxy : undefined,
        })
      )
      .catch((err) => {
        console.error('[track] visitorProfiles upsert FAILED for', siteRef.path, visitorId, err);
      });

    await writePromise;

    // The account-wide monthly visit counter was already
    // checked-and-incremented above, by assertWidgetVisitsAllowed,
    // BEFORE this write happened — not after the fact. That's what
    // makes the limit a real hard-pause for page views instead of
    // cosmetic bookkeeping.

    return NextResponse.json(
      // visitorToken: the signed credential for this visitor's id —
      // sent back on EVERY response (see lib/visitorIdentity.ts); the
      // client overwrites its stored token with this value every time,
      // unconditionally, so it always carries forward whatever the
      // server most recently confirmed. resolvedVisitorId is kept
      // alongside it only for the legacy-loader migration path (an old
      // cached bundle that doesn't know about visitorToken yet, but
      // does still read resolvedVisitorId to re-seed its own bare-id
      // storage) — a loader built after this change ignores it and
      // reads visitorToken instead.
      // visitId: the visits/{autoId} doc just written, handed back so
      // the client can later send ONE follow-up beacon
      // (app/api/visit-end) that patches THIS SAME doc with
      // scrollDepthPct/activeSeconds/validClicks on pagehide — see
      // that route's header and lib/types.ts's Visit engagement-summary
      // fields for the full contract. Never used for anything else;
      // not a visitor identity, just an opaque Firestore doc id.
      // visitorId is sent in the clear alongside visitorToken so the
      // client can resolve identity (and e.g. key its own localStorage
      // lookups, or feed it to widgets) without ever needing to decode
      // the token itself — the token is opaque to the client by
      // design; this plain field is what the loader is meant to read.
      // emailCapture: this visitor's server-tracked visit count (as of
      // THIS page view) and whether they've already submitted the
      // Email Capture widget on this site — see the comment above
      // priorVisitCount for the exact semantics. Forwarded into that
      // widget's #cfg hash by public/sitevento.js so its "never show
      // again once submitted" / "every 10 visits" logic is driven by
      // this server-side truth instead of a localStorage flag alone.
      // siteToken: signs the (siteId, uid) pair this route just
      // resolved above (`uid`, from assertWidgetVisitsAllowed) — see
      // lib/visitorIdentity.ts's "Site token" section for the full
      // contract. The client holds this for the rest of the page view
      // and echoes it on visit-end/heatmap-sample so THOSE routes can
      // skip their own siteIndex read entirely. Purely an
      // optimization: a client that never sends it back (old cached
      // loader, token expired) just means those routes fall back to
      // the siteIndex lookup they always did — nothing breaks either
      // way.
      { ok: true, blocked: isBlocked, blockReason, visitorId, visitorToken, resolvedVisitorId, pendingMessage, emailCapture, visitId: visitRef.id, siteToken: signSiteToken(siteId, uid) },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[track] UNCAUGHT handler error:', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
