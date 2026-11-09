'use client';

// components/dashboard/CustomEventsPanel.tsx
//
// "Custom Events" section for SiteManagePage.tsx — shows the named,
// client-side events sent via window.sitevento('track', name,
// properties) (see public/sitevento.js's header and
// app/api/custom-event/route.ts for the endpoint). Built as a fully
// self-contained component (owns its own data fetching via
// hooks/useCustomEvents.ts) rather than threading new state through
// SiteManagePage.tsx's existing 500+ lines — that file mounts this
// with just <CustomEventsPanel uid={user.uid} siteId={siteId} />.
//
// Reuses SiteManagePage's own `smp-*` class family (styles/dashboard/
// site-manage-page.css) so this section looks like it always belonged
// there — no new CSS file needed, every class used here already
// exists (smp-section, smp-panel, smp-stat-card, etc., the same ones
// the Stats section above it already uses).
import { useCustomEvents } from '@/hooks/useCustomEvents';
import type { CustomEvent } from '@/lib/types';

interface CustomEventsPanelProps {
  uid: string;
  siteId: string;
}

function formatTs(ts: CustomEvent['ts']): string {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts) : ts.toDate();
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function CustomEventsPanel({ uid, siteId }: CustomEventsPanelProps) {
  const { events, byName, loading } = useCustomEvents(uid, siteId);

  return (
    <div className="smp-section">
      <div className="smp-section-head">
        <h2>Custom Events</h2>
      </div>

      {loading ? (
        <div className="smp-panel">
          <p className="smp-panel-empty">Loading…</p>
        </div>
      ) : events.length === 0 ? (
        <div className="smp-panel">
          <p className="smp-panel-empty">
            No custom events yet. Call <code>sitevento(&apos;track&apos;, &apos;your_event_name&apos;)</code> from your page&apos;s own JS
            — a button click, a form submit, anything the install tag alone can&apos;t tell apart — and it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <div className="smp-stats-row">
          <div className="smp-panel smp-countries-panel">
            <h3>Most-fired events</h3>
            <ul className="smp-countries-list">
              {byName.slice(0, 8).map((item) => (
                <li className="smp-country-row" key={item.name}>
                  <span className="smp-country-name">{item.name}</span>
                  <span className="smp-country-bar-track">
                    <span
                      className="smp-country-bar-fill"
                      style={{ width: `${Math.max(6, (item.count / byName[0].count) * 100)}%` }}
                    />
                  </span>
                  <span className="smp-country-count">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="smp-panel smp-meta-panel">
            <h3>Recent events</h3>
            {events.slice(0, 8).map((ev) => (
              <div className="smp-meta-row" key={ev.id}>
                <span className="smp-meta-label">{ev.name}</span>
                <span className="smp-meta-value">{formatTs(ev.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
