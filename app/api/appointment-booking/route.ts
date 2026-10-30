// app/api/appointment-booking/route.ts
//
// POST { siteId, action: 'availability' | 'book', ... }
//
// Backs the Appointment & Demo Booking widget (app/w/[widgetId]/
// widgets/AppointmentBookingWidget.tsx). Two actions share this one
// route rather than two separate ones, since both need the same
// siteId -> owner resolution and both operate on the same
// `bookings` subcollection:
//
//   action: 'availability' — { siteId, dateKey }
//     Returns which of ALL_SLOT_TIMES are already taken for that date,
//     read from users/{uid}/sites/{siteId}/bookings/{dateKey}.slots —
//     a real per-date read, not the widget's old client-side fake.
//
//   action: 'book' — { siteId, dateKey, time, serviceId, name, email,
//                       notes?, pageUrl?, visitorId? }
//     Atomically re-checks the slot is still free AND claims it, in
//     ONE Firestore transaction on the same bookings/{dateKey} doc —
//     this is what closes the race the widget's own comment calls
//     out ("two visitors viewing the same open slot"): whichever
//     request's transaction commits first wins the slot; the second
//     gets { ok:true, confirmed:false } with the now-current slots so
//     the widget can re-open the time-picker rather than show a false
//     confirmation. Only on a successful claim does this write the
//     lead (same `leads` subcollection every other widget here uses,
//     tagged source: 'appointment-booking').
//
// Hard-paused via assertWidgetWriteAllowed on the 'book' action only
// (a real write/lead), same as /api/contact-us — 'availability' is a
// read and isn't gated or counted.
//
// Same CORS-open, always-200, siteIndex-resolved trust model as every
// other widget-facing route in this app.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { allow } from '@/lib/rateLimit';
import { assertWidgetWriteAllowed, pausedWidgetResponse, WidgetWriteBlockedError } from '@/lib/serverAuth';
import { checkFormFlood } from '@/lib/formFloodGuard';

export const maxDuration = 10;
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALL_SLOT_TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '11:00 AM', '1:00 PM', '1:30 PM', '2:30 PM', '3:00 PM', '4:00 PM'];
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(reason: string) {
  return NextResponse.json({ ok: false, reason }, { status: 200, headers: CORS_HEADERS });
}

async function resolveSite(db: Firestore, siteId: string) {
  const indexSnap = await db.collection('siteIndex').doc(siteId).get();
  const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
  if (!uid) return null;
  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) return null;
  return { uid, siteRef };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, action, dateKey } = body || {};

    if (!siteId || typeof siteId !== 'string') return fail('missing siteId');
    if (!dateKey || typeof dateKey !== 'string' || !DATE_KEY_RE.test(dateKey)) return fail('invalid dateKey');

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';
    if (!allow(`appointment-booking:${siteId}:${ip}`, 20, 60_000)) return fail('rate limited');

    let db: Firestore;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[appointment-booking] Firebase Admin init error', err);
      return fail('server error');
    }

    const resolved = await resolveSite(db, siteId);
    if (!resolved) return fail('unknown site');
    const { siteRef } = resolved;
    const dayRef = siteRef.collection('bookings').doc(dateKey);

    if (action === 'availability') {
      const snap = await dayRef.get();
      const taken: string[] = snap.exists ? (snap.data()?.taken as string[]) || [] : [];
      const slots = ALL_SLOT_TIMES.map((time) => ({ time, taken: taken.includes(time) }));
      return NextResponse.json({ ok: true, slots }, { status: 200, headers: CORS_HEADERS });
    }

    if (action === 'book') {
      const { time, serviceId, name, email, notes, pageUrl, visitorId } = body || {};
      const trimmedName = typeof name === 'string' ? name.trim().slice(0, 150) : '';
      const trimmedEmail = typeof email === 'string' ? email.trim().slice(0, 200) : '';
      if (!ALL_SLOT_TIMES.includes(time)) return fail('invalid time');
      if (!trimmedName || !EMAIL_RE.test(trimmedEmail)) return fail('invalid fields');

      let blocked = false;
      try {
        await assertWidgetWriteAllowed(db, siteId);
      } catch (err) {
        if (err instanceof WidgetWriteBlockedError) blocked = true;
        else throw err;
      }
      if (blocked) return pausedWidgetResponse(CORS_HEADERS);

      // Bot Shield, Widget 2: Form Flood Guard — before even competing
      // for the slot, so a bot burst can't tie up real availability
      // checks/claims against genuine bookings. See lib/formFloodGuard.ts.
      const floodCheck = await checkFormFlood({ db, siteRef, ip, visitorId });
      if (floodCheck.blocked) return fail('blocked');

      // Atomic re-check + claim: whichever request's transaction
      // commits first wins the slot. The loser gets confirmed:false
      // and fresh slots instead of a false "Confirmed".
      const claimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(dayRef);
        const taken: string[] = snap.exists ? (snap.data()?.taken as string[]) || [] : [];
        if (taken.includes(time)) return false;
        tx.set(dayRef, { taken: [...taken, time] }, { merge: true });
        return true;
      });

      if (!claimed) {
        const freshSnap = await dayRef.get();
        const taken: string[] = freshSnap.exists ? (freshSnap.data()?.taken as string[]) || [] : [];
        const slots = ALL_SLOT_TIMES.map((t) => ({ time: t, taken: taken.includes(t) }));
        return NextResponse.json({ ok: true, confirmed: false, slots }, { status: 200, headers: CORS_HEADERS });
      }

      await siteRef.collection('leads').add({
        name: trimmedName,
        email: trimmedEmail,
        message: typeof notes === 'string' ? notes.trim().slice(0, 1000) : '',
        source: 'appointment-booking',
        serviceId: typeof serviceId === 'string' ? serviceId.slice(0, 100) : '',
        dateKey,
        time,
        pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 2000) : '',
        visitorId: typeof visitorId === 'string' ? visitorId.slice(0, 200) : '',
        ts: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ ok: true, confirmed: true }, { status: 200, headers: CORS_HEADERS });
    }

    return fail('unknown action');
  } catch (err) {
    console.error('[appointment-booking] handler error', err);
    return fail('server error');
  }
}
