'use client';

// components/dashboard/RecentLeadsPanel.tsx
//
// New "Recent email captured" panel for the dashboard — not in
// the HTML mock, added per your note about missing pieces. Takes the
// same Lead[] shape as the existing LeadsPanel.tsx so the
// backend-wiring step can hand it the real useActiveSiteData().leads
// list unchanged. Structure only: one clean row-card per lead, no
// color/visual design decided here.
import type { Lead } from '@/lib/types';

interface RecentLeadsPanelProps {
  leads: Lead[];
}

function formatLeadTime(ts: Lead['ts']): string {
  if (!ts) return '';
  const date = typeof ts === 'number' ? new Date(ts) : ts.toDate();
  return date.toLocaleString();
}

export function RecentLeadsPanel({ leads }: RecentLeadsPanelProps) {
  // Soft-deleted leads (Lead.deletedAt) stay out of the panel, same
  // as the existing EmailCapturePage/LeadsPanel behavior — only
  // active leads are "recent email captured".
  const activeLeads = leads.filter((l) => !l.deletedAt);

  return (
    <section className="dashv2-email-captured-panel">
      <div className="dashv2-panel-head">
        <h3 className="dashv2-panel-title">Recent email captured</h3>
        <span className="dashv2-panel-count">{activeLeads.length}</span>
      </div>

      {activeLeads.length === 0 ? (
        <div className="dashv2-panel-empty">No emails captured yet</div>
      ) : (
        <div className="dashv2-leads-list">
          {activeLeads.map((lead) => (
            <div key={lead.id} className="dashv2-lead-row">
              <div className="dashv2-lead-row-main">
                <span className="dashv2-lead-email">{lead.email}</span>
                {lead.source && <span className="dashv2-lead-source">{lead.source}</span>}
              </div>
              <span className="dashv2-lead-time">{formatLeadTime(lead.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
