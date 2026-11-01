'use client';

// components/dashboard/DashLogsPanel.tsx
//
// New "Logs" panel for the dashboard — not in the HTML mock,
// added per your note about missing pieces. Takes the same Visit[]
// shape as the existing VisitLogPanel.tsx so the backend-wiring step
// can hand it the real useActiveSiteData().visits list unchanged.
// Structure only: one clean row-card per visit, no color/visual
// design decided here.
import type { Visit } from '@/lib/types';

interface DashLogsPanelProps {
  visits: Visit[];
  onToggleBlock?: (visitId: string, blockedValue: boolean, visitorId: string) => void;
}

function formatVisitTime(ts: Visit['ts']): string {
  if (!ts) return '';
  const date = typeof ts === 'number' ? new Date(ts) : ts.toDate();
  return date.toLocaleString();
}

export function DashLogsPanel({ visits, onToggleBlock }: DashLogsPanelProps) {
  return (
    <section className="dashv2-logs-panel">
      <div className="dashv2-panel-head">
        <h3 className="dashv2-panel-title">Logs</h3>
        <span className="dashv2-panel-count">{visits.length}</span>
      </div>

      {visits.length === 0 ? (
        <div className="dashv2-panel-empty">No visits logged yet</div>
      ) : (
        <div className="dashv2-logs-list">
          {visits.map((visit) => (
            <div key={visit.id} className="dashv2-log-row">
              <div className="dashv2-log-row-main">
                <span className="dashv2-log-path">{visit.path}</span>
                <span className="dashv2-log-meta">
                  {visit.country ? `${visit.country} · ` : ''}
                  {visit.device}
                  {visit.browser ? ` · ${visit.browser}` : ''}
                </span>
              </div>
              <div className="dashv2-log-row-side">
                <span className="dashv2-log-time">{formatVisitTime(visit.ts)}</span>
                {onToggleBlock && (
                  <button
                    type="button"
                    className="dashv2-log-block-btn"
                    onClick={() => onToggleBlock(visit.id, !visit.blocked, visit.visitorId)}
                  >
                    {visit.blocked ? 'Unblock' : 'Block'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
