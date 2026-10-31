// lib/limits.ts
//
// ============================================================
// SINGLE SOURCE OF TRUTH — every plan-gated number in sitevento
// lives in this one file. If you're changing what a plan allows,
// change it HERE and nowhere else.
// ============================================================
//
// This file covers three different kinds of limit, all keyed by
// PlanId so they're trivial to scan and tune:
//
//   1. WIDGET_LIVE_LIMITS       — how many widgets can be live at once per site.
//   2. FEATURE_LIMITS           — per-permission daily usage caps (the
//                                  "block 3 visitors/day on Free" type of
//                                  limit). `null` = unlimited on that plan.
//                                  A permission with NO entry here has no
//                                  usable trial on a below-plan tier — it's
//                                  a hard lock until upgrade (see the
//                                  "trialEligible" note in connectPermissions.ts).
//   3. DEFAULT_DAILY_WRITE_LIMITS — the ONE daily write cap per plan
//                                  (3,000 / 50,000 / 500,000 / 1,500,000),
//                                  used for both the account-wide write
//                                  ceiling AND the Firestore write quota
//                                  (firestoreQuota() just derives from this
//                                  table). Reads are unlimited on every
//                                  plan.
//
// None of these numbers are enforced just by existing in this file —
// enforcement happens server-side wherever the corresponding action is
// written (app/api/*/route.ts), by importing from here and checking
// against lib/usageTracking.ts's daily counters. Client-side UI (the
// connect permissions grid, dashboard) also imports this file so the
// displayed numbers can never drift from what's actually enforced.
//
// lib/plans.ts still owns the general plan catalog (pricing, seat
// counts, connected-site caps, etc.) — this file is specifically for
// numbers that are either (a) a *daily* usage cap, or (b) new as of
// the trial-access redesign. Nothing here duplicates lib/plans.ts;
// WIDGET_LIVE_LIMITS replaces the old flat MAX_LIVE_WIDGETS_PER_SITE.
import type { PlanId } from './plans';

export const PLAN_ORDER: PlanId[] = ['free', 'starter', 'scale', 'pro-developer'];

export function planMeetsMinimum(plan: PlanId, minPlan: PlanId): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(minPlan);
}

export function planAtLeast(plan: PlanId, minPlan: PlanId): boolean {
  return planMeetsMinimum(plan, minPlan);
}

// ────────────────────────────────────────────────────────────────
// 1. Live widget caps per site, per plan.
//    Replaces the old lib/plans.ts MAX_LIVE_WIDGETS_PER_SITE flat-3
//    constant — this is now a genuine upgrade lever, not a flat
//    product constraint.
// ────────────────────────────────────────────────────────────────
export const WIDGET_LIVE_LIMITS: Record<PlanId, number> = {
  free: 3,
  starter: 5,
  scale: 10,
  'pro-developer': 15,
};

export function liveWidgetLimit(plan: PlanId): number {
  return WIDGET_LIVE_LIMITS[plan] ?? WIDGET_LIVE_LIMITS.free;
}

// ────────────────────────────────────────────────────────────────
// 2. Per-feature daily usage limits, keyed by permission id (see
//    lib/connectPermissions.ts for the full permission catalog —
//    ids there must match the keys used here).
//
//    `null` on a plan tier = unlimited on that plan once unlocked.
//    A permission id with NO row in this table at all is a feature
//    that doesn't make sense to meter by count (e.g. it's an
//    on/off capability, or genuinely risky to let Free "sample"),
//    so it stays a hard lock with no trial below its minPlan.
//
//    Free's numbers here ARE the "try before you upgrade" trial —
//    deliberately small, feature-appropriate (not a blanket 5/day
//    for everything — some features don't suit a trial at all and
//    are simply absent from this table for Free).
// ────────────────────────────────────────────────────────────────
export interface FeatureLimitRow {
  free: number | null;
  starter: number | null;
  scale: number | null;
  'pro-developer': number | null;
}

