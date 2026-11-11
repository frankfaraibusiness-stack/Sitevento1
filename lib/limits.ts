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
//                                  "block 3 visitors/day on Ventol Free" type of
//                                  limit). `null` = unlimited on that plan.
//                                  A permission with NO entry here has no
//                                  usable trial on a below-plan tier — it's
//                                  a hard lock until upgrade (see the
//                                  "trialEligible" note in connectPermissions.ts).
//   3. DEFAULT_DAILY_TOKEN_LIMITS — the ONE daily token allowance per plan
//                                  (10,000 / 100,000 / 500,000 / 1,000,000,
//                                  flat per-plan numbers, not derived from
//                                  plan price), used for both the
//                                  account-wide token ceiling AND the
//                                  Firestore write quota (firestoreQuota()
//                                  just derives from this table). Reads are
//                                  unlimited on every plan.
//   4. TOKEN_COSTS               — how many tokens a single call to each
//                                  operation costs (visit check, click
//                                  track, widget render, AI chat reply,
//                                  etc). Unlisted operations fall back to
//                                  DEFAULT_TOKEN_COST (1).
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
//    on/off capability, or genuinely risky to let Ventol Free "sample"),
//    so it stays a hard lock with no trial below its minPlan.
//
//    Ventol Free's numbers here ARE the "try before you upgrade" trial —
//    deliberately small, feature-appropriate (not a blanket 5/day
//    for everything — some features don't suit a trial at all and
//    are simply absent from this table for Ventol Free).
// ────────────────────────────────────────────────────────────────
export interface FeatureLimitRow {
  free: number | null;
  starter: number | null;
  scale: number | null;
  'pro-developer': number | null;
}

