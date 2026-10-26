'use client';

// components/monetization/MonetizationPeriodSelect.tsx
//
// Pill group for the stats period (7/30/90 days), defaulting to 30
// (lib/monetization-stats.ts's DEFAULT_STATS_PERIOD). Controlled from
// the parent (MonetizationDashboard.tsx) — purely a display + click
// target, same "dumb" shape as AgentModelPicker.
import { STATS_PERIODS, type StatsPeriod } from '@/lib/monetization-stats';

interface MonetizationPeriodSelectProps {
  value: StatsPeriod;
  onChange: (period: StatsPeriod) => void;
}

export function MonetizationPeriodSelect({ value, onChange }: MonetizationPeriodSelectProps) {
  return (
    <div className="mon-period-group" role="tablist" aria-label="Stats period">
      {STATS_PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={value === p.id}
          className={`mon-period-pill${value === p.id ? ' is-active' : ''}`}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
