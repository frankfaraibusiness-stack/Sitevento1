'use client';

// components/marketing/Hero.tsx — replaces <section class="hero">.
//
// Desktop widens this into a two-column layout (.hero-grid): copy/CTA/
// snippet on the left in .hero-main (unchanged content, just re-wrapped),
// and HeroSlime filling the previously-empty right column so that side
// doesn't read as dead space on wide viewports. Below the collapse
// breakpoint the grid stacks to one column and the slime is hidden via
// CSS — see marketing-hero.css.
import { HeroSlime } from './HeroSlime';

interface HeroProps {
  onConnectClick: () => void;
}

export function Hero({ onConnectClick }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-main">
          <span className="eyebrow-tag">
            <span className="dot"></span>one script tag, live in minutes
          </span>
          <h1>Connect your site. Run it from here.</h1>
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
