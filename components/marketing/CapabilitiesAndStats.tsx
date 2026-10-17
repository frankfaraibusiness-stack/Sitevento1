// components/marketing/CapabilitiesAndStats.tsx — replaces .status-strip,
// both .capabilities sections, the "What sitevento actually does"
// .section-heading, and .stats.
export function StatusStrip() {
  return (
    <div className="status-strip">
      <span className="status-pill">
        <span className="live-dot"></span>Currently tracking 2,418 active sessions
      </span>
    </div>
  );
}

const TOP_CAPS = [
  { title: 'Visit logs', body: 'Every visit to your site, logged and searchable — pages, timing, referrers.' },
  {
    title: 'Email capture widgets',
    body: 'Drop in onboarding flows and lead-capture forms without touching your codebase.',
  },
  {
    title: 'Live overlays',
    body: 'Push a banner, announcement, or full-site maintenance mode instantly, no redeploy.',
  },
  { title: 'One dashboard', body: 'Manage every connected site — leads, logs, and live state — from one place.' },
];

export function TopCapabilities() {
  return (
    <section className="capabilities">
      {TOP_CAPS.map((c) => (
        <div className="cap" key={c.title}>
          <h3>{c.title}</h3>
          <p>{c.body}</p>
        </div>
      ))}
    </section>
  );
}

const DETAIL_CAPS = [
  {
    title: 'Every visit, logged',
    body: "Connect your business site once and get a full visit log for everyone who lands on it — page, timestamp, referrer, device, and location, searchable from your dashboard.",
  },
  {
    title: 'Full visitor control',
    body: "See exactly who's visiting and when. If someone shouldn't be there, block them directly from the dashboard — no code changes, no redeploy.",
  },
  {
    title: 'Live, full-screen overlays',
    body: 'Push a banner that takes over your site instantly: maintenance mode, a site-wide announcement, or a message to visitors — live the moment you hit send.',
  },
  {
    title: 'Built-in email capture',
    body: "Turn visits into leads with sitevento's capture widget, then see every email collected in your dashboard — no separate tool needed.",
  },
];

export function DetailCapabilities() {
  return (
    <>
      <section className="section-heading" style={{ marginTop: 8 }}>
        <h2>What sitevento actually does</h2>
        <p>
          Your site, <span className="mark">fully in your control</span> — without touching code after setup.
        </p>
      </section>
      <section className="capabilities" style={{ marginTop: 0 }}>
        {DETAIL_CAPS.map((c) => (
          <div className="cap" key={c.title}>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
          </div>
        ))}
      </section>
    </>
  );
}

const STATS = [
  { num: '2,400+', label: 'Sites connected' },
  { num: '48M', label: 'Visits logged monthly' },
  { num: '99.98%', label: 'Script uptime' },
  { num: '<2 min', label: 'Avg. setup time' },
];

export function Stats() {
  return (
    <section className="stats">
      {STATS.map((s) => (
        <div className="stat" key={s.label}>
          <span className="stat-num">{s.num}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </section>
  );
}
