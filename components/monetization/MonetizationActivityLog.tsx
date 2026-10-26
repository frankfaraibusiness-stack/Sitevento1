'use client';

// components/monetization/MonetizationActivityLog.tsx
//
// Recent-events table — timestamp, ad type, event (impression/click),
// country — below the charts. A handful of mock rows
// (lib/monetization-stats.ts's getRecentLogs) standing in for the
// real event stream the ad pool will eventually write; same row shape
// (adType/event/country/timestamp) so swapping to a live feed later
// doesn't change this component's props.
import type { LogRow } from '@/lib/monetization-stats';

interface MonetizationActivityLogProps {
  rows: LogRow[];
}

export function MonetizationActivityLog({ rows }: MonetizationActivityLogProps) {
  return (
    <section className="mon-section">
      <div className="mon-section-head">
        <h2 className="mon-section-title">Recent activity</h2>
      </div>
      <div className="mon-log-card">
        <div className="mon-log-header-row">
          <span>Event</span>
          <span>Ad type</span>
          <span>Country</span>
          <span>When</span>
        </div>
        {rows.map((row) => (
          <div key={row.id} className="mon-log-row">
            <span className={`mon-log-event mon-log-event-${row.event}`}>
              <span className="mon-log-event-dot" />
              {row.event === 'click' ? 'Click' : 'Impression'}
            </span>
            <span className="mon-log-adtype">{row.adType}</span>
            <span className="mon-log-country">
              <span aria-hidden="true">{row.flag}</span> {row.country}
            </span>
            <span className="mon-log-time">{row.timestamp}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
