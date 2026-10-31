'use client';

import { useEffect, useRef, useState } from 'react';

// components/marketing/Hero.tsx
//
// Full rebuild (replaces the old split-image hero). The old hero put
// a large static PNG of the mascot in a right-hand column that never
// matched the left column's content height — tall on desktop with a
// short two-line headline beside it, leaving a lot of dead space or
// forcing an awkward vertical-center. This version drops the PNG
// entirely: the mascot is now the same animated "stage" rig used on
// onboarding (glow + spinning rings + orbiting shapes, see
// components/onboarding/OnboardingMascot.tsx / styles/onboarding/
// onboarding-shell.css), reused here as HeroMascotStage, sized and
// vertically centered against the left column instead of forced to
// its own image aspect ratio — so the two sides actually balance at
// any height. The stage's accent color now cycles once a second
// through the app's tone palette (lime/purple/blue/orange) instead of
// being pinned to one tone, via a small interval in HeroMascotStage.
//
// Layout, structure and CSS are new top-to-bottom in
// marketing-hero.css — nothing here reuses the old .hero-character-*
// rules, which are removed.
//
// The scripted "connect → verify → track" demo (ConnectDemoSurface)
// is also rebuilt below: it now sits directly under the header as its
// own compact section immediately following the hero, with the
// typing/status indicator moved to the TOP of the card instead of the
// old bottom status bar, so the "live" state reads immediately instead
// of being the last thing noticed.
//
// "See how it works" used to just scroll to the #how-it-works strip
// further down the page. It now opens HowItWorksModal (see
// components/marketing/HowItWorksModal.tsx), a full-screen explainer —
// onHowItWorksClick is owned by MarketingPage, which renders the modal.

interface HeroProps {
  onConnectClick: () => void;
  onHowItWorksClick: () => void;
}

function Sparkle({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c0 5-1 9-3 11s-6 3-9 3c3 0 7 1 9 3s3 6 3 11c0-5 1-9 3-11s6-3 9-3c-3 0-7-1-9-3s-3-6-3-11z" />
    </svg>
  );
}

// ---- Mascot stage: onboarding's animated rig, reused for the hero ----
// Same visual language as OnboardingMascot.tsx (glow/rings/orbiting
// shapes/float), but with its own class prefix (hero-mascot-*, see
// marketing-hero.css) so neither file has to compromise for the
// other's sizing, and with a tone that advances on a timer instead of
// a fixed prop — "changes colours every second" per the brief.
const MASCOT_TONES = ['lime', 'purple', 'blue', 'orange'] as const;
type MascotTone = (typeof MASCOT_TONES)[number];

// Single hero image — the second image (a differently-framed, wide
// landscape character on a totally different aspect ratio) used to
// crossfade in here too, but stretched into the same tall box it
// scaled unevenly and sat top-anchored instead of centered like the
// first image, which read as a layout glitch on every swap. Simplest
// correct fix: one image, recoloured instead of replaced. The bunny
// art is almost entirely flat lime-green fills, so a CSS hue-rotate
// filter can retint it convincingly through the same tone cycle that
// already drives the glow/rings/shapes (MASCOT_TONES, 1s interval) —
// see HERO_MASCOT_TONE_FILTERS below for the per-tone rotate() value,
// and .hero-mascot-img in marketing-hero.css for where it's applied.
const MASCOT_IMAGE = '/mascot/hero-bunny.png';

// One hue-rotate() degree value per tone, applied as a CSS filter on
// the <img> itself — rotates the source lime (~77°) to land on each
// tone's actual hue. Lime is 0 (no rotation, the image's native
// colour); the others were solved from the app's real tone hex values
// (--dash-purple/--dash-blue/--dash-orange in styles/base/base.css).
const HERO_MASCOT_TONE_FILTERS: Record<MascotTone, number> = {
  lime: 0,
  purple: 175,
  blue: 130,
  orange: -48,
};

