// app/api/track/route.ts
//
// Receives one beacon per page view from the sitevento tracking snippet
// (public/sitevento.js). Rebuilt from the original version to capture a
// fuller per-visit log while staying privacy-conscious: everything
// network/UA-sensitive is derived server-side (geo headers, User-Agent
// parsing) so the client script never has to read or ship anything
// identifying beyond what the browser already exposes to any page
// (viewport size, language) — no fingerprinting libraries, no
// third-party geo-IP calls, no cookies.
//
// Writes to users/{uid}/sites/{siteId}/visits/{autoId}. The dashboard's
// live onSnapshot listener on that collection picks the new doc up
// immediately — no polling.
//
// Deploy notes (unchanged from before):
//   - Same Firebase Admin env vars as verify-site/route.ts
//     (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).
//   - Called via sendBeacon/fetch-keepalive from third-party pages, so
//     CORS is wide open and the response is always 200 — a tracking
//     call must never surface an error to a site visitor or block page
//     rendering.
//   - siteId is resolved to an owning uid via the flat siteIndex/{siteId}
//     index doc (same as before), then the site doc's `status` gates
//     whether traffic is logged at all.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── User-Agent parsing ─────────────────────────────────────────────
// Deliberately hand-rolled rather than a dependency: this only needs to
// be "good enough for a dashboard column", checked in an order that
// gets the common ambiguous cases right (Edge/Opera/Chrome share
// "Chrome" in their UA string; iPadOS 13+ reports as Mac).

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
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/crios\//i.test(ua)) return 'Chrome';
  if (/fxios\//i.test(ua)) return 'Firefox';
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

// Repeat-visitor collapsing (same IP + UA -> same visitorId), without
// storing raw IPs long-term. One-way, non-reversible to the IP alone.
function hashVisitor(parts: string[]): string {
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return 'v' + hash.toString(36);
}

function clip(v: unknown, max: number): string {
  return typeof v === 'string' && v ? v.slice(0, max) : '';
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  // A tracking call should never block or error out the visitor's page —
  // every failure path below still returns 200. The only thing that
  // matters to the client is "don't retry forever."
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, path, referrer, screen, lang, landing, sessionId } = body || {};

    if (!siteId || typeof siteId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('Firebase Admin init error', err);
      return NextResponse.json(
        { ok: false, reason: 'server not configured' },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // siteId alone doesn't tell us the owning uid — resolve via the
    // flat siteIndex/{siteId} doc written once at site-creation time.
    // One cheap doc read instead of a collection-group query; siteId is
    // already non-secret (it's pasted into the customer's public page).
    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;

    if (!uid) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

    const site = siteSnap.data()!;
    if (site.status !== 'verified') {
      // Don't log traffic for unverified sites — avoids a race where
      // someone pastes another account's tag before it's confirmed
      // theirs.
      return NextResponse.json(
        { ok: false, reason: 'site not verified' },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Vercel populates these geo headers at the edge from the request
    // IP — no external geo-IP API call (and no extra latency/cost)
    // needed. Falls back gracefully off-Vercel.
    const country = req.headers.get('x-vercel-ip-country') || 'Unknown';
    const cityHeader = req.headers.get('x-vercel-ip-city');
    const city = cityHeader ? decodeURIComponent(cityHeader) : null;

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || '';
    const ua = req.headers.get('user-agent') || '';
    const visitorId = hashVisitor([ip, ua]);

    const blockedSnap = await siteRef
      .collection('blockedVisitors')
      .doc(visitorId)
      .get()
      .catch(() => null);
    const isBlocked = !!(blockedSnap && blockedSnap.exists);

    const visitRef = siteRef.collection('visits').doc();
    await visitRef.set({
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
    });

    // Fire-and-forget: bump the site's lastSeenAt so a future "active
    // sites" view could sort by recent traffic without scanning visits.
    // Never awaited beyond this call, and failure here must not affect
    // the 200 the client already gets.
    siteRef.update({ lastSeenAt: FieldValue.serverTimestamp() }).catch(() => {});

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('track handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
