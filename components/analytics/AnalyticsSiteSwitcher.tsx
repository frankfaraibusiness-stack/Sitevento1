'use client';

// components/analytics/AnalyticsSiteSwitcher.tsx
//
// "Startup connected" card + switcher. Reads the REAL connected sites that
// DashboardClient already subscribes to (passed in as props), but only
// changes which one is active — no analytics data is fetched here yet.
import { useEffect, useRef, useState } from 'react';
import type { Site } from '@/lib/types';
import { badgeGradient, siteHost, siteState } from './analyticsUtils';
import { IconCheck, IconChevronDown, IconLink, IconPlus } from './AnalyticsIcons';

interface Props {
  sites: Site[];
  activeSiteId: string | null;
  onChange: (id: string) => void;
  onAdd: () => void;
}

function SiteBadge({ host, small }: { host: string; small?: boolean }) {
  return (
    <span className={small ? 'anx-badge is-sm' : 'anx-badge'} style={{ background: badgeGradient(host) }} aria-hidden="true">
      {host.charAt(0).toUpperCase()}
    </span>
  );
}

export function AnalyticsSiteSwitcher({ sites, activeSiteId, onChange, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // No site yet — the card turns into the one obvious next step.
  if (sites.length === 0) {
    return (
      <div className="anx-site-wrap" ref={rootRef}>
        <button type="button" className="anx-site is-empty" onClick={onAdd}>
          <span className="anx-badge is-ghost" aria-hidden="true">
            <IconLink />
          </span>
          <span className="anx-site-text">
            <strong>Connect your startup</strong>
            <small>Add the tag to start tracking</small>
          </span>
          <IconPlus className="anx-site-chev" />
        </button>
      </div>
    );
  }

  const active = sites.find((s) => s.id === activeSiteId) || sites[0];
  const host = siteHost(active);
  const state = siteState(active);

  return (
    <div className="anx-site-wrap" ref={rootRef}>
      <button
        type="button"
        className={open ? 'anx-site is-open' : 'anx-site'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SiteBadge host={host} />
        <span className="anx-site-text">
          <strong>{host}</strong>
          <small>
            <i className={`anx-dot is-${state.tone}`} />
            {state.label}
          </small>
        </span>
        <IconChevronDown className="anx-site-chev" />
      </button>

      {open && (
        <div className="anx-menu" role="listbox" aria-label="Switch startup">
          <p className="anx-menu-head">
            Your startups <span>{sites.length}</span>
          </p>
          {sites.map((s) => {
            const h = siteHost(s);
            const st = siteState(s);
            const on = s.id === active.id;
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={on}
                className={on ? 'anx-menu-item is-on' : 'anx-menu-item'}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
              >
                <SiteBadge host={h} small />
                <span className="anx-site-text">
                  <strong>{h}</strong>
                  <small>
                    <i className={`anx-dot is-${st.tone}`} />
                    {st.label}
                  </small>
                </span>
                {on && <IconCheck className="anx-menu-check" />}
              </button>
            );
          })}
          <button
            type="button"
            className="anx-menu-item is-add"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
          >
            <span className="anx-badge is-sm is-ghost" aria-hidden="true">
              <IconPlus />
            </span>
            <span className="anx-site-text">
              <strong>Connect another startup</strong>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
