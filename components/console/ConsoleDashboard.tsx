'use client';

// components/console/ConsoleDashboard.tsx
//
// The Console's main landing page content — read-only platform-wide
// overview. Pulls from useConsoleStats() (polls app/api/platform-stats
// every 30s for a "live" feel without a Firestore listener — see that
// hook's header). No writes happen anywhere on this page.
import { useConsoleStats } from '@/hooks/useConsoleStats';
import { ConsoleTrendChart } from './ConsoleTrendChart';

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtTimeAgo(d: Date | null): string {
  if (!d) return '—';
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

function sum(points: number[]): number {
  return points.reduce((a, b) => a + b, 0);
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const isUp = value >= 0;
  return (
    <span className={`console-delta ${isUp ? 'is-up' : 'is-down'}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        {isUp ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  icon: React.ReactNode;
  tone: 'green' | 'purple' | 'blue' | 'orange';
}

function StatCard({ label, value, sub, delta, icon, tone }: StatCardProps) {
  return (
    <div className={`console-stat-card tone-${tone}`}>
      <div className="console-stat-icon">{icon}</div>
      <div className="console-stat-body">
        <div className="console-stat-label">{label}</div>
        <div className="console-stat-value">{value}</div>
        <div className="console-stat-foot">
          {sub && <span className="console-stat-sub">{sub}</span>}
          {delta !== undefined && <DeltaBadge value={delta} />}
        </div>
      </div>
    </div>
  );
}

export function ConsoleDashboard() {
  const { stats, loading, error, lastUpdated, refresh } = useConsoleStats();

  if (loading && !stats) {
    return (
      <div className="console-loading">
        <div className="console-loading-spinner" />
        <p>Loading platform overview…</p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="console-loading console-loading-error">
        <p>{error}</p>
        <button type="button" className="console-retry-btn" onClick={refresh}>
          Try again
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const series = stats.series;
  const last7 = series.slice(-7);
  const prev7 = series.slice(-14, -7);

  const visitsThisWeek = sum(last7.map((p) => p.visits));
  const visitsPrevWeek = sum(prev7.map((p) => p.visits));
  const signupsThisWeek = sum(last7.map((p) => p.signups));
  const signupsPrevWeek = sum(prev7.map((p) => p.signups));
  const newUsersThisWeek = sum(last7.map((p) => p.newUsers));
  const newUsersPrevWeek = sum(prev7.map((p) => p.newUsers));
  const uniquesThisWeek = sum(last7.map((p) => p.uniqueVisitors));
  const uniquesPrevWeek = sum(prev7.map((p) => p.uniqueVisitors));

  return (
    <div className="console-dash">
      <div className="console-dash-head">
        <div>
          <h1>Platform Overview</h1>
          <p className="console-dash-sub">Global, read-only stats across every account, site, and visit. No writes happen on this page.</p>
        </div>
        <div className="console-live">
          <span className="console-live-dot" />
          Live · updated {fmtTimeAgo(lastUpdated)}
          <button type="button" className="console-refresh-btn" onClick={refresh} aria-label="Refresh now">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 11-3-6.7" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Top-line totals ───────────────────────────────────── */}
      <div className="console-stat-grid">
        <StatCard
          label="Total Users"
          value={fmtNum(stats.totals.users)}
          sub={`+${stats.today.newUsers} today`}
          delta={deltaPct(newUsersThisWeek, newUsersPrevWeek)}
          tone="green"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
              <path d="M16.5 4.5a3.5 3.5 0 0 1 0 7" />
              <path d="M15 13.5c2.8.4 5 2.7 5 6.5" />
            </svg>
          }
        />
        <StatCard
          label="Platform Visits"
          value={fmtNum(stats.totals.platformVisitsAllTime)}
          sub={`+${fmtNum(stats.today.platformVisits)} today`}
          delta={deltaPct(visitsThisWeek, visitsPrevWeek)}
          tone="blue"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
        <StatCard
          label="Signup Conversion"
          value={fmtPct(stats.conversion.ratePct)}
          sub={`last ${stats.conversion.windowDays}d · ${fmtNum(signupsThisWeek)} signups / ${fmtNum(uniquesThisWeek)} visitors (7d)`}
          delta={deltaPct(signupsThisWeek, signupsPrevWeek)}
          tone="purple"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
        <StatCard
          label="Websites Connected"
          value={fmtNum(stats.totals.sitesConnected)}
          sub={`${fmtNum(stats.totals.verifiedSites)} verified`}
          tone="orange"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
            </svg>
          }
        />
      </div>

      {/* ── Today snapshot ─────────────────────────────────────── */}
      <div className="console-today-strip">
        <div className="console-today-item">
          <span className="console-today-num">{fmtNum(stats.today.newUsers)}</span>
          <span className="console-today-label">New users today</span>
        </div>
        <div className="console-today-item">
          <span className="console-today-num">{fmtNum(stats.today.platformVisits)}</span>
          <span className="console-today-label">Visits today</span>
        </div>
        <div className="console-today-item">
          <span className="console-today-num">{fmtNum(stats.today.uniqueVisitors)}</span>
          <span className="console-today-label">Unique visitors today</span>
        </div>
        <div className="console-today-item">
          <span className="console-today-num">{fmtNum(stats.today.signups)}</span>
          <span className="console-today-label">Signups today</span>
        </div>
      </div>

      {/* ── Charts ──────────────────────────────────────────────── */}
      <div className="console-chart-grid">
        <div className="console-chart-card">
          <div className="console-chart-card-head">
            <h2>Visits &amp; Unique Visitors</h2>
            <div className="console-legend">
              <span><i style={{ background: 'var(--console-c1)' }} />Visits</span>
              <span><i style={{ background: 'var(--console-c2)' }} />Unique visitors</span>
            </div>
          </div>
          <ConsoleTrendChart
            data={series}
            series={[
              { key: 'visits', label: 'Visits', colorVar: '--console-c1' },
              { key: 'uniqueVisitors', label: 'Unique visitors', colorVar: '--console-c2' },
            ]}
          />
        </div>

        <div className="console-chart-card">
          <div className="console-chart-card-head">
            <h2>New Users &amp; Signups</h2>
            <div className="console-legend">
              <span><i style={{ background: 'var(--console-c3)' }} />New users</span>
              <span><i style={{ background: 'var(--console-c4)' }} />Signup beacons</span>
            </div>
          </div>
          <ConsoleTrendChart
            data={series}
            series={[
              { key: 'newUsers', label: 'New users', colorVar: '--console-c3' },
              { key: 'signups', label: 'Signup beacons', colorVar: '--console-c4' },
            ]}
          />
        </div>
      </div>

      {/* ── Comparison strip: this week vs last week ─────────────── */}
      <div className="console-compare-card">
        <h2>This Week vs. Last Week</h2>
        <div className="console-compare-grid">
          <div className="console-compare-row">
            <span className="console-compare-label">New users</span>
            <span className="console-compare-val">{fmtNum(newUsersThisWeek)}</span>
            <span className="console-compare-prev">vs {fmtNum(newUsersPrevWeek)}</span>
            <DeltaBadge value={deltaPct(newUsersThisWeek, newUsersPrevWeek)} />
          </div>
          <div className="console-compare-row">
            <span className="console-compare-label">Platform visits</span>
            <span className="console-compare-val">{fmtNum(visitsThisWeek)}</span>
            <span className="console-compare-prev">vs {fmtNum(visitsPrevWeek)}</span>
            <DeltaBadge value={deltaPct(visitsThisWeek, visitsPrevWeek)} />
          </div>
          <div className="console-compare-row">
            <span className="console-compare-label">Unique visitors</span>
            <span className="console-compare-val">{fmtNum(uniquesThisWeek)}</span>
            <span className="console-compare-prev">vs {fmtNum(uniquesPrevWeek)}</span>
            <DeltaBadge value={deltaPct(uniquesThisWeek, uniquesPrevWeek)} />
          </div>
          <div className="console-compare-row">
            <span className="console-compare-label">Signups</span>
            <span className="console-compare-val">{fmtNum(signupsThisWeek)}</span>
            <span className="console-compare-prev">vs {fmtNum(signupsPrevWeek)}</span>
            <DeltaBadge value={deltaPct(signupsThisWeek, signupsPrevWeek)} />
          </div>
        </div>
      </div>

      <p className="console-footnote">
        Platform visits and signup conversion are tracked from the marketing site only (see app/api/platform-track). Per-site
        customer visit data is shown on each account&apos;s own dashboard and is not aggregated here.
      </p>
    </div>
  );
}
