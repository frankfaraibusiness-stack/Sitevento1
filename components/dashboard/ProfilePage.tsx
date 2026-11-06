'use client';

// components/dashboard/ProfilePage.tsx
//
// The account profile page — ported 1:1 from the app.html mock (user
// card + "Site performance" analytics card) with every placeholder
// replaced by real data:
//
//   - Avatar/name/email            -> the signed-in Firebase user
//   - Plan badge + Upgrade         -> useUserProfile + lib/plans.ts
//   - Daily tokens bar + countdown -> useAccountLimits().tokenUsage
//   - Connect / Verify / Disconnect -> useSites() (list), /api/connect-site
//     (inline "Add" — creates the site with the plan's default
//     permissions, same fallback app/api/connect-site/route.ts already
//     supports for a bare {idToken,url} call), disconnectSite (same
//     server action the rest of the dashboard uses)
//   - "Site performance" card      -> useActiveSiteData only (real
//     Visit docs: total visits, unique visitors, leads captured, and
//     top country computed straight from each visit's own
//     Visit.country field). Deliberately NOT useMonetizationStats —
//     that hook is ad-serving/impression data (a site with
//     monetization off would show all zeros), not general site
//     traffic, so it has no business on a plain site-performance card.
//
// Per the brief: clicking "Connect your site" expands the inline form
// in place (exactly like the mock's showConnectForm/addSite JS) and
// that inline add is as far as it goes — it only creates the site
// record. The ONLY path to the real multi-step connect/verify flow is
// the "Verify" button on an already-added-but-unverified site, which
// routes to /dashboard/connect?site=<id>&url=<url> (the same resume-
// verification deep link ConnectedSitesPage/DashboardShell already use
// via handleResumeVerification), landing the wizard straight on the
// tag+verify step for that exact site instead of starting over.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Site, Visit } from '@/lib/types';
import { useSites } from '@/hooks/useSites';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { useActiveSiteData } from '@/hooks/useActiveSiteData';
import { useWallet } from '@/hooks/useWallet';
import { useNavRouter } from '@/hooks/useNavPending';
import { useBgTone } from '@/hooks/useBgTone';
import { getPlan } from '@/lib/plans';
import { getCountryName } from '@/lib/countries';
import { ConfirmPopup } from '@/components/widgets/WidgetStatusPopup';

