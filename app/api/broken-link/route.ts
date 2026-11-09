// app/api/broken-link/route.ts
//
// POST { siteId, visitorId, href, fromPath }
//
// Fired by public/sitevento.js's checkPendingBrokenLink — at most once
// per click, and only for a same-site link whose destination never
// showed up as a real page view within BROKEN_LINK_TIMEOUT_MS (4s).
// See that function's own header for the full mechanics and, more
// importantly, this feature's HONEST SCOPE: this is "a click that
// didn't visibly lead anywhere", not a server-side HTTP 404 — the
// script has no way to see a status code for a page that already
// finished loading before it ran. Anything built on top of this data
// (the problem detector, a dashboard list, etc.) must describe it that
// way and never claim "detected a 404".
//
// Writes into a capped per-site `brokenLinks` subcollection, one doc
// per distinct href observed — repeat reports for the SAME href
// increment a counter on the existing doc rather than creating a new
// doc per click, so a genuinely broken nav link doesn't flood the
// collection just because many visitors hit it. This keeps the write
// volume proportional to DISTINCT broken links, not total broken
// clicks, which is the number an owner actually wants to see anyway.
//
// Carries no usage charge of its own under the visit model — same
// posture as every other post-pageview beacon route in this app
// (email-capture, overlay-notify, appointment-booking, visit-end): the
// visit was already counted by the pageview beacon (/api/track) that
// preceded it.
//
// Same always-200 / CORS-open / fail-open contract as every other
// visitor-facing beacon route in this app.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { allow } from '@/lib/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const MAX_BODY_BYTES = 2 * 1024;
const VISITOR_ID_RE = /^v[a-z0-9]{6,40}$/i;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, reason: 'payload too large' }, { status: 200, headers: CORS_HEADERS });
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, reason: 'payload too large' }, { status: 200, headers: CORS_HEADERS });
    }

    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, reason: 'invalid json' }, { status: 200, headers: CORS_HEADERS });
    }

    const { siteId, visitorId, href, fromPath } = body || {};

    if (!siteId || typeof siteId !== 'string' || siteId.length > 100) {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (!href || typeof href !== 'string' || href.length > 2000) {
      return NextResponse.json({ ok: false, reason: 'invalid href' }, { status: 200, headers: CORS_HEADERS });
    }
    if (visitorId !== undefined && (typeof visitorId !== 'string' || !VISITOR_ID_RE.test(visitorId))) {
      return NextResponse.json({ ok: false, reason: 'invalid visitorId' }, { status: 200, headers: CORS_HEADERS });
    }

    const forwardedForHeader = req.headers.get('x-forwarded-for') || '';
    const callerIp = forwardedForHeader.split(',')[0].trim() || 'unknown';
    // Tighter than visit-end's typical allowance — a real broken link
    // is rare per visitor; this mainly guards against a client-side
    // bug in the detector itself looping and flooding this endpoint.
    if (!allow(`broken-link:${siteId}:${callerIp}`, 20, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[broken-link] Firebase Admin init error', err);
      return NextResponse.json({ ok: false, reason: 'server not configured' }, { status: 200, headers: CORS_HEADERS });
    }

    // Under the visit model, the visit was already charged by the
    // pageview beacon (/api/track) that preceded it — this route, like
    // every other visitor-facing action that isn't the pageview
    // itself, carries no usage charge of its own; it just needs uid
    // resolution.
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

    const clippedHref = href.slice(0, 500);
    const clippedFromPath = typeof fromPath === 'string' ? fromPath.slice(0, 300) : null;

    // One doc per distinct href — see this file's header for why a
    // repeat report on the same link increments rather than creating
    // a new doc. A short hash keeps the doc id well-formed and short
    // regardless of how long/odd the href is (query strings, etc);
    // collisions are a non-issue at this volume and this isn't a
    // security-sensitive id, just a stable dedup key.
    const docId = crypto.createHash('sha1').update(clippedHref).digest('hex').slice(0, 24);
    const linkRef = siteRef.collection('brokenLinks').doc(docId);

    // A plain merge() with serverTimestamp() on firstSeenAt would
    // overwrite it on every repeat report, not just the first one —
    // this small transaction (one extra read, still a single logical
    // write) is what keeps firstSeenAt genuinely first instead of
    // creeping forward toward "now" every time the same broken link
    // gets clicked again. Worth the extra read here specifically
    // because the problem detector uses firstSeenAt to tell "a link
    // that just started breaking" apart from "a link that's been
    // broken for weeks and the owner already knows."
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(linkRef);
      if (snap.exists) {
        tx.update(linkRef, {
          href: clippedHref,
          fromPath: clippedFromPath,
          count: FieldValue.increment(1),
          lastSeenAt: FieldValue.serverTimestamp(),
        });
      } else {
        tx.set(linkRef, {
          href: clippedHref,
          fromPath: clippedFromPath,
          count: 1,
          firstSeenAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[broken-link] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
