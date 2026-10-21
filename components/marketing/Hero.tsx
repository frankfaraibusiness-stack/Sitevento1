'use client';

import { useEffect, useRef, useState } from 'react';

// components/marketing/Hero.tsx
//
// App-feel hero matching the reference design: bold two-line headline
// with a hand-drawn-looking highlight blob behind the second line,
// subcopy, two CTAs (full-width stacked on narrow screens, side-by-side
// width capped once there's room), a "connected site" preview card, and
// small decorative sparkle/squiggle accents scattered around — all
// static/illustrative, except the preview card below which is a small
// interactive demo of what a connected site looks like live. The mascot
// is a placeholder (CharacterPlaceholder) until the real character art
// is supplied.

interface HeroProps {
  onConnectClick: () => void;
}

function CharacterPlaceholder() {
  // Stands in for the mascot (see reference) — only this component
  // needs to change later when the real art is supplied.
  return (
    <div className="hero-character-placeholder" aria-hidden="true">
      <div className="hero-character-blob" />
    </div>
  );
}

function Sparkle({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c0 5-1 9-3 11s-6 3-9 3c3 0 7 1 9 3s3 6 3 11c0-5 1-9 3-11s6-3 9-3c-3 0-7-1-9-3s-3-6-3-11z" />
    </svg>
  );
}

function Squiggle({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 60 20" fill="none" aria-hidden="true">
      <path d="M2 14c6 0 6-10 12-10s6 12 12 12 6-9 12-9 6 7 12 7" strokeLinecap="round" strokeWidth="3.5" />
    </svg>
  );
}

function Crystal({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 2 36 14l-6 24H10L4 14z" />
      <path d="M20 2 14 14h12z" opacity="0.5" />
      <path d="M4 14h32l-6 24H10z" opacity="0.15" />
    </svg>
  );
}

function HeroDecor() {
  // Scattered sparkles/crystal/squiggle accents around the headline and
  // preview card, matching the reference's playful "juice splash" feel.
  return (
    <div className="hero-decor" aria-hidden="true">
      <Sparkle className="hero-decor-sparkle hero-decor-sparkle-a" />
      <Crystal className="hero-decor-crystal" />
      <Sparkle className="hero-decor-sparkle hero-decor-sparkle-b" />
      <Squiggle className="hero-decor-squiggle hero-decor-squiggle-a" />
      <Squiggle className="hero-decor-squiggle hero-decor-squiggle-b" />
    </div>
  );
}

// Pop labels cycled through for the live-activity demo — mirrors the
// kind of events sitevento actually tracks on a connected site.
const ACTIVITY_LABELS = ['+1 view', '+1 impression', '+1 click', '+1 visitor'];

interface ActivityPop {
  id: number;
  label: string;
  left: number; // percentage across the demo surface
  top: number; // percentage down the demo surface
}

const POP_LIFETIME_MS = 1600;
const BURST_WINDOW_MS = 5000; // ~5s of bursts, then a pause, like widgets rotating
const BURST_PAUSE_MS = 1800;
const POP_INTERVAL_MS = 420;

