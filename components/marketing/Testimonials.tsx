// components/marketing/Testimonials.tsx — replaces .testi-marquee-wrap
// (scrolling loop, list intentionally duplicated x2 in the source) and
// .testimonials-wrap (static 3-card grid).
interface Testimonial {
  quote: string;
  initials: string;
  name: string;
  role: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'We saw where visitors were dropping off within the first day. No new tooling, no engineering ticket.',
    initials: 'MR',
    name: 'Maya Reyes',
    role: 'Head of Growth, Northwind Retail',
  },
  {
    quote: 'The live overlay saved us during a pricing error. We pushed a banner site-wide in under a minute.',
    initials: 'DK',
    name: 'Dev Kapoor',
    role: 'Founder, Fernbrook Labs',
  },
  {
    quote: "Lead capture used to mean a dev sprint. Now it's a widget we drop in and adjust ourselves.",
    initials: 'SH',
    name: 'Sara Hollis',
    role: 'Marketing Lead, Harlow & Co.',
  },
  {
    quote: 'Switching between client sites from one dashboard cut our reporting time in half.',
    initials: 'JP',
    name: 'Jon Pierce',
    role: 'Ops Lead, Driftline Studio',
  },
  {
    quote: 'Setup took less time than writing the Slack message announcing it.',
    initials: 'AT',
    name: 'Amara Tate',
    role: 'Analyst, Pacific Analytics',
  },
];

export function TestimonialsMarquee() {
  // Duplicated on purpose — same reason as LogoMarquee — so the CSS
  // scroll-loop animation has no visible seam.
  const doubled = [...TESTIMONIALS, ...TESTIMONIALS];
  return (
    <div className="testi-marquee-wrap" aria-hidden="true">
      <section className="section-heading">
        <h2>Loved by teams everywhere</h2>
        <p>A rolling look at what people are saying right now.</p>
      </section>
      <div className="testi-track">
        {doubled.map((t, i) => (
          <div className="testi-card" key={i}>
            <p className="quote">&quot;{t.quote}&quot;</p>
            <div className="person">
              <span className="avatar">{t.initials}</span>
              <span>
                <span className="name">{t.name}</span>
                <span className="role">{t.role}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TestimonialsGrid() {
  const shown = TESTIMONIALS.slice(0, 3);
  return (
    <div className="testimonials-wrap">
      <section className="section-heading">
        <h2>What teams are saying</h2>
        <p>A few words from people running their sites through the dashboard.</p>
      </section>
      <div className="testimonials">
        {shown.map((t) => (
          <div className="testimonial-card" key={t.name}>
            <p className="quote">&quot;{t.quote}&quot;</p>
            <div className="person">
              <span className="avatar">{t.initials}</span>
              <span>
                <span className="name" style={{ display: 'block' }}>
                  {t.name}
                </span>
                <span className="role">{t.role}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
