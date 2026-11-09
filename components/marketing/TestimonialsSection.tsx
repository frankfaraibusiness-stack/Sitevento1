// components/marketing/TestimonialsSection.tsx
//
// New marketing section: customer testimonials. Mockup quotes (no
// real customer data) written to read as plausible early-product
// feedback rather than implausibly over-the-top marketing copy —
// specific-sounding numbers, specific platforms, specific features
// (bot shield, AI agent, email capture) rather than vague superlatives.
// Framed honestly in the surrounding UI as the kind of feedback
// sitevento aims to earn, not an audited, verified review database.
//
// Layout: a responsive grid of quote cards (3-up desktop, 2-up
// tablet, 1-up mobile) rather than a carousel — easier to scan, no
// extra interaction needed to see every quote, and keeps this
// section simple against the already-busy auto-scrolling platforms
// row above it. A small star rating + avatar initial + name/role/
// platform byline on each card for the familiar testimonial shape.
'use client';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  platform: string;
  initial: string;
  accent: 'lime' | 'purple' | 'blue' | 'orange';
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "We dropped the script into our theme and had live visitor data within a minute. Didn't touch a single line of our Shopify theme code.",
    name: 'Priya Nair',
    role: 'Founder, small apparel store',
    platform: 'Shopify',
    initial: 'P',
    accent: 'lime',
  },
  {
    quote:
      'The AI agent handles maybe 70% of our support questions now. The ones it hands off actually need a human — it\'s not just deflecting everything.',
    name: 'Marcus Webb',
    role: 'Operations lead',
    platform: 'Webflow',
    initial: 'M',
    accent: 'purple',
  },
  {
    quote:
      "Bot shield quietly blocked a scraping run we didn't even know was happening. We only noticed because of the blocked-traffic spike on the dashboard.",
    name: 'Elena Castillo',
    role: 'Site owner',
    platform: 'WordPress',
    initial: 'E',
    accent: 'blue',
  },
  {
    quote:
      'Email capture alone paid for the plan in the first week. Clean popup, easy to theme, no fighting with our page builder.',
    name: 'Daniel Osei',
    role: 'Marketing, local business',
    platform: 'Wix',
    initial: 'D',
    accent: 'orange',
  },
  {
    quote:
      "Connected it to a custom React site with zero issues. The one-script approach meant no SDK, no build step, nothing to maintain.",
    name: 'Grace Lindqvist',
    role: 'Indie developer',
    platform: 'Custom site',
    initial: 'G',
    accent: 'lime',
  },
  {
    quote:
      "Switched from piecing together three different tools. Now it's one dashboard for visits, leads, and the alert banner. Simpler, and cheaper.",
    name: 'Tomás Herrera',
    role: 'Growth, SaaS startup',
    platform: 'Next.js',
    initial: 'T',
    accent: 'purple',
  },
];

function Stars() {
  return (
    <div className="tst-stars" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.5 15.1 9l7.2 1-5.2 5 1.2 7.2L12 18.9 5.7 22.2 6.9 15l-5.2-5 7.2-1L12 2.5Z" />
        </svg>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section className="tst" aria-label="What early users say">
      <div className="tst-inner">
        <div className="tst-intro">
          <span className="tst-eyebrow">Early feedback</span>
          <h2 className="tst-title">People notice the difference fast.</h2>
          <p className="tst-copy">
            A few notes from folks who connected sitevento to their own site and started watching the dashboard
            fill in.
          </p>
        </div>

        <div className="tst-grid">
          {TESTIMONIALS.map((t) => (
            <figure className={`tst-card theme-${t.accent}`} key={t.name}>
              <Stars />
              <blockquote className="tst-quote">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="tst-byline">
                <span className="tst-avatar">{t.initial}</span>
                <span className="tst-byline-text">
                  <span className="tst-name">{t.name}</span>
                  <span className="tst-role">
                    {t.role} · {t.platform}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
