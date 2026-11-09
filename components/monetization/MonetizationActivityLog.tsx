'use client';

// components/monetization/MonetizationActivityLog.tsx
//
// Recent-events feed — timestamp, ad type, event, country — below the
// charts. Each row is now a single clean line with an event-colored
// dot, format badge and right-aligned time, rather than a dense grid
// of columns; reads more like a tidy timeline than a log dump. Same
// row shape (adType/event/country/timestamp) as before, so swapping
// to a live feed later doesn't change this component's props.
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
        {rows.map((row) => (
          <div key={row.id} className="mon-log-item">
            <span className={`mon-log-event-dot mon-log-event-dot-${row.event}`} aria-hidden="true" />
            <div className="mon-log-main">
              <span className="mon-log-primary">
                <strong>{row.event === 'click' ? 'Click' : 'Impression'}</strong> on {row.adType}
              </span>
              <span className="mon-log-secondary">
                <span aria-hidden="true">{row.flag}</span> {row.country}
              </span>
            </div>
            <span className="mon-log-time">{row.timestamp}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
