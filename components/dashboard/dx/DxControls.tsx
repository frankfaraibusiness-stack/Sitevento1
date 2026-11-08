'use client';

// components/dashboard/dx/DxControls.tsx
//
// The dashboard's control row: site switcher, period picker (with a custom
// date range), refresh button + auto-refresh status, and the live-visitors
// pill. All presentational — state lives in DashboardShell.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import type { Site } from '@/lib/types';
import { RANGE_OPTIONS, addDays, dayKey, startOfDay, type CustomRange, type RangeId } from '@/lib/dashboardRange';
import { isRangeAllowed, type PlanLimits } from '@/lib/plans';
import { POLL_MS } from '@/hooks/useDashboardData';

// Same navigation path the rest of the dashboard uses (useNavRouter drives
// the NavPendingOverlay), while keeping a real href so cmd/ctrl-click and
// "open in new tab" still work — mirrors DxPanels.tsx's own NavLink.
function NavLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useNavRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}

export function siteHost(site: Pick<Site, 'url' | 'name'>): string {
  try {
    const raw = site.url.includes('://') ? site.url : `https://${site.url}`;
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return site.url || site.name;
  }
}

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

/* ── Site switcher ─────────────────────────────────────────────── */
interface SwitcherProps {
  sites: Site[];
  activeSiteId: string | null;
  onChange: (id: string) => void;
  onAdd: () => void;
}

function siteState(s: Site): { label: string; tone: 'ok' | 'warn' | 'off' } {
  if (s.paused) return { label: 'Paused', tone: 'off' };
  if (s.status !== 'verified') return { label: 'Needs verification', tone: 'warn' };
  return { label: 'Tracking', tone: 'ok' };
}

