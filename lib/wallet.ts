// lib/wallet.ts
//
// Client-safe data model + pricing for the global wallet — a single,
// account-wide prepaid USD balance (NOT per-site, unlike
// advertiserAccount/billing which is scoped to ad spend). Its one job
// today: pay for writes beyond a plan's DEFAULT_DAILY_WRITE_LIMITS
// (lib/limits.ts) cap instead of hard-pausing the account the instant
// that cap is hit.
//
// ── Overage pricing ───────────────────────────────────────────────
// Overage writes (once the plan's daily cap is exceeded) are sold in
// whole BUNDLES, never metered per-write: a bundle of 100,000 extra
// writes, minimum 1 bundle, no upper limit. Any overage amount — even
// a single extra write — rounds UP to the next whole bundle; there is
// no partial-bundle price and no free write. The per-bundle PRICE
// scales down by plan (see OVERAGE_MICROCENTS_PER_BUNDLE_BY_PLAN
// below: $2.00/$1.50/$1.00/$0.50 for free/starter/scale/pro-developer
// respectively) while the bundle SIZE stays 100,000 writes for every
// plan. Priced in integer microcents internally so a bundle has an
// exact, non-floating-point cost and a long run of purchases can't
// drift from rounding the way repeated toFixed(2) accumulation would.
//
// ── Storage shape ─────────────────────────────────────────────────
//   users/{uid}/wallet/account          — WalletAccountDoc (the balance)
//   users/{uid}/wallet/ledger/{entryId} — WalletLedgerEntry (every
//                                          deposit and every overage
//                                          debit, newest-first history)
// Both written exclusively server-side (Admin SDK) — see
// firestore.rules's users/{uid}/wallet/{document=**} block, mirroring
// the existing advertiserAccount/billing carve-out: a client-writable
// balance could top itself up for free, so there is no client write
// path at all, same reasoning as that ledger.
import type { PlanId } from './plans';

// Bundle SIZE is the same for every plan — 100,000 overage writes per
// bundle — but the PRICE per bundle scales down as the account
// upgrades, as a retention lever: a Free account overrunning its tiny
// daily cap pays the most per bundle, while Pro Developer (already
// paying $99/mo for a 1.5M/day cap) pays the least for the rare
// overage it hits. Prices are in whole integer microcents (1
// microcent = 1/100,000 of a dollar) so every bundle has an exact,
// non-floating-point cost — no repeating decimal anywhere in this
// file.
export const OVERAGE_WRITE_BUNDLE_SIZE = 100_000;

export const OVERAGE_MICROCENTS_PER_BUNDLE_BY_PLAN: Record<PlanId, number> = {
  free: 200_000, // = $2.00
  starter: 150_000, // = $1.50
  scale: 100_000, // = $1.00
  'pro-developer': 50_000, // = $0.50
};

/** The per-bundle price (in microcents) for a given plan. */
export function overageMicrocentsPerBundle(planId: PlanId): number {
  return OVERAGE_MICROCENTS_PER_BUNDLE_BY_PLAN[planId];
}

/** How many whole bundles are needed to cover `extraWrites` writes beyond the plan's daily cap — always rounds UP, so even 1 overage write needs (and costs) a full bundle. Bundle SIZE doesn't vary by plan, only price does, so this takes no planId. */
export function bundlesNeeded(extraWrites: number): number {
  if (extraWrites <= 0) return 0;
  return Math.ceil(extraWrites / OVERAGE_WRITE_BUNDLE_SIZE);
}

/** Exact cost in USD (as a plain number, already rounded to the cent) to buy enough whole bundles to cover `extraWrites` writes beyond `planId`'s daily cap, at that plan's per-bundle rate. */
export function overageCostUsd(extraWrites: number, planId: PlanId): number {
  if (extraWrites <= 0) return 0;
  return microcentsToUsd(overageCostMicrocents(extraWrites, planId));
}

/** Exact cost in integer microcents (for server-side ledger math — no floats in the actual balance debit) to buy enough whole bundles to cover `extraWrites` writes, at `planId`'s per-bundle rate. Always a whole multiple of that plan's per-bundle price — there is no partial-bundle price. */
export function overageCostMicrocents(extraWrites: number, planId: PlanId): number {
  if (extraWrites <= 0) return 0;
  return bundlesNeeded(extraWrites) * overageMicrocentsPerBundle(planId);
}