export const FEATURE_LIMITS: Record<string, FeatureLimitRow> = {
  // Visitor access control — explicit trial per your spec: Ventol Free can
  // genuinely block a handful of visitors/day to see the feature work,
  // then scales hard with plan.
  'visitor-access-control': { free: 3, starter: 1000, scale: 5000, 'pro-developer': null },

  // Geographic restrictions are an all-or-nothing enforcement layer
  // (you either filter a country or you don't) — doesn't suit a
  // per-day trial, so Ventol Free has no row entry and stays hard-locked.
  // (No Ventol Free key below — see note above.)
  'geographic-restrictions': { free: 0, starter: 0, scale: 50, 'pro-developer': null },

  // Threat response (auto-blocking bots/abuse) is a standing
  // automation rule, not a per-use action — also not trial-friendly
  // on Ventol Free; starts usable at Ventol Plus.
  'threat-response': { free: 0, starter: 0, scale: 25, 'pro-developer': null },

  // Session replay — small daily trial so Ventol Free owners can watch a
  // couple of real sessions and see the value before upgrading.
  'session-replay': { free: 5, starter: 50, scale: 500, 'pro-developer': null },

  // Data export — a few trial rows/exports a day, enough to prove
  // the format works without giving away the full data firehose.
  'data-export': { free: 2, starter: 100, scale: 1000, 'pro-developer': null },

  // Campaign overlays — let Ventol Free push a couple of test overlays/day.
  'campaign-overlays': { free: 2, starter: 50, scale: 250, 'pro-developer': null },

  // Custom widget styling edits/day.
  'custom-widget-styling': { free: 3, starter: 100, scale: 500, 'pro-developer': null },

  // Conversion experiments (A/B tests) — not metered by day, gated by
  // plan only (running an experiment is a standing config, not a
  // repeatable action), so no Ventol Free trial.
  'conversion-experiments': { free: 0, starter: 0, scale: 10, 'pro-developer': null },

  // Advanced style overrides (raw CSS injection) — security-sensitive
  // enough that a trial doesn't make sense; locked until Ventol Business.
  'advanced-style-overrides': { free: 0, starter: 0, scale: 0, 'pro-developer': null },

  // Scheduled publishing — let Ventol Free try scheduling a couple of
  // on/off events per day.
  'scheduled-publishing': { free: 2, starter: 50, scale: 250, 'pro-developer': null },

  // Event-driven workflows — small trial of automation triggers.
  'event-driven-workflows': { free: 2, starter: 50, scale: 250, 'pro-developer': null },

  // Advanced rule engine — compound automation logic, Ventol Business only.
  'advanced-rule-engine': { free: 0, starter: 0, scale: 0, 'pro-developer': null },

  // AI response service — let Ventol Free try a few AI-handled chat replies/day.
  'ai-response-service': { free: 5, starter: 200, scale: 2000, 'pro-developer': null },

  // AI knowledge configuration — edits/day to the AI's instructions.
  'ai-knowledge-configuration': { free: 3, starter: 100, scale: 500, 'pro-developer': null },

  // Support intelligence (conversation history/insights) — view count/day.
  'support-intelligence': { free: 0, starter: 0, scale: 500, 'pro-developer': null },

  // AI action autonomy — the agent taking real actions on its own is
  // high-trust; no trial, Ventol Business only.
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
  // touches visitor privacy across properties; no trial, Ventol Business only.
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
// 3 & 4. DAILY TOKEN LIMIT — the ONE token number per plan, used for
//    BOTH of the app's usage counters:
//      - accountTokens: the blanket per-day ceiling across every
//        owner-initiated action (profile/settings edits, pause/
//        disconnect a site, restrict a visitor, save an overlay).
//        Enforced by lib/serverAuth.ts's
//        checkAndIncrementAccountTokens/incrementWidgetTokenUsage.
//      - widgetTokens: every visitor-facing widget callback (widget
//        config load, track, overlay-track, overlay-notify,
//        email-capture, chat), each charged its own per-operation
//        token cost (see TOKEN_COSTS below) rather than a flat 1.
//      - writes: the Firestore infra-cost write quota, enforced by
//        lib/usageTracking.ts's checkAndIncrementFirestoreUsage (this
//        one still counts raw Firestore writes 1:1 — it's an infra
//        budget, not the user-facing token allowance).
//
//    Revised 2026-11: moved off a flat per-plan WRITE cap to a
//    TOKEN allowance. Originally priced at $1 of plan price = 10,000
//    tokens/day; revised again (still 2026-11) to flat per-plan
//    round numbers instead, since the per-dollar formula no longer
//    produced the numbers the product wanted at every tier:
//      free            →     10,000 tokens/day
//      starter         →    100,000 tokens/day
//      scale           →    500,000 tokens/day
//      pro-developer   →  1,000,000 tokens/day
//    These are flat constants now, not derived from plan price —
//    see DEFAULT_DAILY_TOKEN_LIMITS below for the single source of
//    truth. Overage pricing (lib/wallet.ts's
//    OVERAGE_MICROCENTS_PER_BUNDLE_BY_PLAN) is unaffected by this
//    change and still scales down by plan: $2.00/$1.50/$1.00/$0.50
//    per 100,000-token bundle for free/starter/scale/pro-developer.
//    Different operations now cost different amounts of that
//    allowance per call (TOKEN_COSTS below) instead of every call
//    costing a flat 1 the way writes used to — a plain visit lookup
//    is cheap, a click (which both records the click AND looks up/
//    credits the owner it belongs to) costs more, and an AI-answered
//    chat turn costs the most because it carries real inference spend
//    on top of the usual Firestore write.
//
//    READS are unlimited on every plan (no infra-cost concern there
//    worth gating on) — so firestoreQuota().readsPerDay is always
//    null and checkAndIncrementFirestoreUsage always allows reads.
//
//    This data lives here (client-safe, no firebase-admin import) so
//    both server routes (lib/serverAuth.ts, lib/usageTracking.ts)
//    and client UI (the plans screen, DailyLimitCard) render/enforce the
//    exact same numbers from this one place.
// ────────────────────────────────────────────────────────────────

/** Ventol Free plan's flat daily token floor (not derived from price, since Ventol Free is $0). */
export const FREE_DAILY_TOKENS = 10_000;

// Flat per-plan daily token allowances — no longer derived from plan
// price (see the header note above for why). Change a number here
// and it's the single source of truth everywhere: server enforcement
// (lib/serverAuth.ts), the pricing page, the plans screen, DailyLimitCard.
export const DEFAULT_DAILY_TOKEN_LIMITS: Record<PlanId, number | null> = {
  free: FREE_DAILY_TOKENS,
  starter: 100_000,
  scale: 500_000,
  'pro-developer': 1_000_000,
};

export function dailyTokenLimit(plan: PlanId): number | null {
  return DEFAULT_DAILY_TOKEN_LIMITS[plan] ?? DEFAULT_DAILY_TOKEN_LIMITS.free;
}

// ────────────────────────────────────────────────────────────────
// TOKEN COSTS — how many tokens a single call to each operation
// costs, charged against accountTokens/widgetTokens. Everything not
// listed explicitly falls back to DEFAULT_TOKEN_COST (1) — this is
// the "we didn't specify how many tokens it's worth, so -1 token"
// catch-all for any request kind that doesn't have its own row.
// ────────────────────────────────────────────────────────────────
export const DEFAULT_TOKEN_COST = 1;

export const TOKEN_COSTS = {
  /** A visit/session callback checking whether this visitor is new
   *  or returning (app/api/track). One read + one conditional write
   *  — the cheapest, highest-volume operation in the app. */
  visitCheck: 1,
  /** A click callback: records the click itself AND looks up which
   *  site owner to credit it to (app/api/click-track) — two writes'
   *  worth of real cost, so it's priced at double a plain visit. */
  clickTrack: 2,
  /** A widget actually rendering/loading its config on a page
   *  (app/api/widget) — same cost class as a visit check, since it's
   *  one config read per load and happens just as often. */
  widgetRender: 1,
  /** A chat turn that reaches the AI model for a real reply
   *  (app/api/chat) — carries real inference spend on top of the
   *  usual Firestore write, so it's priced well above a plain write. */
  aiChatReply: 5,
  /** The engagement-summary beacon (app/api/visit-end) that patches an
   *  existing visit doc with scrollDepthPct/activeSeconds/validClicks
   *  once, on pagehide — a single targeted update, same cost class as
   *  a plain visit check despite covering the whole page view's worth
   *  of scroll/click/time data (that data is accumulated for free,
   *  client-side, in memory — see public/sitevento.js — not sent as
   *  one beacon per scroll tick or per click). */
  visitEnd: 1,
  /** A client-side custom event beacon (app/api/custom-event) — "user
   *  clicked THIS button," named by the site owner's own page, not
   *  auto-detected the way rage-clicks/valid-clicks are. One write per
   *  call, same cost class as a plain visit check. */
  customEvent: 1,
  /** A batched heatmap-sample flush (app/api/heatmap-sample) — one
   *  call per page view (same "accumulate in memory, send once on
   *  pagehide" shape as visitEnd), but the single write it causes is a
   *  set(..., {merge:true}) with up to GRID_SIZE*GRID_SIZE field-level
   *  increments rather than visitEnd's handful of scalar fields — so
   *  it's priced at double a plain visit check, same cost class as
   *  clickTrack, which is priced for an analogous "more than one
   *  write's worth of real cost" reason. */
  heatmapSample: 2,
} as const;

export type TokenCostKind = keyof typeof TOKEN_COSTS;

/** Token cost for a named operation kind, or DEFAULT_TOKEN_COST (1) for anything unlisted. */
export function tokenCost(kind: TokenCostKind | (string & {})): number {
  return (TOKEN_COSTS as Record<string, number>)[kind] ?? DEFAULT_TOKEN_COST;
}

export interface FirestoreQuotaRow {
  readsPerDay: number | null;
  writesPerDay: number | null;
}

/** Derived from DEFAULT_DAILY_TOKEN_LIMITS — not a second source of numbers. This is the Firestore infra-write quota, kept separate from the user-facing token allowance (see note above). */
export function firestoreQuota(plan: PlanId): FirestoreQuotaRow {
  return { readsPerDay: null, writesPerDay: dailyTokenLimit(plan) };
}

// DEPRECATED aliases — kept only so any lingering import of the old
// write-based names doesn't break the build. Prefer the token-named
// exports above in new code.
export const DEFAULT_DAILY_WRITE_LIMITS = DEFAULT_DAILY_TOKEN_LIMITS;
export const dailyWriteLimit = dailyTokenLimit;
