// components/dashboard/VisitLogPanel.tsx — replaces #panelVisits + renderVisits' visit-row half.
import { formatTs } from '@/lib/format';
import type { Visit } from '@/lib/types';

interface VisitLogPanelProps {
  visits: Visit[];
  onToggleBlock: (visitId: string, blockedValue: boolean, visitorId: string) => void;
}

export function VisitLogPanel({ visits, onToggleBlock }: VisitLogPanelProps) {
  return (
    <div className="dash-panel" id="panelVisits">
      <div className="dash-panel-head">
        <div>
          <h3>Visit log</h3>
          <span className="dp-sub">Everyone who&apos;s landed on this site.</span>
        </div>
      </div>
      <div className="dash-panel-body">
        {visits.length === 0 ? (
          <div className="empty-row">No visits logged yet for this site.</div>
        ) : (
          visits.map((v) => (
            <div key={v.id} className={`visit-row${v.blocked ? ' blocked' : ''}`}>
              <span className="v-path">{v.path || '/'}</span>
              <span className="v-meta">
                {v.referrer || 'Direct'} · {v.device || 'Unknown device'} · {v.country || 'Unknown'}
              </span>
              <span className="v-meta">{formatTs(v.ts)}</span>
              <span className="v-status">
                <span className="vdot" />
                {v.blocked ? 'Blocked' : 'Allowed'}
              </span>
              <button
                className="v-block"
                onClick={() => onToggleBlock(v.id, !v.blocked, v.visitorId || '')}
              >
                {v.blocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
