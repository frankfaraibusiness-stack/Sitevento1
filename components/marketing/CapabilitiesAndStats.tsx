// components/marketing/CapabilitiesAndStats.tsx — replaces .status-strip,
// both .capabilities sections, the "What sitevento actually does"
// .section-heading, and .stats.
'use client';

import { useScrollReveal } from '@/hooks/useScrollReveal';

export function StatusStrip() {
  return (
    <div className="status-strip">
      <span className="status-pill">
        <span className="live-dot"></span>
        <span className="status-pill-text">
          Currently tracking <span className="status-pill-num">2,418</span> active sessions
        </span>
      </span>
    </div>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

const TOP_CAPS = [
  {
    title: 'Visit logs',
    body: 'Every visit to your site, logged and searchable — pages, timing, referrers.',
    Icon: IconEye,
  },
  {
    title: 'Email capture widgets',
    body: 'Drop in onboarding flows and lead-capture forms without touching your codebase.',
    Icon: IconMail,
  },
  {
    title: 'Live overlays',
    body: 'Push a banner, announcement, or full-site maintenance mode instantly, no redeploy.',
    Icon: IconBolt,
  },
  {
    title: 'One dashboard',
    body: 'Manage every connected site — leads, logs, and live state — from one place.',
    Icon: IconGrid,
  },
];

export function TopCapabilities() {
  const reveal = useScrollReveal<HTMLDivElement>();

  return (
    <section className="capabilities">
      {TOP_CAPS.map((c) => (
        <div className="cap" key={c.title} ref={reveal}>
          <div className="cap-icon">
            <c.Icon />
          </div>
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
