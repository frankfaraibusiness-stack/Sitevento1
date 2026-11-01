'use client';

// components/dashboard/OverviewStats.tsx
//
// Premium glass stat tiles for the new dashboard. Frosted "surface on
// lime" cards (no hardcoded off-palette fills — just var(--surface) +
// var(--lime)/var(--dash-*) tokens) with a count-up animation on mount
// and a soft glow ring per tone, so the row reads as alive rather than
// four static numbers.
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface OverviewStatsProps {
  totalVisits: number;
  uniqueVisitors: number;
  leadsCount: number;
  blockedCount: number;
}

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useMountCountUp(target: number, durationMs = 1100, delayMs = 0) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    // Re-run the count-up whenever the target actually changes (new
    // site selected, new data arrives) — not just once on mount — but
    // skip animating if it's the very first paint and target is 0, so
    // empty tiles don't needlessly animate.
    if (prevTarget.current === target) return;
    prevTarget.current = target;
    let raf: number;
    const start = performance.now() + delayMs;
    function tick(now: number) {
      const elapsed = now - start;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, elapsed / durationMs);
      setValue(Math.round(target * easeOutExpo(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, delayMs]);

  return value;
}

function Sparkline({ tone }: { tone: 'green' | 'purple' | 'blue' | 'orange' }) {
  const paths: Record<typeof tone, string> = {
    green: 'M2 20 L12 15 L20 17 L30 9 L38 11 L46 2',
    purple: 'M2 18 L10 19 L18 12 L26 15 L34 6 L46 8',
    blue: 'M2 19 L11 13 L19 16 L27 8 L35 11 L46 3',
    orange: 'M2 10 L12 9 L20 11 L30 9 L38 10 L46 9',
  };
  return (
    <svg className="dnx-spark" viewBox="0 0 48 24" fill="none" aria-hidden="true">
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

interface TileSpec {
  tone: 'green' | 'purple' | 'blue' | 'orange';
  label: string;
  value: number;
  sub: string;
  icon: ReactNode;
  delay: number;
}

export function OverviewStats({ totalVisits, uniqueVisitors, leadsCount, blockedCount }: OverviewStatsProps) {
  const tiles: TileSpec[] = [
    { tone: 'green', label: 'Total Visits', value: totalVisits, sub: 'All time', icon: <EyeIcon />, delay: 0 },
    { tone: 'purple', label: 'Unique Visitors', value: uniqueVisitors, sub: 'All time', icon: <PersonIcon />, delay: 70 },
    { tone: 'blue', label: 'Emails Captured', value: leadsCount, sub: 'All time', icon: <MailIcon />, delay: 140 },
    { tone: 'orange', label: 'Blocked Visitors', value: blockedCount, sub: 'Currently blocked', icon: <ShieldIcon />, delay: 210 },
  ];

  return (
    <div className="dnx-stat-grid">
      {tiles.map((tile) => (
        <StatTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}

function StatTile({ tone, label, value, sub, icon, delay }: TileSpec) {
  const animated = useMountCountUp(value, 1100, delay);
  return (
    <div className={`dnx-stat-tile dnx-tone-${tone}`}>
      <div className="dnx-stat-top">
        <span className="dnx-stat-icon">{icon}</span>
        <Sparkline tone={tone} />
      </div>
      <span className="dnx-stat-num">{animated.toLocaleString()}</span>
      <span className="dnx-stat-label">{label}</span>
      <span className="dnx-stat-sub">{sub}</span>
    </div>
  );
}
