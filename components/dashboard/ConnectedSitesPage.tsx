'use client';

// components/dashboard/ConnectedSitesPage.tsx — the dedicated
// "Connected sites" route (see app/dashboard/sites/page.tsx). Previously
// Connected Sites had no page of its own — the sidebar link just
// scrolled to the inline rail under Overview
// (ConnectedSitesSection.tsx). This is the full management surface:
// every connected site as its own card (domain, connected date, last
// seen, status), verified sites sorted ahead of pending ones, with
// Manage/Verify/Disconnect actions per card.
//
// Styling lives in styles/dashboard/connected-sites-page.css under its
// own `csp-` namespace, built on the app's shared --ink/--lime/--cream/
// --walnut/--line/--success/--warning tokens from base.css — same
// convention as VisitsPage's `vlp-` and SiteManagePage's `smp-`.
import { useMemo, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { Site } from '@/lib/types';
import { ConfirmPopup } from '@/components/widgets/WidgetStatusPopup';

interface ConnectedSitesPageProps {
  sites: Site[];
  onDisconnectSite: (siteId: string) => Promise<boolean> | Promise<void> | void;
  onAddSite: () => void;
  onResumeVerification: (site: { id: string; url: string }) => void;
}

function toDateSafe(ts: { toDate: () => Date } | null | undefined): Date | null {
  if (!ts || typeof ts.toDate !== 'function') return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(d: Date | null): string {
  if (!d) return 'No visits yet';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(d);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || url;
  }
}

export function ConnectedSitesPage({ sites, onDisconnectSite, onAddSite, onResumeVerification }: ConnectedSitesPageProps) {
  const router = useNavRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Verified sites first, each group newest-connected first — lets an
  // owner managing a growing list see "what's live" at a glance
  // without pending/unverified sites pushed in among them.
  const sortedSites = useMemo(() => {
    return [...sites].sort((a, b) => {
      const aVerified = a.status === 'verified' ? 0 : 1;
      const bVerified = b.status === 'verified' ? 0 : 1;
      if (aVerified !== bVerified) return aVerified - bVerified;
      const aDate = toDateSafe(a.createdAt)?.getTime() ?? 0;
      const bDate = toDateSafe(b.createdAt)?.getTime() ?? 0;
      return bDate - aDate;
    });
  }, [sites]);

  const verifiedCount = sites.filter((s) => s.status === 'verified').length;
  const pendingCount = sites.length - verifiedCount;
  const confirmTarget = sites.find((s) => s.id === confirmId) || null;

  async function handleConfirmDisconnect() {
    if (!confirmId) return;
    setBusyId(confirmId);
    try {
      await onDisconnectSite(confirmId);
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  function handleManage(siteId: string) {
    router.push(`/dashboard/sites/${siteId}`);
  }

  return (
    <div className="csp-main">
      <div className="csp-wrap">
        <div className="csp-head">
          <div className="csp-head-text">
            <h1>Connected sites</h1>
            <p>Every site linked to your account, its verification status, and when it last reported a visit.</p>
          </div>
          <button type="button" className="csp-add-btn" onClick={onAddSite}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Connect a site
          </button>
        </div>

        {sites.length > 0 && (
          <div className="csp-stats" role="group" aria-label="Site status summary">
            <div className="csp-stat">
              <span className="csp-stat-value">{sites.length}</span>
              <span className="csp-stat-label">Total sites</span>
            </div>
            <div className="csp-stat csp-stat-verified">
              <span className="csp-stat-value">{verifiedCount}</span>
              <span className="csp-stat-label">Verified</span>
            </div>
            <div className="csp-stat csp-stat-pending">
              <span className="csp-stat-value">{pendingCount}</span>
              <span className="csp-stat-label">Pending</span>
            </div>
          </div>
        )}

        {sites.length === 0 ? (
          <div className="csp-empty">
            <div className="csp-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
              </svg>
            </div>
            <h2>No sites connected yet</h2>
            <p>Connect your first site to start tracking visits, capturing leads, and pushing live banners.</p>
            <button type="button" className="csp-empty-cta" onClick={onAddSite}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Connect your site
            </button>
          </div>
        ) : (
          <div className="csp-grid">
            {sortedSites.map((site) => {
              const isVerified = site.status === 'verified';
              const isPaused = !!site.paused;
              const connectedDate = formatDate(toDateSafe(site.createdAt));
              const verifiedDate = formatDate(toDateSafe(site.verifiedAt));
              const lastSeen = formatRelative(toDateSafe(site.lastSeenAt));
              const noTrafficYet = isVerified && !site.lastSeenAt;
              const host = hostnameOf(site.url);

              return (
                <article
                  key={site.id}
                  className={`csp-card${isVerified ? ' is-verified' : ' is-pending'}${isPaused ? ' is-paused' : ''}`}
                >
                  <div className="csp-card-top">
                    <span className="csp-card-favicon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
                      </svg>
                    </span>
                    <span className={`csp-status-pill${isVerified ? ' is-verified' : ' is-pending'}`}>
                      {isVerified ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v6l4 2" />
                        </svg>
                      )}
                      {isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>

                  <h3 className="csp-card-domain" title={host}>
                    {host}
                  </h3>
                  <a className="csp-card-url" href={site.url} target="_blank" rel="noopener noreferrer">
                    {site.url}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M7 17 17 7M8 7h9v9" />
                    </svg>
                  </a>

                  <dl className="csp-card-meta">
                    <div className="csp-card-meta-row">
                      <dt>Connected</dt>
                      <dd>{connectedDate}</dd>
                    </div>
                    {isVerified ? (
                      <>
                        <div className="csp-card-meta-row">
                          <dt>Verified</dt>
                          <dd>{verifiedDate}</dd>
                        </div>
                        <div className="csp-card-meta-row">
                          <dt>Last visit</dt>
                          <dd className={noTrafficYet ? 'csp-meta-warn' : ''}>{lastSeen}</dd>
                        </div>
                      </>
                    ) : (
                      <div className="csp-card-meta-row">
                        <dt>Status</dt>
                        <dd>Waiting on verification</dd>
                      </div>
                    )}
                    {isPaused && (
                      <div className="csp-card-meta-row">
                        <dt>Tracking</dt>
                        <dd className="csp-meta-warn">Paused by owner</dd>
                      </div>
                    )}
                  </dl>

                  <div className="csp-card-actions">
                    {!isVerified && (
                      <button
                        type="button"
                        className="csp-action-btn csp-action-verify"
                        onClick={() => onResumeVerification({ id: site.id, url: site.url })}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        Verify now
                      </button>
                    )}
                    <button type="button" className="csp-action-btn csp-action-manage" onClick={() => handleManage(site.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                      </svg>
                      Manage
                    </button>
                    <button
                      type="button"
                      className="csp-action-btn csp-action-disconnect"
                      onClick={() => setConfirmId(site.id)}
                      disabled={busyId === site.id}
                      aria-label={`Disconnect ${host}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M18.4 5.6 5.6 18.4M5.6 5.6l12.8 12.8" />
                      </svg>
                      Disconnect
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmPopup
        open={!!confirmTarget}
        title={`Disconnect ${confirmTarget ? hostnameOf(confirmTarget.url) : 'this site'}?`}
        message="The tracking tag on this site will stop working immediately — no more visits logged, and any live banner will disappear. You'd need to connect the site again from scratch."
        confirmLabel="Disconnect"
        busyLabel="Disconnecting…"
        danger
        busy={!!busyId}
        onConfirm={handleConfirmDisconnect}
        onClose={() => !busyId && setConfirmId(null)}
      />
    </div>
  );
}
