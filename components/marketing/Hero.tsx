'use client';

import { useEffect, useRef, useState } from 'react';

// components/marketing/Hero.tsx
//
// App-feel hero: bold two-line headline with a hand-drawn-looking
// highlight blob behind the second line, subcopy, and two CTAs — on
// the left half of the hero, on both phone and desktop. The right
// half is the animated bunny character (public/mascot/hero-bunny.png),
// large on both breakpoints, same 50/50 split at every width (see
// .hero-layout / .hero-character-col in marketing-hero.css).
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

// ---- Connect → verify → tracking demo ----
// Replaces the old random "+1 view" chip-popping surface with a
// scripted, looping story told inside a browser-window mock: a plain
// site loads, the snippet gets dropped in, the site verifies/connects,
// then live tracking chips start drifting up the page — then it resets
// and repeats. Not wired to anything real; purely illustrative, like a
// short looping product video rather than a literal live demo.
type DemoPhase = 'loading' | 'pasting' | 'connecting' | 'tracking';

const PHASE_DURATIONS_MS: Record<DemoPhase, number> = {
  loading: 1400,
  pasting: 2200,
  connecting: 1600,
  tracking: 5200,
};

const PHASE_ORDER: DemoPhase[] = ['loading', 'pasting', 'connecting', 'tracking'];

const TRACKING_LABELS = ['+1 view', '+1 impression', '+1 click', '+1 visitor'];

interface TrackingChip {
  id: number;
  label: string;
  left: number;
  top: number;
}

const SNIPPET_TEXT = '<meta name="sitevento" content="QKnN…iWKJ" />';

