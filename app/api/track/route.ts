// app/api/track/route.ts
//
// Port of the original api/track.js Vercel function to a Next.js App
// Router Route Handler. Called by the sitevento tracking snippet
// (public/sitevento.js) on every page view of a connected site. Resolves the
// visitor's country from Vercel's geo headers, looks up whether the
// site is verified and whether this visitor is blocked, then writes a
// visit doc to:
//
//   users/{uid}/sites/{siteId}/visits/{autoId}
//
// The dashboard's onSnapshot listener on that collection picks the new
// doc up in real time.
//
// Deploy notes:
//   - Same Firebase Admin env vars as verify-site/route.ts
//     (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY).
//   - Designed to be called from the browser (sendBeacon/fetch with
//     keepalive), so CORS is wide open and the response is always 200 —
//     a tracking call should never surface an error to site visitors or
//     block page rendering.
//   - Does NOT require querying by meta-tag content; the client passes
//     the siteId straight through (non-sensitive site-routing info, not
//     a secret write credential — Firestore rules are bypassed via
//     Admin SDK here same as verify-site).

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getAdminDb() {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
  return getFirestore(app);
}

// Lightweight device classification from the UA string — good enough
// for the dashboard's "device" column without pulling in a parsing
// library.
function classifyDevice(ua: string) {
  if (!ua || typeof ua !== 'string') return 'Unknown device';
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return 'Tablet';
  if (/mobi|iphone|android/.test(s)) return 'Mobile';
  return 'Desktop';
}

// Simple string hash so repeat visitors (same IP + UA) collapse into
// the same visitorId for the "unique visitors" stat, without storing
// raw IPs in Firestore long-term (the hash is one-way and not
// reversible to the IP on its own).
function hashVisitor(parts: string[]) {
  const str = parts.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return 'v' + hash.toString(36);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  // A tracking call should never block or error out the visitor's page,
  // so every failure path below still returns 200 — the only thing
  // that matters to the client is "don't retry forever."
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, path, referrer } = body || {};

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

    // siteId alone doesn't tell us the owning uid. Sites live at
    // users/{uid}/sites/{siteId}, so resolve uid via a flat index doc
    // (siteIndex/{siteId} -> { uid }) written once at site-creation
    // time. One cheap doc read instead of a collection-group query;
    // siteId is already non-secret (it's pasted into the public <head>
    // of the customer's site as the meta tag's content).
    let uid: string | null = null;
    let siteSnap = null;

    const indexSnap = await db.collection('siteIndex').doc(siteId).get();
    if (indexSnap.exists) {
      uid = indexSnap.data()?.uid ?? null;
      if (uid) {
        const ref = db.collection('users').doc(uid).collection('sites').doc(siteId);
        siteSnap = await ref.get();
      }
    }

    if (!uid || !siteSnap || !siteSnap.exists) {
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
    // IP, so no external geo-IP API call (and no extra latency/cost) is
    // needed. Falls back gracefully off-Vercel.
    const country = req.headers.get('x-vercel-ip-country') || 'Unknown';
    const cityHeader = req.headers.get('x-vercel-ip-city');
    const city = cityHeader ? decodeURIComponent(cityHeader) : null;

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || '';
    const ua = req.headers.get('user-agent') || '';
    const visitorId = hashVisitor([ip, ua]);

    const blockedSnap = await db
      .collection('users')
      .doc(uid)
      .collection('sites')
      .doc(siteId)
      .collection('blockedVisitors')
      .doc(visitorId)
      .get()
      .catch(() => null);
    const isBlocked = !!(blockedSnap && blockedSnap.exists);

    const visitRef = db
      .collection('users')
      .doc(uid)
      .collection('sites')
      .doc(siteId)
      .collection('visits')
      .doc();
    await visitRef.set({
      ts: FieldValue.serverTimestamp(),
      path: typeof path === 'string' && path ? path.slice(0, 300) : '/',
      referrer: typeof referrer === 'string' && referrer ? referrer.slice(0, 300) : 'Direct',
      device: classifyDevice(ua),
      country,
      city,
      visitorId,
      blocked: isBlocked,
    });

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('track handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
