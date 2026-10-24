'use client';

// components/dashboard/VisitsPage.tsx
//
// Standalone "Visit logs" page, mounted at /dashboard/visits (see that
// route's page.tsx and DashboardClient.tsx's view="visits"). Fixes the
// sidebar's "Visit logs" link, which previously only scrolled to the
// Analytics panel's log section on the main dashboard (#panelVisits) —
// this gives it an actual dedicated page instead, in the same
// `/dashboard/sites/[siteId]` / SiteManagePage.tsx pattern: its own
// route, own scoped stylesheet, sharing DashboardClient's single auth
// gate/header/sidebar rather than standing up its own copies.
//
// Same useSites/useActiveSiteData data this app already subscribes to
// — no new Firestore reads. Adds a detailed, searchable/filterable
// table (visitor id, time, location, device, referrer, landing page,
// status) plus two real actions per visitor: permanent Block
// (toggleBlockVisit, already wired elsewhere) and timed Restrict
// (the new restrictVisitor — pick a duration and it's lifted
// automatically once that time passes).
import { useMemo, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { User } from 'firebase/auth';
import { useSites } from '@/hooks/useSites';
import { useActiveSiteData, isRestricted } from '@/hooks/useActiveSiteData';
import { formatTs } from '@/lib/format';
import { getCountryName } from '@/lib/countries';
import { AppSkeleton } from '@/components/AppSkeleton';
import type { Visit } from '@/lib/types';

interface VisitsPageProps {
  user: User;
}

type StatusFilter = 'all' | 'allowed' | 'restricted' | 'blocked';

const RESTRICT_OPTIONS = [
  { label: '15 minutes', ms: 15 * 60_000 },
  { label: '1 hour', ms: 60 * 60_000 },
  { label: '24 hours', ms: 24 * 60 * 60_000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60_000 },
  { label: '30 days', ms: 30 * 24 * 60 * 60_000 },
];

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}

function restrictionLabel(v: Visit): string | null {
  if (!isRestricted(v)) return null;
  const msLeft = (v.restrictedUntil as number) - Date.now();
  const hours = msLeft / 3_600_000;
  if (hours >= 24) return `Restricted · ${Math.ceil(hours / 24)}d left`;
  if (hours >= 1) return `Restricted · ${Math.ceil(hours)}h left`;
  return `Restricted · ${Math.max(1, Math.ceil(msLeft / 60_000))}m left`;
}

