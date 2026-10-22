'use client';

import { useEffect, useRef, useState } from 'react';

// components/marketing/Hero.tsx
//
// App-feel hero: bold two-line headline with a hand-drawn-looking
// highlight blob behind the second line, subcopy, and two CTAs
// (full-width stacked on narrow screens, side-by-side once there's
// room). Single stacked column at every width — no mascot/character
// column anymore, and no side-by-side squeeze on mobile.
//
// The "connected site" demo card previously lived at the bottom of
// this component; it's now its own standalone section
// (ConnectedSiteShowcase, rendered separately by MarketingPage) rather
// than part of the hero.

interface HeroProps {
  onConnectClick: () => void;
}

function Sparkle({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c0 5-1 9-3 11s-6 3-9 3c3 0 7 1 9 3s3 6 3 11c0-5 1-9 3-11s6-3 9-3c-3 0-7-1-9-3s-3-6-3-11z" />
    </svg>
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

export function Hero({ onConnectClick }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-layout">
        <div className="hero-left-col">
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
      </div>

      <p className="hero-tagline">
        <Sparkle className="hero-tagline-sparkle" />
        One tiny snippet. Live control.
      </p>
    </section>
  );
}

// ---- Connected-site demo: now its own standalone section ----
// Previously nested inside Hero (card beneath the CTAs); split out so
// it's a section on its own, separate from the header/hero. Same
// mini browser-window chrome, live activity demo, Connected/
// Disconnected status + toggle, and meta-tag snippet as before.
export function ConnectedSiteShowcase() {
  const [isOn, setIsOn] = useState(true);

  return (
    <section className="hero-showcase">
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
    </section>
  );
}
