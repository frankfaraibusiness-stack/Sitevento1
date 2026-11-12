'use client';

// components/analytics/AnalyticsHeader.tsx
//
// The top of the analytics page: greeting, then one elevated control bar
// holding (1) the connected startup and (2) the period picker, plus a one-line
// summary underneath that reads the REAL totals for the chosen period (the
// proof the picker is wired to data).
import { useMemo, type CSSProperties } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import type { PlanLimits } from '@/lib/plans';
import { fmtNum } from '@/lib/dashboardStats';
import { AnalyticsSiteSwitcher } from './AnalyticsSiteSwitcher';
import { AnalyticsRangePicker } from './AnalyticsRangePicker';
import { useAnalyticsData } from './AnalyticsDataContext';
import { firstNameOf, greetingFor, siteHost, type RangeSel } from './analyticsUtils';

// Staggers the entrance animation (see .anx-rise in analytics.css).
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

interface Props {
  user: User;
  sites: Site[];
  activeSite: Site | null;
  activeSiteId: string | null;
  onSiteChange: (id: string) => void;
  onAddSite: () => void;
  range: RangeSel;
  compare: boolean;
  onRangeChange: (range: RangeSel, compare: boolean) => void;
  limits: PlanLimits | null;
  siteStart: Date | null;
}

/** "+18%" / "−4%" / "new" — change of `now` against `before`. */
function changeLabel(now: number, before: number): { text: string; dir: 'up' | 'down' | 'flat' } {
  if (before <= 0) return now > 0 ? { text: 'new', dir: 'up' } : { text: '0%', dir: 'flat' };
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.05) return { text: '0%', dir: 'flat' };
  const abs = Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.round(Math.abs(pct) * 10) / 10;
  return { text: `${pct > 0 ? '+' : '−'}${abs}%`, dir: pct > 0 ? 'up' : 'down' };
}

/** Real totals for the selected site + period. */
function PeriodSummary() {
  const { site, data, status, error, loading, refreshing, refresh, compare, prevWindow } = useAnalyticsData();
  if (!site) return null;

  if (loading) {
    return (
      <p className="anx-summary is-loading" role="status" aria-live="polite">
        <i className="anx-summary-dot" aria-hidden="true" />
        Loading this period…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p className="anx-summary is-error" role="alert">
        {error ?? 'We couldn’t load this period.'}{' '}
        <button type="button" className="anx-summary-retry" onClick={refresh}>
          Try again
        </button>
      </p>
    );
  }

  const change = compare && prevWindow && data.prevTotal !== null ? changeLabel(data.total, data.prevTotal) : null;
  return (
    <p className={refreshing ? 'anx-summary is-refreshing' : 'anx-summary'} role="status" aria-live="polite">
      <i className="anx-summary-dot is-live" aria-hidden="true" />
      <span>
        <b>{fmtNum(data.total)}</b> {data.total === 1 ? 'visit' : 'visits'}
      </span>
      <span className="anx-summary-sep" aria-hidden="true">·</span>
      <span>
        <b>{data.uniqueExact ? '' : '~'}{fmtNum(data.uniqueUsers)}</b> {data.uniqueUsers === 1 ? 'visitor' : 'visitors'}
      </span>
      {change && (
        <>
          <span className="anx-summary-sep" aria-hidden="true">·</span>
          <span className={`anx-summary-delta is-${change.dir}`}>
            {change.text} <small>vs {fmtNum(data.prevTotal)} before</small>
          </span>
        </>
      )}
      {error && <span className="anx-summary-warn">{error}</span>}
    </p>
  );
}

export function AnalyticsHeader({
  user,
  sites,
  activeSite,
  activeSiteId,
  onSiteChange,
  onAddSite,
  range,
  compare,
  onRangeChange,
  limits,
  siteStart,
}: Props) {
  const now = useMemo(() => new Date(), []);
  const name = firstNameOf(user);
  const dateLine = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const subtitle = activeSite
    ? `Revenue, growth and customer signals for ${siteHost(activeSite)} — in one calm view.`
    : 'Connect your startup to see revenue, growth and customer signals in one calm view.';

  // Deliberately a <div>, not a <header>: base.css has a bare
  // `header { position: fixed }` rule that would pin any <header> element to
  // the top of the viewport, on top of the real app header.
  return (
    <div className="anx-head">
      <div className="anx-eyebrow-row anx-rise" style={delay(0)}>
        <span className="anx-eyebrow">
          <i className="anx-eyebrow-dot" aria-hidden="true" />
          {greetingFor(now)} · {dateLine}
        </span>
      </div>

      <h1 className="anx-title anx-rise" style={delay(70)}>
        <span className="anx-title-soft">Welcome back{name ? ',' : ''}</span>
        {name && <span className="anx-title-name"> {name}</span>}
      </h1>
      <p className="anx-sub anx-rise" style={delay(130)}>
        {subtitle}
      </p>

      <div className="anx-bar anx-rise" style={delay(200)}>
        <section className="anx-sec is-site" aria-label="Connected startup">
          <span className="anx-sec-label">Startup</span>
          <AnalyticsSiteSwitcher sites={sites} activeSiteId={activeSiteId} onChange={onSiteChange} onAdd={onAddSite} />
        </section>

        <section className="anx-sec is-range" aria-label="Period">
          <span className="anx-sec-label">Period</span>
          <AnalyticsRangePicker value={range} compare={compare} onChange={onRangeChange} limits={limits} siteStart={siteStart} />
        </section>
      </div>

      <div className="anx-rise" style={delay(260)}>
        <PeriodSummary />
      </div>
    </div>
  );
}