export function VisitsPage({ user }: VisitsPageProps) {
  const router = useNavRouter();
  const { sites, activeSiteId, setActiveSiteId, dashState } = useSites(user.uid);
  const { visits, stats, toggleBlockVisit, restrictVisitor } = useActiveSiteData(user.uid, activeSiteId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [restrictMenuFor, setRestrictMenuFor] = useState<string | null>(null);

  const activeSite = sites.find((s) => s.id === activeSiteId) || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits.filter((v) => {
      if (statusFilter === 'blocked' && !v.blocked) return false;
      if (statusFilter === 'restricted' && !isRestricted(v)) return false;
      if (statusFilter === 'allowed' && (v.blocked || isRestricted(v))) return false;

      if (!q) return true;
      const haystack = [
        v.visitorId,
        v.path,
        v.referrer,
        v.device,
        v.browser,
        v.os,
        v.country,
        v.city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [visits, search, statusFilter]);

  if (dashState === 'loading') {
    return (
      <div className="vlp-main">
        <div className="vlp-wrap">
          <AppSkeleton label="Loading visit logs" />
        </div>
      </div>
    );
  }

  if (dashState === 'empty' || !activeSite) {
    return (
      <div className="vlp-main">
        <div className="vlp-wrap">
          <button type="button" className="vlp-back" onClick={() => router.push('/dashboard')}>
            <BackIcon />
            Back to dashboard
          </button>
          <div className="vlp-notfound">
            <h2>No sites connected yet</h2>
            <p>Connect a site to start seeing visit logs here.</p>
            <button type="button" className="btn-primary" onClick={() => router.push('/dashboard?connect=1')}>
              Connect your site
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vlp-main">
      <div className="vlp-wrap">
        <button type="button" className="vlp-back" onClick={() => router.push('/dashboard')}>
          <BackIcon />
          Back to dashboard
        </button>

        <div className="vlp-head">
          <div className="vlp-head-text">
            <h1>Visit logs</h1>
            <p>Every visitor who&apos;s landed on your site — searchable, filterable, and yours to control.</p>
          </div>

          {sites.length > 1 && (
            <select
              className="vlp-site-select"
              value={activeSiteId || ''}
              onChange={(e) => setActiveSiteId(e.target.value)}
              aria-label="Select site"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.url}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="vlp-stats">
          <div className="vlp-stat">
            <span className="vlp-stat-value">{stats.total}</span>
            <span className="vlp-stat-label">Total visits</span>
          </div>
          <div className="vlp-stat">
            <span className="vlp-stat-value">{stats.unique}</span>
            <span className="vlp-stat-label">Unique visitors</span>
          </div>
          <div className="vlp-stat">
            <span className="vlp-stat-value">{stats.blockedCount}</span>
            <span className="vlp-stat-label">Blocked</span>
          </div>
          <div className="vlp-stat">
            <span className="vlp-stat-value">{visits.filter((v) => isRestricted(v)).length}</span>
            <span className="vlp-stat-label">Restricted</span>
          </div>
        </div>

        <div className="vlp-toolbar">
          <div className="vlp-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by visitor, page, location, device…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="vlp-filters" role="group" aria-label="Filter by status">
            {([
              ['all', 'All'],
              ['allowed', 'Allowed'],
              ['restricted', 'Restricted'],
              ['blocked', 'Blocked'],
            ] as [StatusFilter, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`vlp-filter-btn${statusFilter === value ? ' is-active' : ''}`}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="vlp-empty">
            {visits.length === 0 ? 'No visits logged yet for this site.' : 'No visits match your search or filter.'}
          </div>
        ) : (
          <div className="vlp-table">
            <div className="vlp-table-head" role="row">
              <span>Visitor</span>
              <span>Page</span>
              <span>Location &amp; device</span>
              <span>Time</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {filtered.map((v) => {
              const restricted = isRestricted(v);
              const label = restrictionLabel(v);
              return (
                <div className={`vlp-row${v.blocked ? ' is-blocked' : restricted ? ' is-restricted' : ''}`} key={v.id} role="row">
                  <span className="vlp-cell vlp-cell-visitor" data-label="Visitor">
                    <span className="vlp-visitor-id" title={v.visitorId}>
                      {v.visitorId ? `${v.visitorId.slice(0, 10)}…` : v.id}
                    </span>
                    {v.sessionId && <span className="vlp-session-id">Session {v.sessionId.slice(0, 6)}</span>}
                  </span>

                  <span className="vlp-cell" data-label="Page">
                    {v.landing && <span className="vlp-landing-badge">Entry</span>}
                    <span className="vlp-path">{v.path || '/'}</span>
                  </span>

                  <span className="vlp-cell vlp-cell-meta" data-label="Location & device">
                    <span>
                      {v.country ? getCountryName(v.country) : 'Unknown location'}
                      {v.city ? `, ${v.city}` : ''}
                    </span>
                    <span className="vlp-meta-sub">
                      {v.device || 'Unknown device'}
                      {v.browser ? ` · ${v.browser}` : ''}
                      {v.referrer ? ` · via ${v.referrer}` : ' · Direct'}
                    </span>
                  </span>

                  <span className="vlp-cell" data-label="Time">
                    {formatTs(v.ts)}
                  </span>

                  <span className="vlp-cell" data-label="Status">
                    <span className={`vlp-status-pill${v.blocked ? ' blocked' : restricted ? ' restricted' : ' allowed'}`}>
                      <span className="vlp-status-dot" />
                      {v.blocked ? 'Blocked' : label || 'Allowed'}
                    </span>
                  </span>

                  <span className="vlp-cell vlp-cell-actions" data-label="Actions">
                    <div className="vlp-restrict-wrap">
                      <button
                        type="button"
                        className="vlp-action-btn"
                        onClick={() => setRestrictMenuFor(restrictMenuFor === v.id ? null : v.id)}
                        disabled={v.blocked}
                      >
                        <ClockIcon />
                        {restricted ? 'Change' : 'Restrict'}
                      </button>
                      {restrictMenuFor === v.id && (
                        <div className="vlp-restrict-menu" role="menu">
                          {RESTRICT_OPTIONS.map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                restrictVisitor(v.visitorId || '', opt.ms);
                                setRestrictMenuFor(null);
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                          {restricted && (
                            <button
                              type="button"
                              role="menuitem"
                              className="vlp-restrict-lift"
                              onClick={() => {
                                restrictVisitor(v.visitorId || '', null);
                                setRestrictMenuFor(null);
                              }}
                            >
                              Lift restriction
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`vlp-action-btn vlp-block-btn${v.blocked ? ' is-blocked' : ''}`}
                      onClick={() => toggleBlockVisit(v.id, !v.blocked, v.visitorId || '')}
                    >
                      <BanIcon />
                      {v.blocked ? 'Unblock' : 'Block'}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {visits.length >= 50 && (
          <p className="vlp-cap-note">Showing the 50 most recent visits.</p>
        )}
      </div>
    </div>
  );
}
