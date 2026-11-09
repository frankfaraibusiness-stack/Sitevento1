// lib/visits.ts
//
// ============================================================
// NEW BILLING MODEL — per-visit, monthly allowance + overage.
// ============================================================
//
// This is the single source of truth for the new usage model: every
// account gets a MONTHLY allowance of tracked visits (one unit per
// page view recorded by app/api/track — the same beacon that used to
// be charged a "token" under the old model), and once that monthly
// allowance is used up, extra visits are billed at a flat overage
// rate instead of hard-pausing the site.
//
//   free            →     1,000 visits/month
//   starter         →    50,000 visits/month
//   scale           →   400,000 visits/month
//   pro-developer   → 1,000,000 visits/month
//
//   Overage rate: $0.05 per 1,000 visits, on every plan (flat — no
//   per-plan scaling the way the old token-bundle price did). Sold in
//   whole 1,000-visit blocks, rounded up — there's no partial-block
//   price and no free visit past the monthly cap.
//
// This file is intentionally a NEW, STANDALONE module — it does not
// modify or replace lib/limits.ts or lib/wallet.ts (the old daily
// token system). Both systems can exist side by side; which one is
// actually enforced is decided by which helper a given API route
// calls (see lib/serverAuth.ts's visit-counter functions, added
// alongside the existing token ones, not instead of them).
//
// ── Reset model: fixed UTC calendar month ───────────────────────────
// Resets on the 1st of each UTC month, the same simple fixed-boundary
// approach the old system used for its UTC-day reset — just a wider
// window. The counter's Firestore doc id is the YYYY-MM key itself
// (see lib/serverAuth.ts's visitUsageDocRef), so there's no separate
// reset job: last month's doc is just never read again.
//
// ── Storage shape ────────────────────────────────────────────────────
//   users/{uid}/visitUsage/{YYYY-MM}   — { visits: number }
// Reuses the SAME wallet doc/ledger as the old token system
// (users/{uid}/wallet/account + its ledger subcollection) for overage
// billing — one wallet per account, debited in whichever unit
// (tokens or visits) the enforcement path currently in use calls for.
import type { PlanId } from './plans';

export const MONTHLY_VISIT_LIMITS: Record<PlanId, number> = {
  free: 1_000,
  starter: 50_000,
  scale: 400_000,
  'pro-developer': 1_000_000,
};

/** Monthly visit allowance for a plan. Every plan has a finite cap under this model — none are unlimited, since overage is always metered at the flat per-visit rate below once the allowance runs out. */
export function monthlyVisitLimit(plan: PlanId): number {
  return MONTHLY_VISIT_LIMITS[plan] ?? MONTHLY_VISIT_LIMITS.free;
}

// ── Overage pricing ──────────────────────────────────────────────────
// Flat $0.05 per 1,000 visits on every plan — no per-plan scaling.
// Priced in integer microcents (1 microcent = 1/100,000 USD) so a
// block has an exact, non-floating-point cost, same reasoning as the
// old token-bundle pricing in lib/wallet.ts.
export const OVERAGE_VISIT_BLOCK_SIZE = 1_000;

/** $0.05 per 1,000-visit block = 5,000 microcents. Flat across every plan. */
export const OVERAGE_MICROCENTS_PER_VISIT_BLOCK = 5_000;

export function overageMicrocentsPerVisitBlock(_plan?: PlanId): number {
  return OVERAGE_MICROCENTS_PER_VISIT_BLOCK;
}

/** How many whole 1,000-visit blocks are needed to cover `extraVisits` visits beyond the plan's monthly cap — always rounds UP, so even 1 overage visit needs (and costs) a full block. */
export function visitBlocksNeeded(extraVisits: number): number {
  if (extraVisits <= 0) return 0;
  return Math.ceil(extraVisits / OVERAGE_VISIT_BLOCK_SIZE);
}

/** Exact cost in integer microcents to buy enough whole 1,000-visit blocks to cover `extraVisits` visits beyond the monthly cap. */
export function overageCostMicrocentsForVisits(extraVisits: number): number {
  if (extraVisits <= 0) return 0;
  return visitBlocksNeeded(extraVisits) * OVERAGE_MICROCENTS_PER_VISIT_BLOCK;
}

export function microcentsToUsd(microcents: number): number {
  return Math.round(microcents) / 100_000;
}

/** How many whole extra visits a given microcent balance could still buy, at block granularity. For "visits left in an already-purchased block," see the wallet doc's bankedVisits field instead — this is only "what could still be bought." */
export function visitsAffordable(balanceMicrocents: number): number {
  if (balanceMicrocents <= 0) return 0;
  const wholeBlocks = Math.floor(balanceMicrocents / OVERAGE_MICROCENTS_PER_VISIT_BLOCK);
  return wholeBlocks * OVERAGE_VISIT_BLOCK_SIZE;
}

/** UTC calendar month key, e.g. "2026-11" — the shared reset boundary for the monthly visit counter. */
export function monthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

/** ISO timestamp of the next UTC-month rollover — when the monthly visit counter resets. Purely informational, for UI display. */
export function nextUtcMonthStartIso(d: Date = new Date()): string {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return next.toISOString();
}

export interface VisitPlanDisplay {
  id: PlanId;
  monthlyVisits: number;
}

/** Full per-plan monthly-visit table, for client UI that wants to show every tier's allowance at once (e.g. the pricing page, plan comparison). */
export const VISIT_PLAN_TABLE: VisitPlanDisplay[] = (Object.keys(MONTHLY_VISIT_LIMITS) as PlanId[]).map((id) => ({
  id,
  monthlyVisits: MONTHLY_VISIT_LIMITS[id],
}));
