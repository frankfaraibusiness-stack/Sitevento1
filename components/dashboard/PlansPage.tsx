'use client';

// components/dashboard/PlansPage.tsx
//
// Standalone plan-comparison + switch page (route:
// app/dashboard/plans/page.tsx). No longer a modal — renders straight
// on the app surface, GlobalNav comes from app/layout.tsx.
//
// All plan data (names, prices, limits, highlight copy) lives in
// lib/plans.ts so this can't drift from /pricing or the homepage.
// Plan changes write to users/{uid}.plan via useUserProfile.setPlan —
// no billing provider wired up yet.
//
// Styling is intentionally class-name only. Drop plans-page.css in
// later; nothing in this file assumes a specific visual treatment.
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

// Comparison rows. Values are read directly from each plan's limits
// object — monthly tokens and monthly visits are the source of truth
// (matches the pricing page limits: 1k/50k/400k/1M visits,
// 30k/300k/1M/3M tokens, 1/3/5/10 sites, 0/2/5/10 seats).
const COMPARE_ROWS: Array<{
  label: string;
  value: (plan: ReturnType<typeof getPlan>) => string;
}> = [
  { label: 'Connected sites', value: (p) => `${p.limits.connectedSites}` },
  { label: 'Team seats', value: (p) => (p.limits.teamSeats === 0 ? 'None' : `${p.limits.teamSeats}`) },
  { label: 'Widgets configured per site', value: (p) => `${p.limits.widgetsPerSite}` },
  { label: 'Live widgets per site', value: (p) => `${p.limits.liveWidgetsPerSite}` },
  {
    label: 'Visit history',
    value: (p) =>
      p.limits.historyRetentionDays === null
        ? p.limits.customDateRangeHistory
          ? 'Unlimited + custom range'
          : 'Unlimited'
        : `${p.limits.historyRetentionDays} days`,
  },
  {
    label: 'Visits per month',
    value: (p) =>
      p.limits.visitsPerMonth === null
        ? 'Unlimited'
        : p.limits.visitsPerMonth >= 1_000_000
          ? `${(p.limits.visitsPerMonth / 1_000_000).toFixed(0)}M`
          : p.limits.visitsPerMonth >= 1_000
            ? `${(p.limits.visitsPerMonth / 1_000).toFixed(0)}k`
            : `${p.limits.visitsPerMonth}`,
  },
  {
    label: 'Tokens per month',
    value: (p) =>
      p.limits.tokensPerMonth === null
        ? 'Unlimited'
        : p.limits.tokensPerMonth >= 1_000_000
          ? `${(p.limits.tokensPerMonth / 1_000_000).toFixed(0)}M`
          : p.limits.tokensPerMonth >= 1_000
            ? `${(p.limits.tokensPerMonth / 1_000).toFixed(0)}k`
            : `${p.limits.tokensPerMonth}`,
  },
  { label: 'Data export', value: (p) => (p.limits.dataExport ? (p.limits.fullDataExport ? 'Full (CSV + API)' : 'CSV') : 'No') },
  { label: 'Block visitors', value: (p) => (p.limits.canBlockVisitors ? 'Yes' : 'No') },
  { label: 'Live overlays', value: (p) => (p.limits.liveOverlays ? 'Yes' : 'No') },
  { label: 'Automation rules per site', value: (p) => (p.limits.automation ? `${p.limits.automationRulesPerSite}` : 'No') },
  { label: 'Custom logo branding', value: (p) => (p.limits.customLogoBranding ? 'Yes' : 'No') },
  {
    label: 'Support',
    value: (p) =>
      p.limits.support === 'community'
        ? 'Community'
        : p.limits.support === 'email'
          ? 'Email'
          : p.limits.support === 'priority'
            ? 'Priority'
            : 'Dedicated 24/7',
  },
];

