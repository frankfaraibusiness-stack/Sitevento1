'use client';

// components/dashboard/RetentionPanel.tsx
//
// "Retention" section for SiteManagePage.tsx — classic weekly-cohort
// grid (rows = the week a visitor was first seen, columns = % of that
// cohort seen again N weeks later). Built on
// lib/analytics.ts's retentionCohorts(), which derives everything from
// VisitorProfile.firstSeenAt/lastSeenAt — both already captured by
// app/api/track's upsertVisitorProfile, so this is a pure client-side
// derivation with zero backend changes, same "no new usage-quota
// cost" framing AnalyticsPanel's own header gives for its own
// derivations.
//
// Standalone panel (own subscription via hooks/useRetentionCohorts.ts)
// rather than a 5th AnalyticsPanel tab: AnalyticsPanel takes `visits`
// as a PROP (SiteManagePage already holds that array), but cohorts
// need VisitorProfile[] instead — a different collection entirely —
// so folding this in as a tab would mean either lifting a new
// subscription up into SiteManagePage (which its own AnalyticsPanel
// comment explicitly avoided doing) or giving one tab its own
// subscription while its siblings use props. A standalone, self-
// contained panel (same shape as CustomEventsPanel/HeatmapPanel) is
// the more consistent choice.
import { useMemo } from 'react';
import { useRetentionCohorts } from '@/hooks/useRetentionCohorts';
import { retentionCohorts } from '@/lib/analytics';

interface RetentionPanelProps {
  uid: string;
  siteId: string;
}

// Opacity-scaled cell shading, same "percent-based, not a clashing
// red/yellow heat ramp" approach HeatmapPanel's own cellOpacity uses —
// consistent visual language for "this cell represents a magnitude"
// across both panels. The rgba() triplet below (184, 232, 67) is
// --lime's own literal value (confirmed in styles/base/base.css) —
// hardcoded, not read via var(), because this codebase has no
// "--lime-rgb" companion token for building an rgba() string from a
// CSS custom property, and adding one just for this one panel would be
// more global surface area than the single use here justifies. If
// --lime's hex ever changes, this literal needs updating alongside it.
function cellOpacity(pct: number): number {
  if (pct <= 0) return 0.04; // always at least a faint fill, so a real 0% reads differently from "no data" (null)
  return Math.max(0.08, Math.min(0.92, pct / 100));
}

export function RetentionPanel({ uid, siteId }: RetentionPanelProps) {
  const { profiles, loading } = useRetentionCohorts(uid, siteId);
  const cohorts = useMemo(() => retentionCohorts(profiles), [profiles]);
  const weeksOut = cohorts[0]?.retainedPct.length ? cohorts[0].retainedPct.length - 1 : 6;

  return (
    <div className="smp-section">
      <div className="smp-section-head">
        <h2>Retention</h2>
      </div>

      {loading ? (
        <div className="smp-panel">
          <p className="smp-panel-empty">Loading…</p>
        </div>
      ) : cohorts.length === 0 ? (
        <div className="smp-panel">
          <p className="smp-panel-empty">
            No cohorts yet — this fills in automatically as visitors return across different weeks. Nothing to
            install beyond the existing tracking snippet.
          </p>
        </div>
      ) : (
        <div className="smp-panel">
          <p className="rtp-caption">
            Each row is visitors first seen that week. Each column is the share of that same cohort seen again N
            weeks later. A blank cell means that week hasn&apos;t happened yet for that cohort — not 0%.
          </p>
          <div className="rtp-table-scroll">
            <table className="rtp-table">
              <thead>
                <tr>
                  <th>Cohort week</th>
                  <th>Size</th>
                  {Array.from({ length: weeksOut + 1 }, (_, i) => (
                    <th key={i}>{i === 0 ? 'Week 0' : `+${i}w`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((row) => (
                  <tr key={row.cohortWeek}>
                    <td className="rtp-cohort-label">{row.cohortLabel}</td>
                    <td className="rtp-cohort-size">{row.cohortSize}</td>
                    {row.retainedPct.map((pct, i) => (
                      <td key={i} className="rtp-cell-wrap">
                        {pct === null ? (
                          <span className="rtp-cell-empty">—</span>
                        ) : (
                          <span className="rtp-cell" style={{ backgroundColor: `rgba(184, 232, 67, ${cellOpacity(pct)})` }}>
                            {pct}%
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
