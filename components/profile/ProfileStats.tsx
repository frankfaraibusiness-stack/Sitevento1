'use client';

// components/profile/ProfileStats.tsx
//
// The four headline stats, laid out as one open strip on the page (no card per
// stat). All values come from hooks/useProfileStats — real Firestore totals —
// and a figure that couldn't be loaded shows "—", never a made-up 0.
//
// "View all" targets are real routes: views, clicks and session time are all
// explored on /dashboard (traffic, heatmap, engagement panels); sites links to
// the connected-sites page.
import type { ProfileStats } from '@/hooks/useProfileStats';
import { fmtDuration } from '@/lib/dashboardStats';
import { PfLink, ArrowIcon } from '@/components/profile/PfLink';

interface ProfileStatsProps {
  stats: ProfileStats | null;
  loading: boolean;
  sitesCount: number;
  sitesLimit: number | null;
}

function Delta({ stats }: { stats: ProfileStats }) {
  if (stats.growthPct === null) return null;
  const rounded = Math.round(stats.growthPct * 10) / 10;
  const tone = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  return (
    <small className={`pf-delta is-${tone}`} title="Last 30 days vs the 30 days before">
      {rounded > 0 ? '+' : ''}
      {rounded.toLocaleString()}%
    </small>
  );
}

function num(n: number | null): string {
  return n === null ? '—' : n.toLocaleString();
}

export function ProfileStats({ stats, loading, sitesCount, sitesLimit }: ProfileStatsProps) {
  const waiting = loading && !stats;

  const items: Array<{
    key: string;
    label: string;
    value: React.ReactNode;
    note: string;
    href: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'views',
      label: 'All-time views',
      value: stats ? (
        <>
          {num(stats.views)}
          <Delta stats={stats} />
        </>
      ) : null,
      note: stats?.viewsLast30 != null ? `${stats.viewsLast30.toLocaleString()} in the last 30 days` : 'Page views across every site',
      href: '/dashboard/analytics',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      key: 'clicks',
      label: 'All-time clicks',
      value: stats ? num(stats.clicks) : null,
      note: 'Human clicks tracked on your sites',
      href: '/dashboard/analytics',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 9l11 4-4.5 1.8L13 19.5 9 9z" />
          <path d="M5 5 4 3M3 9H1M9 3V1M5.6 12.4 4 14" />
        </svg>
      ),
    },
    {
      key: 'session',
      label: 'Avg. session',
      value: stats ? fmtDuration(stats.avgSessionSec) : null,
      note: stats && stats.engagedVisits > 0 ? `Active time, from ${stats.engagedVisits.toLocaleString()} visits` : 'Appears once visits report engagement',
      href: '/dashboard/analytics',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.2 1.9" />
        </svg>
      ),
    },
    {
      key: 'sites',
      label: 'Sites connected',
      value: (
        <>
          {sitesCount.toLocaleString()}
          {sitesLimit ? <small className="pf-of">/ {sitesLimit}</small> : null}
        </>
      ),
      note: sitesCount === 0 ? 'Connect your first site to start tracking' : 'Verified and pending sites',
      href: '/dashboard/sites',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.8 2.7 4.2 5.7 4.2 9s-1.4 6.3-4.2 9c-2.8-2.7-4.2-5.7-4.2-9S9.2 5.7 12 3z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="pf-stats" aria-label="Account totals">
      {items.map((it) => (
        <div className="pf-stat" key={it.key}>
          <span className="pf-stat-label">
            <span className="pf-stat-icon" aria-hidden="true">
              {it.icon}
            </span>
            {it.label}
          </span>
          {waiting && it.value === null ? (
            <span className="pf-stat-value is-skeleton" aria-hidden="true" />
          ) : (
            <span className="pf-stat-value">{it.value ?? '—'}</span>
          )}
          <span className="pf-stat-note">{it.note}</span>
          <PfLink href={it.href} className="pf-more">
            View all <ArrowIcon />
          </PfLink>
        </div>
      ))}
    </section>
  );
}
