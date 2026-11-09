'use client';

// components/profile/ProfilePlanMenu.tsx
//
// The plan pill under the user's name and the usage popup it opens. Everything
// in here is the account's real plan and real limits:
//
//   - plan name            users/{uid}.plan (hooks/useUserProfile) — the pill
//                          shows a skeleton until that has actually loaded, so
//                          a paid account never flashes "Free"
//   - visits this month    /api/site-limits → visitUsage (hooks/useAccountLimits),
//                          the same counter app/api/track enforces
//   - sites connected      the same response (sitesUsed / sitesLimit)
//   - wallet balance       visitWallet from the same response
//   - plan limits          lib/plans.ts, the catalog every other page reads
//   - overage rate         lib/visits.ts (OVERAGE_* constants)
//
// "Upgrade" goes to /dashboard/plans, which switches the plan for real
// (users/{uid}.plan via app/api/user-action 'update-plan').
import { useEffect, useRef, useState } from 'react';
import { getPlan, PLANS, type PlanId } from '@/lib/plans';
import { overageMicrocentsPerVisitBlock, microcentsToUsd } from '@/lib/visits';
import type { AccountLimits } from '@/hooks/useAccountLimits';
import { PfLink, ArrowIcon } from '@/components/profile/PfLink';

interface ProfilePlanMenuProps {
  /** null while users/{uid}.plan hasn't loaded yet. */
  planId: PlanId | null;
  limits: AccountLimits | null;
  limitsLoading: boolean;
  limitsError: string | null;
  onRetry: () => void;
}

function tone(pct: number): 'calm' | 'warm' | 'hot' {
  if (pct >= 90) return 'hot';
  if (pct >= 70) return 'warm';
  return 'calm';
}

function resetLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (!isFinite(diff) || diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `Resets in ${days} day${days === 1 ? '' : 's'}`;
  return `Resets in ${Math.max(1, Math.floor(diff / 3_600_000))}h`;
}

function retention(days: number | null, custom: boolean): string {
  if (days === null) return custom ? 'Unlimited + custom range' : 'Unlimited';
  return `${days} days`;
}

