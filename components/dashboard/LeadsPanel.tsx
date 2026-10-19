// components/dashboard/LeadsPanel.tsx — replaces #panelLeads + renderLeads.
import { formatTs } from '@/lib/format';
import type { Lead } from '@/lib/types';

export function LeadsPanel({ leads }: { leads: Lead[] }) {
  return (
    <div className="dash-panel" id="panelLeads">
      <div className="dash-panel-head">
        <div>
          <h3>Email capture</h3>
          <span className="dp-sub">Leads collected by the sitevento widget.</span>
        </div>
      </div>
      <div className="dash-panel-body">
        {leads.length === 0 ? (
          <div className="empty-row">No emails captured yet.</div>
        ) : (
          <>
            <div className="dash-scroll-list">
              {leads.map((l) => (
                <div key={l.id} className="lead-row">
                  <span className="l-email">{l.email || '—'}</span>
                  <span className="l-time">{formatTs(l.ts)}</span>
                </div>
              ))}
            </div>
            {leads.length >= 50 && (
              // Capped to the most recent 50 leads upstream (see
              // useActiveSiteData). A dedicated "all leads" page/route
              // isn't built yet, so this is a placeholder CTA only —
              // wire it up once that view exists.
              <button type="button" className="ghost-btn dash-view-all-btn" onClick={() => {}}>
                View all
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