function ConnectDemoSurface() {
  const [phase, setPhase] = useState<DemoPhase>('loading');
  const [typedChars, setTypedChars] = useState(0);
  const [chips, setChips] = useState<TrackingChip[]>([]);
  const nextChipId = useRef(0);

  // Advances through the scripted phases, looping back to the start —
  // the same four beats every time, like a looped product video.
  useEffect(() => {
    const idx = PHASE_ORDER.indexOf(phase);
    const timer = setTimeout(() => {
      const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
      setPhase(next);
      if (next === 'pasting') setTypedChars(0);
      if (next === 'tracking') setChips([]);
    }, PHASE_DURATIONS_MS[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  // Types the snippet out character by character during "pasting".
  useEffect(() => {
    if (phase !== 'pasting') return;
    const stepMs = Math.max(18, PHASE_DURATIONS_MS.pasting / (SNIPPET_TEXT.length + 6));
    const interval = setInterval(() => {
      setTypedChars((c) => (c < SNIPPET_TEXT.length ? c + 1 : c));
    }, stepMs);
    return () => clearInterval(interval);
  }, [phase]);

  // Drips tracking chips for the duration of the "tracking" phase.
  useEffect(() => {
    if (phase !== 'tracking') return;
    const spawn = () => {
      const id = nextChipId.current++;
      const chip: TrackingChip = {
        id,
        label: TRACKING_LABELS[Math.floor(Math.random() * TRACKING_LABELS.length)],
        left: 10 + Math.random() * 76,
        top: 14 + Math.random() * 60,
      };
      setChips((prev) => [...prev, chip]);
      setTimeout(() => setChips((prev) => prev.filter((c) => c.id !== id)), 1600);
    };
    spawn();
    const interval = setInterval(spawn, 480);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div className="hero-demo-surface" aria-hidden="true">
      <div className={`hero-demo-page hero-demo-page--${phase}`}>
        <div className="hero-demo-page-bar" />
        <div className="hero-demo-page-line hero-demo-page-line--title" />
        <div className="hero-demo-page-line hero-demo-page-line--a" />
        <div className="hero-demo-page-line hero-demo-page-line--b" />

        {phase === 'pasting' && (
          <div className="hero-demo-codeblock">
            <span className="hero-demo-codeblock-caret">
              {SNIPPET_TEXT.slice(0, typedChars)}
              <span className="hero-demo-caret" />
            </span>
          </div>
        )}

        {phase === 'connecting' && (
          <div className="hero-demo-connecting">
            <span className="hero-demo-spinner" />
            <span>Verifying snippet…</span>
          </div>
        )}

        {phase === 'tracking' &&
          chips.map((chip) => (
            <span
              key={chip.id}
              className="hero-demo-chip"
              style={{ left: `${chip.left}%`, top: `${chip.top}%` }}
            >
              {chip.label}
            </span>
          ))}
      </div>

      <div className="hero-demo-statusbar">
        <span className={`hero-demo-status-dot hero-demo-status-dot--${phase}`} />
        <span className="hero-demo-status-text">
          {phase === 'loading' && 'YourSite.com'}
          {phase === 'pasting' && 'Adding sitevento snippet…'}
          {phase === 'connecting' && 'Connecting…'}
          {phase === 'tracking' && 'Connected — tracking live'}
        </span>
      </div>
    </div>
  );
}

export function Hero({ onConnectClick }: HeroProps) {
  // Skeleton/spinner while hero-bunny.png loads, so the right column
  // isn't empty space on a slow connection. imgRef + the mount check
  // below covers the case where the <img> is already `complete` by
  // the time React attaches onLoad (e.g. served from the browser's
  // cache) — without it, onLoad never fires and the skeleton would
  // be stuck showing over an already-loaded image.
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) {
      setImgLoaded(true);
    }
  }, []);

  return (
    <section className="hero">
      {/* Single <h1> (one top-level heading, not two) whose layout
          switches entirely via CSS (.hero-h1 in marketing-hero.css):
          a full-width row above the 50/50 split on mobile — "Your
          website." pinned left, "Your rules." pinned right, with the
          whole hero's width to work with rather than just the left
          column's half, which is what keeps both sides fitting even
          at a 320px viewport — versus the original two-line stack,
          width-matched to .hero-left-col, on desktop. */}
      <h1 className="hero-h1">
        <span className="hero-h1-left">Your website.</span>
        <span className="hero-highlight-wrap">
          <span className="hero-highlight-shape" aria-hidden="true" />
          <span className="hero-highlight-text">Your rules.</span>
        </span>
      </h1>

      <div className="hero-layout">
        <div className="hero-left-col">
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

          <p className="hero-tagline">
            <Sparkle className="hero-tagline-sparkle" />
            One tiny snippet. Live control.
          </p>
        </div>

        <div className="hero-character-col" aria-hidden="true">
          {!imgLoaded && (
            <span className="hero-character-skeleton" aria-hidden="true">
              <span className="hero-character-skeleton-spinner" />
            </span>
          )}
          <img
            ref={imgRef}
            className={`hero-character-img${imgLoaded ? ' is-loaded' : ' is-loading'}`}
            src="/mascot/hero-bunny.png"
            alt=""
            width={1156}
            height={1361}
            onLoad={() => setImgLoaded(true)}
          />
        </div>
      </div>
    </section>
  );
}

// ---- Connected-site demo: now its own standalone section ----
// Sits directly under the hero, blended into the same page background
// rather than a floating white card. The browser-window mock plays a
// short looping story — site loads, snippet goes in, it connects,
// tracking starts — instead of a one-off animation. On desktop, two
// supporting copy columns flank the mock so the full-width section
// doesn't read as one small card adrift in empty space; on mobile the
// single centered mock is enough.
export function ConnectedSiteShowcase() {
  return (
    <section className="hero-showcase">
      <div className="hero-showcase-inner">
        <div className="hero-showcase-side hero-showcase-side--left" aria-hidden="true">
          <p className="hero-showcase-eyebrow">Step 1–2</p>
          <p className="hero-showcase-side-text">
            Drop one snippet into your site&apos;s head. No rebuild, no redeploy — it verifies itself
            in seconds.
          </p>
        </div>

        <div className="hero-showcase-frame">
          <div className="hero-demo-chrome">
            <span className="hero-demo-dot" />
            <span className="hero-demo-dot" />
            <span className="hero-demo-dot" />
            <span className="hero-demo-url">yoursite.com</span>
          </div>
          <ConnectDemoSurface />
        </div>

        <div className="hero-showcase-side hero-showcase-side--right" aria-hidden="true">
          <p className="hero-showcase-eyebrow">Step 3</p>
          <p className="hero-showcase-side-text">
            Once it&apos;s connected, every view, impression, and click streams in live — ready to
            control from your dashboard.
          </p>
        </div>
      </div>
    </section>
  );
}