function ActivityDemoSurface({ isOn }: { isOn: boolean }) {
  // Illustrates what a connected site's banner does live: a steady drip
  // of "+1 view / +1 impression / +1 click" chips popping up at random
  // points across the surface, several at once, in ~5s bursts with a
  // short pause between — the same rhythm widgets rotate through —
  // rather than a single one-off pop. Purely a demo (nothing here is
  // wired to real traffic); when the toggle is off, it goes idle and
  // shows a hint instead.
  const [pops, setPops] = useState<ActivityPop[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (!isOn) {
      setPops([]);
      return;
    }

    let burstTimer: ReturnType<typeof setTimeout>;
    let popTimer: ReturnType<typeof setInterval>;
    let elapsed = 0;

    const spawnPop = () => {
      const id = nextId.current++;
      const pop: ActivityPop = {
        id,
        label: ACTIVITY_LABELS[Math.floor(Math.random() * ACTIVITY_LABELS.length)],
        left: 8 + Math.random() * 78,
        top: 10 + Math.random() * 68,
      };
      setPops((prev) => [...prev, pop]);
      setTimeout(() => {
        setPops((prev) => prev.filter((p) => p.id !== id));
      }, POP_LIFETIME_MS);
    };

    const runBurst = () => {
      elapsed = 0;
      popTimer = setInterval(() => {
        spawnPop();
        elapsed += POP_INTERVAL_MS;
        if (elapsed >= BURST_WINDOW_MS) {
          clearInterval(popTimer);
          burstTimer = setTimeout(runBurst, BURST_PAUSE_MS);
        }
      }, POP_INTERVAL_MS);
    };

    // Kick off immediately so the demo doesn't sit empty on first paint.
    spawnPop();
    runBurst();

    return () => {
      clearInterval(popTimer);
      clearTimeout(burstTimer);
    };
  }, [isOn]);

  return (
    <div className={`hero-preview-thumb${isOn ? '' : ' is-off'}`} aria-hidden="true">
      {isOn ? (
        pops.map((pop) => (
          <span
            key={pop.id}
            className="hero-preview-pop"
            style={{ left: `${pop.left}%`, top: `${pop.top}%` }}
          >
            {pop.label}
          </span>
        ))
      ) : (
        <p className="hero-preview-thumb-hint">Turn on to see live activity</p>
      )}
    </div>
  );
}

function ConnectedSitePreview() {
  // The card beneath the CTAs: a mini browser-window chrome, a live
  // activity demo standing in for the banner's real-time tracking,
  // "Connected"/"Disconnected" status + site name, a working toggle
  // (on by default) that switches the demo on/off, and the meta-tag
  // snippet overlapping the card's bottom edge.
  const [isOn, setIsOn] = useState(true);

  return (
    <div className="hero-preview">
      <div className="hero-preview-card">
        <div className="hero-preview-browser">
          <span className="hero-preview-dot" />
          <span className="hero-preview-dot" />
          <span className="hero-preview-dot" />
        </div>
        <ActivityDemoSurface isOn={isOn} />
        <div className="hero-preview-info">
          <div className="hero-preview-site">
            <span className={`hero-preview-status-dot${isOn ? '' : ' is-off'}`} />
            <span className="hero-preview-site-name">YourSite.com</span>
          </div>
          <p className="hero-preview-connected">{isOn ? 'Connected' : 'Disconnected'}</p>
          <div className="hero-preview-toggle-row">
            <button
              type="button"
              className={`hero-preview-toggle${isOn ? ' is-on' : ''}`}
              role="switch"
              aria-checked={isOn}
              aria-label={isOn ? 'Turn off demo banner' : 'Turn on demo banner'}
              onClick={() => setIsOn((v) => !v)}
            >
              <span className="hero-preview-toggle-knob" />
            </button>
            <span className="hero-preview-toggle-label">{isOn ? 'Connected' : 'Disconnected'}</span>
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
            <span className="hero-highlight-wrap">
              <span className="hero-highlight-shape" aria-hidden="true" />
              <span className="hero-highlight-text">Your rules.</span>
            </span>
          </h1>
          <p className="sub">
            Connect once. Change what visitors see, anytime — without rebuilding your site.
          </p>
          <div className="actions">
            <button className="btn-primary" onClick={onConnectClick}>
              <span className="btn-primary-full">Connect your site</span>
              <span className="btn-primary-short">Connect site</span>
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
        <div className="hero-character-col">
          <CharacterPlaceholder />
          <HeroDecor />
        </div>
      </div>

      <ConnectedSitePreview />

      <p className="hero-tagline">
        <Sparkle className="hero-tagline-sparkle" />
        One tiny snippet. Live control.
      </p>
    </section>
  );
}
