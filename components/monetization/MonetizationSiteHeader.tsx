'use client';

// components/monetization/MonetizationSiteHeader.tsx
//
// Shows which site these stats belong to, plus the period selector,
// above the stat grid. `site` is the already-active Site from
// useSites (same one gating the upsell overlay) — this isn't a new
// site switcher, just naming the one already selected so the numbers
// below aren't ambiguous when a user has more than one site connected.
import type { Site } from '@/lib/types';
import { MonetizationPeriodSelect } from './MonetizationPeriodSelect';
import type { StatsPeriod } from '@/lib/monetization-stats';

interface MonetizationSiteHeaderProps {
  site: Site;
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
}

export function MonetizationSiteHeader({ site, period, onPeriodChange }: MonetizationSiteHeaderProps) {
  const domain = site.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className="mon-site-head">
      <div className="mon-site-id">
        <span className="mon-site-dot" aria-hidden="true" />
        <span className="mon-site-name">{site.name}</span>
        <span className="mon-site-domain">{domain}</span>
      </div>
      <MonetizationPeriodSelect value={period} onChange={onPeriodChange} />
    </div>
  );
}
