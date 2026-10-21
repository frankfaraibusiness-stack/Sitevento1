'use client';

// components/marketing/Hero.tsx
//
// New stripped-down app-feel hero, replacing the previous lime-field +
// backdrop-grid + side-column slime layout. Per the new reference design:
// headline, subcopy, the two CTAs, then a single "connected site" preview
// card directly beneath — no side column, no animated backdrop. The
// bunny/character art is a placeholder (CharacterPlaceholder) until the
// real character asset is supplied; swap that one component out later
// without touching the rest of the layout.

interface HeroProps {
  onConnectClick: () => void;
}

function CharacterPlaceholder() {
  // Placeholder for the mascot character (see reference design) — a
  // simple soft blob standing in for it so the layout/spacing is final
  // now and only this one component needs to change later.
  return (
    <div className="hero-character-placeholder" aria-hidden="true">
      <div className="hero-character-blob" />
    </div>
  );
}

function ConnectedSitePreview() {
  // The card beneath the CTAs in the reference: a mini browser-window
  // thumbnail, a "Connected" status line with site name, a live toggle,
  // and the meta-tag snippet underneath, overlapping the card's bottom
  // edge. Static/illustrative — not wired to any real site yet.
  return (
    <div className="hero-preview">
      <div className="hero-preview-card">
        <div className="hero-preview-browser">
          <span className="hero-preview-dot" />
          <span className="hero-preview-dot" />
          <span className="hero-preview-dot" />
        </div>
        <div className="hero-preview-thumb" aria-hidden="true" />
        <div className="hero-preview-info">
          <div className="hero-preview-site">
            <span className="hero-preview-status-dot" />
            <span className="hero-preview-site-name">YourSite.com</span>
          </div>
          <p className="hero-preview-connected">Connected</p>
          <div className="hero-preview-toggle-row">
            <span className="hero-preview-toggle is-on">
              <span className="hero-preview-toggle-knob" />
            </span>
            <span className="hero-preview-toggle-label">Banner is live</span>
          </div>
        </div>
      </div>
      <div className="hero-preview-snippet">
        <span className="hero-preview-snippet-icon">&lt;/&gt;</span>
        <span className="hero-preview-snippet-code">
          <span className="attr">name</span>=<span className="val">&quot;sitevento&quot;</span>
          <br />
          <span className="attr">content</span>=<span className="val">&quot;QKnNQvsrXqAziCjdiWKJ&quot;</span>
        </span>
      </div>
    </div>
  );
}

export function Hero({ onConnectClick }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-top">
        <div className="hero-top-copy">
          <h1>
            Your website.
            <br />
            <span className="hero-highlight">Your rules.</span>
          </h1>
          <p className="sub">
            Connect once. Change what visitors see, anytime — without rebuilding your site.
          </p>
          <div className="actions">
            <button className="btn-primary" onClick={onConnectClick}>
              Connect your site
              <span className="btn-arrow" aria-hidden="true">
                →
              </span>
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
        </div>
        <CharacterPlaceholder />
      </div>

      <ConnectedSitePreview />

      <p className="hero-tagline">
        <span className="hero-tagline-sparkle" aria-hidden="true">
          ✦
        </span>
        One tiny snippet. Live control.
      </p>
    </section>
  );
}
