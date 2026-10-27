'use client';

// components/dashboard/PlanUsageStrip.tsx
//
// Ambient, inline upsell for the new dashboard — not a modal (that's
// UpsellOverlay, shown only once the account actually hits its site
// limit). This sits in the normal page flow and shows connected-site
// usage against the plan's limit at all times, with a gentle nudge to
// upgrade once usage gets close. Free tier (1 site) always nudges since
// there's nowhere to grow without upgrading.
import { getPlan, PLANS, type PlanId } from '@/lib/plans';

interface PlanUsageStripProps {
  planId: PlanId;
  used: number;
  onUpgrade: () => void;
}

export function PlanUsageStrip({ planId, used, onUpgrade }: PlanUsageStripProps) {
  const plan = getPlan(planId);
  const limit = plan.limits.connectedSites;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const atLimit = used >= limit;
  const nextPlan = PLANS[PLANS.findIndex((p) => p.id === planId) + 1];

  return (
    <div className={`dnx-usage-strip${atLimit ? ' is-at-limit' : ''}`}>
      <div className="dnx-usage-main">
        <div className="dnx-usage-head">
          <span className="dnx-usage-plan-pill">{plan.name} plan</span>
          <span className="dnx-usage-count">
            {used} / {limit} sites connected
          </span>
        </div>
        <div className="dnx-usage-bar-track" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
          <div className="dnx-usage-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {nextPlan && (
        <button type="button" className="dnx-usage-cta" onClick={onUpgrade}>
          <span className="dnx-usage-cta-text">
            <strong>{atLimit ? `Upgrade to ${nextPlan.name}` : `Room to grow with ${nextPlan.name}`}</strong>
            <span>{nextPlan.limits.connectedSites} sites · {nextPlan.priceDisplay}/mo</span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
