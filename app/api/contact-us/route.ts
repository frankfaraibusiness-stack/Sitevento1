// app/api/contact-us/route.ts
//
// POST { siteId, name, email, message, pageUrl?, visitorId? }
//
// Backs the Contact Us widget (app/w/[widgetId]/widgets/
// ContactUsWidget.tsx) — a direct name/email/message contact form,
// distinct from the AI chat thread Support Chat backs via /api/chat.
// Same siteId -> owner resolution and CORS-open/always-200 contract as
// /api/email-capture and /api/overlay-notify, and writes into that
// same site-level `leads` subcollection (tagged source: 'contact-us')
// so submissions show up in the dashboard's LeadsPanel alongside every
// other lead source.
//
// Unlike email-capture/overlay-notify (soft signals), this is a real,
// user-intended lead submission, so it's gated by
// assertWidgetWriteAllowed: once the owning account hits its daily
// write cap, this returns a paused response instead of writing — see
// lib/serverAuth.ts's "HARD PAUSE" section for why this route uses
// that instead of the older soft incrementWidgetRequestUsage/
// trackWidgetRequest path.

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
const MAX_NAME_LEN = 150;
const MAX_MESSAGE_LEN = 2000;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, name, email, message, pageUrl, visitorId } = body || {};

    if (!siteId || typeof siteId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    const trimmedName = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LEN) : '';
    const trimmedEmail = typeof email === 'string' ? email.trim().slice(0, 200) : '';
    const trimmedMessage = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LEN) : '';
    if (!trimmedName || !EMAIL_RE.test(trimmedEmail) || !trimmedMessage) {
      return NextResponse.json({ ok: false, reason: 'invalid fields' }, { status: 200, headers: CORS_HEADERS });
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`contact-us:${siteId}:${ip}`, 10, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[contact-us] Firebase Admin init error', err);
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
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage,
      source: 'contact-us',
      pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 2000) : '',
      visitorId: typeof visitorId === 'string' ? visitorId.slice(0, 200) : '',
      ts: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[contact-us] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
