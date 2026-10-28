'use client';

// components/marketing/DashboardPreview.tsx
//
// New marketing section: a stylized peek at the real dashboard —
// overview stats, a slice of the visit log, and the leads list — so
// visitors see what they actually land in after connecting, not just
// isolated feature claims. Mirrors the real panels (OverviewStats,
// VisitLogPanel, LeadsPanel under components/dashboard/) with
// illustrative sample data; nothing here is wired to real traffic.
//
// Single stacked column on mobile (stat strip, then log, then leads);
// desktop arranges the same three pieces into one cohesive "dashboard"
// frame — stat strip across the top, log and leads side by side below
// — so it reads as one screen rather than three separate cards.

const STATS = [
  { label: 'Total visits', value: '18,402' },
  { label: 'Unique visitors', value: '6,115' },
  { label: 'Leads captured', value: '284' },
  { label: 'Blocked', value: '3' },
];

const VISITS = [
  { page: '/pricing', time: '2m ago', ref: 'google.com', device: 'Desktop' },
  { page: '/', time: '4m ago', ref: 'direct', device: 'Mobile' },
  { page: '/blog/launch', time: '9m ago', ref: 'twitter.com', device: 'Mobile' },
  { page: '/docs/setup', time: '14m ago', ref: 'direct', device: 'Desktop' },
];

const LEADS = [
  { email: 'maya@northwindretail.com', source: 'Exit-intent widget' },
  { email: 'dev@fernbrooklabs.io', source: 'Newsletter banner' },
  { email: 'sara@harlowco.com', source: 'Footer capture' },
];

function IconArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export function DashboardPreview() {
  return (
    <section className="dp-section">
      <div className="dp-heading">
        <p className="dp-eyebrow">See it before you connect it</p>
        <h2 className="dp-title">One dashboard. Everything that matters.</h2>
        <p className="dp-sub">
          Every connected site lands here — visits, leads, and live controls, updated as they happen.
        </p>
      </div>

      <div className="dp-frame">
        <div className="dp-frame-chrome">
          <span className="dp-dot" />
          <span className="dp-dot" />
          <span className="dp-dot" />
          <span className="dp-frame-url">app.sitevento.com/dashboard</span>
        </div>

        <div className="dp-stats">
          {STATS.map((s) => (
            <div className="dp-stat" key={s.label}>
              <span className="dp-stat-value">{s.value}</span>
              <span className="dp-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="dp-panels">
          <div className="dp-panel">
            <div className="dp-panel-head">
              <h3>Recent visits</h3>
              <span className="dp-panel-link">
                View all <IconArrowUpRight />
              </span>
            </div>
            <ul className="dp-visit-list">
              {VISITS.map((v, i) => (
                <li className="dp-visit-row" key={i}>
                  <span className="dp-visit-page">{v.page}</span>
                  <span className="dp-visit-meta">{v.ref}</span>
                  <span className="dp-visit-device">{v.device}</span>
                  <span className="dp-visit-time">{v.time}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="dp-panel">
            <div className="dp-panel-head">
              <h3>New leads</h3>
              <span className="dp-panel-link">
                View all <IconArrowUpRight />
              </span>
            </div>
            <ul className="dp-lead-list">
              {LEADS.map((l) => (
                <li className="dp-lead-row" key={l.email}>
                  <span className="dp-lead-avatar">{l.email.charAt(0).toUpperCase()}</span>
                  <span className="dp-lead-info">
                    <span className="dp-lead-email">{l.email}</span>
                    <span className="dp-lead-source">{l.source}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