/** How many whole extra writes a given microcent balance can still cover, at bundle granularity and `planId`'s per-bundle rate (i.e. the writes available from whole bundles that balance could buy at this plan's price). For "writes left in an already-purchased bundle," use the usage doc's bundle-bank field instead — this is only for "what could still be bought." */
export function writesAffordable(balanceMicrocents: number, planId: PlanId): number {
  if (balanceMicrocents <= 0) return 0;
  const wholeBundles = Math.floor(balanceMicrocents / overageMicrocentsPerBundle(planId));
  return wholeBundles * OVERAGE_WRITE_BUNDLE_SIZE;
}

export function microcentsToUsd(microcents: number): number {
  return Math.round(microcents) / 100_000;
}

export function usdToMicrocents(usd: number): number {
  return Math.round(usd * 100_000);
}

export const MIN_DEPOSIT_USD = 5;
export const MAX_DEPOSIT_USD = 2_000;

/** Preset deposit amounts shown as quick-pick chips on the wallet page. */
export const DEPOSIT_PRESETS_USD = [10, 25, 50, 100] as const;

export interface WalletAccountDoc {
  /** Current spendable balance, in integer microcents (1/100,000 USD) — never a float dollar amount, so overage debits are always exact. */
  balanceMicrocents: number;
  /** Lifetime total ever deposited, in microcents — for the "Total deposited" stat; never decreases. */
  lifetimeDepositedMicrocents: number;
  /** Lifetime total ever spent on overage writes, in microcents — for the "Total spent" stat; never decreases. */
  lifetimeSpentMicrocents: number;
  /** Whether wallet overage coverage is active. On by default once a wallet exists — this is a spending switch, not an account-deletion one: off simply means "fall back to hard-pausing at the daily cap," matching pre-wallet behavior. */
  autoRechargeEnabled?: boolean;
  updatedAt?: unknown;
  createdAt?: unknown;
}

export type WalletLedgerKind = 'deposit' | 'overage-debit' | 'adjustment';

export interface WalletLedgerEntry {
  id: string;
  kind: WalletLedgerKind;
  /** Signed amount in microcents: positive for deposits/credits, negative for debits. */
  amountMicrocents: number;
  /** Resulting balance immediately after this entry, in microcents — lets the UI render a running-balance ledger without re-summing. */
  balanceAfterMicrocents: number;
  /** For 'overage-debit' entries only: how many extra writes this entry paid for. */
  writesCovered?: number;
  /** For 'overage-debit' entries only: the plan active when the overage happened (context for the history row). */
  planId?: PlanId;
  note?: string;
  createdAt: string; // ISO — converted server-side from the Firestore Timestamp before the API response reaches the client
}

export interface WalletSummary {
  balanceMicrocents: number;
  balanceUsd: number;
  lifetimeDepositedUsd: number;
  lifetimeSpentUsd: number;
  autoRechargeEnabled: boolean;
  /** How many more extra writes today's balance alone could cover, at the caller's current plan rate — a concrete, honest number rather than just a dollar figure. */
  writesAffordable: number;
  /** The per-bundle overage price (in USD) for the plan this summary was computed for — lets the UI show "your rate" without re-deriving it from OVERAGE_MICROCENTS_PER_BUNDLE_BY_PLAN. */
  overageRateUsdPerBundle: number;
}

/** `planId` determines the per-bundle rate used for `writesAffordable` — the wallet doc itself is plan-agnostic (one wallet per account), but what a given balance can buy depends on the account's CURRENT plan, since overage pricing now scales by plan. */
export function summarizeWallet(doc: WalletAccountDoc | null, planId: PlanId): WalletSummary {
  const balanceMicrocents = doc?.balanceMicrocents ?? 0;
  return {
    balanceMicrocents,
    balanceUsd: microcentsToUsd(balanceMicrocents),
    lifetimeDepositedUsd: microcentsToUsd(doc?.lifetimeDepositedMicrocents ?? 0),
    lifetimeSpentUsd: microcentsToUsd(doc?.lifetimeSpentMicrocents ?? 0),
    autoRechargeEnabled: doc?.autoRechargeEnabled ?? true,
    writesAffordable: writesAffordable(balanceMicrocents, planId),
    overageRateUsdPerBundle: microcentsToUsd(overageMicrocentsPerBundle(planId)),
  };
}
