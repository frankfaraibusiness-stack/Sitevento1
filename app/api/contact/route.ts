// app/api/contact/route.ts
//
// POST { name, email, message }
//
// Backs the /contact page's form (components/content/ContactForm.tsx).
// Same trust model as /api/feedback: a public, rate-limited, always-200
// endpoint that writes with the Admin SDK rather than exposing a direct
// client-side Firestore write — the browser never needs its own write
// access to a top-level "contactSubmissions" collection, so no new rule
// has to be opened up in firestore.rules for this.
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';

export const maxDuration = 10;
export const runtime = 'nodejs';

const MAX_NAME_LEN = 120;
const MAX_EMAIL_LEN = 200;
const MAX_MESSAGE_LEN = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, message } = body || {};

    const trimmedName = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LEN) : '';
    const trimmedEmail = typeof email === 'string' ? email.trim().slice(0, MAX_EMAIL_LEN) : '';
    const trimmedMessage = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LEN) : '';

    if (!trimmedName) {
      return NextResponse.json({ ok: false, reason: 'missing name' }, { status: 200 });
    }
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      return NextResponse.json({ ok: false, reason: 'invalid email' }, { status: 200 });
    }
    if (!trimmedMessage) {
      return NextResponse.json({ ok: false, reason: 'empty message' }, { status: 200 });
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`contact:${ip}`, 5, 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate limited' }, { status: 200 });
    }

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[contact] Firebase Admin init error', err);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    await db.collection('contactSubmissions').add({
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage,
      status: 'new',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[contact] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
