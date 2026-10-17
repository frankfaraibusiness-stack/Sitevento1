// components/dashboard/VisitLogPanel.tsx — replaces #panelVisits + renderVisits' visit-row half.
// Rebuilt to surface the richer per-visit fields /api/track now writes
// (browser, OS, landing-page flag) alongside the original path/referrer/
// device/country/time columns.
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
          <span className="dp-sub">Everyone who&apos;s landed on this site, in real time.</span>
        </div>
      </div>
      <div className="dash-panel-body">
        {visits.length === 0 ? (
          <div className="empty-row">No visits logged yet for this site.</div>
        ) : (
          visits.map((v) => (
            <div key={v.id} className={`visit-row${v.blocked ? ' blocked' : ''}`}>
              <span className="v-path">
                {v.landing && <span className="v-landing-badge" title="Landing page">Entry</span>}
                {v.path || '/'}
              </span>
              <span className="v-meta">
                {v.referrer || 'Direct'} &middot; {v.device || 'Unknown device'}
                {v.browser ? ` (${v.browser}${v.os ? ' / ' + v.os : ''})` : ''} &middot; {v.country || 'Unknown'}
                {v.city ? `, ${v.city}` : ''}
              </span>
              <span className="v-meta">{formatTs(v.ts)}</span>
              <span className="v-status">
                <span className="vdot" />
                {v.blocked ? 'Blocked' : 'Allowed'}
              </span>
              <button className="v-block" onClick={() => onToggleBlock(v.id, !v.blocked, v.visitorId || '')}>
                {v.blocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
