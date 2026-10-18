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
// signal: it survives across sessions/days on the same browser, unlike
// an IP+UA hash (which collapses everyone behind the same office
// NAT/VPN into "one visitor" and reclassifies the same real person as
// "new" the moment their IP or browser changes). If the client couldn't
// set that cookie-equivalent (storage blocked, private mode, bots that
// don't run JS fully), this route falls back to a one-way hash of
// IP + User-Agent so a visit still gets *a* visitorId rather than none.
// Either way, nothing reversible to the visitor's real IP is stored —
// the raw IP itself is never written to Firestore.
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
import type { AgentConfig } from '@/lib/agent';

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

    const { siteId, path, referrer, screen, lang, landing, sessionId, visitorId: clientVisitorId } = body || {};

    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      console.log('[track] reject: missing/invalid siteId. body was:', JSON.stringify(body).slice(0, 300));
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }

    console.log('[track] received beacon', { siteId, path, landing });

    // Abuse protection: cap beacons per IP+site. A tracking call still
    // always returns 200 (never surface an error to a visitor's page),
    // it just skips the Firestore write once the limit is hit.
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
    // /api/overlay-track and /api/overlay-notify). One cheap doc read
    // instead of a collection-group query; siteId is already
    // non-secret (it's pasted into the customer's public page).
    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;

    if (!uid) {
      console.log('[track] reject: unknown site — no siteIndex doc (or no uid field) for siteId:', siteId);
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

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

    // Prefer the persisted id the loader sent; fall back to a hash only
    // when it's missing or doesn't look like a real generated id.
    const visitorId =
      typeof clientVisitorId === 'string' && VISITOR_ID_RE.test(clientVisitorId)
        ? clientVisitorId
        : hashVisitor([ip, ua]);

    const [blockedSnap, agentSnap] = await Promise.all([
      siteRef.collection('blockedVisitors').doc(visitorId).get().catch(() => null),
      siteRef.collection('agent').doc('config').get().catch(() => null),
    ]);
    const isVisitorBlocked = !!(blockedSnap && blockedSnap.exists);

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

    // Per-visitor block takes priority in the reason reported to the
    // client (it's the more specific/intentional of the two), but
    // either one marks the visit doc as blocked for dashboard stats.
    const isBlocked = isVisitorBlocked || isCountryBlocked;
    const blockReason: 'visitor' | 'country' | null = isVisitorBlocked
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

    await writePromise;

    return NextResponse.json(
      { ok: true, blocked: isBlocked, blockReason },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[track] UNCAUGHT handler error:', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
