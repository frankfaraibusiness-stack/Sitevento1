// lib/wallet.ts
//
// Client-safe data model + pricing for the global wallet — a single,
// account-wide prepaid USD balance (NOT per-site, unlike
// advertiserAccount/billing which is scoped to ad spend). Its one job
// today: pay for tokens beyond a plan's DEFAULT_DAILY_TOKEN_LIMITS
// (lib/limits.ts) cap instead of hard-pausing the account the instant
// that cap is hit.
//
// ── Overage pricing ───────────────────────────────────────────────
// Overage tokens (once the plan's daily cap is exceeded) are sold in
// whole BUNDLES, never metered per-token: a bundle of 100,000 extra
// tokens, minimum 1 bundle, no upper limit. Any overage amount — even
// a single extra token — rounds UP to the next whole bundle; there is
// no partial-bundle price and no free token. The per-bundle PRICE
// scales down by plan (see OVERAGE_MICROCENTS_PER_BUNDLE_BY_PLAN
// below: $2.00/$1.50/$1.00/$0.50 for free/starter/scale/pro-developer
// respectively) while the bundle SIZE stays 100,000 tokens for every
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

// Bundle SIZE is the same for every plan — 100,000 overage tokens per
// bundle — but the PRICE per bundle scales down as the account
// upgrades, as a retention lever: a Ventol Free account overrunning its tiny
// daily cap pays the most per bundle, while Ventol Business (already
// paying $99/mo for a 1,000,000/day cap) pays the least for the rare
// overage it hits. Prices are in whole integer microcents (1
// microcent = 1/100,000 of a dollar) so every bundle has an exact,
// non-floating-point cost — no repeating decimal anywhere in this
// file.
export const OVERAGE_TOKEN_BUNDLE_SIZE = 100_000;

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

/** How many whole bundles are needed to cover `extraTokens` tokens beyond the plan's daily cap — always rounds UP, so even 1 overage token needs (and costs) a full bundle. Bundle SIZE doesn't vary by plan, only price does, so this takes no planId. */
export function bundlesNeeded(extraTokens: number): number {
  if (extraTokens <= 0) return 0;
  return Math.ceil(extraTokens / OVERAGE_TOKEN_BUNDLE_SIZE);
}

/** Exact cost in USD (as a plain number, already rounded to the cent) to buy enough whole bundles to cover `extraTokens` tokens beyond `planId`'s daily cap, at that plan's per-bundle rate. */
export function overageCostUsd(extraTokens: number, planId: PlanId): number {
  if (extraTokens <= 0) return 0;
  return microcentsToUsd(overageCostMicrocents(extraTokens, planId));
}

/** Exact cost in integer microcents (for server-side ledger math — no floats in the actual balance debit) to buy enough whole bundles to cover `extraTokens` tokens, at `planId`'s per-bundle rate. Always a whole multiple of that plan's per-bundle price — there is no partial-bundle price. */
export function overageCostMicrocents(extraTokens: number, planId: PlanId): number {
  if (extraTokens <= 0) return 0;
  return bundlesNeeded(extraTokens) * overageMicrocentsPerBundle(planId);
}

/** How many whole extra tokens a given microcent balance can still cover, at bundle granularity and `planId`'s per-bundle rate (i.e. the tokens available from whole bundles that balance could buy at this plan's price). For "tokens left in an already-purchased bundle," use the usage doc's bundle-bank field instead — this is only for "what could still be bought." */
export function tokensAffordable(balanceMicrocents: number, planId: PlanId): number {
  if (balanceMicrocents <= 0) return 0;
  const wholeBundles = Math.floor(balanceMicrocents / overageMicrocentsPerBundle(planId));
  return wholeBundles * OVERAGE_TOKEN_BUNDLE_SIZE;
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
  /** Lifetime total ever spent on overage tokens, in microcents — for the "Total spent" stat; never decreases. */
  lifetimeSpentMicrocents: number;
  /** Whether wallet overage coverage is active. On by default once a wallet exists — this is a spending switch, not an account-deletion one: off simply means "fall back to hard-pausing at the daily cap," matching pre-wallet behavior. */
  autoRechargeEnabled?: boolean;
  /** Already-purchased overage tokens not yet spent — the leftover from whatever whole bundle(s) were last bought (bundles are always bought in units of OVERAGE_TOKEN_BUNDLE_SIZE, so there's usually some remainder). Lives on THIS permanent doc, not the daily usage doc, specifically so it does NOT reset at UTC midnight: the user paid real wallet money for these tokens, so they're owned permanently and are only ever drawn down (never zeroed by a day rolling over) until spent. Read/written exclusively by lib/serverAuth.ts's checkAndIncrementAccountTokens / assertWidgetTokensAllowed, inside the same transaction as the balance debit. */
  bankedTokens?: number;
  /** Visit-model counterpart to bankedTokens — already-purchased overage VISITS not yet spent (see lib/visits.ts), for accounts whose routes are wired to the new per-visit billing model instead of the token model. Same permanent-doc, never-expires semantics; read/written by lib/serverAuth.ts's checkAndIncrementAccountVisits / assertWidgetVisitsAllowed. Independent of bankedTokens — the two counters never mix units. */
  bankedVisits?: number;
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
  /** For 'overage-debit' entries only: how many extra tokens this entry paid for. */
  tokensCovered?: number;
  /** For 'overage-debit' entries made under the new per-visit model (lib/visits.ts): how many extra visits this entry paid for. Mutually exclusive with tokensCovered — an entry is one or the other, never both. */
  visitsCovered?: number;
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
  /** How many more extra tokens today's balance alone could cover, at the caller's current plan rate — a concrete, honest number rather than just a dollar figure. */
  tokensAffordable: number;
  /** The per-bundle overage price (in USD) for the plan this summary was computed for — lets the UI show "your rate" without re-deriving it from OVERAGE_MICROCENTS_PER_BUNDLE_BY_PLAN. */
  overageRateUsdPerBundle: number;
  /** Already-purchased, not-yet-spent overage tokens sitting in the permanent bank (WalletAccountDoc.bankedTokens) — owned outright, never expires, drawn down before any new bundle is bought or any dollar balance is touched. This is DIFFERENT from `tokensAffordable`: that's "what the dollar balance COULD still buy"; this is "what's already been bought and is just sitting there unspent." */
  bankedTokens: number;
  /** bankedTokens + tokensAffordable — the full permanent-token picture: tokens already owned, plus tokens the remaining balance could still turn into. The number the ledger card leads with. */
  totalPermanentTokens: number;
}

