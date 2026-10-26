'use client';

// components/dashboard/SiteSwitcher.tsx
//
// Premium site switcher for the top of the dashboard. Always shows the
// active site as a pill; the dropdown with the rest of the account's
// sites only opens/renders as "switchable" once there's more than one
// site connected — with exactly one site it still shows the pill (so the
// header looks the same either way) but drops the chevron/dropdown
// affordance since there's nothing to switch to.
import { useEffect, useRef, useState } from 'react';
import type { Site } from '@/lib/types';

interface SiteSwitcherProps {
  sites: Site[];
  activeSiteId: string | null;
  onSelect: (siteId: string) => void;
  onAddSite: () => void;
}

function siteInitial(site: Site) {
  const label = site.name || site.url || '?';
  return label.replace(/^https?:\/\//, '').trim().charAt(0).toUpperCase() || '?';
}

export function SiteSwitcher({ sites, activeSiteId, onSelect, onAddSite }: SiteSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeSite = sites.find((s) => s.id === activeSiteId) || sites[0] || null;
  const canSwitch = sites.length > 1;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  if (!activeSite) return null;

  const isPending = activeSite.status === 'pending';
  const isLive = !!activeSite.overlay?.active;

  return (
    <div className="dnx-switcher" ref={rootRef}>
      <button
        type="button"
        className={`dnx-switcher-trigger${canSwitch ? ' is-switchable' : ''}`}
        onClick={() => canSwitch && setOpen((v) => !v)}
        aria-haspopup={canSwitch ? 'listbox' : undefined}
        aria-expanded={canSwitch ? open : undefined}
      >
        <span className="dnx-switcher-avatar" aria-hidden="true">{siteInitial(activeSite)}</span>
        <span className="dnx-switcher-text">
          <span className="dnx-switcher-name">{activeSite.name || activeSite.url || 'Untitled site'}</span>
          <span className={`dnx-switcher-status${isPending ? ' is-pending' : ''}${isLive ? ' is-live' : ''}`}>
            <span className="dnx-switcher-dot" aria-hidden="true" />
            {isPending ? 'Unverified' : isLive ? 'Banner live' : 'Verified'}
          </span>
        </span>
        {canSwitch && (
          <svg
            className={`dnx-switcher-chevron${open ? ' is-open' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {canSwitch && open && (
        <div className="dnx-switcher-menu" role="listbox" aria-label="Switch site">
          <div className="dnx-switcher-menu-label">{sites.length} connected sites</div>
          {sites.map((s) => {
            const pending = s.status === 'pending';
            const live = !!s.overlay?.active;
            const selected = s.id === activeSiteId;
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`dnx-switcher-opt${selected ? ' is-selected' : ''}`}
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                }}
              >
                <span className="dnx-switcher-avatar dnx-switcher-avatar-sm" aria-hidden="true">{siteInitial(s)}</span>
                <span className="dnx-switcher-opt-text">
                  <span className="dnx-switcher-opt-name">{s.name || s.url || 'Untitled site'}</span>
                  <span className={`dnx-switcher-opt-status${pending ? ' is-pending' : ''}${live ? ' is-live' : ''}`}>
                    <span className="dnx-switcher-dot" aria-hidden="true" />
                    {pending ? 'Unverified' : live ? 'Banner live' : 'Verified'}
                  </span>
                </span>
                {selected && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="dnx-switcher-check" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
          <button type="button" className="dnx-switcher-add" onClick={() => { setOpen(false); onAddSite(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Connect another site
          </button>
        </div>
      )}
    </div>
  );
}
