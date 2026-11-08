// app/api/overlay-notify/route.ts
//
// POST { siteId, email }
//
// A locked (non-closable) banner with notifyOnClose turned on shows a
// "Notify me" control instead of leaving the visitor stuck with nothing
// to do. There's no visitor-facing auth system on a third-party site, so
// this just captures an email address — written straight into the
// site's existing `leads` subcollection (the same one LeadsPanel already
// renders), rather than inventing a parallel notification-subscriber
// list. The dashboard owner follows up manually once the banner comes
// down; sitevento doesn't send mail on anyone's behalf.
//
// Same CORS-open, always-200 contract as /api/track and
// /api/overlay-track — a visitor-facing endpoint must never surface an
// error or block the page.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveLeadAttribution } from '@/lib/leadAttribution';


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
    const { siteId, email, visitorId: rawVisitorId, pageUrl } = body || {};

    if (!siteId || typeof siteId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }
    const trimmed = typeof email === 'string' ? email.trim().slice(0, 200) : '';
    if (!EMAIL_RE.test(trimmed)) {
      return NextResponse.json({ ok: false, reason: 'invalid email' }, { status: 200, headers: CORS_HEADERS });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('Firebase Admin init error', err);
      return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
    }

    // This is a real lead write (siteRef.collection('leads').add), the
    // same shape as email-capture/contact-us/etc. Under the visit
    // model, the visit was already charged by the pageview beacon
    // (/api/track) that preceded it — this route, like every other
    // visitor-facing action that isn't the pageview itself, carries no
    // usage charge of its own; it just needs uid resolution.
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

    // Best-effort device attribution — see lib/leadAttribution.ts.
    const attribution = await resolveLeadAttribution(db, siteRef, rawVisitorId);

    await siteRef.collection('leads').add({
      email: trimmed,
      source: 'overlay-notify',
      ts: FieldValue.serverTimestamp(),
      visitorId: attribution.visitorId,
      device: attribution.device,
      path: typeof pageUrl === 'string' ? pageUrl.slice(0, 300) : null,
    });

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('overlay-notify handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