/** `planId` determines the per-bundle rate used for `tokensAffordable` — the wallet doc itself is plan-agnostic (one wallet per account), but what a given balance can buy depends on the account's CURRENT plan, since overage pricing now scales by plan. */
export function summarizeWallet(doc: WalletAccountDoc | null, planId: PlanId): WalletSummary {
  const balanceMicrocents = doc?.balanceMicrocents ?? 0;
  const bankedTokens = doc?.bankedTokens ?? 0;
  const affordable = tokensAffordable(balanceMicrocents, planId);
  return {
    balanceMicrocents,
    balanceUsd: microcentsToUsd(balanceMicrocents),
    lifetimeDepositedUsd: microcentsToUsd(doc?.lifetimeDepositedMicrocents ?? 0),
    lifetimeSpentUsd: microcentsToUsd(doc?.lifetimeSpentMicrocents ?? 0),
    autoRechargeEnabled: doc?.autoRechargeEnabled ?? true,
    tokensAffordable: affordable,
    overageRateUsdPerBundle: microcentsToUsd(overageMicrocentsPerBundle(planId)),
    bankedTokens,
    totalPermanentTokens: bankedTokens + affordable,
  };
}

// DEPRECATED aliases — kept only so any lingering import of the old
// write-based names doesn't break the build. Prefer the token-named
// exports above in new code.
export const OVERAGE_WRITE_BUNDLE_SIZE = OVERAGE_TOKEN_BUNDLE_SIZE;
export const writesAffordable = tokensAffordable;

// ── Visit-model wallet summary (new, additive) ───────────────────────
// Mirrors summarizeWallet/WalletSummary above exactly, just reading
// the visit-model fields (bankedVisits) and pricing (lib/visits.ts's
// flat $0.10/1,000-visit rate) instead of the token-model ones. Same
// wallet doc, different unit of account — the two summaries can be
// computed side by side off one WalletAccountDoc read.
import { visitsAffordable, OVERAGE_MICROCENTS_PER_VISIT_BLOCK } from './visits';

export interface VisitWalletSummary {
  balanceMicrocents: number;
  balanceUsd: number;
  lifetimeDepositedUsd: number;
  lifetimeSpentUsd: number;
  autoRechargeEnabled: boolean;
  /** How many more extra visits today's balance alone could cover, at the flat $0.10/1,000-visit rate. */
  visitsAffordable: number;
  /** The flat per-1,000-visit overage price in USD (same on every plan). */
  overageRateUsdPerThousandVisits: number;
  /** Already-purchased, not-yet-spent overage visits sitting in the permanent bank (WalletAccountDoc.bankedVisits). */
  bankedVisits: number;
  /** bankedVisits + visitsAffordable — the full permanent-visit picture. */
  totalPermanentVisits: number;
}

export function summarizeVisitWallet(doc: (WalletAccountDoc & { bankedVisits?: number }) | null): VisitWalletSummary {
  const balanceMicrocents = doc?.balanceMicrocents ?? 0;
  const bankedVisits = doc?.bankedVisits ?? 0;
  const affordable = visitsAffordable(balanceMicrocents);
  return {
    balanceMicrocents,
    balanceUsd: microcentsToUsd(balanceMicrocents),
    lifetimeDepositedUsd: microcentsToUsd(doc?.lifetimeDepositedMicrocents ?? 0),
    lifetimeSpentUsd: microcentsToUsd(doc?.lifetimeSpentMicrocents ?? 0),
    autoRechargeEnabled: doc?.autoRechargeEnabled ?? true,
    visitsAffordable: affordable,
    overageRateUsdPerThousandVisits: microcentsToUsd(OVERAGE_MICROCENTS_PER_VISIT_BLOCK),
    bankedVisits,
    totalPermanentVisits: bankedVisits + affordable,
  };
}
