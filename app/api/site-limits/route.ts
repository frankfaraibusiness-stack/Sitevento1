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
//
// Also now reports the account-wide DAILY WRITE usage
// (lib/serverAuth.ts's getAccountWriteUsage) alongside the site count —
// used/limit/remaining/resetsAt — so the dashboard and profile pages
// can render a live usage bar and a countdown to the next UTC-midnight
// reset. That counter itself is maintained by app/api/user-action and
// every widget-facing route; this route only reads it, same read-only
// contract as everything else here. Shares its Admin-SDK/auth
// boilerplate with lib/serverAuth.ts now instead of redefining
// getAdminApp/jsonError/isValidPlanId locally, so a fix there (e.g. a
// credential-loading change) lands here automatically.
import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminApp,
  getAdminDb,
  jsonError,
  verifyCaller,
  getCallerPlan,
  rateLimitOk,
  getAccountWriteUsage,
  DEFAULT_DAILY_WRITE_LIMITS,
  nextPlanAfter,
} from '@/lib/serverAuth';
import { getPlan, type PlanId } from '@/lib/plans';
import { liveWidgetLimit, firestoreQuota } from '@/lib/limits';
import { getFeatureUsage } from '@/lib/usageTracking';
import { CONNECT_PERMISSIONS, permissionAccessStatus } from '@/lib/connectPermissions';

export const maxDuration = 10;
export const runtime = 'nodejs';

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
    const uid = await verifyCaller(app, idToken);
    if (!uid) return jsonError(401, 'Invalid or expired session. Please sign in again.');

    // Cheap per-uid limit — this route is hit on every dashboard load
    // and every "add site" click, not just at creation time.
    if (!rateLimitOk(`site-limits:${uid}`, 60, 60_000)) {
      return jsonError(429, 'Too many requests. Please try again shortly.');
    }

    const db = getAdminDb();
    const planId: PlanId = await getCallerPlan(db, uid);
    const plan = getPlan(planId);

    // count() aggregation avoids pulling every site doc just to get a
    // number — cheap even for an account with the max 30 sites.
    const sitesSnap = await db.collection('users').doc(uid).collection('sites').count().get();
    const used = sitesSnap.data().count;

    const limit = plan.limits.connectedSites;
    const atLimit = used >= limit;

    // Today's usage for every permission that has a trial allowance on
    // this plan (lib/limits.ts's FEATURE_LIMITS) — lets the dashboard
    // show "2 of 3 free blocks used today" style copy, not just the
    // connect wizard's static per-plan numbers. Permissions that are
    // fully unlocked or fully locked (no trial) are skipped here since
    // there's nothing daily to report for them.
    const trialPermissions = CONNECT_PERMISSIONS.filter((p) => permissionAccessStatus(p.id, planId) === 'trial');
    const featureUsage = await Promise.all(
      trialPermissions.map(async (p) => {
        const usage = await getFeatureUsage(uid, planId, p.id);
        return { permissionId: p.id, ...usage };
      })
    );

    // Account-wide daily write usage (lib/serverAuth.ts) — the single
    // "every write + every widget callback counts +1 against a daily
    // cap" number introduced alongside app/api/user-action. Surfaced
    // here so the dashboard/profile/plans UI can show a live counter,
    // usage bar, and reset countdown without a separate route — this
    // was previously computed server-side but never returned to any
    // client (see lib/serverAuth.ts's getAccountWriteUsage doc comment:
    // "Used by /api/site-limits-style UI checks").
    const writeUsage = await getAccountWriteUsage(db, uid, planId);

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
        nextPlanId: nextPlanAfter(planId),
        liveWidgetLimit: liveWidgetLimit(planId),
        firestoreQuota: firestoreQuota(planId),
        featureUsage,
        writeUsage: {
          used: writeUsage.used,
          limit: writeUsage.limit,
          remaining: writeUsage.remaining,
          resetsAt: writeUsage.resetsAt,
        },
        dailyWriteLimits: DEFAULT_DAILY_WRITE_LIMITS,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[site-limits] handler error', err);
    return jsonError(500, 'Something went wrong checking your plan limits.');
  }
}
