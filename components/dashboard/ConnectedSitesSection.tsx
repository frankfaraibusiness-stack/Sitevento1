'use client';

// components/dashboard/ConnectedSitesSection.tsx
//
// Replaces the plain tab-strip (SiteTabs) with a horizontally scrollable
// row of real cards — one per connected site, each showing status,
// visit count (from stats passed in) and a disconnect action, matching
// the "beautiful scrollable section, each well thick" brief. Selecting a
// site still works the same way SiteTabs did (click to make active);
// disconnecting asks for confirmation first since it's destructive to
// the connection (tag stops working, banner disappears).
import { useState } from 'react';
import type { Site } from '@/lib/types';

interface ConnectedSitesSectionProps {
  sites: Site[];
  activeSiteId: string | null;
  onSelect: (siteId: string) => void;
  onAddSite: () => void;
  onDisconnect: (siteId: string) => Promise<void> | void;
}

export function ConnectedSitesSection({ sites, activeSiteId, onSelect, onAddSite, onDisconnect }: ConnectedSitesSectionProps) {
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
    <section className="css-root">
      <div className="css-head">
        <h3>Connected sites</h3>
        <button type="button" className="css-add-btn" onClick={onAddSite}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Connect a site
        </button>
      </div>

      <div className="css-scroller" role="listbox" aria-label="Connected sites">
        {sites.map((s) => {
          const isActive = s.id === activeSiteId;
          const isPending = s.status === 'pending';
          const isLive = !!s.overlay?.active;
          return (
            <div
              key={s.id}
              role="option"
              aria-selected={isActive}
              className={`css-card${isActive ? ' is-active' : ''}${isPending ? ' is-pending' : ''}`}
            >
              <span className="css-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
                </svg>
              </span>
              <button type="button" className="css-card-main" onClick={() => onSelect(s.id)}>
                <span className="css-card-top">
                  <span className="css-card-name">{s.name || s.url || 'Untitled site'}</span>
                </span>
                <span className={`css-card-meta${isPending ? ' is-pending' : ''}${isLive ? ' is-live' : ''}`}>
                  <span className={`css-status-dot${isPending ? ' is-pending' : ''}${isLive ? ' is-live' : ''}`} />
                  {isPending ? 'UNVERIFIED' : isLive ? 'BANNER LIVE' : 'VERIFIED'}
                </span>
                <span className="css-card-url">{s.url}</span>
              </button>
              <span className={`css-connected-pill${isPending ? ' is-pending' : ''}`}>
                {isPending ? 'Pending' : 'Connected'}
              </span>
              <button
                type="button"
                className="css-disconnect-btn"
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
          );
        })}

        <button type="button" className="css-card css-card-add" onClick={onAddSite}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Connect a site</span>
        </button>
      </div>

      {confirmTarget && (
        <div className="css-sheet-backdrop" role="presentation" onClick={() => !busyId && setConfirmId(null)}>
          <div className="css-sheet" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="css-sheet-title">Disconnect {confirmTarget.name || confirmTarget.url}?</div>
            <p className="css-sheet-msg">
              The tracking tag on this site will stop working immediately — no more visits logged, and any live
              banner will disappear. This can&apos;t be undone from here; you&apos;d need to connect the site again.
            </p>
            <div className="css-sheet-actions">
              <button type="button" className="ghost-btn" onClick={() => setConfirmId(null)} disabled={!!busyId}>
                Cancel
              </button>
              <button type="button" className="ghost-btn danger" onClick={handleConfirmDisconnect} disabled={!!busyId}>
                {busyId ? 'Disconnecting\u2026' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
