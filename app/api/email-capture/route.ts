// app/api/email-capture/route.ts
//
// POST { siteId, email }
//
// Backs the Email Capture widget (app/w/[widgetId]/widgets/
// EmailCaptureWidget.tsx) — the scroll-to-end signup prompt. Mirrors
// app/api/overlay-notify/route.ts exactly: resolve siteId -> owning
// site via the Admin SDK (never the client SDK, so no Firestore rule
// needs to open up writes to anonymous visitors), then write into the
// site's existing `leads` subcollection so captured addresses show up
// in the dashboard's LeadsPanel alongside every other lead source,
// tagged with source: 'email-capture' to distinguish them.
//
// Same CORS-open, always-200 contract as the other visitor-facing
// routes (/api/track, /api/overlay-track, /api/overlay-notify) — a
// widget embedded on a third-party page must never surface a raw error
// or throw into the host page.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { assertWidgetWriteAllowed, pausedWidgetResponse, WidgetWriteBlockedError } from '@/lib/serverAuth';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, email } = body || {};

    if (!siteId || typeof siteId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    const trimmed = typeof email === 'string' ? email.trim().slice(0, 200) : '';
    if (!EMAIL_RE.test(trimmed)) {
      return NextResponse.json({ ok: false, reason: 'invalid email' }, { status: 200, headers: CORS_HEADERS });
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`email-capture:${siteId}:${ip}`, 10, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[email-capture] Firebase Admin init error', err);
      return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
    }

    let resolved;
    try {
      resolved = await assertWidgetWriteAllowed(db, siteId);
    } catch (err) {
      if (err instanceof WidgetWriteBlockedError) {
        return pausedWidgetResponse(CORS_HEADERS);
      }
      throw err;
    }
    if (!resolved) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }
    const { uid } = resolved;

    const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) {
      return NextResponse.json({ ok: false, reason: 'unknown site' }, { status: 200, headers: CORS_HEADERS });
    }

    await siteRef.collection('leads').add({
      email: trimmed,
      source: 'email-capture',
      ts: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[email-capture] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