export const FEATURE_LIMITS: Record<string, FeatureLimitRow> = {
  // Visitor access control — explicit trial per your spec: Free can
  // genuinely block a handful of visitors/day to see the feature work,
  // then scales hard with plan.
  'visitor-access-control': { free: 3, starter: 1000, scale: 5000, 'pro-developer': null },

  // Geographic restrictions are an all-or-nothing enforcement layer
  // (you either filter a country or you don't) — doesn't suit a
  // per-day trial, so Free has no row entry and stays hard-locked.
  // (No Free key below — see note above.)
  'geographic-restrictions': { free: 0, starter: 0, scale: 50, 'pro-developer': null },

  // Threat response (auto-blocking bots/abuse) is a standing
  // automation rule, not a per-use action — also not trial-friendly
  // on Free; starts usable at Scale.
  'threat-response': { free: 0, starter: 0, scale: 25, 'pro-developer': null },

  // Session replay — small daily trial so Free owners can watch a
  // couple of real sessions and see the value before upgrading.
  'session-replay': { free: 5, starter: 50, scale: 500, 'pro-developer': null },

  // Data export — a few trial rows/exports a day, enough to prove
  // the format works without giving away the full data firehose.
  'data-export': { free: 2, starter: 100, scale: 1000, 'pro-developer': null },

  // Campaign overlays — let Free push a couple of test overlays/day.
  'campaign-overlays': { free: 2, starter: 50, scale: 250, 'pro-developer': null },

  // Custom widget styling edits/day.
  'custom-widget-styling': { free: 3, starter: 100, scale: 500, 'pro-developer': null },

  // Conversion experiments (A/B tests) — not metered by day, gated by
  // plan only (running an experiment is a standing config, not a
  // repeatable action), so no Free trial.
  'conversion-experiments': { free: 0, starter: 0, scale: 10, 'pro-developer': null },

  // Advanced style overrides (raw CSS injection) — security-sensitive
  // enough that a trial doesn't make sense; locked until Pro Developer.
  'advanced-style-overrides': { free: 0, starter: 0, scale: 0, 'pro-developer': null },

  // Scheduled publishing — let Free try scheduling a couple of
  // on/off events per day.
  'scheduled-publishing': { free: 2, starter: 50, scale: 250, 'pro-developer': null },

  // Event-driven workflows — small trial of automation triggers.
  'event-driven-workflows': { free: 2, starter: 50, scale: 250, 'pro-developer': null },

  // Advanced rule engine — compound automation logic, Pro Developer only.
  'advanced-rule-engine': { free: 0, starter: 0, scale: 0, 'pro-developer': null },

  // AI response service — let Free try a few AI-handled chat replies/day.
  'ai-response-service': { free: 5, starter: 200, scale: 2000, 'pro-developer': null },

  // AI knowledge configuration — edits/day to the AI's instructions.
  'ai-knowledge-configuration': { free: 3, starter: 100, scale: 500, 'pro-developer': null },

  // Support intelligence (conversation history/insights) — view count/day.
  'support-intelligence': { free: 0, starter: 0, scale: 500, 'pro-developer': null },

  // AI action autonomy — the agent taking real actions on its own is
  // high-trust; no trial, Pro Developer only.
  'ai-action-autonomy': { free: 0, starter: 0, scale: 0, 'pro-developer': null },

  // Event delivery (outbound webhooks) — a handful of test events/day.
  'event-delivery': { free: 3, starter: 500, scale: 5000, 'pro-developer': null },

  // Integration connections (CRM/Zapier/Make) — not metered, plan-gated only.
  'integration-connections': { free: 0, starter: 0, scale: 5, 'pro-developer': null },

  // External alerts (Slack/monitoring) — a few test alerts/day.
  'external-alerts': { free: 2, starter: 100, scale: 1000, 'pro-developer': null },

  // Page-context access (DOM read for contextual targeting) — reads/day.
  'page-context-access': { free: 5, starter: 200, scale: 2000, 'pro-developer': null },

  // Cross-site identity — needs 2+ connected sites to mean anything and
  // touches visitor privacy across properties; no trial, Pro Developer only.
  'cross-site-identity': { free: 0, starter: 0, scale: 0, 'pro-developer': null },

  // Delegated site management — a trust/access-control grant, not a
  // metered action; plan-gated only, no trial.
  'delegated-site-management': { free: 0, starter: 0, scale: 10, 'pro-developer': null },
};

