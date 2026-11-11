'use client';

// components/analytics/AnalyticsHeader.tsx
//
// The top of the analytics page: greeting, then one elevated control bar
// holding (1) the connected startup, (2) the real/sample data switch and
// (3) the period picker. Everything below it comes in later steps.
import { useMemo, type CSSProperties } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import { AnalyticsSiteSwitcher } from './AnalyticsSiteSwitcher';
import { AnalyticsDataSwitch, type DataMode } from './AnalyticsDataSwitch';
import { AnalyticsRangePicker } from './AnalyticsRangePicker';
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
  mode: DataMode;
  onModeChange: (mode: DataMode) => void;
  liveAvailable: boolean;
  range: RangeSel;
  compare: boolean;
  onRangeChange: (range: RangeSel, compare: boolean) => void;
}

export function AnalyticsHeader({
  user,
  sites,
  activeSite,
  activeSiteId,
  onSiteChange,
  onAddSite,
  mode,
  onModeChange,
  liveAvailable,
  range,
  compare,
  onRangeChange,
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
        {mode === 'sample' && (
          <span className="anx-tag" role="status">
            <i aria-hidden="true" />
            Sample data
          </span>
        )}
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

        <section className="anx-sec is-data" aria-label="Data source">
          <span className="anx-sec-label">Data</span>
          <AnalyticsDataSwitch mode={mode} onChange={onModeChange} liveAvailable={liveAvailable} />
        </section>

        <section className="anx-sec is-range" aria-label="Period">
          <span className="anx-sec-label">Period</span>
          <AnalyticsRangePicker value={range} compare={compare} onChange={onRangeChange} />
        </section>
      </div>
    </div>
  );
}
