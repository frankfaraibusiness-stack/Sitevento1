'use client';

// components/dashboard/VisitUsageCard.tsx
//
// Live "monthly visit allowance" card — the visit-model counterpart to
// DailyLimitCard, and now the PRIMARY usage card shown in two contexts:
//   - compact on the main dashboard (DashboardShell), right under the
//     existing PlanUsageStrip (site-count), as a second ambient strip
//   - full on ProfilePage, as its own dedicated "Your usage this
//     month" section with more breathing room and a bigger upsell push
//
// Data comes from hooks/useAccountLimits.ts, which wraps
// /api/site-limits's visitUsage field (lib/serverAuth.ts's
// getAccountVisitUsage) — the account-wide "one unit per tracked page
// view, against a MONTHLY allowance" counter. This component is purely
// presentational: it never fetches anything itself, so the same live
// data can drive both the dashboard strip and the profile section
// without two separate polling loops.
//
// Every plan has a finite monthly cap under this model (see
// lib/visits.ts — even Ventol Business's 1,000,000/month is a real
// number, not unlimited), so unlike DailyLimitCard this component has
// no "unlimited tier" branch.
//
// Visual language: a class-renamed copy of DailyLimitCard's structure
// (dlc- → vuc-) — same --dnx-glass/--dnx-shadow/--lime tokens, same
// animated glow ring, shimmering progress bar, and tone shift once
// usage crosses 70%/90% — so this reads as the same kind of live,
// attention-earning number DailyLimitCard was, just monthly instead of
// daily. Styling lives in styles/dashboard/visit-usage-card.css under
// its own `vuc-` namespace.
import { getPlan, PLANS, type PlanId } from '@/lib/plans';
import { useCountdown, type VisitUsage } from '@/hooks/useAccountLimits';
import { overageMicrocentsPerVisitBlock, microcentsToUsd } from '@/lib/visits';

interface VisitUsageCardProps {
  planId: PlanId;
  visitUsage: VisitUsage | null | undefined;
  /** The full per-plan monthly-visit-limit table, as returned by /api/site-limits (monthlyVisitLimits — mirrors lib/visits.ts's MONTHLY_VISIT_LIMITS). Used only to name the NEXT plan's cap in the upsell line; omit while that data hasn't loaded yet and the upsell simply won't show a number. */
  monthlyVisitLimits?: Record<PlanId, number> | null;
  onUpgrade: () => void;
  /** 'compact' for the dashboard strip, 'full' for the profile section. Defaults to 'compact'. */
  variant?: 'compact' | 'full';
  /** Current wallet balance in USD (lib/wallet.ts's VisitWalletSummary.balanceUsd), as returned alongside visitUsage by /api/site-limits. Undefined while that data hasn't loaded yet — treated the same as 0 (no "covered by wallet" messaging shown). */
  walletBalanceUsd?: number;
  /** Routes to /dashboard/wallet. Shown once usage is at/near the cap, as an alternative to upgrading — visits past the cap draw from the wallet automatically when it has balance, so this is "add more room" without a plan change. */
  onOpenWallet?: () => void;
}

function tierTone(pct: number): 'calm' | 'warm' | 'hot' {
  if (pct >= 90) return 'hot';
  if (pct >= 70) return 'warm';
  return 'calm';
}

