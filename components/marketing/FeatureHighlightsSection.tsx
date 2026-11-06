// components/marketing/FeatureHighlightsSection.tsx
//
// New marketing section: a 6-tile feature grid pitching the product's
// real capabilities (visit tracking, bot shield, AI agent, email
// capture, site alert, monetization) as one coherent "everything your
// site needs" pitch — sits between the testimonials section and the
// final CTA band. Each tile is deliberately short (icon + title +
// one line) so the section reads fast rather than becoming a second
// features page; it's an upsell summary, not documentation.
//
// Icons are plain inline SVGs (no icon library dependency), same
// convention as every other marketing section in this folder.
'use client';

interface FeatureTile {
  title: string;
  copy: string;
  theme: 'lime' | 'purple' | 'blue' | 'orange';
  icon: 'pulse' | 'shield' | 'chat' | 'mail' | 'megaphone' | 'coin';
}

const FEATURES: FeatureTile[] = [
  {
    title: 'Live visit tracking',
    copy: 'Every visitor, page view, and session shows up on your dashboard in real time.',
    theme: 'lime',
    icon: 'pulse',
  },
  {
    title: 'Bot shield',
    copy: 'Blocks scrapers, bad bots, and abusive traffic automatically — no config needed.',
    theme: 'orange',
    icon: 'shield',
  },
  {
    title: 'AI site agent',
    copy: 'Answers visitor questions 24/7 using what you tell it about your own site.',
    theme: 'purple',
    icon: 'chat',
  },
  {
    title: 'Email capture',
    copy: 'A themeable popup that turns anonymous visits into a growing lead list.',
    theme: 'blue',
    icon: 'mail',
  },
  {
    title: 'Site alert banners',
    copy: 'Push a sitewide announcement live to every visitor instantly, no redeploy.',
    theme: 'lime',
    icon: 'megaphone',
  },
  {
    title: 'Monetization',
    copy: 'Turn spare space into ad revenue with a payout dashboard built in.',
    theme: 'purple',
    icon: 'coin',
  },
];

function FeatureIcon({ icon }: { icon: FeatureTile['icon'] }) {
  switch (icon) {
    case 'pulse':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l2-7 4 14 2-7h6" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 4 6v6c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V6l-8-3Z" />
          <path d="m9.5 12 2 2 3.5-4" />
        </svg>
      );
    case 'chat':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v11H7l-3 3V5Z" />
          <path d="M8 10h8M8 13h5" />
        </svg>
      );
    case 'mail':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10v4h3l5 4V6l-5 4H3Z" />
          <path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
        </svg>
      );
    case 'coin':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.2c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 1.6-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2" />
        </svg>
      );
  }
}

export function FeatureHighlightsSection() {
  return (
    <section className="fhx" aria-label="What sitevento does for your site">
      <div className="fhx-inner">
        <div className="fhx-intro">
          <span className="fhx-eyebrow">Everything included</span>
          <h2 className="fhx-title">One script. A full toolkit.</h2>
          <p className="fhx-copy">
            Every tile below ships with the same tag you already pasted in — nothing extra to install, nothing
            else to configure.
          </p>
        </div>

        <div className="fhx-grid">
          {FEATURES.map((f) => (
            <div className={`fhx-card theme-${f.theme}`} key={f.title}>
              <span className="fhx-icon">
                <FeatureIcon icon={f.icon} />
              </span>
              <h3 className="fhx-card-title">{f.title}</h3>
              <p className="fhx-card-copy">{f.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
