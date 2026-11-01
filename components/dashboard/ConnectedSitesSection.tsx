'use client';

// components/dashboard/ConnectedSitesSection.tsx
//
// Premium "manage your sites" rail. SiteSwitcher (in the hero header)
// handles quick switching; this section is for actually managing the
// sites on the account — a horizontally scrollable row of glass cards,
// each with status, a "Manage" link into SiteManagePage, and disconnect.
// Renders only when there's something worth managing (1+ sites) — the
// empty-account state is handled entirely by DashEmptyState upstream.
import { useState } from 'react';
import type { Site } from '@/lib/types';

interface ConnectedSitesSectionProps {
  sites: Site[];
  activeSiteId: string | null;
  onSelect: (siteId: string) => void;
  onAddSite: () => void;
  // Return value isn't consumed here (see handleConfirmDisconnect
  // below — just awaited), so this accepts whatever the caller's own
  // disconnect function resolves to — including hooks/useSites.ts's
  // disconnectSite, which resolves Promise<boolean> (success/failure).
  // `any` (not `unknown`) specifically: TS checks function-typed props
  // contravariantly on their return type, so a narrower return type
  // (Promise<unknown>) is NOT assignable to a prop expecting a
  // specific return (Promise<boolean>, Promise<void>, etc — whatever
  // DashboardShell.tsx's own disconnectSite prop type happens to say).
  // `Promise<any>` sidesteps that check entirely, so this prop accepts
  // any disconnect function regardless of what it resolves to, without
  // DashboardShell.tsx and this file having to keep two independently
  // hand-written signatures for the same function in lockstep.
  onDisconnect: (siteId: string) => Promise<any> | void;
  onManageSite?: (siteId: string) => void;
}

export function ConnectedSitesSection({ sites, activeSiteId, onSelect, onAddSite, onDisconnect, onManageSite }: ConnectedSitesSectionProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirmTarget = sites.find((s) => s.id === confirmId) || null;

  async function handleConfirmDisconnect() {
    if (!confirmId) return;
    setBusyId(confirmId);
    try {
      await onDisconnect(confirmId);
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <section className="dnx-sites-root">
      <div className="dnx-sites-head">
        <h3>Your sites</h3>
        <button type="button" className="dnx-sites-add-btn" onClick={onAddSite}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Connect a site
        </button>
      </div>

      <div className="dnx-sites-scroller" role="listbox" aria-label="Connected sites">
        {sites.map((s) => {
          const isActive = s.id === activeSiteId;
          const isPending = s.status === 'pending';
          const isLive = !!s.overlay?.active;
          return (
            <div
              key={s.id}
              role="option"
              aria-selected={isActive}
              className={`dnx-site-card${isActive ? ' is-active' : ''}${isPending ? ' is-pending' : ''}`}
            >
              <button type="button" className="dnx-site-card-main" onClick={() => onSelect(s.id)}>
                <span className="dnx-site-card-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
                  </svg>
                </span>
                <span className="dnx-site-card-name">{s.name || s.url || 'Untitled site'}</span>
                <span className={`dnx-site-card-status${isPending ? ' is-pending' : ''}${isLive ? ' is-live' : ''}`}>
                  <span className="dnx-site-card-dot" aria-hidden="true" />
                  {isPending ? 'Unverified' : isLive ? 'Banner live' : 'Verified'}
                </span>
                <span className="dnx-site-card-url">{s.url}</span>
              </button>

              <div className="dnx-site-card-actions">
                <button type="button" className="dnx-site-card-manage" onClick={() => onManageSite?.(s.id)}>
                  Manage
                </button>
                <button
                  type="button"
                  className="dnx-site-card-disconnect"
                  onClick={() => setConfirmId(s.id)}
                  aria-label={`Disconnect ${s.name || s.url}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}

        <button type="button" className="dnx-site-card dnx-site-card-add" onClick={onAddSite}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Connect a site</span>
        </button>
      </div>

      {confirmTarget && (
        <div className="dnx-sheet-backdrop" role="presentation" onClick={() => !busyId && setConfirmId(null)}>
          <div className="dnx-sheet" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="dnx-sheet-title">Disconnect {confirmTarget.name || confirmTarget.url}?</div>
            <p className="dnx-sheet-msg">
              The tracking tag on this site will stop working immediately — no more visits logged, and any live
              banner will disappear. This can&apos;t be undone from here; you&apos;d need to connect the site again.
            </p>
            <div className="dnx-sheet-actions">
              <button type="button" className="ghost-btn" onClick={() => setConfirmId(null)} disabled={!!busyId}>
                Cancel
              </button>
              <button type="button" className="ghost-btn danger" onClick={handleConfirmDisconnect} disabled={!!busyId}>
                {busyId ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
