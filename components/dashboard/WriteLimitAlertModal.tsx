'use client';

// components/dashboard/WriteLimitAlertModal.tsx
//
// Fixes a real "silent failure" bug: when an account's daily write cap
// (lib/limits.ts's DEFAULT_DAILY_WRITE_LIMITS) runs low or hits zero,
// nothing in the UI said so beyond a small inline chip on DailyLimitCard
// that a site owner has to go looking for. A user watching their
// dashboard had no way to tell "visitors are still landing on my site,
// but their visits/leads/chat messages have quietly stopped being
// recorded" — or, if pay-as-you-go is on, that they're now spending
// real money per bundle without ever being told. This modal is the
// can't-miss version of that same signal, shown via
// hooks/useWriteLimitAlert.ts's once-per-day-per-severity logic on both
// screens that already render DailyLimitCard (DashboardShell, compact;
// ProfilePage, full) — see each file's own mount of this component for
// why both: a user's first glance could land on either one.
//
// Two tiers, both already computed by the hook:
//   'yellow' — under 20% of today's free writes left. Early warning,
//              softer visual treatment, no implication anything has
//              failed yet.
//   'red'    — fully used. Writes past this point are either being
//              blocked outright (pay-as-you-go off / wallet empty) or
//              silently billing the wallet (pay-as-you-go on) — the
//              copy below is explicit about which, so there's no
//              ambiguity about whether data is being lost right now.
//
// Both tiers offer the same two upsell paths, since they solve the
// same underlying problem from different angles:
//   - Upgrade plan → a materially higher daily cap, permanently.
//   - Enable pay-as-you-go → lib/wallet.ts's bundle system
//     (OVERAGE_MICROCENTS_PER_BUNDLE_BY_PLAN) keeps writes flowing past
//     the cap automatically, billed per 100,000-write bundle at this
//     plan's rate, without changing plans. If the wallet already has a
//     balance and auto-recharge is simply off, this flips it on in
//     place; if the wallet is empty, it routes to the wallet page to
//     fund it first (flipping the switch on an empty wallet would just
//     mean the next overage call falls straight through to
//     WriteLimitReachedError anyway, so there's nothing to turn on
//     until there's money behind it).
import { useEffect } from 'react';
import { getPlan, PLANS, type PlanId } from '@/lib/plans';
import { overageMicrocentsPerBundle, microcentsToUsd, OVERAGE_WRITE_BUNDLE_SIZE, type WalletSummary } from '@/lib/wallet';
import { useScrollLock } from '@/hooks/useScrollLock';
import type { WriteUsage } from '@/hooks/useAccountLimits';
import type { WriteLimitSeverity } from '@/hooks/useWriteLimitAlert';

interface WriteLimitAlertModalProps {
  severity: WriteLimitSeverity | null;
  planId: PlanId;
  writeUsage: WriteUsage | null | undefined;
  wallet: WalletSummary | null | undefined;
  onDismiss: () => void;
  onUpgrade: () => void;
  /** Routes to /dashboard/wallet to fund it — used when there's no balance to turn pay-as-you-go on with yet. */
  onOpenWallet: () => void;
  /** Flips autoRechargeEnabled on directly — used when the wallet already has a balance, so there's no need to leave the page first. */
  onEnablePayAsYouGo: () => void;
}