function HeroMascotStage() {
  const [toneIndex, setToneIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Catch the image if it was already cached/complete by the time the
  // ref attaches (onLoad won't fire again for that case).
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setToneIndex((i) => (i + 1) % MASCOT_TONES.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const tone: MascotTone = MASCOT_TONES[toneIndex];

  return (
    <div className={`hero-mascot-stage hero-mascot-${tone}`} aria-hidden="true">
      <div className="hero-mascot-glow" />
      <div className="hero-mascot-ring hero-mascot-ring-a" />
      <div className="hero-mascot-ring hero-mascot-ring-b" />

      <span className="hero-mascot-shape hero-mascot-shape-1" />
      <span className="hero-mascot-shape hero-mascot-shape-2" />
      <span className="hero-mascot-shape hero-mascot-shape-3" />
      <span className="hero-mascot-shape hero-mascot-shape-4" />

      <div className="hero-mascot-float">
        {!loaded && (
          <span className="hero-mascot-skeleton" aria-hidden="true">
            <span className="hero-mascot-skeleton-spinner" />
          </span>
        )}
        <img
          ref={imgRef}
          className={`hero-mascot-img${loaded ? ' is-loaded' : ' is-loading'}`}
          style={{ ['--hero-mascot-hue' as string]: `${HERO_MASCOT_TONE_FILTERS[tone]}deg` }}
          src={MASCOT_IMAGE}
          alt=""
          width={1156}
          height={1361}
          onLoad={() => setLoaded(true)}
        />
      </div>

      <div className="hero-mascot-shadow" />
    </div>
  );
}

// Mobile-only (<640px) decorative cluster filling the dead space to
// the right of the stacked CTA buttons — the actions column no longer
// stretches full-width (see .hero .actions mobile rule), which left
// that side of the row empty. Small bobbing stat chips + gem shapes,
// same visual language as the connect-demo's tracking chips
// (.hero-demo-chip) and the mascot stage's orbiting shapes, just
// positioned here instead. Purely decorative/illustrative, not real
// data — aria-hidden, no pointer events.
function HeroActionsSideDecor() {
  return (
    <div className="hero-actions-decor" aria-hidden="true">
      <span className="hero-actions-decor-chip hero-actions-decor-chip-1">
        <span className="hero-actions-decor-chip-dot" />
        247 live
      </span>
      <span className="hero-actions-decor-chip hero-actions-decor-chip-2">✓ Connected</span>
      <span className="hero-actions-decor-gem hero-actions-decor-gem-1" />
      <span className="hero-actions-decor-gem hero-actions-decor-gem-2" />
      <span className="hero-actions-decor-spark hero-actions-decor-spark-1" />
    </div>
  );
}

export function Hero({ onConnectClick, onHowItWorksClick }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-layout">
        <div className="hero-left-col">
          <p className="hero-eyebrow">
            <Sparkle className="hero-eyebrow-sparkle" />
            One tiny snippet. Live control.
          </p>

          <h1 className="hero-h1">
            <span className="hero-h1-line">Your website.</span>
            <span className="hero-highlight-wrap">
              <span className="hero-highlight-shape" aria-hidden="true" />
              <span className="hero-highlight-text">Your rules.</span>
            </span>
          </h1>

          <p className="sub">
            Connect once. Change what visitors see, anytime — without rebuilding your site.
          </p>

          <div className="actions-row">
            <div className="actions">
              <button className="btn-primary" onClick={onConnectClick}>
                <span className="btn-primary-full">Connect your site</span>
                <span className="btn-primary-short">Connect site</span>
                <span className="btn-arrow" aria-hidden="true">
                  →
                </span>
              </button>
              <button className="btn-secondary btn-how-it-works" onClick={onHowItWorksClick}>
                <span className="how-it-works-play" aria-hidden="true">
                  <span className="how-it-works-play-pulse" />
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                See how it works
              </button>
            </div>

            <HeroActionsSideDecor />
          </div>

          <div className="hero-trust-row" aria-hidden="true">
            <span className="hero-trust-dot" />
            <span>No code. No rebuild. Live in minutes.</span>
          </div>
        </div>

        <div className="hero-character-col">
          <HeroMascotStage />
        </div>
      </div>
    </section>
  );
}

// ---- Connect → verify → tracking demo ----
// Scripted, looping story told inside a browser-window mock: a plain
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

const STATUS_COPY: Record<DemoPhase, string> = {
  loading: 'YourSite.com',
  pasting: 'Adding sitevento snippet…',
  connecting: 'Connecting…',
  tracking: 'Connected — tracking live',
};

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
        top: 18 + Math.random() * 56,
      };
      setChips((prev) => [...prev, chip]);
      setTimeout(() => setChips((prev) => prev.filter((c) => c.id !== id)), 1600);
    };
    spawn();
    const interval = setInterval(spawn, 480);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div className="hero-demo-chrome">
      <div className="hero-demo-chrome-bar">
        <span className="hero-demo-dot" />
        <span className="hero-demo-dot" />
        <span className="hero-demo-dot" />
        <span className="hero-demo-url">yoursite.com</span>
      </div>

      {/* Status/typing indicator now lives at the TOP of the card,
          directly under the browser chrome, instead of as a status
          bar along the bottom — it's the first thing read, not the
          last. */}
      <div className="hero-demo-statusbar">
        <span className={`hero-demo-status-dot hero-demo-status-dot--${phase}`} />
        <span className="hero-demo-status-text">{STATUS_COPY[phase]}</span>
        {phase === 'pasting' && (
          <span className="hero-demo-typing" aria-hidden="true">
            <span className="hero-demo-typing-snippet">{SNIPPET_TEXT.slice(0, typedChars)}</span>
            <span className="hero-demo-caret" />
          </span>
        )}
      </div>

      <div className="hero-demo-surface" aria-hidden="true">
        <div className={`hero-demo-page hero-demo-page--${phase}`}>
          <div className="hero-demo-page-bar" />
          <div className="hero-demo-page-line hero-demo-page-line--title" />
          <div className="hero-demo-page-line hero-demo-page-line--a" />
          <div className="hero-demo-page-line hero-demo-page-line--b" />

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
      </div>
    </div>
  );
}

// ---- Connected-site demo: standalone section right under the hero ----
// Sits directly beneath the hero as the "section under header" — a
// compact, single card (no flanking copy columns) so it reads as part
// of the same opening beat as the hero rather than a separate scroll
// stop. On desktop it sits inside a short two-column row: a few quick
// proof lines on the left, the demo card on the right.
export function ConnectedSiteShowcase() {
  return (
    <section className="hero-showcase">
      <div className="hero-showcase-inner">
        <div className="hero-showcase-copy">
          <p className="hero-showcase-eyebrow">See it connect</p>
          <h2 className="hero-showcase-title">One snippet. It verifies itself.</h2>
          <ul className="hero-showcase-list">
            <li>Drop one line into your site&apos;s head — no rebuild, no redeploy.</li>
            <li>It verifies in seconds, right in your dashboard.</li>
            <li>Every view, impression, and click streams in live from there.</li>
          </ul>
        </div>

        <div className="hero-showcase-frame">
          <ConnectDemoSurface />
        </div>
      </div>
    </section>
  );
}
