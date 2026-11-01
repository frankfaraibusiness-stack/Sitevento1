'use client';

// components/dashboard/SiteDomainCard.tsx
//
// Domain/site-switcher card, matching the HTML mock's .domain-section
// but wired to real behavior rather than the mock's inline add-site
// text input: the real app adds a site via a dedicated pre-flight
// check + route push (DashboardClient.tsx's openAddSiteModal ->
// /dashboard/connect, with the at-limit upsell short-circuiting
// first), not an inline form — so "Add a new site" here calls
// onAddSite() exactly like the existing SiteSwitcher.tsx does, and
// there's no separate input state to fake.
import { useEffect, useRef, useState } from 'react';
import type { Site } from '@/lib/types';

interface SiteDomainCardProps {
  sites: Site[];
  activeSiteId: string | null;
  onSelect: (siteId: string) => void;
  onAddSite: () => void;
}

export function SiteDomainCard({ sites, activeSiteId, onSelect, onAddSite }: SiteDomainCardProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeSite = sites.find((s) => s.id === activeSiteId) || sites[0] || null;
  const canSwitch = sites.length > 1;

  // Same outside-click / Escape handling as the existing SiteSwitcher.
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
    <section className="dashv2-domain-section" ref={rootRef}>
      <div className="dashv2-domain-card">
        <div className="dashv2-domain-info">
          <div className="dashv2-domain-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.5} />
              <path d="M3 12H21" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <path
                d="M12 3C14.5 5.5 15.8 8.6 15.8 12C15.8 15.4 14.5 18.5 12 21C9.5 18.5 8.2 15.4 8.2 12C8.2 8.6 9.5 5.5 12 3Z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="dashv2-domain-text">
            <span className="dashv2-domain-label">Current site</span>
            <span className="dashv2-domain-url">{activeSite.name || activeSite.url}</span>
            <span className={`dashv2-domain-status${isPending ? ' is-pending' : ''}${isLive ? ' is-live' : ''}`}>
              <span className="dashv2-domain-status-dot" aria-hidden="true" />
              {isPending ? 'Unverified' : isLive ? 'Banner live' : 'Verified'}
            </span>
          </div>
        </div>

        {canSwitch && (
          <button
            type="button"
            className="dashv2-switch-btn"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4L3 8L7 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 8H17C19.2 8 21 9.8 21 12C21 14.2 19.2 16 17 16H13" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 20L21 16L17 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 16H7C4.8 16 3 14.2 3 12C3 9.8 4.8 8 7 8H11" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Switch site
          </button>
        )}

        {canSwitch && open && (
          <div className="dashv2-site-switcher" role="listbox" aria-label="Switch site">
            <div className="dashv2-site-switcher-label">{sites.length} connected sites</div>
            <div className="dashv2-site-switcher-list">
              {sites.map((s) => {
                const selected = s.id === activeSite.id;
                const pending = s.status === 'pending';
                const live = !!s.overlay?.active;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`dashv2-site-option${selected ? ' is-selected' : ''}`}
                    onClick={() => {
                      onSelect(s.id);
                      setOpen(false);
                    }}
                  >
                    <span className="dashv2-site-option-dot" aria-hidden="true" />
                    <span className="dashv2-site-option-name">{s.name || s.url || 'Untitled site'}</span>
                    <span className={`dashv2-site-option-status${pending ? ' is-pending' : ''}${live ? ' is-live' : ''}`}>
                      {pending ? 'Unverified' : live ? 'Banner live' : 'Verified'}
                    </span>
                    {selected && (
                      <svg className="dashv2-site-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="dashv2-site-switcher-divider" />
            <button
              type="button"
              className="dashv2-add-site-trigger"
              onClick={() => {
                setOpen(false);
                onAddSite();
              }}
            >
              <span className="dashv2-add-site-trigger-icon" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
                </svg>
              </span>
              Connect another site
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
