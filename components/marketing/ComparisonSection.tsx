// components/marketing/ComparisonSection.tsx
//
// New marketing section: "sitevento vs. piecing it together yourself"
// comparison table. Upsell framing — contrasts the one-script
// sitevento column against the realistic alternative of stitching
// together several separate analytics/chat/popup/bot-protection
// tools and a custom dashboard, rather than naming or disparaging any
// specific competitor product. Builds the case for consolidation
// (one tag, one dashboard, one bill) without inventing unverifiable
// competitor claims.
//
// Desktop renders a real side-by-side table. Mobile collapses each
// row into a stacked card (label + the two answers) so nothing gets
// squeezed into illegibly narrow table columns — see
// comparison-section.css's breakpoint for the swap.
'use client';

interface ComparisonRow {
  label: string;
  sitevento: string;
  diy: string;
}

const ROWS: ComparisonRow[] = [
  { label: 'Setup', sitevento: 'One script tag', diy: 'Separate SDK per tool' },
  { label: 'Visit tracking', sitevento: 'Built in, live', diy: 'Extra analytics tool' },
  { label: 'Bot & scraper protection', sitevento: 'Included', diy: 'Separate service, separate bill' },
  { label: 'AI support agent', sitevento: 'Included', diy: 'Third-party chat widget' },
  { label: 'Email capture', sitevento: 'Included', diy: 'Another popup plugin' },
  { label: 'Sitewide alerts', sitevento: 'Push instantly, no redeploy', diy: 'Edit code, redeploy' },
  { label: 'Dashboards to check', sitevento: 'One', diy: 'Three or four' },
  { label: 'Monthly bills', sitevento: 'One plan', diy: 'One per tool' },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
    </svg>
  );
}

export function ComparisonSection() {
  return (
    <section className="cmp" aria-label="sitevento compared to piecing tools together yourself">
      <div className="cmp-inner">
        <div className="cmp-intro">
          <span className="cmp-eyebrow">Why consolidate</span>
          <h2 className="cmp-title">One tag beats five tools.</h2>
          <p className="cmp-copy">
            Most sites end up duct-taping together an analytics script, a chat widget, a popup plugin, and a bot
            blocker. Here&apos;s what that actually costs versus running it all from sitevento.
          </p>
        </div>

        {/* ---- Desktop table ---- */}
        <div className="cmp-table" role="table" aria-label="Feature comparison">
          <div className="cmp-row cmp-row-head" role="row">
            <span className="cmp-cell cmp-cell-label" role="columnheader" />
            <span className="cmp-cell cmp-cell-head cmp-cell-sv" role="columnheader">
              sitevento
            </span>
            <span className="cmp-cell cmp-cell-head cmp-cell-diy" role="columnheader">
              Piecing it together
            </span>
          </div>
          {ROWS.map((r) => (
            <div className="cmp-row" role="row" key={r.label}>
              <span className="cmp-cell cmp-cell-label" role="rowheader">
                {r.label}
              </span>
              <span className="cmp-cell cmp-cell-sv" role="cell">
                <span className="cmp-badge cmp-badge-yes">
                  <CheckIcon />
                </span>
                {r.sitevento}
              </span>
              <span className="cmp-cell cmp-cell-diy" role="cell">
                <span className="cmp-badge cmp-badge-no">
                  <DashIcon />
                </span>
                {r.diy}
              </span>
            </div>
          ))}
        </div>

        {/* ---- Mobile stacked cards ---- */}
        <div className="cmp-cards" aria-hidden="true">
          {ROWS.map((r) => (
            <div className="cmp-mcard" key={r.label}>
              <span className="cmp-mcard-label">{r.label}</span>
              <div className="cmp-mcard-row cmp-mcard-sv">
                <span className="cmp-badge cmp-badge-yes">
                  <CheckIcon />
                </span>
                <span>{r.sitevento}</span>
              </div>
              <div className="cmp-mcard-row cmp-mcard-diy">
                <span className="cmp-badge cmp-badge-no">
                  <DashIcon />
                </span>
                <span>{r.diy}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