interface ProfilePageProps {
  user: User;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

// HH:MM:SS countdown to a target ISO timestamp, ticking every second —
// matches the mock's own updateResetCountdown() exactly (it floors to
// local midnight rather than using accountLimits' resetsAt format, so
// this mirrors that same "time left today" shape against the real
// resetsAt value the server reports).
function useHmsCountdown(targetIso: string | null | undefined): string {
  const [label, setLabel] = useState('00:00:00');

  useEffect(() => {
    if (!targetIso) {
      setLabel('00:00:00');
      return;
    }
    const target = new Date(targetIso).getTime();

    function tick() {
      const diff = Math.max(0, target - Date.now());
      const h = String(Math.floor(diff / 3_600_000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60_000) / 1000)).padStart(2, '0');
      setLabel(`${h}:${m}:${s}`);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return label;
}

// Buckets today's visits (local time) into 11 evenly-spaced points
// across the day so far, for the same 0..300 x / 0..90 y SVG the mock
// draws — a real analogue of the mock's hardcoded polyline, built from
// actual Visit docs instead of invented numbers.
function buildTodayVisitsPath(visits: { ts: { toDate: () => Date } | number | null }[]): { points: string; areaPoints: string; max: number } {
  const POINTS = 11;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const elapsedMs = Date.now() - startOfDay;
  const dayMs = 24 * 60 * 60 * 1000;
  // How far through the day we are, in buckets (at least 1 so a chart
  // always renders something right after midnight instead of a flat
  // line at x=0).
  const bucketsElapsed = Math.max(1, Math.round((elapsedMs / dayMs) * (POINTS - 1)));

  const counts = new Array(POINTS).fill(0);
  for (const v of visits) {
    const d = v.ts && typeof v.ts !== 'number' && 'toDate' in v.ts ? v.ts.toDate() : v.ts ? new Date(v.ts as number) : null;
    if (!d) continue;
    if (d.getTime() < startOfDay) continue;
    const frac = (d.getTime() - startOfDay) / dayMs;
    const bucket = Math.min(POINTS - 1, Math.max(0, Math.round(frac * (POINTS - 1))));
    counts[bucket] += 1;
  }

  // Cumulative running total up to each bucket (so the line trends
  // upward across the day the way the mock's does), flat after the
  // current time.
  const cumulative: number[] = [];
  let running = 0;
  for (let i = 0; i < POINTS; i++) {
    if (i <= bucketsElapsed) {
      running += counts[i];
      cumulative.push(running);
    } else {
      cumulative.push(running);
    }
  }

  const max = Math.max(1, ...cumulative);
  const coords = cumulative.map((c, i) => {
    const x = (i / (POINTS - 1)) * 300;
    const y = 82 - (c / max) * 66; // keep an 8px floor/ceiling pad like the mock's 16..70 range
    return [x, y] as const;
  });

  const points = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPoints = `${points} 300,90 0,90`;
  return { points, areaPoints, max };
}

// Real top-country, computed straight from each visit's own
// Visit.country field (set server-side at /api/track from the
// visitor's IP) — not ad-impression data. Returns null when no visit
// carries a country at all (e.g. a brand-new site with no traffic
// yet).
function computeTopCountry(visits: Pick<Visit, 'country'>[]): { name: string; sharePct: number } | null {
  const counts: Record<string, number> = {};
  let withCountry = 0;
  for (const v of visits) {
    if (!v.country) continue;
    counts[v.country] = (counts[v.country] || 0) + 1;
    withCountry += 1;
  }
  if (withCountry === 0) return null;
  const [code, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { name: getCountryName(code), sharePct: Math.round((count / withCountry) * 100) };
}

export function ProfilePage({ user }: ProfilePageProps) {
  const router = useNavRouter();
  // Same pattern as the main dashboard and SECURITY BOT page: every
  // surface/ink/accent below is a colour-mix of the live --app-bg
  // (Settings > Appearance's Theme Colour, including any custom hex)
  // instead of the fixed purple-on-white this page used to be pinned
  // to regardless of theme. This just measures whether that live
  // background currently reads light or dark.
  const tone = useBgTone();
  const { sites, activeSiteId, setActiveSiteId, activeSite, disconnectSite } = useSites(user.uid, user);
  const { planId } = useUserProfile(user);
  const { limits: accountLimits } = useAccountLimits(user);
  const { visits, stats } = useActiveSiteData(user.uid, activeSiteId, user);
  const { wallet } = useWallet(user);

  const resetCountdown = useHmsCountdown(accountLimits?.tokenUsage?.resetsAt);

  const [showConnectForm, setShowConnectForm] = useState(false);
  const [siteInput, setSiteInput] = useState('');
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const name = user.displayName || (user.email ? user.email.split('@')[0] : 'Account');
  const email = user.email || '';
  const plan = getPlan(planId);

  const tokenUsage = accountLimits?.tokenUsage;
  const tokenLimit = tokenUsage?.limit ?? null;
  const tokenRemaining = tokenUsage?.remaining ?? null;
  const tokenPct =
    tokenLimit && tokenRemaining !== null ? Math.max(0, Math.min(100, (tokenRemaining / tokenLimit) * 100)) : 100;

  const openConnectForm = useCallback(() => {
    setConnectError(null);
    setShowConnectForm(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeConnectForm = useCallback(() => {
    setShowConnectForm(false);
    setSiteInput('');
    setConnectError(null);
  }, []);

  // Inline "Add" — exactly as far as the mock's own addSite() goes:
  // it only records the site (POST /api/connect-site with no
  // permissionIds, so the server falls back to the plan's defaults —
  // see that route's own comment). It never jumps to the full
  // connect/verify wizard itself; that only happens from the
  // "Verify" button below.
  const addSite = useCallback(async () => {
    const value = siteInput.trim();
    if (!value) return;
    setConnectBusy(true);
    setConnectError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/connect-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, url: value }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        if (result.code === 'SITE_LIMIT_REACHED') {
          setConnectError(`You've reached your plan's limit of ${result.limit} connected site${result.limit === 1 ? '' : 's'}.`);
        } else {
          setConnectError(result.error || "Couldn't add that site.");
        }
        return;
      }
      setActiveSiteId(result.siteId);
      setShowConnectForm(false);
      setSiteInput('');
    } catch {
      setConnectError('Could not reach the server. Please try again.');
    } finally {
      setConnectBusy(false);
    }
  }, [siteInput, user, setActiveSiteId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') addSite();
  }

  // The ONLY route into the real multi-step wizard: resumes
  // verification for this exact already-created site, same deep link
  // DashboardShell/ConnectedSitesPage already use.
  function handleVerify(site: Site) {
    router.push(`/dashboard/connect?site=${encodeURIComponent(site.id)}&url=${encodeURIComponent(site.url)}`);
  }

  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);
  const [disconnectBusy, setDisconnectBusy] = useState(false);

  function handleDisconnect(siteId: string) {
    setConfirmDisconnectId(siteId);
  }

  async function handleConfirmDisconnect() {
    if (!confirmDisconnectId) return;
    setDisconnectBusy(true);
    try {
      await disconnectSite(confirmDisconnectId);
    } finally {
      setDisconnectBusy(false);
      setConfirmDisconnectId(null);
    }
  }

  const chart = useMemo(() => buildTodayVisitsPath(visits), [visits]);
  const topCountry = useMemo(() => computeTopCountry(visits), [visits]);

  const showUnverifiedNotice = !!activeSite && activeSite.status === 'pending';

  return (
    <div className="profile-page-root" data-tone={tone}>
      <div className="profile-page-stack">
        {/* ---- Left column (desktop): identity + plan + connect.
            Sticky on desktop so it stays in view while the stat/
            performance cards on the right scroll past it — see
            .profile-col-left in profile-page.css. On mobile this is
            just the first card in a single stacked column, same as
            before. ---- */}
        <div className="profile-col-left">
        <div className="profile-user-card">
          <div className="profile-top-row">
            <div className="profile-avatar">
              {user.photoURL ? <img src={user.photoURL} alt="" /> : initialOf(name)}
            </div>
            <div className="profile-user-info">
              <div className="profile-user-name">{name}</div>
              <div className="profile-user-email">{email}</div>
              <div className="profile-user-plan">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5L5.7 21l2.3-7.2-6-4.6h7.6z" />
                </svg>
                {plan.name.toUpperCase()} PLAN
              </div>
            </div>
            <button type="button" className="profile-upgrade-btn" onClick={() => router.push('/dashboard/plans')}>
              Upgrade
            </button>
          </div>

          <div className="profile-token-section">
            <div className="profile-token-label-row">
              <span>
                Daily tokens
                <span className="profile-reset-timer">
                  resets in <span className="profile-reset-countdown">{resetCountdown}</span>
                </span>
              </span>
              <span>
                <span className="profile-count">{tokenRemaining !== null ? tokenRemaining.toLocaleString() : '—'}</span>{' '}
                / {tokenLimit !== null ? tokenLimit.toLocaleString() : 'Unlimited'} left
              </span>
            </div>
            <div className="profile-token-bar-track">
              <div className="profile-token-bar-fill" style={{ width: `${tokenPct}%` }} />
            </div>
          </div>

          <div className="profile-connect-section">
            {!activeSite && !showConnectForm && (
              <button type="button" className="profile-connect-box" onClick={openConnectForm}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
                  <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.5-1.5" />
                </svg>
                Connect your site
              </button>
            )}

            {!activeSite && showConnectForm && (
              <>
                <div className="profile-connect-form">
                  <input
                    ref={inputRef}
                    type="text"
                    className="profile-connect-input"
                    placeholder="https://yoursite.com"
                    value={siteInput}
                    onChange={(e) => setSiteInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={connectBusy}
                  />
                  <button type="button" className="profile-connect-add-btn" onClick={addSite} disabled={connectBusy}>
                    {connectBusy ? 'Adding…' : 'Add'}
                  </button>
                </div>
                <button
                  type="button"
                  className="profile-connect-cancel-btn"
                  onClick={closeConnectForm}
                  disabled={connectBusy}
                >
                  Cancel
                </button>
                {connectError && <div className="profile-connect-error">{connectError}</div>}
              </>
            )}

            {activeSite && (
              <div className="profile-site-connected">
                <span
                  className={`profile-site-dot${activeSite.status === 'pending' ? ' profile-site-dot--pending' : ''}`}
                />
                <span className="profile-site-url">{hostnameOf(activeSite.url)}</span>
                <button type="button" className="profile-site-switch-btn" onClick={() => handleVerify(activeSite)}>
                  Verify
                </button>
                <button
                  type="button"
                  className="profile-site-disconnect-btn"
                  aria-label="Disconnect site"
                  onClick={() => handleDisconnect(activeSite.id)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            )}

            {sites.length > 1 && (
              <div className="profile-site-picker">
                {sites.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`profile-site-picker-btn${s.id === activeSiteId ? ' profile-site-picker-btn--active' : ''}`}
                    onClick={() => setActiveSiteId(s.id)}
                  >
                    {hostnameOf(s.url)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* ---- Right column (desktop): sites / wallet / site
            performance cards. "Your sites" and "Wallet" sit side by
            side as a 2-up sub-grid on wide screens (they're short,
            same-height summary cards — pairing them avoids two
            half-empty full-width rows), with "Site performance"
            spanning the full column width below since it's taller
            and chart-bearing. On mobile this is just the remaining
            cards in the same single stacked column as before. ---- */}
        <div className="profile-col-right">
        <div className="profile-col-right-top">
        <div className="profile-analytics-card">
          <div className="profile-analytics-header">
            <span className="profile-analytics-title">Your sites</span>
            <span className="profile-analytics-site">
              {sites.length} connected
            </span>
          </div>

          <div className="profile-stat-grid">
            <div className="profile-stat-tile">
              <span className="profile-stat-tile-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Verified
              </span>
              <span className="profile-stat-tile-value">{sites.filter((s) => s.status === 'verified').length}</span>
            </div>
            <div className="profile-stat-tile">
              <span className="profile-stat-tile-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Pending
              </span>
              <span className="profile-stat-tile-value">{sites.filter((s) => s.status !== 'verified').length}</span>
            </div>
          </div>

          <a
            href="/dashboard/sites"
            className="profile-view-analytics-link"
            onClick={(e) => {
              e.preventDefault();
              router.push('/dashboard/sites');
            }}
          >
            Manage all sites
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>

        <div className="profile-analytics-card">
          <div className="profile-analytics-header">
            <span className="profile-analytics-title">Wallet</span>
            <span className="profile-analytics-site">
              {wallet ? `$${wallet.balanceUsd.toFixed(2)} available` : '—'}
            </span>
          </div>

          <div className="profile-stat-grid">
            <div className="profile-stat-tile">
              <span className="profile-stat-tile-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 1l4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 23l-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                Lifetime deposited
              </span>
              <span className="profile-stat-tile-value">
                {wallet ? `$${wallet.lifetimeDepositedUsd.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="profile-stat-tile">
              <span className="profile-stat-tile-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Lifetime spent
              </span>
              <span className="profile-stat-tile-value">
                {wallet ? `$${wallet.lifetimeSpentUsd.toFixed(2)}` : '—'}
              </span>
            </div>
          </div>

          <a
            href="/dashboard/wallet"
            className="profile-view-analytics-link"
            onClick={(e) => {
              e.preventDefault();
              router.push('/dashboard/wallet');
            }}
          >
            View wallet
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
        </div>

        <div className="profile-analytics-card">
          <div className="profile-analytics-header">
            <span className="profile-analytics-title">Site performance</span>
            <span className="profile-analytics-site">{activeSite ? hostnameOf(activeSite.url) : 'No site connected'}</span>
          </div>

          {activeSite ? (
            <>
              <div className="profile-chart-box">
                <div className="profile-chart-label">Today&apos;s visits</div>
                <svg viewBox="0 0 300 90" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="profileVisitsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c6f24e" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="#c6f24e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline
                    points={chart.points}
                    fill="none"
                    stroke="#000"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polygon points={chart.areaPoints} fill="url(#profileVisitsFill)" stroke="none" />
                </svg>
              </div>

              <div className="profile-stat-grid profile-stat-grid--quad">
                <div className="profile-stat-tile">
                  <span className="profile-stat-tile-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                    </svg>
                    Unique visitors
                  </span>
                  <span className="profile-stat-tile-value">{stats.unique.toLocaleString()}</span>
                </div>
                <div className="profile-stat-tile">
                  <span className="profile-stat-tile-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Top country
                  </span>
                  <span className="profile-stat-tile-value">
                    {topCountry ? (
                      <>
                        {topCountry.name} <small>{topCountry.sharePct}%</small>
                      </>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
                <div className="profile-stat-tile">
                  <span className="profile-stat-tile-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3 9h18M7 13h4" />
                    </svg>
                    Leads
                  </span>
                  <span className="profile-stat-tile-value">{stats.leadsCount.toLocaleString()}</span>
                </div>
                <div className="profile-stat-tile">
                  <span className="profile-stat-tile-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 1l4 4-4 4" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <path d="M7 23l-4-4 4-4" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    Visits
                  </span>
                  <span className="profile-stat-tile-value">{stats.total.toLocaleString()}</span>
                </div>
              </div>

              {showUnverifiedNotice && (
                <div className="profile-analytics-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Some data couldn&apos;t be verified for this site
                </div>
              )}

              {!showUnverifiedNotice && stats.total === 0 && (
                <div className="profile-analytics-empty">No visits recorded yet for this site.</div>
              )}

              <a
                href="/dashboard"
                className="profile-view-analytics-link"
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/dashboard');
                }}
              >
                View full analytics
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </a>
            </>
          ) : (
            <div className="profile-analytics-empty">Connect a site to see live performance data here.</div>
          )}
        </div>
        </div>
      </div>

      <ConfirmPopup
        open={!!confirmDisconnectId}
        title={`Disconnect ${
          confirmDisconnectId ? hostnameOf(sites.find((s) => s.id === confirmDisconnectId)?.url || '') : 'this site'
        }?`}
        message="The tracking tag on this site will stop working immediately — no more visits logged, and any live banner will disappear. You'd need to connect the site again from scratch."
        confirmLabel="Disconnect"
        busyLabel="Disconnecting…"
        danger
        busy={disconnectBusy}
        onConfirm={handleConfirmDisconnect}
        onClose={() => !disconnectBusy && setConfirmDisconnectId(null)}
      />
    </div>
  );
}
