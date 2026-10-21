'use client';

// components/marketing/Hero.tsx — replaces <section class="hero">.
//
// Desktop widens this into a two-column layout (.hero-grid): copy/CTA/
// snippet on the left in .hero-main, and HeroSlime filling the right
// column that would otherwise sit empty on wide viewports.
//
// Below the 960px collapse breakpoint, the slime stays visible (not
// hidden) rather than desktop-only, so mobile visitors get the same
// character — but at full hero width there's no room for a full-height
// side column next to the rest of the copy. Instead the slime is
// rendered inside .hero-top (the eyebrow+heading block), as
// .hero-top-slime — on mobile it's a small companion sitting beside the
// heading via flexbox. On desktop .hero-top-slime is hidden and the
// *same* HeroSlime is rendered a second time in .hero-side, which only
// becomes visible (and fills the full right column) at that breakpoint
// — see marketing-hero.css. Two render sites, CSS visibility toggles
// between them, rather than one DOM node needing to visually jump
// between a row beside the heading and a full-height column, which
// plain CSS can't do without reparenting.
import { HeroSlime } from './HeroSlime';

interface HeroProps {
  onConnectClick: () => void;
}

function HeroBackdrop() {
  // Purely decorative high-tech backdrop: a faint animated dot/grid
  // field plus two soft drifting glow orbs. Sits behind everything
  // else via CSS (absolute, negative z-index) so it never affects
  // layout or interferes with the slime/copy hit areas.
  return (
    <div className="hero-backdrop" aria-hidden="true">
      <div className="hero-backdrop-grid" />
      <div className="hero-backdrop-orb hero-backdrop-orb-a" />
      <div className="hero-backdrop-orb hero-backdrop-orb-b" />
    </div>
  );
}

export function Hero({ onConnectClick }: HeroProps) {
  return (
    <section className="hero">
      <HeroBackdrop />
      <div className="hero-grid">
        <div className="hero-main">
          <div className="hero-top">
            <div className="hero-top-copy">
              <span className="hero-eyebrow">
                <span className="live-dot"></span>
                Live on every connected site
              </span>
              <h1>Connect your site. Run it from here.</h1>
            </div>
            <div className="hero-top-slime">
              <HeroSlime />
            </div>
          </div>
          <p className="sub">
            Drop a single meta tag into your site and get a control panel for everything that happens on it: who
            visits, who converts, and what they see right now.
          </p>
          <div className="actions">
            <button className="btn-primary" onClick={onConnectClick}>
              Connect your site
            </button>
            <button
              className="btn-secondary"
              onClick={() =>
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              See how it works
            </button>
          </div>
          <div className="snippet">
            <span className="snippet-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            &lt;<span className="tag-name">meta</span> <span className="attr">name</span>=
            <span className="val">&quot;sitevento&quot;</span> <span className="attr">content</span>=
            <span className="val">&quot;a8f3-9d21-...&quot;</span>&gt;
            <br />
            &lt;<span className="tag-name">script</span> <span className="attr">src</span>=
            <span className="val" id="heroScriptSrc">
              &quot;…/sitevento.js&quot;
            </span>{' '}
            <span className="attr">defer</span>&gt;&lt;/<span className="tag-name">script</span>&gt;
            <br />
            <span className="comment">// paste into your site&apos;s &lt;head&gt;, then verify</span>
          </div>
        </div>
        <div className="hero-side">
          <HeroSlime />
        </div>
      </div>
    </section>
  );
}