export function SiteSwitcher({ sites, activeSiteId, onChange, onAdd }: SwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const active = sites.find((s) => s.id === activeSiteId) || sites[0];
  if (!active) return null;
  const state = siteState(active);

  return (
    <div className="dx-switcher" ref={ref}>
      <button
        type="button"
        className="dx-switch-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dx-site-badge" aria-hidden="true">
          {siteHost(active).charAt(0).toUpperCase()}
        </span>
        <span className="dx-switch-text">
          <strong>{siteHost(active)}</strong>
          <small>
            <i className={`dx-dot-state is-${state.tone}`} /> {state.label}
          </small>
        </span>
        <svg viewBox="0 0 24 24" className="dx-chev" aria-hidden="true">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="dx-menu" role="listbox" aria-label="Switch site">
          {sites.map((s) => {
            const st = siteState(s);
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={s.id === active.id}
                className={s.id === active.id ? 'dx-menu-item is-active' : 'dx-menu-item'}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
              >
                <span className="dx-site-badge is-sm" aria-hidden="true">
                  {siteHost(s).charAt(0).toUpperCase()}
                </span>
                <span className="dx-switch-text">
                  <strong>{siteHost(s)}</strong>
                  <small>
                    <i className={`dx-dot-state is-${st.tone}`} /> {st.label}
                  </small>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className="dx-menu-item is-add"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
          >
            <span className="dx-site-badge is-sm is-plus" aria-hidden="true">
              +
            </span>
            <span className="dx-switch-text">
              <strong>Connect another site</strong>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Period picker ─────────────────────────────────────────────── */
interface RangePickerProps {
  value: RangeId;
  custom: CustomRange;
  onChange: (id: RangeId, custom?: CustomRange) => void;
  // Plan's visit-history window — see lib/plans.ts's isRangeAllowed. When
  // omitted (limits still loading), every chip renders unlocked rather
  // than flashing a lock that then disappears once the plan loads.
  limits?: PlanLimits | null;
}

function lockHint(rangeId: RangeId, limits: PlanLimits): string {
  if (rangeId === 'custom') return 'Custom date ranges are available on Scale and above — upgrade to unlock.';
  const days = limits.historyRetentionDays;
  return `Your plan keeps ${days}-day history — upgrade to see further back.`;
}

export function RangePicker({ value, custom, onChange, limits }: RangePickerProps) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(custom.from);
  const [to, setTo] = useState(custom.to);
  const [upsellId, setUpsellId] = useState<RangeId | null>(null);
  const ref = useOutsideClose(open, () => setOpen(false));
  const upsellRef = useOutsideClose(!!upsellId, () => setUpsellId(null));
  const todayKey = dayKey(startOfDay(new Date()));

  function apply() {
    if (!from || !to) return;
    const [a, b] = from <= to ? [from, to] : [to, from];
    onChange('custom', { from: a, to: b > todayKey ? todayKey : b });
    setOpen(false);
  }

  function selectChip(id: RangeId) {
    if (limits && !isRangeAllowed(limits, id)) {
      setUpsellId((cur) => (cur === id ? null : id));
      return;
    }
    setUpsellId(null);
    onChange(id);
  }

  return (
    <div className="dx-range" ref={ref}>
      <div className="dx-chips" role="tablist" aria-label="Time period">
        {RANGE_OPTIONS.map((o) => {
          const locked = !!limits && !isRangeAllowed(limits, o.id);
          return (
            <div className="dx-chip-wrap" key={o.id}>
              <button
                type="button"
                role="tab"
                aria-selected={value === o.id}
                aria-disabled={locked}
                className={value === o.id ? 'dx-chip is-on' : locked ? 'dx-chip is-locked' : 'dx-chip'}
                onClick={() => selectChip(o.id)}
              >
                {locked && (
                  <svg viewBox="0 0 24 24" className="dx-chip-lock" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 11V8a4 4 0 1 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {o.label}
              </button>
              {upsellId === o.id && (
                <div className="dx-pop dx-upsell-pop" role="dialog" aria-label="Upgrade required" ref={upsellRef}>
                  <p>{lockHint(o.id, limits!)}</p>
                  <NavLink href="/dashboard/plans" className="dx-btn is-accent is-block">
                    See plans
                  </NavLink>
                </div>
              )}
            </div>
          );
        })}
        <div className="dx-chip-wrap">
          <button
            type="button"
            role="tab"
            aria-selected={value === 'custom'}
            aria-expanded={open}
            aria-disabled={!!limits && !isRangeAllowed(limits, 'custom')}
            className={
              value === 'custom'
                ? 'dx-chip is-on'
                : limits && !isRangeAllowed(limits, 'custom')
                  ? 'dx-chip is-locked'
                  : 'dx-chip'
            }
            onClick={() => {
              if (limits && !isRangeAllowed(limits, 'custom')) {
                setUpsellId((cur) => (cur === 'custom' ? null : 'custom'));
                return;
              }
              setUpsellId(null);
              if (value !== 'custom') {
                const t = startOfDay(new Date());
                setFrom(custom.from || dayKey(addDays(t, -13)));
                setTo(custom.to || dayKey(t));
              }
              setOpen((o) => !o);
            }}
          >
            {limits && !isRangeAllowed(limits, 'custom') && (
              <svg viewBox="0 0 24 24" className="dx-chip-lock" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M8 11V8a4 4 0 1 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            Custom
          </button>
          {upsellId === 'custom' && (
            <div className="dx-pop dx-upsell-pop" role="dialog" aria-label="Upgrade required" ref={upsellRef}>
              <p>{lockHint('custom', limits!)}</p>
              <NavLink href="/dashboard/plans" className="dx-btn is-accent is-block">
                See plans
              </NavLink>
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="dx-pop" role="dialog" aria-label="Custom date range">
          <label>
            <span>From</span>
            <input type="date" value={from} max={todayKey} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={to} max={todayKey} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="dx-btn" onClick={apply} disabled={!from || !to}>
            Apply range
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Refresh + live status ─────────────────────────────────────── */
interface RefreshProps {
  onRefresh: () => void;
  refreshing: boolean;
  updatedAt: number | null;
  live: boolean;
  error: string | null;
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function RefreshControl({ onRefresh, refreshing, updatedAt, live, error }: RefreshProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="dx-refresh">
      <button
        type="button"
        className="dx-btn is-icon"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh data"
        title="Refresh now"
      >
        <svg viewBox="0 0 24 24" className={refreshing ? 'is-spin' : undefined} aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="dx-refresh-text" aria-live="polite">
        {error ? (
          <em>{error}</em>
        ) : updatedAt ? (
          <>
            Updated {ago(now - updatedAt)}
            <small>{live ? 'Auto-refreshes every 60s' : 'Past period — no auto-refresh'}</small>
          </>
        ) : (
          'Loading…'
        )}
      </span>
      {live && updatedAt && (
        <i key={updatedAt} className="dx-countdown" style={{ animationDuration: `${POLL_MS}ms` }} aria-hidden="true" />
      )}
    </div>
  );
}

export function LivePill({ count }: { count: number }) {
  return (
    <span className={count > 0 ? 'dx-live is-on' : 'dx-live'} title="Unique visitors in the last 5 minutes">
      <i className="dx-pulse" aria-hidden="true" />
      {count > 0 ? `${count} online now` : 'No one online right now'}
    </span>
  );
}
