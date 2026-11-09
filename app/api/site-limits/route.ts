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
// Also now reports the account-wide DAILY TOKEN usage
// (lib/serverAuth.ts's getAccountTokenUsage) alongside the site count —
// used/limit/remaining/resetsAt — so the dashboard and profile pages
// can render a live usage bar and a countdown to the next UTC-midnight
// reset. That counter itself is maintained by app/api/user-action and
// every widget-facing route; this route only reads it, same read-only
// contract as everything else here. Shares its Admin-SDK/auth
// boilerplate with lib/serverAuth.ts now instead of redefining
// getAdminApp/jsonError/isValidPlanId locally, so a fix there (e.g. a
// credential-loading change) lands here automatically.
//
// Revised 2026-11: the JSON response field names are now fully
// token-named (tokenUsage, dailyTokenLimits, overageTokensToday)
// instead of the old write-era names — the whole stack (this route,
// useAccountLimits.ts, DailyLimitCard, ProfilePage, DashboardShell,
// BillingPanel) was renamed together so there's no longer a
// write/token naming split anywhere between server and client.
//
// Also now reports the new MONTHLY VISIT usage model alongside the
// token fields (visitUsage, monthlyVisitLimits, visitWallet) — see
// lib/visits.ts's header for the full model. Both are reported side
// by side for now; the token fields stay until every usage-gated
// route and every usage-displaying UI surface has moved over.
import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminApp,
  getAdminDb,
  jsonError,
  verifyCaller,
  getCallerPlan,
  rateLimitOk,
  getAccountTokenUsage,
  getAccountVisitUsage,
  getWalletAccount,
  DEFAULT_DAILY_TOKEN_LIMITS,
  nextPlanAfter,
} from '@/lib/serverAuth';
import { getPlan, type PlanId } from '@/lib/plans';
import { liveWidgetLimit, firestoreQuota } from '@/lib/limits';
import { MONTHLY_VISIT_LIMITS } from '@/lib/visits';
import { getFeatureUsage } from '@/lib/usageTracking';
import { CONNECT_PERMISSIONS, permissionAccessStatus } from '@/lib/connectPermissions';
import { summarizeWallet, summarizeVisitWallet } from '@/lib/wallet';

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

    // Account-wide daily token usage (lib/serverAuth.ts) — the single
    // "every owner action + every widget callback costs some number of
    // tokens against a daily cap" number introduced alongside
    // app/api/user-action. Surfaced here so the dashboard/profile/plans
    // UI can show a live counter, usage bar, and reset countdown
    // without a separate route.
    const tokenUsage = await getAccountTokenUsage(db, uid, planId);

    // Account-wide MONTHLY VISIT usage (lib/serverAuth.ts) — the new
    // billing model's counterpart to tokenUsage above. Surfaced
    // alongside it (not replacing it — the old token system stays
    // readable in the dashboard until every route is migrated) so the
    // dashboard/profile/plans UI can show the new visit-based numbers.
    const visitUsage = await getAccountVisitUsage(db, uid, planId);

    // Wallet summary piggybacks on this same read-only route so the
    // dashboard's one existing poll (useAccountLimits, every 60s) also
    // keeps the compact wallet chip fresh, instead of standing up a
    // second polling loop just for a balance number. The full wallet
    // page (hooks/useWallet.ts) still calls /api/wallet directly for
    // its own ledger history and deposit actions — this is only the
    // small "how much is left, is overage even possible right now"
    // summary other dashboard surfaces need.
    const walletDoc = await getWalletAccount(db, uid);
    const wallet = summarizeWallet(walletDoc, planId);
    const visitWallet = summarizeVisitWallet(walletDoc);

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
        tokenUsage: {
          used: tokenUsage.used,
          limit: tokenUsage.limit,
          remaining: tokenUsage.remaining,
          resetsAt: tokenUsage.resetsAt,
          overageTokensToday: tokenUsage.overageTokensToday,
        },
        dailyTokenLimits: DEFAULT_DAILY_TOKEN_LIMITS,
        // Full WalletSummary, including bankedTokens/totalPermanentTokens
        // (lib/wallet.ts) — the permanent, never-expires token count the
        // dashboard/profile's TokenLedgerCard reads, alongside the
        // existing balance fields WalletPage already uses.
        wallet,
        // ── New visit-based model, surfaced alongside the token fields
        // above (not replacing them yet) ──
        visitUsage: {
          used: visitUsage.used,
          limit: visitUsage.limit,
          remaining: visitUsage.remaining,
          resetsAt: visitUsage.resetsAt,
          overageVisitsThisMonth: visitUsage.overageVisitsThisMonth,
        },
        monthlyVisitLimits: MONTHLY_VISIT_LIMITS,
        // Full VisitWalletSummary — the visit-model counterpart to
        // `wallet` above, sharing the same underlying wallet doc.
        visitWallet,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[site-limits] handler error', err);
    return jsonError(500, 'Something went wrong checking your plan limits.');
  }
}
