'use client';

// components/dashboard/PlansPage.tsx
//
// Standalone plan-comparison + switch page. Used to be a bottom-sheet
// modal (`.feat-panel-sheet.prof-plan-sheet`) opened from
// ProfilePage; it's now its own route (see
// app/dashboard/plans/page.tsx) with its own SEO metadata, its own
// dedicated stylesheet (styles/dashboard/plans-page.css, not the shared
// .prof-plan-*/.feat-panel-* sheet classes), and gets GlobalNav for
// free since that renders site-wide from app/layout.tsx.
//
// Plan changes still write straight to users/{uid}.plan via
// useUserProfile.setPlan — no billing provider wired up yet, same as
// before. Plan data (names, prices, limits, highlight copy) all comes
// from lib/plans.ts so this can't drift from /pricing or the homepage
// pricing cards.
import { useState } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import { PLANS, getPlan, type PlanId } from '@/lib/plans';
import { useUserProfile } from '@/hooks/useUserProfile';

interface PlansPageProps {
  user: User;
  sites: Site[];
}

function nextPlan(id: PlanId) {
  const i = PLANS.findIndex((p) => p.id === id);
  if (i === -1 || i === PLANS.length - 1) return null;
  return PLANS[i + 1];
}

const COMPARE_ROWS: Array<{
  label: string;
  value: (limits: ReturnType<typeof getPlan>['limits']) => string;
}> = [
  { label: 'Connected sites', value: (l) => `${l.connectedSites}` },
  { label: 'Widgets configured per site', value: (l) => `${l.widgetsPerSite}` },
  { label: 'Live widgets per site', value: (l) => `${l.liveWidgetsPerSite}` },
  { label: 'Visit history', value: (l) => (l.historyRetentionDays === null ? 'Unlimited' : `${l.historyRetentionDays} days`) },
  { label: 'Block visitors', value: (l) => (l.canBlockVisitors ? 'Yes' : 'No') },
  { label: 'Live overlays', value: (l) => (l.liveOverlays ? 'Yes' : 'No') },
  { label: 'Automation rules per site', value: (l) => (l.automation ? `${l.automationRulesPerSite}` : 'No') },
  { label: 'Team seats', value: (l) => `${l.teamSeats}` },
  { label: 'Daily write limit', value: (l) => (l.dailyWrites === null ? 'Unlimited' : `${l.dailyWrites.toLocaleString()}/day`) },
  {
    label: 'Support',
    value: (l) => (l.support === 'community' ? 'Community' : l.support === 'email' ? 'Email' : l.support === 'priority' ? 'Priority' : 'Dedicated'),
  },
];

export function PlansPage({ user, sites }: PlansPageProps) {
  void user;
  const { planId, setPlan } = useUserProfile(user);
  const plan = getPlan(planId);
  const upgrade = nextPlan(planId);

  const usedCount = sites.length;
  const limit = plan.limits.connectedSites;
  const atLimit = usedCount >= limit;
  const usagePct = Math.min(100, (usedCount / Math.max(limit, 1)) * 100);

  const [switching, setSwitching] = useState<PlanId | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function handleChoosePlan(id: PlanId) {
    if (id === planId) return;
    setSwitching(id);
    const ok = await setPlan(id);
    setSwitching(null);
    if (ok) {
      const chosen = getPlan(id);
      setToast(`Switched to ${chosen.name}.`);
      setTimeout(() => setToast(null), 3200);
    }
  }

  return (
    <section>
      <div className="plans-page">
        <div className="plans-head">
          <span className="plans-eyebrow">Plans &amp; billing</span>
          <h1>Choose your plan</h1>
          <p>Switch anytime. Changes apply immediately, no proration surprises.</p>
        </div>

        <div className={`plans-usage-banner${atLimit ? ' is-urgent' : ''}`}>
          <div className="plans-usage-glow" aria-hidden="true" />
          <div className="plans-usage-top">
            <span className="plans-usage-pill">{plan.name} plan</span>
            {atLimit && <span className="plans-usage-urgent-pill">Limit reached</span>}
          </div>
          <h2>{plan.price === 0 ? 'You’re on Free' : `${plan.priceDisplay}/mo — ${plan.name}`}</h2>
          <p>
            {usedCount} of {limit} connected site{limit === 1 ? '' : 's'} used.
          </p>
          <div className="plans-usage-track" aria-hidden="true">
            <div className="plans-usage-fill" style={{ width: `${usagePct}%` }} />
          </div>
        </div>

        <div className="plans-toolbar">
          <h3>All plans</h3>
          <a className="plans-back-link" href="/dashboard/profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to profile
          </a>
        </div>

        <div className="plans-grid">
          {PLANS.map((p) => {
            const current = p.id === planId;
            return (
              <div key={p.id} className={`plans-card${current ? ' is-current' : ''}${p.featured && !current ? ' is-featured' : ''}`}>
                {p.featured && !current && <span className="plans-card-badge">Most popular</span>}
                {current && <span className="plans-card-badge is-current">Current plan</span>}
                <p className="plans-card-name">{p.name}</p>
                <p className="plans-card-tagline">{p.tagline}</p>
                <p className="plans-card-price">
                  {p.priceDisplay}
                  <span>/mo</span>
                </p>
                <p className="plans-card-writes">
                  {p.limits.dailyWrites === null
                    ? 'Unlimited writes/day'
                    : `${p.limits.dailyWrites.toLocaleString()} writes/day`}
                </p>
                <ul className="plans-card-features">
                  {p.cardHighlights.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`plans-card-btn${current ? ' is-current' : ''}`}
                  disabled={current || switching !== null}
                  onClick={() => handleChoosePlan(p.id)}
                >
                  {switching === p.id ? 'Switching…' : current ? 'Current plan' : p.price === 0 ? 'Downgrade' : p.cta}
                </button>
              </div>
            );
          })}
        </div>

        <div className="plans-compare">
          <h3>Full comparison</h3>
          <div className="plans-compare-scroll">
            <table className="plans-compare-table">
              <thead>
                <tr>
                  <th scope="col">Limit</th>
                  {PLANS.map((p) => (
                    <th scope="col" key={p.id} className={p.id === planId ? 'is-current' : undefined}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {PLANS.map((p) => (
                      <td key={p.id} className={p.id === planId ? 'is-current' : undefined}>
                        {row.value(p.limits)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="plans-foot">
          Need more detail? <a href="/pricing">See the full pricing page {'→'}</a>
        </p>
      </div>

      {toast && <div className="plans-toast">{toast}</div>}
    </section>
  );
}