function support(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function ProfilePlanMenu({ planId, limits, limitsLoading, limitsError, onRetry }: ProfilePlanMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!planId) {
    return <span className="pf-plan-pill is-skeleton" aria-hidden="true" />;
  }

  const plan = getPlan(planId);
  const next = PLANS[PLANS.findIndex((p) => p.id === planId) + 1] ?? null;

  const visit = limits?.visitUsage ?? null;
  const visitPct = visit && visit.limit > 0 ? Math.min(100, Math.round((visit.used / visit.limit) * 100)) : 0;
  const sitesUsed = limits?.sitesUsed ?? 0;
  const sitesLimit = limits?.sitesLimit ?? plan.limits.connectedSites;
  const sitesPct = sitesLimit > 0 ? Math.min(100, Math.round((sitesUsed / sitesLimit) * 100)) : 0;
  const sitesAtLimit = !!limits && sitesUsed >= sitesLimit;
  const rate = microcentsToUsd(overageMicrocentsPerVisitBlock(planId));
  const reset = resetLabel(visit?.resetsAt);
  const wallet = limits?.visitWallet ?? null;

  return (
    <div className="pf-plan-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`pf-plan-pill${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`pf-plan-dot is-${plan.id}`} aria-hidden="true" />
        {plan.name} plan
        <svg className="pf-plan-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div className={`pf-pop${open ? ' is-open' : ''}`} role="dialog" aria-label="Plan usage and limits" aria-hidden={!open}>
        <div className="pf-pop-head">
          <span className="pf-pop-title">Usage this month</span>
          {reset && <span className="pf-pop-reset">{reset}</span>}
        </div>

        {limitsError && !limits ? (
          <div className="pf-pop-error">
            <p>{limitsError}</p>
            <button type="button" className="pf-link-btn" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : limitsLoading && !limits ? (
          <div className="pf-pop-skeleton" aria-hidden="true">
            <i /> <i /> <i />
          </div>
        ) : (
          <>
            <div className="pf-meter">
              <div className="pf-meter-top">
                <span className="pf-meter-name">Visits / month</span>
                <span className="pf-meter-val">
                  <b>{(visit?.used ?? 0).toLocaleString()}</b> / {(visit?.limit ?? 0).toLocaleString()}
                </span>
              </div>
              <div className={`pf-bar is-${tone(visitPct)}`} role="progressbar" aria-valuenow={visit?.used ?? 0} aria-valuemin={0} aria-valuemax={visit?.limit ?? 0}>
                <i style={{ width: `${Math.max(visit && visit.used > 0 ? 2 : 0, visitPct)}%` }} />
              </div>
              <div className="pf-meter-foot">
                <span>
                  {visit && visit.overageVisitsThisMonth > 0
                    ? `${visit.overageVisitsThisMonth.toLocaleString()} extra visits, billed from your wallet`
                    : `$${rate.toFixed(2)} per 1K visits after the limit`}
                </span>
                <PfLink href="/dashboard" className="pf-more" onNavigate={() => setOpen(false)}>
                  View all <ArrowIcon />
                </PfLink>
              </div>
            </div>

            <div className="pf-meter">
              <div className="pf-meter-top">
                <span className="pf-meter-name">Sites connected</span>
                <span className="pf-meter-val">
                  <b>{sitesUsed}</b> / {sitesLimit}
                </span>
              </div>
              <div className={`pf-bar is-${sitesAtLimit ? 'hot' : tone(sitesPct)}`} role="progressbar" aria-valuenow={sitesUsed} aria-valuemin={0} aria-valuemax={sitesLimit}>
                <i style={{ width: `${Math.max(sitesUsed > 0 ? 2 : 0, sitesPct)}%` }} />
              </div>
              <div className="pf-meter-foot">
                <span>
                  {sitesAtLimit
                    ? next
                      ? `Limit reached — ${next.name} allows ${next.limits.connectedSites}`
                      : 'Limit reached on the top plan'
                    : `${Math.max(0, sitesLimit - sitesUsed)} more site${sitesLimit - sitesUsed === 1 ? '' : 's'} available`}
                </span>
                <PfLink href="/dashboard/sites" className="pf-more" onNavigate={() => setOpen(false)}>
                  View all <ArrowIcon />
                </PfLink>
              </div>
            </div>

            <div className="pf-meter">
              <div className="pf-meter-top">
                <span className="pf-meter-name">Wallet balance</span>
                <span className="pf-meter-val">
                  <b>${(wallet?.balanceUsd ?? 0).toFixed(2)}</b>
                </span>
              </div>
              <div className="pf-meter-foot">
                <span>Covers visits past your monthly allowance</span>
                <PfLink href="/dashboard/wallet" className="pf-more" onNavigate={() => setOpen(false)}>
                  Add funds <ArrowIcon />
                </PfLink>
              </div>
            </div>
          </>
        )}

        <dl className="pf-pop-facts">
          <div>
            <dt>Widgets per site</dt>
            <dd>{plan.limits.widgetsPerSite}</dd>
          </div>
          <div>
            <dt>Live widgets per site</dt>
            <dd>{plan.limits.liveWidgetsPerSite}</dd>
          </div>
          <div>
            <dt>Visit history</dt>
            <dd>{retention(plan.limits.historyRetentionDays, plan.limits.customDateRangeHistory)}</dd>
          </div>
          <div>
            <dt>Team seats</dt>
            <dd>{plan.limits.teamSeats}</dd>
          </div>
          <div>
            <dt>Support</dt>
            <dd>{support(plan.limits.support)}</dd>
          </div>
        </dl>

        <div className="pf-pop-foot">
          {next ? (
            <>
              <span className="pf-pop-hint">
                Need more? Go <b>{next.name}</b> · {next.priceDisplay}/mo
              </span>
              <PfLink href="/dashboard/plans" className="pf-btn pf-btn-accent pf-btn-sm" onNavigate={() => setOpen(false)}>
                Upgrade
              </PfLink>
            </>
          ) : (
            <>
              <span className="pf-pop-hint">You&rsquo;re on our top plan.</span>
              <PfLink href="/dashboard/plans" className="pf-btn pf-btn-ghost pf-btn-sm" onNavigate={() => setOpen(false)}>
                Manage plan
              </PfLink>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