export function VisitUsageCard({
  planId,
  visitUsage,
  monthlyVisitLimits,
  onUpgrade,
  variant = 'compact',
  walletBalanceUsd,
  onOpenWallet,
}: VisitUsageCardProps) {
  const plan = getPlan(planId);
  const nextPlan = PLANS[PLANS.findIndex((p) => p.id === planId) + 1] || null;
  const countdown = useCountdown(visitUsage?.resetsAt);

  const used = visitUsage?.used ?? 0;
  const limit = visitUsage?.limit ?? 0;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = tierTone(pct);
  const remaining = visitUsage?.remaining ?? null;
  const overageVisitsThisMonth = visitUsage?.overageVisitsThisMonth ?? 0;
  const hasWalletFunds = (walletBalanceUsd ?? 0) > 0;

  const loading = !visitUsage;

  return (
    <div className={`vuc-card vuc-${variant} vuc-tone-${tone}${loading ? ' is-loading' : ''}`}>
      <div className="vuc-glow" aria-hidden="true" />

      <div className="vuc-top">
        <div className="vuc-title-group">
          <span className="vuc-kicker">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.2 1.9" />
            </svg>
            Monthly visit allowance
          </span>
          {variant === 'full' && <h2>Your usage this month</h2>}
        </div>
        <span className="vuc-plan-pill">{plan.name}</span>
      </div>

      {loading ? (
        <div className="vuc-skeleton" aria-hidden="true">
          <div className="vuc-skeleton-line vuc-skeleton-wide" />
          <div className="vuc-skeleton-bar" />
        </div>
      ) : (
        <>
          <div className="vuc-counter-row">
            <div className="vuc-counter">
              <span className="vuc-counter-num">{used.toLocaleString()}</span>
              <span className="vuc-counter-sep">/</span>
              <span className="vuc-counter-cap">{limit.toLocaleString()}</span>
              <span className="vuc-counter-label">visits used</span>
            </div>
            {countdown && (
              <div className="vuc-countdown">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.2 1.9" />
                </svg>
                <span>
                  Resets in <strong>{countdown}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="vuc-track" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
            <div className="vuc-fill" style={{ width: `${pct}%` }}>
              <span className="vuc-fill-shimmer" aria-hidden="true" />
            </div>
          </div>

          <div className="vuc-foot">
            <span className="vuc-foot-note">
              {overageVisitsThisMonth > 0
                ? `${overageVisitsThisMonth.toLocaleString()} extra visits this month, covered by your wallet`
                : remaining !== null && remaining > 0
                ? `${remaining.toLocaleString()} visits left this month`
                : "You've used this month's full allowance"}
            </span>

            {overageVisitsThisMonth === 0 && remaining === 0 && hasWalletFunds && onOpenWallet ? (
              <button type="button" className="vuc-upsell vuc-upsell-wallet" onClick={onOpenWallet}>
                <span className="vuc-upsell-text">
                  <strong>Keep going with your wallet</strong>
                  <span>${walletBalanceUsd!.toFixed(2)} available · ${microcentsToUsd(overageMicrocentsPerVisitBlock(planId)).toFixed(2)} per 1,000 visits</span>
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ) : (
              nextPlan &&
              (tone !== 'calm' || variant === 'full') && (
                <button type="button" className="vuc-upsell" onClick={onUpgrade}>
                  <span className="vuc-upsell-text">
                    <strong>
                      {tone === 'hot' ? `Upgrade to ${nextPlan.name}` : `${nextPlan.name} gives you more room`}
                    </strong>
                    <span>
                      {(() => {
                        const cap = monthlyVisitLimits ? monthlyVisitLimits[nextPlan.id] : undefined;
                        if (cap === undefined) return `${nextPlan.priceDisplay}/mo`;
                        return `Up to ${cap.toLocaleString()} visits/month · ${nextPlan.priceDisplay}/mo`;
                      })()}
                    </span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )
            )}
          </div>

          {variant === 'full' && tone === 'hot' && overageVisitsThisMonth === 0 && (
            <p className="vuc-urgent-note">
              {hasWalletFunds && onOpenWallet ? (
                <>
                  You&rsquo;re almost out of this month&rsquo;s visits. Once you hit the cap, usage will automatically
                  draw from your wallet (${walletBalanceUsd!.toFixed(2)} available) instead of pausing.
                </>
              ) : (
                <>
                  You&rsquo;re almost out of this month&rsquo;s visits. Once you hit the cap, visitor-facing widgets
                  will pause until it resets —{' '}
                  {onOpenWallet ? (
                    <button type="button" className="vuc-urgent-link" onClick={onOpenWallet}>
                      add wallet funds
                    </button>
                  ) : (
                    'add wallet funds'
                  )}{' '}
                  to keep going instead.
                </>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
