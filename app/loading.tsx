// app/loading.tsx — Next.js App Router route-level loading UI. Shown
// automatically during navigation/suspense for any route under app/
// that doesn't define its own loading.tsx. Pure presentational markup,
// so this stays a plain Server Component (no 'use client' needed —
// nothing here is interactive).
//
// Shaped as a loose stand-in for the dashboard: a header-ish row, a
// couple of stat-card blocks, and a panel block, reusing the
// .dashboard-empty / .dash-empty-inner wrapper's spacing conventions
// from components/dashboard/DashboardShell.tsx's loading branch, but
// with shaped shimmering placeholders instead of just loading text.

export default function Loading() {
  return (
    <div className="dashboard-empty route-skeleton" role="status" aria-label="Loading page">
      <div className="dash-empty-inner route-skeleton-inner">
        <div className="skel-head">
          <div className="skel-block skel-title" />
          <div className="skel-block skel-pill" />
        </div>

        <div className="skel-grid">
          <div className="skel-block skel-card" />
          <div className="skel-block skel-card" />
          <div className="skel-block skel-card" />
          <div className="skel-block skel-card" />
        </div>

        <div className="skel-panel">
          <div className="skel-panel-head">
            <div className="skel-block skel-panel-title" />
            <div className="skel-block skel-panel-sub" />
          </div>
          <div className="skel-panel-body">
            <div className="skel-block skel-row" />
            <div className="skel-block skel-row" />
            <div className="skel-block skel-row" />
          </div>
        </div>
      </div>
    </div>
  );
}
