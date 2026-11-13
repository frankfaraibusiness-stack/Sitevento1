'use client';

// components/analytics/NoSiteBanner.tsx
//
// Shown at the top of the Analytics page while the account has no connected
// site. The sections underneath stay visible (dimmed, empty) so people can see
// what they're about to unlock — this banner is the single, clear next step.
// It disappears on its own the moment a site exists, because AnalyticsPage
// only renders it while dashState === 'empty'.
//
// Styled by styles/analytics/analytics-no-site.css with the .anx tokens only,
// so it follows the Analytics page look.

interface NoSiteBannerProps {
  onConnect: () => void;
}

const STEPS = [
  { title: 'Add the tag', text: 'Paste one line into your site’s <head>.' },
  { title: 'We verify it', text: 'We check your site automatically.' },
  { title: 'Data appears', text: 'Visits show up here within minutes.' },
];

const PERKS = ['Live visitors', 'Countries & devices', 'Email capture', 'Bot protection'];

export function NoSiteBanner({ onConnect }: NoSiteBannerProps) {
  return (
    <section className="anx-nosite" aria-labelledby="anxNoSiteTitle">
      <i className="anx-nosite-orb is-a" aria-hidden="true" />
      <i className="anx-nosite-orb is-b" aria-hidden="true" />

      <div className="anx-nosite-main">
        <span className="anx-nosite-eyebrow">
          <i aria-hidden="true" /> No site connected yet
        </span>
        <h2 id="anxNoSiteTitle">Connect your first site and watch it come alive</h2>
        <p>Everything below fills in automatically once your site is connected.</p>

        <div className="anx-nosite-actions">
          <button type="button" className="anx-btn is-primary anx-nosite-cta" onClick={onConnect}>
            Connect your first site
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 12h14m-6-6 6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="anx-nosite-hint">Takes about 2 minutes</span>
        </div>

        <ul className="anx-nosite-perks" aria-label="What you unlock">
          {PERKS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <ol className="anx-nosite-steps" aria-label="How connecting works">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="anx-nosite-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="anx-nosite-step-text">
              <strong>{s.title}</strong>
              <small>{s.text}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