// Per-plan icon + one-line "why upgrade" reason. Purely presentational
// — keyed off PlanId so it can't drift from lib/plans.ts.
const PLAN_STORY: Record<PlanId, { icon: JSX.Element; reason: string }> = {
  free: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2L12 16.4 5.7 21l2.3-7.2L2 9.2h7.6z" />
      </svg>
    ),
    reason: 'Perfect for trying sitevento on one site — no card needed.',
  },
  starter: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h7l-1 8 11-14h-7z" />
      </svg>
    ),
    reason: 'Unlock visitor blocking + overlays once one site isn’t enough.',
  },
  plus: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M6 21V10l6-6 6 6v11M9 21v-6h6v6" />
      </svg>
    ),
    reason: 'Built for a real portfolio — automation + priority support.',
  },
  premium: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.6 7.2H22l-6 4.7 2.3 7.1-6.3-4.5-6.3 4.5 2.3-7.1-6-4.7h7.4z" />
      </svg>
    ),
    reason: 'Max headroom for agencies running sites at real scale.',
  },
};

export function PlansPage({ user }: PlansPageProps) {
  const { planId, setPlan } = useUserProfile(user);
  const plan = getPlan(planId);
  const upgrade = nextPlan(planId);

  const [switching, setSwitching] = useState<PlanId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileCompareOpen, setMobileCompareOpen] = useState<PlanId | null>(planId);

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
          <span className="plans-eyebrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2L12 16.4 5.7 21l2.3-7.2L2 9.2h7.6z" />
            </svg>
            Plans &amp; billing
          </span>
          <h1>Find your plan</h1>
          <p>Switch anytime. Changes apply immediately, no proration surprises — and every plan keeps the same one-script-tag setup.</p>
        </div>

        <div className="plans-toolbar">
          <h3>All plans</h3>
          <a className="plans-back-link" href="/dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </a>
        </div>

        <div className="plans-grid">
          {PLANS.map((p) => {
            const current = p.id === planId;
            const story = PLAN_STORY[p.id];
            return (
              <div
                key={p.id}
                className={`plans-card${current ? ' is-current' : ''}${p.featured && !current ? ' is-featured' : ''}`}
              >
                {p.featured && !current && <span className="plans-card-badge">Most popular</span>}
                {current && <span className="plans-card-badge is-current">Current plan</span>}

                <span className="plans-card-icon" aria-hidden="true">
                  {story.icon}
                </span>

                <p className="plans-card-name">{p.name}</p>
                <p className="plans-card-tagline">{p.tagline}</p>
                <p className="plans-card-price">
                  {p.priceDisplay}
                  <span>/mo</span>
                </p>

                <ul className="plans-card-features">
                  {p.cardHighlights.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>

                <p className="plans-card-reason">{story.reason}</p>

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

          {/* Wide screens: real table, horizontally scrollable if needed. */}
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
                        {row.value(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one stacked accordion card per plan — same
             COMPARE_ROWS data, no sideways scrolling. Defaults open
             on the user's current plan. */}
          <div className="plans-compare-mobile">
            {PLANS.map((p) => {
              const open = mobileCompareOpen === p.id;
              const current = p.id === planId;
              return (
                <div
                  key={p.id}
                  className={`plans-compare-m-card${current ? ' is-current' : ''}${open ? ' is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="plans-compare-m-head"
                    onClick={() => setMobileCompareOpen(open ? null : p.id)}
                    aria-expanded={open}
                  >
                    <span className="plans-compare-m-name">
                      {p.name}
                      {current && <span className="plans-compare-m-tag">Current</span>}
                    </span>
                    <span className="plans-compare-m-price">
                      {p.priceDisplay}
                      <span>/mo</span>
                    </span>
                    <svg
                      className="plans-compare-m-chev"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {open && (
                    <dl className="plans-compare-m-body">
                      {COMPARE_ROWS.map((row) => (
                        <div key={row.label} className="plans-compare-m-row">
                          <dt>{row.label}</dt>
                          <dd>{row.value(p)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}
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