// app/api/feedback/route.ts
//
// POST { siteId, message, pageUrl? }
//
// Backs the Feedback Tab widget (app/w/[widgetId]/widgets/
// FeedbackWidget.tsx). Same trust model as /api/overlay-notify: a
// visitor-facing, CORS-open, always-200 endpoint (never surfaces an
// error into the embedded widget) that resolves siteId -> owner via
// siteIndex and writes with the Admin SDK into that site's own
// subcollection — a visitor never gets direct Firestore write access.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_MESSAGE_LEN = 500;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, message, pageUrl } = body || {};

    if (!siteId || typeof siteId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    const trimmed = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LEN) : '';
    if (!trimmed) {
      return NextResponse.json({ ok: false, reason: 'empty message' }, { status: 200, headers: CORS_HEADERS });
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`feedback:${siteId}:${ip}`, 10, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[feedback] Firebase Admin init error', err);
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

    await siteRef.collection('feedback').add({
      message: trimmed,
      pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 2000) : '',
      ts: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[feedback] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
