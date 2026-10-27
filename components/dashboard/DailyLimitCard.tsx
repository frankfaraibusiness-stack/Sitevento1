'use client';

// components/dashboard/DailyLimitCard.tsx
//
// Live "daily write limit" card — one shared component rendered in two
// contexts:
//   - compact on the main dashboard (DashboardShell), right under the
//     existing PlanUsageStrip (site-count), as a second ambient strip
//   - full on ProfilePage, as its own dedicated "Daily limits" section
//     with more breathing room and a bigger upsell push
//
// Data comes from hooks/useAccountLimits.ts, which wraps
// /api/site-limits's writeUsage field (lib/serverAuth.ts's
// getAccountWriteUsage) — the account-wide "every write + every widget
// callback counts +1/day" counter introduced alongside
// app/api/user-action. This component is purely presentational: it
// never fetches anything itself, so the same live data can drive both
// the dashboard strip and the profile section without two separate
// polling loops.
//
// Visual language: builds on the same --dnx-glass/--dnx-shadow/--lime
// tokens as dashboard-premium.css's .dnx-usage-strip, but pushed further
// — a soft animated glow ring behind the live counter, a shimmering
// progress bar, a monospace ticking countdown, and (only once usage
// crosses 70%) a playful "running low" tone shift — so this reads as the
// one truly *live*, attention-earning number on the page, distinct from
// the static site-count bar beside it. Styling lives in
// styles/dashboard/daily-limit-card.css under its own `dlc-` namespace.
import { getPlan, PLANS, type PlanId } from '@/lib/plans';
import { useCountdown, type WriteUsage } from '@/hooks/useAccountLimits';

interface DailyLimitCardProps {
  planId: PlanId;
  writeUsage: WriteUsage | null | undefined;
  /** The full per-plan daily-write-limit table, as returned by /api/site-limits (dailyWriteLimits — mirrors lib/serverAuth.ts's DEFAULT_DAILY_WRITE_LIMITS). Used only to name the NEXT plan's cap in the upsell line; omit while that data hasn't loaded yet and the upsell simply won't show a number. */
  dailyWriteLimits?: Record<PlanId, number | null> | null;
  onUpgrade: () => void;
  /** 'compact' for the dashboard strip, 'full' for the profile section. Defaults to 'compact'. */
  variant?: 'compact' | 'full';
}

function tierTone(pct: number): 'calm' | 'warm' | 'hot' {
  if (pct >= 90) return 'hot';
  if (pct >= 70) return 'warm';
  return 'calm';
}

export function DailyLimitCard({ planId, writeUsage, dailyWriteLimits, onUpgrade, variant = 'compact' }: DailyLimitCardProps) {
  const plan = getPlan(planId);
  const nextPlan = PLANS[PLANS.findIndex((p) => p.id === planId) + 1] || null;
  const countdown = useCountdown(writeUsage?.resetsAt);

  // Unlimited tier (Pro Developer): no bar/countdown needed, just a
  // calm confirmation instead of a 0/∞ progress bar that would read as
  // broken.
  const unlimited = writeUsage ? writeUsage.limit === null : false;

  const used = writeUsage?.used ?? 0;
  const limit = writeUsage?.limit ?? null;
  const pct = !unlimited && limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = tierTone(pct);
  const remaining = writeUsage?.remaining ?? null;

  const loading = !writeUsage;

  return (
    <div className={`dlc-card dlc-${variant} dlc-tone-${unlimited ? 'calm' : tone}${loading ? ' is-loading' : ''}`}>
      <div className="dlc-glow" aria-hidden="true" />

      <div className="dlc-top">
        <div className="dlc-title-group">
          <span className="dlc-kicker">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.2 1.9" />
            </svg>
            Daily write limit
          </span>
          {variant === 'full' && <h2>Your usage today</h2>}
        </div>
        <span className="dlc-plan-pill">{plan.name}</span>
      </div>

      {loading ? (
        <div className="dlc-skeleton" aria-hidden="true">
          <div className="dlc-skeleton-line dlc-skeleton-wide" />
          <div className="dlc-skeleton-bar" />
        </div>
      ) : unlimited ? (
        <div className="dlc-unlimited">
          <span className="dlc-unlimited-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
            Unlimited
          </span>
          <p>Your {plan.name} plan has no daily write cap — every action goes through, no counting.</p>
        </div>
      ) : (
        <>
          <div className="dlc-counter-row">
            <div className="dlc-counter">
              <span className="dlc-counter-num">{used.toLocaleString()}</span>
              <span className="dlc-counter-sep">/</span>
              <span className="dlc-counter-cap">{(limit ?? 0).toLocaleString()}</span>
              <span className="dlc-counter-label">writes used</span>
            </div>
            {countdown && (
              <div className="dlc-countdown">
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

          <div className="dlc-track" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit ?? 0}>
            <div className="dlc-fill" style={{ width: `${pct}%` }}>
              <span className="dlc-fill-shimmer" aria-hidden="true" />
            </div>
          </div>

          <div className="dlc-foot">
            <span className="dlc-foot-note">
              {remaining !== null && remaining > 0
                ? `${remaining.toLocaleString()} writes left today`
                : "You've used today's full allowance"}
            </span>

            {nextPlan && (tone !== 'calm' || variant === 'full') && (
              <button type="button" className="dlc-upsell" onClick={onUpgrade}>
                <span className="dlc-upsell-text">
                  <strong>
                    {tone === 'hot' ? `Upgrade to ${nextPlan.name}` : `${nextPlan.name} gives you more room`}
                  </strong>
                  <span>
                    {(() => {
                      const cap = dailyWriteLimits ? dailyWriteLimits[nextPlan.id] : undefined;
                      if (cap === undefined) return `${nextPlan.priceDisplay}/mo`;
                      return `Up to ${cap === null ? 'unlimited' : cap.toLocaleString()} writes/day · ${nextPlan.priceDisplay}/mo`;
                    })()}
                  </span>
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>

          {variant === 'full' && tone === 'hot' && (
            <p className="dlc-urgent-note">
              You&rsquo;re almost out of today&rsquo;s writes. Once you hit the cap, dashboard changes and widget
              requests will pause until it resets.
            </p>
          )}
        </>
      )}
    </div>
  );
}

