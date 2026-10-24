// app/api/site-limits/route.ts
//
// POST { idToken }
//
// Reports the caller's connected-site usage against their plan's
// connectedSites cap, via the Admin SDK — mirrors app/api/site-widget/
// route.ts's pattern exactly: verify the Firebase ID token server-side
// to recover the real uid (never trust a uid typed into the body),
// then read users/{uid}.plan + count users/{uid}/sites with that same
// trusted uid.
//
// This route is read-only (no writes) and exists so the dashboard can:
//   (a) show accurate "3 of 5 sites used" numbers, and
//   (b) decide whether to open the connect wizard at all, or show the
//       upsell overlay instead — BEFORE the wizard's own site-creation
//       call, so an at-limit user never even sees the domain form.
//
// The actual enforcement (the thing a user can't bypass by skipping
// this check and calling creation directly) lives in
// app/api/connect-site/route.ts, which re-checks the same limit
// atomically at write time with the Admin SDK. This route alone is
// advisory/UI-driving; that one is the real gate.
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { allow } from '@/lib/rateLimit';
import { getPlan, type PlanId } from '@/lib/plans';

export const maxDuration = 10;
export const runtime = 'nodejs';

const DEFAULT_PLAN_ID: PlanId = 'free';

function getAdminApp() {
  return getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isValidPlanId(value: unknown): value is PlanId {
  return value === 'free' || value === 'starter' || value === 'scale' || value === 'pro-developer';
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 4 * 1024) {
      return jsonError(400, 'Request body too large.');
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(400, 'Malformed JSON body.');
    }

    const { idToken } = body || {};
    if (!idToken || typeof idToken !== 'string') {
      return jsonError(401, 'Missing idToken.');
    }

    let app;
    try {
      app = getAdminApp();
    } catch (err) {
      console.error('[site-limits] Firebase Admin init error', err);
      return jsonError(500, 'Server is not configured yet (missing Firebase Admin credentials).');
    }

    // ---- Verify the caller's identity server-side ----
    // Same reasoning as site-widget's route: the body can't be trusted,
    // so the uid used below comes only from a signature-checked token.
    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      return jsonError(401, 'Invalid or expired session. Please sign in again.');
    }

    // Cheap per-uid limit — this route is hit on every dashboard load
    // and every "add site" click, not just at creation time.
    if (!allow(`site-limits:${uid}`, 60, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getAdminDb();

    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const planId: PlanId = isValidPlanId(userData.plan) ? userData.plan : DEFAULT_PLAN_ID;
    const plan = getPlan(planId);

    // count() aggregation avoids pulling every site doc just to get a
    // number — cheap even for an account with the max 30 sites.
    const sitesSnap = await db.collection('users').doc(uid).collection('sites').count().get();
    const used = sitesSnap.data().count;

    const limit = plan.limits.connectedSites;
    const atLimit = used >= limit;

    return NextResponse.json(
      {
        ok: true,
        planId,
        planName: plan.name,
        limit,
        used,
        atLimit,
        // So the UI can name the next tier up without hardcoding the
        // catalog order itself.
        nextPlanId: planId === 'pro-developer' ? null : nextPlanAfter(planId),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[site-limits] handler error', err);
    return jsonError(500, 'Something went wrong checking your plan limits.');
  }
}

function nextPlanAfter(planId: PlanId): PlanId | null {
  const order: PlanId[] = ['free', 'starter', 'scale', 'pro-developer'];
  const idx = order.indexOf(planId);
  if (idx === -1 || idx === order.length - 1) return null;
  return order[idx + 1];
}
