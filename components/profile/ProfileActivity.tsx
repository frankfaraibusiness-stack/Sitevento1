'use client';

// components/profile/ProfileActivity.tsx
//
// "Recent activity" — the real event log across every connected site (page
// visits, captured emails / booking requests, Security Bot actions), newest
// first, from hooks/useProfileActivity. Filter chips narrow it by kind.
// Each row opens the page that manages that kind of event; visits have no
// dedicated log page, so they open the dashboard.
import { useMemo, useState } from 'react';
import type { ActivityItem, ActivityKind } from '@/hooks/useProfileActivity';
import { timeAgo } from '@/lib/dashboardStats';
import { PfLink, ArrowIcon } from '@/components/profile/PfLink';

interface ProfileActivityProps {
  items: ActivityItem[];
  loading: boolean;
  refreshing: boolean;
  hasSites: boolean;
  onRefresh: () => void;
}

type Filter = 'all' | ActivityKind;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'visit', label: 'Visits' },
  { id: 'lead', label: 'Leads' },
  { id: 'security', label: 'Security' },
];

const VISIBLE = 10;

function KindIcon({ kind }: { kind: ActivityKind }) {
  if (kind === 'lead') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }
  if (kind === 'security') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ProfileActivity({ items, loading, refreshing, hasSites, onRefresh }: ProfileActivityProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const now = Date.now();

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, visit: 0, lead: 0, security: 0 };
    for (const it of items) c[it.kind] += 1;
    return c;
  }, [items]);

  const shown = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.kind === filter)).slice(0, VISIBLE),
    [items, filter]
  );

  return (
    <section className="pf-section" aria-labelledby="pf-activity-title">
      <div className="pf-section-head">
        <div>
          <h2 id="pf-activity-title">Recent activity</h2>
          <p>Latest events from your visitors, leads and Security Bot.</p>
        </div>
        <button type="button" className="pf-more pf-more-btn" onClick={onRefresh} disabled={refreshing || !hasSites}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="pf-filters" role="tablist" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`pf-filter${filter === f.id ? ' is-active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {!hasSites ? (
        <div className="pf-empty">
          <b>No activity yet</b>
          <p>Connect a site and its visits, leads and security events will show up here.</p>
          <PfLink href="/dashboard/connect" className="pf-btn pf-btn-accent pf-btn-sm">
            Connect a site
          </PfLink>
        </div>
      ) : loading ? (
        <ul className="pf-feed" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="pf-feed-row is-skeleton">
              <i />
              <span />
            </li>
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <div className="pf-empty">
          <b>{filter === 'all' ? 'Nothing recorded yet' : 'Nothing here yet'}</b>
          <p>
            {filter === 'all'
              ? 'Once visitors reach your connected sites, their activity appears here.'
              : 'No events of this kind have been recorded yet.'}
          </p>
        </div>
      ) : (
        <ul className="pf-feed">
          {shown.map((it) => (
            <li key={it.id}>
              <PfLink href={it.href} className={`pf-feed-row is-${it.tone}`}>
                <span className={`pf-feed-icon is-${it.kind}`} aria-hidden="true">
                  <KindIcon kind={it.kind} />
                </span>
                <span className="pf-feed-text">
                  <b>{it.title}</b>
                  <small>{[it.detail, it.siteHost].filter(Boolean).join(' · ')}</small>
                </span>
                <time className="pf-feed-time" dateTime={new Date(it.ts).toISOString()}>
                  {timeAgo(it.ts, now)}
                </time>
              </PfLink>
            </li>
          ))}
        </ul>
      )}

      {hasSites && !loading && items.length > 0 && (
        <div className="pf-section-foot">
          <PfLink href="/dashboard" className="pf-more">
            View all activity <ArrowIcon />
          </PfLink>
        </div>
      )}
    </section>
  );
}
