// components/dashboard/BlockedVisitorsPanel.tsx — replaces #panelBlocked + renderVisits' blocked-body half.
import type { Visit } from '@/lib/types';

interface BlockedVisitorsPanelProps {
  blocked: Visit[];
  onUnblock: (visitId: string, visitorId: string) => void;
}

export function BlockedVisitorsPanel({ blocked, onUnblock }: BlockedVisitorsPanelProps) {
  // `blocked` is a list of blocked *visit rows*, and the same visitor can
  // have several of those (one per past visit). Collapse down to one row
  // per visitorId so a repeat visitor doesn't show up multiple times —
  // Unblock still clears every row for that visitor via onUnblock's
  // batch update in useActiveSiteData.
  const uniqueBlocked = Array.from(
    new Map(blocked.map((v) => [v.visitorId || v.id, v])).values()
  );

  return (
    <div className="dash-panel" id="panelBlocked">
      <div className="dash-panel-head">
        <div>
          <h3>Blocked visitors</h3>
          <span className="dp-sub">Visitors you&apos;ve blocked from this site.</span>
        </div>
      </div>
      <div className="dash-panel-body">
        {uniqueBlocked.length === 0 ? (
          <div className="empty-row">Nobody&apos;s blocked right now.</div>
        ) : (
          <>
            <div className="dash-scroll-list">
              {uniqueBlocked.map((v) => (
                <div key={v.visitorId || v.id} className="lead-row">
                  <span className="l-email">{v.visitorId || v.id}</span>
                  <button className="ghost-btn" onClick={() => onUnblock(v.id, v.visitorId || '')}>
                    Unblock
                  </button>
                </div>
              ))}
            </div>
            {/* `blocked` is derived from the (capped-at-50) visits list,
                so this panel can't tell whether more blocked visitors
                exist beyond that cap. A dedicated "all blocked visitors"
                page/route isn't built yet, so this is a placeholder CTA
                only — wire it up (and its real visibility condition)
                once that view exists. */}
            <button type="button" className="ghost-btn dash-view-all-btn" onClick={() => {}}>
              View all
            </button>
          </>
        )}
      </div>
    </div>
  );
}