/** True if this permission id has ANY usable trial/limit row defined at all. */
export function hasFeatureLimit(permissionId: string): boolean {
  return permissionId in FEATURE_LIMITS;
}

/**
 * Daily usage limit for a permission on a given plan.
 * Returns: a positive number (the cap), 0 (no access at all on this
 * plan — locked, no trial), or null (unlimited on this plan).
 * Returns null for a permission with no FEATURE_LIMITS row (treated
 * as "not metered" — gating is plan-only, see connectPermissions.ts).
 */
export function featureDailyLimit(permissionId: string, plan: PlanId): number | null {
  const row = FEATURE_LIMITS[permissionId];
  if (!row) return null;
  return row[plan];
}

// ────────────────────────────────────────────────────────────────
// 3 & 4. DAILY WRITE LIMIT — the ONE write number per plan, used for
//    BOTH of the app's write counters:
//      - accountWrites: the blanket per-day ceiling across every
//        write kind (profile/settings edits, pause/disconnect a
//        site, restrict a visitor, save an overlay, plus every
//        widget-facing callback: widget config load, track,
//        overlay-track, overlay-notify, email-capture, chat).
//        Enforced by lib/serverAuth.ts's
//        checkAndIncrementAccountWrites/incrementWidgetRequestUsage.
//      - writes: the Firestore infra-cost write quota, enforced by
//        lib/usageTracking.ts's checkAndIncrementFirestoreUsage.
//    These used to be two separate tables with two separate sets of
//    numbers (200/2k/10k/null vs 1k/10k/100k/1M) even though both
//    are "how many writes can this plan do today" — now there is
//    exactly one table and both counters read from it, so the
//    numbers can never drift apart again.
//
//    Revised 2026-10: bumped from 1k/10k/100k/1M to 3k/50k/500k/1.5M.
//    At Firestore Standard pricing ($0.09/100k writes, us-central1),
//    a user maxing out their cap every single day of a 30-day month
//    costs: free ~$0.08, starter ~$1.35, scale ~$13.50,
//    pro-developer ~$40.50 — comfortable margin under each plan's price
//    (free is a subsidized trial by design; starter/scale/pro-developer
//    margins stay 93%+ even in this worst case).
//
//    READS are unlimited on every plan (no infra-cost concern there
//    worth gating on) — so firestoreQuota().readsPerDay is always
//    null and checkAndIncrementFirestoreUsage always allows reads.
//
//    This data lives here (client-safe, no firebase-admin import) so
//    both server routes (lib/serverAuth.ts, lib/usageTracking.ts)
//    and client UI (PlansPage, DailyLimitCard) render/enforce the
//    exact same numbers from this one place.
// ────────────────────────────────────────────────────────────────
export const DEFAULT_DAILY_WRITE_LIMITS: Record<PlanId, number | null> = {
  free: 3_000,
  starter: 50_000,
  scale: 500_000,
  'pro-developer': 1_500_000,
};

export function dailyWriteLimit(plan: PlanId): number | null {
  return DEFAULT_DAILY_WRITE_LIMITS[plan] ?? DEFAULT_DAILY_WRITE_LIMITS.free;
}

export interface FirestoreQuotaRow {
  readsPerDay: number | null;
  writesPerDay: number | null;
}

/** Derived from DEFAULT_DAILY_WRITE_LIMITS — not a second source of numbers. */
export function firestoreQuota(plan: PlanId): FirestoreQuotaRow {
  return { readsPerDay: null, writesPerDay: dailyWriteLimit(plan) };
}
