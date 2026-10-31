'use client';

// components/settings/panels/BillingPanel.tsx
//
// Real billing panel — composed almost entirely from data that already
// flows through hooks/useAccountLimits.ts (itself backed by
// app/api/site-limits), reusing the two polished, already-responsive
// usage-with-upsell components built for the dashboard/profile pages
// instead of reinventing them here:
//   - PlanUsageStrip  — connected-sites usage (components/dashboard)
//   - DailyLimitCard  — daily write usage + countdown (components/dashboard)
// Plus one new lightweight section: today's usage for each trial-only
// permission on the account (useAccountLimits' featureUsage — already
// computed server-side, just never read by any UI before now).
//
// No invented numbers and no new backend calls: everything here is
// 100% real, Firestore-backed data already returned by /api/site-limits.
// `user` is passed down the same way DangerZonePanel receives it,
// rather than this panel calling useAuth() a second time (two listeners
// instead of one, plus a flash of `loading` while it independently
// resolves).
import type { User } from 'firebase/auth';
import '@/styles/settings/billing-panel.css';
import { useNavRouter } from '@/hooks/useNavPending';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { getPlan, PLANS } from '@/lib/plans';
import { CONNECT_PERMISSIONS } from '@/lib/connectPermissions';
import { PlanUsageStrip } from '@/components/dashboard/PlanUsageStrip';
import { DailyLimitCard } from '@/components/dashboard/DailyLimitCard';

interface BillingPanelProps {
  user: User | null;
}

export default function BillingPanel({ user }: BillingPanelProps) {
  const router = useNavRouter();
  const { limits, loading } = useAccountLimits(user);

  const planId = limits?.planId ?? 'free';
  const plan = getPlan(planId);
  const nextPlan = PLANS[PLANS.findIndex((p) => p.id === planId) + 1] || null;

  function goToPlans() {
    router.push('/dashboard/plans');
  }

  // Only ever show trial rows the account can actually run out of today
  // (limit !== null) — permissions with no daily cap on this plan have
  // nothing meaningful to report here.
  const trialRows = (limits?.featureUsage ?? []).filter((f) => f.limit !== null);
  const hottestTrial = trialRows.reduce<(typeof trialRows)[number] | null>((hottest, row) => {
    const pct = row.limit ? row.used / row.limit : 0;
    const hottestPct = hottest?.limit ? hottest.used / hottest.limit : -1;
    return pct > hottestPct ? row : hottest;
  }, null);

  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        <h3>Billing &amp; Plans</h3>
      </div>
      <p className="settings-panel-desc">Your plan, today&rsquo;s usage, and when you&rsquo;re close to a limit.</p>
      <hr className="settings-divider" />

      <div className={`bil-plan-row${loading ? ' is-loading' : ''}`}>
        <div className="bil-plan-id">
          <span className="bil-plan-price">{plan.price === 0 ? 'Free' : `${plan.priceDisplay}/mo`}</span>
          <span className="bil-plan-name">{plan.name} plan</span>
        </div>
        <div className="bil-plan-actions">
          <button type="button" className="settings-save-btn-ghost" onClick={goToPlans}>
            {nextPlan ? 'Compare plans' : 'View plans'}
          </button>
          {nextPlan && (
            <button type="button" className="settings-save-btn" onClick={goToPlans}>
              Upgrade to {nextPlan.name}
            </button>
          )}
        </div>
      </div>

      {!loading && nextPlan && hottestTrial && hottestTrial.limit && hottestTrial.used / hottestTrial.limit >= 0.7 && (
        <div className="bil-upsell-banner">
          <div className="bil-upsell-banner-glow" aria-hidden="true" />
          <div className="bil-upsell-banner-copy">
            <span className="bil-upsell-banner-kicker">Running low today</span>
            <strong>
              You&rsquo;ve used {hottestTrial.used} of {hottestTrial.limit} free {permissionLabel(hottestTrial.permissionId)} today.
            </strong>
            <span>{nextPlan.name} removes this daily cap &middot; {nextPlan.priceDisplay}/mo</span>
          </div>
          <button type="button" className="bil-upsell-banner-cta" onClick={goToPlans}>
            Upgrade
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      )}

      <hr className="settings-divider" />

      <div className="bil-section">
        <h4 className="bil-section-title">Usage today</h4>

        <PlanUsageStrip planId={planId} used={limits?.sitesUsed ?? 0} onUpgrade={goToPlans} />

        <DailyLimitCard
          planId={planId}
          writeUsage={limits?.writeUsage}
          dailyWriteLimits={limits?.dailyWriteLimits}
          onUpgrade={goToPlans}
          variant="compact"
        />
      </div>

      {trialRows.length > 0 && (
        <>
          <hr className="settings-divider" />
          <div className="bil-section">
            <h4 className="bil-section-title">Trial features</h4>
            <p className="settings-panel-desc" style={{ marginTop: '-0.1rem' }}>
              Below {plan.name}&rsquo;s normal tier, these run on a daily free allowance instead of being fully unlocked.
            </p>

            <div className="bil-trial-list">
              {trialRows.map((row) => {
                const pct = row.limit ? Math.min(100, Math.round((row.used / row.limit) * 100)) : 0;
                const tone = pct >= 90 ? 'hot' : pct >= 70 ? 'warm' : 'calm';
                return (
                  <div key={row.permissionId} className={`bil-trial-row bil-tone-${tone}`}>
                    <div className="bil-trial-row-top">
                      <span className="bil-trial-name">{permissionLabel(row.permissionId)}</span>
                      <span className="bil-trial-count">
                        {row.used}/{row.limit}
                      </span>
                    </div>
                    <div className="bil-trial-track" role="progressbar" aria-valuenow={row.used} aria-valuemin={0} aria-valuemax={row.limit ?? 0}>
                      <div className="bil-trial-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {nextPlan && (
              <button type="button" className="bil-trial-upsell" onClick={goToPlans}>
                <span>
                  <strong>Unlock these on {nextPlan.name}</strong>
                  <span>No daily caps on included features &middot; {nextPlan.priceDisplay}/mo</span>
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}

      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Payment Method</label>
        <div className="settings-placeholder-note">No payment method on file yet.</div>
      </div>
    </>
  );
}

// Human-readable label for a permission id, from the same catalog
// (lib/connectPermissions.ts) the connect wizard uses — one source of
// truth instead of a second copy of these names living here.
function permissionLabel(id: string): string {
  const def = CONNECT_PERMISSIONS.find((p) => p.id === id);
  return def ? def.label.toLowerCase() : id.replace(/-/g, ' ');
}
