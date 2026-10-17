// components/dashboard/BlockedVisitorsPanel.tsx — replaces #panelBlocked + renderVisits' blocked-body half.
import type { Visit } from '@/lib/types';

interface BlockedVisitorsPanelProps {
  blocked: Visit[];
  onUnblock: (visitId: string, visitorId: string) => void;
}

export function BlockedVisitorsPanel({ blocked, onUnblock }: BlockedVisitorsPanelProps) {
  return (
    <div className="dash-panel" id="panelBlocked">
      <div className="dash-panel-head">
        <div>
          <h3>Blocked visitors</h3>
          <span className="dp-sub">Visitors you&apos;ve blocked from this site.</span>
        </div>
      </div>
      <div className="dash-panel-body">
        {blocked.length === 0 ? (
          <div className="empty-row">Nobody&apos;s blocked right now.</div>
        ) : (
          blocked.map((v) => (
            <div key={v.id} className="lead-row">
              <span className="l-email">{v.visitorId || v.id}</span>
              <button className="ghost-btn" onClick={() => onUnblock(v.id, v.visitorId || '')}>
                Unblock
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
