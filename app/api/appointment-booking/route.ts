// app/api/appointment-booking/route.ts
//
// POST { siteId, name, email?, phone?, service?, message?, visitorId? }
//
// Backs the Booking Request widget (app/w/[widgetId]/widgets/
// BookingWidget.tsx) — a button-based, no-calendar inquiry form (see
// that component's header for why there's no date/time field at all).
// Mirrors app/api/email-capture/route.ts's shape almost exactly:
// resolve siteId -> owning site via the Admin SDK (never the client
// SDK), run the same Bot Shield / Form Flood Guard check every other
// lead-capture route runs, then write into the site's existing
// `leads` subcollection tagged source: 'appointment-booking' so a
// booking request shows up in the dashboard's LeadsPanel alongside
// every other lead source instead of needing its own separate view.
//
// Unlike email-capture there's no uniqueness/duplicate check — a
// returning visitor asking about a second, different service is a
// second, legitimate lead, not a duplicate signup.
//
// Same CORS-open, always-200 contract as every other visitor-facing
// route (/api/track, /api/email-capture, /api/overlay-notify) — a
// widget embedded on a third-party page must never surface a raw
// error or throw into the host page. Carries no usage charge of its
// own under the visit model — the visit was already counted by the
// pageview beacon (/api/track) that preceded it.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkFormFlood } from '@/lib/formFloodGuard';
import { resolveLeadAttribution } from '@/lib/leadAttribution';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose on purpose: this never dials or SMSes anyone, it's just
// stored for the site owner to call back on. Accepts digits, spaces,
// parens, dashes, and a leading +, 7-20 digits' worth — wide enough
// for real-world international formats without pretending to validate
// a specific country's numbering plan.
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;

const MAX_NAME_LEN = 120;
const MAX_SERVICE_LEN = 120;
const MAX_MESSAGE_LEN = 1000;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, name, email, phone, service, message, visitorId, pageUrl } = body || {};

    if (!siteId || typeof siteId !== 'string') {
      return NextResponse.json({ ok: false, reason: 'missing siteId' }, { status: 200, headers: CORS_HEADERS });
    }

    const trimmedName = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LEN) : '';
    if (!trimmedName) {
      return NextResponse.json({ ok: false, reason: 'missing name' }, { status: 200, headers: CORS_HEADERS });
    }

    // At least one valid contact method is required regardless of
    // which contactMode the widget was configured for — the widget's
    // own UI already enforces that client-side per its contactMode
    // setting (email-only / phone-only / visitor's choice of either or
    // both), but the server never trusts that enforcement happened,
    // same "never trust the client's native validation alone" posture
    // as email-capture's EMAIL_RE check.
    const trimmedEmail = typeof email === 'string' ? email.trim().slice(0, 200).toLowerCase() : '';
    const trimmedPhone = typeof phone === 'string' ? phone.trim().slice(0, 40) : '';
    const hasValidEmail = trimmedEmail && EMAIL_RE.test(trimmedEmail);
    const hasValidPhone = trimmedPhone && PHONE_RE.test(trimmedPhone);
    if (!hasValidEmail && !hasValidPhone) {
      return NextResponse.json({ ok: false, reason: 'missing contact info' }, { status: 200, headers: CORS_HEADERS });
    }
    // A non-empty but invalid value for either field (rather than
    // simply absent) is rejected outright instead of silently dropped
    // — a malformed email a visitor typo'd is worth asking them to
    // fix, not worth silently discarding so the owner ends up with no
    // way to reach back out at all.
    if (trimmedEmail && !hasValidEmail) {
      return NextResponse.json({ ok: false, reason: 'invalid email' }, { status: 200, headers: CORS_HEADERS });
    }
    if (trimmedPhone && !hasValidPhone) {
      return NextResponse.json({ ok: false, reason: 'invalid phone' }, { status: 200, headers: CORS_HEADERS });
    }

    const trimmedService = typeof service === 'string' ? service.trim().slice(0, MAX_SERVICE_LEN) : '';
    const trimmedMessage = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LEN) : '';

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[appointment-booking] Firebase Admin init error', err);
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

    // Bot Shield, Widget 2: Form Flood Guard — same check every other
    // lead-capture route runs (see lib/formFloodGuard.ts's header),
    // keyed on this visitor's real id when the loader supplied one
    // (so a block lands in blockedVisitors, not just the IP bucket),
    // falling back to IP alone otherwise.
    const floodCheck = await checkFormFlood({ db, siteRef, ip, visitorId });
    if (floodCheck.blocked) {
      return NextResponse.json({ ok: false, reason: 'blocked' }, { status: 200, headers: CORS_HEADERS });
    }

    // Best-effort device attribution — see lib/leadAttribution.ts.
    const attribution = await resolveLeadAttribution(db, siteRef, visitorId);

    await siteRef.collection('leads').add({
      // 'email' stays the Lead schema's one required contact field for
      // compatibility with every existing list/export/dedupe path that
      // already reads it (see lib/types.ts's Lead interface) — a
      // phone-only submission still gets a stable placeholder here so
      // those paths never see an undefined email, with the real
      // contact details carried in 'phone' and 'email' (blank when not
      // supplied) alongside it.
      email: trimmedEmail || '',
      phone: trimmedPhone || null,
      name: trimmedName,
      service: trimmedService || null,
      message: trimmedMessage || null,
      source: 'appointment-booking',
      ts: FieldValue.serverTimestamp(),
      visitorId: attribution.visitorId,
      device: attribution.device,
      path: typeof pageUrl === 'string' ? pageUrl.slice(0, 300) : null,
    });

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[appointment-booking] handler error', err);
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
}
