'use client';

// components/dashboard/SiteManagePage.tsx
//
// Standalone per-site management page, mounted at
// /dashboard/sites/[siteId] (see that route's page.tsx and
// DashboardClient.tsx's view="site-manage"). Reached from the
// "Manage site" button on each card in ConnectedSitesSection — fixes
// the bug where that button had no onManageSite handler wired up.
//
// Three stacked sections, in the order the product ask specced them:
//   1. Site identity header — nice URL, status, domain info snapshot
//      (the same RDAP data the connect wizard's live "domain intel"
//      card shows while adding a site — see lib/domainLookup.ts and
//      app/api/connect-site/route.ts, which now persists it onto
//      Site.domainInfo at connect time instead of only ever showing
//      it transiently).
//   2. Actions — Remove (reuses ConnectedSitesSection's confirm-sheet
//      pattern around the existing disconnectSite), Pause/Resume (new
//      — useSites' pauseSite), Resume verification (only while
//      pending — hands off to the main dashboard, where
//      ConnectSiteWizard's resume flow already lives, rather than
//      duplicating that wizard here).
//   3. Stats — visits/unique/blocked from useActiveSiteData (already
//      generic on uid/siteId despite its name), impressions from
//      Site.overlayStats, most-visited countries derived client-side
//      from the visits list via lib/countries.ts, date added from
//      Site.createdAt, and widgets-enabled state from the new
//      useSiteWidgetsList hook.
//
// Own stylesheet (styles/dashboard/site-manage-page.css, `smp-` prefix),
// imported directly by the route's page.tsx rather than added to
// app/globals.css's @import list — same scoping trick already used
// for styles/agent/agent-page.css (see app/dashboard/agent/page.tsx's
// comment). Same restrained "one bold lime/ink accent per section,
// calm cream/ink everywhere else" visual language as that page, and
// reuses AgentBlob (the small lime mascot) rather than inventing a
// second character.
import { useMemo, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { User } from 'firebase/auth';
import { useSites } from '@/hooks/useSites';
import { useActiveSiteData } from '@/hooks/useActiveSiteData';
import { useSiteWidgetsList } from '@/hooks/useSiteWidgetsList';
import { getCountryName } from '@/lib/countries';
import { AgentBlob } from '@/components/agent/AgentBlob';
import { AppSkeleton } from '@/components/AppSkeleton';

interface SiteManagePageProps {
  user: User;
  siteId: string;
}

function formatDate(value: { toDate: () => Date } | null | undefined): string | null {
  if (!value) return null;
  try {
    return value.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
}

function formatIsoDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatAge(days: number | null): string | null {
  if (days === null || days === undefined) return null;
  const years = Math.floor(days / 365);
  const rem = days % 365;
  const months = Math.floor(rem / 30);
  if (years > 0) {
    return `${years} year${years === 1 ? '' : 's'}${months > 0 ? `, ${months} mo` : ''} old`;
  }
  if (months > 0) return `${months} month${months === 1 ? '' : 's'} old`;
  return `${days} day${days === 1 ? '' : 's'} old`;
}

export function SiteManagePage({ user, siteId }: SiteManagePageProps) {
  const router = useNavRouter();
  const { sites, dashState, disconnectSite, pauseSite } = useSites(user.uid);
  const { visits, stats } = useActiveSiteData(user.uid, siteId);
  const { enabledWidgets, widgets, hasAnyEnabled, loading: widgetsLoading } = useSiteWidgetsList(user.uid, siteId);

  const site = sites.find((s) => s.id === siteId) || null;

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [pausing, setPausing] = useState(false);

  const topCountries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of visits) {
      if (!v.country) continue;
      counts.set(v.country, (counts.get(v.country) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, name: getCountryName(code), count }));
  }, [visits]);

  const maxCountryCount = topCountries[0]?.count || 1;

  async function handleConfirmRemove() {
    if (!site) return;
    setRemoving(true);
    try {
      await disconnectSite(site.id);
      router.push('/dashboard');
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  async function handleTogglePause() {
    if (!site) return;
    setPausing(true);
    try {
      await pauseSite(site.id, !site.paused);
    } finally {
      setPausing(false);
    }
  }

  // Still loading the sites list for the first time.
  if (dashState === 'loading') {
    return (
      <div className="smp-main">
        <div className="smp-wrap">
          <AppSkeleton label="Loading site" />
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="smp-main">
        <div className="smp-wrap">
          <button type="button" className="smp-back" onClick={() => router.push('/dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to dashboard
          </button>
          <div className="smp-notfound">
            <h2>Site not found</h2>
            <p>This site may have been disconnected already, or the link is out of date.</p>
          </div>
        </div>
      </div>
    );
  }

  const isPending = site.status === 'pending';
  const isPaused = !!site.paused;
  const domainInfo = site.domainInfo;
  const addedOn = formatDate(site.createdAt);
  const impressions = site.overlayStats?.impressions ?? 0;

  let statusLabel = 'Verified';
  let statusClass = 'is-verified';
  if (isPaused) {
    statusLabel = 'Paused';
    statusClass = 'is-paused';
  } else if (isPending) {
    statusLabel = 'Pending verification';
    statusClass = 'is-pending';
  }

  return (
    <div className="smp-main">
      <div className="smp-wrap">
        <button type="button" className="smp-back" onClick={() => router.push('/dashboard')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to dashboard
        </button>

        {/* ── Identity header ──────────────────────────────────── */}
        <div className="smp-head">
          <AgentBlob variant="greet" className="smp-head-blob" />
          <div className="smp-head-top">
            <span className={`smp-status-pill ${statusClass}`}>
              <span className="smp-status-dot" />
              {statusLabel}
            </span>
            {isPaused && <span className="smp-paused-note">Tracking and widgets are stopped until resumed.</span>}
          </div>
          <h1 className="smp-site-name">{site.name || site.url || 'Untitled site'}</h1>
          <a className="smp-site-url" href={site.url} target="_blank" rel="noopener noreferrer">
            {site.url}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>

          {/* ── Domain info ───────────────────────────────────── */}
          <div className="smp-domain-grid">
            {domainInfo?.found ? (
              <>
                <div className="smp-domain-item">
                  <span className="smp-domain-label">Domain age</span>
                  <span className="smp-domain-value">{formatAge(domainInfo.ageDays) || 'Unknown'}</span>
                </div>
                <div className="smp-domain-item">
                  <span className="smp-domain-label">Registrar</span>
                  <span className="smp-domain-value">{domainInfo.registrar || 'Unknown'}</span>
                </div>
                <div className="smp-domain-item">
                  <span className="smp-domain-label">Registered</span>
                  <span className="smp-domain-value">{formatIsoDate(domainInfo.createdAt) || 'Unknown'}</span>
                </div>
                <div className="smp-domain-item">
                  <span className="smp-domain-label">Expires</span>
                  <span className="smp-domain-value">{formatIsoDate(domainInfo.expiresAt) || 'Unknown'}</span>
                </div>
                <div className="smp-domain-item">
                  <span className="smp-domain-label">Nameservers</span>
                  <span className="smp-domain-value">{domainInfo.nameserverCount ?? 'Unknown'}</span>
                </div>
                {domainInfo.status.length > 0 && (
                  <div className="smp-domain-item smp-domain-item-wide">
                    <span className="smp-domain-label">Status</span>
                    <span className="smp-domain-tags">
                      {domainInfo.status.map((s) => (
                        <span className="smp-domain-tag" key={s}>
                          {s}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="smp-domain-empty">
                No domain registration info is available for this site yet
                {!domainInfo ? ' (connected before this was tracked).' : '.'}
              </p>
            )}
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────── */}
        <div className="smp-section">
          <div className="smp-section-head">
            <h2>Actions</h2>
          </div>
          <div className="smp-actions">
            {isPending && (
              <button type="button" className="smp-action-btn smp-action-verify" onClick={() => router.push('/dashboard')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6l7-3z" />
                  <path d="M9 12.2l2 2 4-4.4" />
                </svg>
                Finish verifying
              </button>
            )}
            <button
              type="button"
              className={`smp-action-btn ${isPaused ? 'smp-action-resume' : 'smp-action-pause'}`}
              onClick={handleTogglePause}
              disabled={pausing}
            >
              {isPaused ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M8 5v14l11-7-11-7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 5v14M15 5v14" />
                </svg>
              )}
              {pausing ? 'Working\u2026' : isPaused ? 'Resume tracking' : 'Pause tracking'}
            </button>
            <button type="button" className="smp-action-btn smp-action-remove" onClick={() => setConfirmRemove(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m2 0v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7h10z" />
              </svg>
              Remove site
            </button>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────── */}
        <div className="smp-section">
          <div className="smp-section-head">
            <h2>Stats</h2>
          </div>
          <div className="smp-stats-grid">
            <div className="smp-stat-card">
              <span className="smp-stat-label">Total visits</span>
              <span className="smp-stat-value">{stats.total}</span>
            </div>
            <div className="smp-stat-card">
              <span className="smp-stat-label">Unique visitors</span>
              <span className="smp-stat-value">{stats.unique}</span>
            </div>
            <div className="smp-stat-card">
              <span className="smp-stat-label">Impressions</span>
              <span className="smp-stat-value">{impressions}</span>
            </div>
            <div className="smp-stat-card smp-stat-card-accent">
              <span className="smp-stat-label">Blocked visits</span>
              <span className="smp-stat-value">{stats.blockedCount}</span>
            </div>
          </div>

          <div className="smp-stats-row">
            <div className="smp-panel smp-countries-panel">
              <h3>Most-visited countries</h3>
              {topCountries.length === 0 ? (
                <p className="smp-panel-empty">No location data yet.</p>
              ) : (
                <ul className="smp-countries-list">
                  {topCountries.map((c) => (
                    <li className="smp-country-row" key={c.code}>
                      <span className="smp-country-name">{c.name}</span>
                      <span className="smp-country-bar-track">
                        <span
                          className="smp-country-bar-fill"
                          style={{ width: `${Math.max(6, (c.count / maxCountryCount) * 100)}%` }}
                        />
                      </span>
                      <span className="smp-country-count">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="smp-panel smp-meta-panel">
              <h3>Site details</h3>
              <div className="smp-meta-row">
                <span className="smp-meta-label">Added</span>
                <span className="smp-meta-value">{addedOn || 'Unknown'}</span>
              </div>
              <div className="smp-meta-row">
                <span className="smp-meta-label">Widgets</span>
                <span className="smp-meta-value">
                  {widgetsLoading ? (
                    <span className="smp-meta-skel" aria-hidden="true" />
                  ) : hasAnyEnabled ? (
                    <span className="smp-widgets-on">
                      {enabledWidgets.length} enabled
                      <span className="smp-widgets-names">{enabledWidgets.map((w) => w.name).join(', ')}</span>
                    </span>
                  ) : widgets.length === 0 ? (
                    'None set up'
                  ) : (
                    'All off'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmRemove && (
        <div className="smp-sheet-backdrop" role="presentation" onClick={() => !removing && setConfirmRemove(false)}>
          <div className="smp-sheet" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="smp-sheet-title">Remove {site.name || site.url}?</div>
            <p className="smp-sheet-msg">
              The tracking tag on this site will stop working immediately — no more visits logged, and any live
              banner will disappear. This can&apos;t be undone from here; you&apos;d need to connect the site again.
            </p>
            <div className="smp-sheet-actions">
              <button type="button" className="smp-sheet-btn" onClick={() => setConfirmRemove(false)} disabled={removing}>
                Cancel
              </button>
              <button type="button" className="smp-sheet-btn smp-sheet-btn-danger" onClick={handleConfirmRemove} disabled={removing}>
                {removing ? 'Removing\u2026' : 'Remove site'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
