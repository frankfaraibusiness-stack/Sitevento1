// app/api/overlay-track/route.ts
//
// POST { siteId, version, event: "impression" | "cta" | "close" }
//
// Bumps an engagement counter for a site's CURRENTLY LIVE banner. Called
// from the tracking snippet (public/sitevento.js) on every page a
// visitor sees the overlay on — no sign-in required, since a visitor on
// a third-party site has no sitevento account.
//
// ── Why a counter, not a client-reported number ──────────────────────
// Every call does exactly one FieldValue.increment(1) server-side. The
// client never reads-then-writes a count, and a count is never accepted
// from the request body — a visitor editing local state or replaying a
// crafted request can only ever add 1 at a time, same as any other
// click. This is a rough engagement signal for the dashboard, not a
// deduplicated analytics pipeline.
//
// ── Version guard ─────────────────────────────────────────────────────
// Rejected (silently, still 200) if `version` doesn't match the
// overlay that's actually live right now, so a slow/cached client
// holding a stale version — or a visitor closing an overlay in a
// background tab right as the owner pushes a new one — can't bump the
// WRONG push's numbers.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { OVERLAY_TRACK_EVENTS, type OverlayTrackEvent } from '@/lib/siteAlert';
import { trackWidgetRequest } from '@/lib/serverAuth';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const FIELD: Record<OverlayTrackEvent, string> = {
  impression: 'impressions',
  cta: 'ctaClicks',
  close: 'closes',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  // Same contract as /api/track: never surface an error or block the
  // visitor's page — always 200.
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, version, event } = body || {};

    if (!siteId || typeof siteId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    if (typeof version !== 'number') {
      return NextResponse.json({ ok: false, reason: 'missing version' }, { status: 200, headers: CORS_HEADERS });
    }
    if (typeof event !== 'string' || !OVERLAY_TRACK_EVENTS.includes(event as OverlayTrackEvent)) {
      return NextResponse.json({ ok: false, reason: 'bad event' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('Firebase Admin init error', err);
      return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
    }

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

    const liveVersion = siteSnap.data()?.overlay?.version;
    if (typeof liveVersion !== 'number' || liveVersion !== version) {
      // Stale push — don't count it.
      return NextResponse.json({ ok: true, counted: false }, { status: 200, headers: CORS_HEADERS });
    }

    const field = FIELD[event as OverlayTrackEvent];
    await siteRef.update({ [`overlayStats.${field}`]: FieldValue.increment(1) });

    // Counts against the site owner's daily write limit, same as
    // every other widget-to-app request — fire-and-forget.
    trackWidgetRequest(db, siteId).catch(() => {});

    return NextResponse.json({ ok: true, counted: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('overlay-track handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
