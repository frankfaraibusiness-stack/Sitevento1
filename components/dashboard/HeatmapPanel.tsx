'use client';

// components/dashboard/HeatmapPanel.tsx
//
// "Click Heatmap" section for SiteManagePage.tsx — renders the
// server-aggregated 20x20 click-position grid for whichever page the
// owner selects (see lib/types.ts's HeatmapPage and
// app/api/heatmap-sample/route.ts for how these docs get built).
// Fully self-contained, same pattern as CustomEventsPanel.tsx: owns
// its own data fetching via hooks/useHeatmapData.ts, mounted with just
// <HeatmapPanel uid={user.uid} siteId={siteId} />.
//
// Reuses SiteManagePage's `smp-*` class family for the outer section/
// panel/empty-state chrome (same as CustomEventsPanel), but the grid
// itself and the page picker are new, so they get their own small
// stylesheet (styles/dashboard/heatmap-panel.css) rather than
// overloading smp-* classes that were never meant to style a picker
// or an SVG grid — same reasoning AnalyticsPanel's own CSS file gives
// for why IT didn't try to force everything into smp-*.
//
// No charting/heatmap library exists anywhere in this repo (see
// AnalyticsPanel's own header) — this is plain inline SVG, same
// approach.
import { useMemo, useState } from 'react';
import { useHeatmapData } from '@/hooks/useHeatmapData';

interface HeatmapPanelProps {
  uid: string;
  siteId: string;
}

const GRID_PX = 320; // square SVG viewBox size — cell size is just GRID_PX / gridSize

// Opacity-only heat scale (not a color ramp) so this reads correctly
// against the existing --lime/--ink palette rather than introducing a
// clashing red/yellow "heat" gradient this design system doesn't use
// anywhere else.
function cellOpacity(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0;
  // Square-root scale, not linear: a linear scale makes one dominant
  // hotspot wash out every other cell to near-invisible, since real
  // click distributions are heavily skewed toward a few cells (e.g. a
  // primary CTA button). sqrt keeps secondary hotspots visibly
  // distinct instead of flattening to the same near-zero opacity.
  return Math.max(0.08, Math.min(0.92, Math.sqrt(count / max)));
}

export function HeatmapPanel({ uid, siteId }: HeatmapPanelProps) {
  const { pages, loading } = useHeatmapData(uid, siteId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default to the most-sampled page (pages is already ordered by
  // totalClicks desc from the hook's query) unless the owner picked a
  // different one themselves.
  const active = useMemo(() => {
    if (selectedId) {
      const found = pages.find((p) => p.page.id === selectedId);
      if (found) return found;
    }
    return pages[0] || null;
  }, [pages, selectedId]);

  return (
    <div className="smp-section">
      <div className="smp-section-head">
        <h2>Click Heatmap</h2>
        {pages.length > 1 && (
          <select
            className="hmp-page-select"
            value={active?.page.id || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Select page"
          >
            {pages.map((p) => (
              <option key={p.page.id} value={p.page.id}>
                {p.page.path} ({p.page.totalClicks})
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="smp-panel">
          <p className="smp-panel-empty">Loading…</p>
        </div>
      ) : !active ? (
        <div className="smp-panel">
          <p className="smp-panel-empty">
            No click samples yet. This fills in automatically from real visitor clicks — nothing to install beyond
            the existing tracking snippet.
          </p>
        </div>
      ) : (
        <div className="smp-panel hmp-panel">
          <div className="hmp-meta">
            <span className="hmp-path">{active.page.path}</span>
            <span className="hmp-count">{active.page.totalClicks} clicks sampled</span>
          </div>
          <svg
            className="hmp-grid"
            viewBox={`0 0 ${GRID_PX} ${GRID_PX}`}
            role="img"
            aria-label={`Click heatmap for ${active.page.path}`}
          >
            <rect x={0} y={0} width={GRID_PX} height={GRID_PX} className="hmp-grid-bg" />
            {active.grid.map((count, i) => {
              if (count <= 0) return null;
              const gx = i % active.size;
              const gy = Math.floor(i / active.size);
              const cell = GRID_PX / active.size;
              return (
                <rect
                  key={i}
                  x={gx * cell}
                  y={gy * cell}
                  width={cell}
                  height={cell}
                  className="hmp-cell"
                  opacity={cellOpacity(count, active.max)}
                >
                  <title>{count} click{count === 1 ? '' : 's'}</title>
                </rect>
              );
            })}
          </svg>
          <p className="hmp-caption">
            Approximate click positions (x%, y% of the viewport, bucketed on a {active.size}×{active.size} grid) —
            not pixel-exact, and gathered across every visitor&apos;s own viewport width, not one fixed screen size.
          </p>
        </div>
      )}
    </div>
  );
}