export function WriteLimitAlertModal({
  severity,
  planId,
  writeUsage,
  wallet,
  onDismiss,
  onUpgrade,
  onOpenWallet,
  onEnablePayAsYouGo,
}: WriteLimitAlertModalProps) {
  const open = severity !== null;
  useScrollLock(open);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onDismiss();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onDismiss]);

  if (!severity || !writeUsage || writeUsage.limit === null) return null;

  const plan = getPlan(planId);
  const nextPlan = PLANS.find((p) => (p.limits.connectedSites > plan.limits.connectedSites));
  const limit = writeUsage.limit;
  const used = writeUsage.used;
  const remaining = Math.max(0, limit - used);
  const remainingPct = Math.round((remaining / limit) * 100);

  const balanceUsd = wallet?.balanceUsd ?? 0;
  const autoRechargeEnabled = wallet?.autoRechargeEnabled ?? true;
  const hasWalletFunds = balanceUsd > 0;
  const payAsYouGoActive = autoRechargeEnabled && hasWalletFunds;
  const bundleRateUsd = microcentsToUsd(overageMicrocentsPerBundle(planId));

  const isRed = severity === 'red';

  // Red-tier copy depends on whether pay-as-you-go is actively
  // covering overage right now (money is already being spent, so say
  // so) or writes are flatly blocked (nothing is being recorded).
  const redIsBilling = payAsYouGoActive;

  function handleEnablePayAsYouGo() {
    if (hasWalletFunds) {
      onEnablePayAsYouGo();
    } else {
      onOpenWallet();
    }
  }

  return (
    <div
      className={`wla-backdrop${open ? ' is-open' : ''}${isRed ? ' is-red' : ' is-yellow'}`}
      role="dialog"
      aria-modal="true"
      aria-label={isRed ? 'Daily write limit reached' : 'Daily write limit running low'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="wla-modal">
        <button type="button" className="wla-close" aria-label="Close" onClick={onDismiss}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="wla-glow" aria-hidden="true" />

        <div className="wla-icon-ring">
          {isRed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v6M12 16.8h.01" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="M12 3l9 16H3l9-16z" strokeLinejoin="round" />
              <path d="M12 9.5v4M12 16.8h.01" strokeLinecap="round" />
            </svg>
          )}
        </div>

        <span className="wla-pill">{isRed ? 'Limit reached' : 'Running low'}</span>

        <h2 className="wla-title">
          {isRed
            ? redIsBilling
              ? "You've used today's free writes — your wallet is covering the rest"
              : "You've used today's free writes"
            : `Only ${remainingPct}% of today's free writes are left`}
        </h2>

        <p className="wla-body">
          {isRed ? (
            redIsBilling ? (
              <>
                Every write past your {plan.name} plan&apos;s {limit.toLocaleString()}/day cap is now drawing from your
                wallet in 100,000-write bundles (${bundleRateUsd.toFixed(2)} each) until it resets at UTC midnight —
                nothing is being lost, but it is costing you.
              </>
            ) : (
              <>
                New visits, leads, chat messages, and other write-backed activity are <strong>not being recorded</strong>{' '}
                right now — your {plan.name} plan&apos;s {limit.toLocaleString()}/day cap is used up and pay-as-you-go
                isn&apos;t covering the gap. This resets at UTC midnight, or you can fix it now below.
              </>
            )
          ) : (
            <>
              {used.toLocaleString()} of {limit.toLocaleString()} writes used today on your {plan.name} plan — once
              you hit the cap, new activity either stops being recorded or starts billing your wallet, depending on
              your pay-as-you-go setting.
            </>
          )}
        </p>

        <div className="wla-track" aria-hidden="true">
          <div className={`wla-track-fill${isRed ? ' is-red' : ' is-yellow'}`} style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
        </div>
        <div className="wla-track-caption">
          <span>{used.toLocaleString()} used</span>
          <span>{limit.toLocaleString()}/day</span>
        </div>

        <div className="wla-options">
          <div className="wla-option">
            <div className="wla-option-head">
              <span className="wla-option-icon wla-option-icon-upgrade" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <strong>Upgrade your plan</strong>
                <span>
                  {nextPlan
                    ? `${nextPlan.name} gives you ${nextPlan.limits.connectedSites > plan.limits.connectedSites ? 'a much higher' : 'a higher'} daily cap, permanently.`
                    : "You're already on our top tier."}
                </span>
              </div>
            </div>
            <button type="button" className="wla-option-btn wla-option-btn-primary" onClick={onUpgrade}>
              {nextPlan ? `View ${nextPlan.name} plan` : 'View plans'}
            </button>
          </div>

          <div className="wla-option">
            <div className="wla-option-head">
              <span className="wla-option-icon wla-option-icon-wallet" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <rect x="3" y="6" width="18" height="13" rx="2.5" />
                  <path d="M3 10h18" />
                  <circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <div>
                <strong>{payAsYouGoActive ? 'Pay-as-you-go is on' : 'Enable pay-as-you-go'}</strong>
                <span>
                  {payAsYouGoActive
                    ? `Covered by your wallet — $${bundleRateUsd.toFixed(2)} per 100,000-write bundle, bought automatically as needed.`
                    : hasWalletFunds
                    ? `Your wallet has $${balanceUsd.toFixed(2)} — turn this on to keep writes flowing at $${bundleRateUsd.toFixed(2)} per 100,000-write bundle.`
                    : `Add funds and writes keep flowing automatically at $${bundleRateUsd.toFixed(2)} per ${OVERAGE_WRITE_BUNDLE_SIZE.toLocaleString()}-write bundle, instead of stopping.`}
                </span>
              </div>
            </div>
            {!payAsYouGoActive && (
              <button type="button" className="wla-option-btn wla-option-btn-secondary" onClick={handleEnablePayAsYouGo}>
                {hasWalletFunds ? 'Turn on pay-as-you-go' : 'Add funds to wallet'}
              </button>
            )}
          </div>
        </div>

        <button type="button" className="wla-dismiss-link" onClick={onDismiss}>
          {isRed ? "I'll wait for the reset" : 'Not now'}
        </button>
      </div>
    </div>
  );
}
