// components/dashboard/OverviewStats.tsx — replaces the .dash-grid stat cards.
//
// Restyled to four colour-coded tiles (green / purple / blue / orange),
// each with an icon chip and a small decorative sparkline — matching the
// siterifty-style dashboard reference. Same props/data as before, purely
// a presentation change.
interface OverviewStatsProps {
  totalVisits: number;
  uniqueVisitors: number;
  leadsCount: number;
  blockedCount: number;
}

// Tiny inert decorative sparkline — not a real chart, just a visual echo
// of "things trending up" matching the reference screenshot. Shape only
// varies by tone so the four cards don't look identical.
function Sparkline({ tone }: { tone: 'green' | 'purple' | 'blue' | 'orange' }) {
  const paths: Record<typeof tone, string> = {
    green: 'M2 20 L12 15 L20 17 L30 9 L38 11 L46 2',
    purple: 'M2 18 L10 19 L18 12 L26 15 L34 6 L46 8',
    blue: 'M2 19 L11 13 L19 16 L27 8 L35 11 L46 3',
    orange: 'M2 10 L12 9 L20 11 L30 9 L38 10 L46 9',
  };
  return (
    <svg className="dc-spark" viewBox="0 0 48 24" fill="none" aria-hidden="true">
      <path d={paths[tone]} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="5" width="18" height="14" rx="2.2" />
    <path d="M4 7l8 6 8-6" />
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6l7-3z" />
  </svg>
);

export function OverviewStats({ totalVisits, uniqueVisitors, leadsCount, blockedCount }: OverviewStatsProps) {
  return (
    <div className="dash-grid">
      <div className="dash-card dc-tone-green">
        <span className="dc-icon"><EyeIcon /></span>
        <span className="dc-label">Total Visits</span>
        <span className="dc-num">{totalVisits}</span>
        <span className="dc-row">
          <span className="dc-sub">All time</span>
          <Sparkline tone="green" />
        </span>
      </div>
      <div className="dash-card dc-tone-purple">
        <span className="dc-icon"><PersonIcon /></span>
        <span className="dc-label">Unique Visitors</span>
        <span className="dc-num">{uniqueVisitors}</span>
        <span className="dc-row">
          <span className="dc-sub">All time</span>
          <Sparkline tone="purple" />
        </span>
      </div>
      <div className="dash-card dc-tone-blue">
        <span className="dc-icon"><MailIcon /></span>
        <span className="dc-label">Emails Captured</span>
        <span className="dc-num">{leadsCount}</span>
        <span className="dc-row">
          <span className="dc-sub">All time</span>
          <Sparkline tone="blue" />
        </span>
      </div>
      <div className="dash-card dc-tone-orange">
        <span className="dc-icon"><ShieldIcon /></span>
        <span className="dc-label">Blocked Visitors</span>
        <span className="dc-num">{blockedCount}</span>
        <span className="dc-row">
          <span className="dc-sub">Currently blocked</span>
          <Sparkline tone="orange" />
        </span>
      </div>
    </div>
  );
}
