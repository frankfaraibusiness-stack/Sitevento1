// app/api/spin-reward/route.ts
//
// POST { siteId, action: 'status' | 'claim', visitorId, ... }
//
// Backs the Daily Spin Reward widget (app/w/[widgetId]/widgets/
// SpinRewardWidget.tsx). The wheel's own prize pick and stopping
// angle stay entirely client-side by design (see that widget's header
// comment: the angle is derived FROM the chosen prize, never the
// reverse, so the visible result can never be rigged against what the
// wheel shows) — this route's job is only the things that must be
// real and server-side:
//
//   action: 'status' — { siteId, visitorId }
//     Read-only check of whether this visitor has already spun in the
//     last 24h, so the widget can disable the Spin button (and show
//     "Come back tomorrow") BEFORE the wheel animation ever starts —
//     not after, which would mean a visitor watches the wheel spin
//     and only then learns they're denied. Not gated by
//     assertWidgetWriteAllowed (it writes nothing) and not rate
//     limited by the same low ceiling as 'claim' (just a status read
//     on open).
//
//   action: 'claim' — { siteId, visitorId, prizeLabel, prizeCode, pageUrl? }
//     A real "one spin per visitor per 24h" gate, keyed by
//     siteId+visitorId rather than the draft's raw localStorage
//     timestamp (so it can't be reset by clearing site data, and so
//     the SITE OWNER's redemption volume per prize is actually
//     recorded server-side, not just claimed client-side) — atomic
//     check-and-claim in one transaction, same shape as
//     appointment-booking's slot claim. Gated by
//     assertWidgetWriteAllowed like the other real-write routes.
//
// users/{uid}/sites/{siteId}/spinRedemptions/{visitorId} holds
// { lastSpinAt, prizeCode, prizeLabel } — doc id IS the visitorId.
//
// Same CORS-open/always-200/siteIndex-resolved contract as the rest of
// this app's widget-facing routes.

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

const DAY_MS = 24 * 60 * 60 * 1000;

function fail(reason: string) {
  return NextResponse.json({ ok: false, reason }, { status: 200, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function resolveSite(db: ReturnType<typeof getAdminDb>, siteId: string) {
  const indexSnap = await db.collection('siteIndex').doc(siteId).get();
  const uid: string | null = indexSnap.exists ? indexSnap.data()?.uid ?? null : null;
  if (!uid) return null;
  const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
  const siteSnap = await siteRef.get();
  if (!siteSnap.exists) return null;
  return { uid, siteRef };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { siteId, action, visitorId } = body || {};

    if (!siteId || typeof siteId !== 'string') return fail('missing siteId');
    const vid = typeof visitorId === 'string' ? visitorId.trim().slice(0, 200) : '';
    if (!vid) return fail('missing visitorId');

    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 'unknown';

    let db;
    try {
      db = getAdminDb();
    } catch (err) {
      console.error('[spin-reward] Firebase Admin init error', err);
      return fail('server error');
    }

    if (action === 'status') {
      if (!allow(`spin-reward-status:${siteId}:${ip}`, 30, 60_000)) return fail('rate limited');
      const resolved = await resolveSite(db, siteId);
      if (!resolved) return fail('unknown site');
      const snap = await resolved.siteRef.collection('spinRedemptions').doc(vid).get();
      const data = snap.exists ? snap.data() || {} : {};
      const lastSpinAt = data.lastSpinAtMs as number | undefined;
      const alreadySpun = !!lastSpinAt && Date.now() - lastSpinAt < DAY_MS;
      return NextResponse.json({ ok: true, alreadySpun }, { status: 200, headers: CORS_HEADERS });
    }

    if (action === 'claim') {
      const { prizeLabel, prizeCode, pageUrl } = body || {};
      const label = typeof prizeLabel === 'string' ? prizeLabel.trim().slice(0, 100) : '';
      const code = typeof prizeCode === 'string' ? prizeCode.trim().slice(0, 100) : '';
      if (!label || !code) return fail('invalid prize');

      if (!allow(`spin-reward:${siteId}:${ip}`, 10, 60_000)) return fail('rate limited');

      let resolved;
      try {
        resolved = await assertWidgetWriteAllowed(db, siteId);
      } catch (err) {
        if (err instanceof WidgetWriteBlockedError) return pausedWidgetResponse(CORS_HEADERS);
        throw err;
      }
      if (!resolved) return fail('unknown site');
      const { uid } = resolved;

      const siteRef = db.collection('users').doc(uid).collection('sites').doc(siteId);
      const siteSnap = await siteRef.get();
      if (!siteSnap.exists) return fail('unknown site');

      const redemptionRef = siteRef.collection('spinRedemptions').doc(vid);

      const claimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(redemptionRef);
        const data = snap.exists ? snap.data() || {} : {};
        const lastSpinAt = data.lastSpinAtMs as number | undefined;
        if (lastSpinAt && Date.now() - lastSpinAt < DAY_MS) {
          return false;
        }
        tx.set(redemptionRef, {
          lastSpinAt: FieldValue.serverTimestamp(),
          lastSpinAtMs: Date.now(),
          prizeCode: code,
          prizeLabel: label,
          pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 2000) : '',
        });
        return true;
      });

      if (!claimed) {
        return NextResponse.json({ ok: true, allowed: false, reason: 'already spun today' }, { status: 200, headers: CORS_HEADERS });
      }
      return NextResponse.json({ ok: true, allowed: true }, { status: 200, headers: CORS_HEADERS });
    }

    return fail('unknown action');
  } catch (err) {
    console.error('[spin-reward] handler error', err);
    return fail('server error');
  }
}
