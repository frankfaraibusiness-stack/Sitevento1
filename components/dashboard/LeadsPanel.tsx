// components/dashboard/LeadsPanel.tsx — replaces #panelLeads + renderLeads.
import { useNavRouter } from '@/hooks/useNavPending';
import { formatTs } from '@/lib/format';
import type { Lead } from '@/lib/types';

export function LeadsPanel({ leads }: { leads: Lead[] }) {
  const router = useNavRouter();
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
              // useActiveSiteData). The full, uncapped list now has
              // its own dedicated page — see app/dashboard/leads/page.tsx
              // and EmailCapturePage.tsx.
              <button
                type="button"
                className="ghost-btn dash-view-all-btn"
                onClick={() => router.push('/dashboard/leads')}
              >
                View all
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
