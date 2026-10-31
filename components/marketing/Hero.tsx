'use client';

import { useEffect, useRef, useState } from 'react';

// components/marketing/Hero.tsx
//
// Hero is now just the animated mascot "stage" (glow + spinning rings
// + orbiting shapes, same rig as onboarding — see
// components/onboarding/OnboardingMascot.tsx / styles/onboarding/
// onboarding-shell.css), reused here as HeroMascotStage and rendered
// on its own, inside its own standalone section
// (.hero-mascot-section in marketing-hero.css). The stage's accent
// color cycles once a second through the app's tone palette (lime/
// purple/blue/orange) via a small interval in HeroMascotStage.
//
// The previous version of this file also rendered a left-column
// headline ("Your website. Your rules."), subcopy, Connect site / See
// how it works buttons, and a trust row — all of that is removed, on
// every breakpoint, not just mobile. Those entry points still exist
// elsewhere on the page (the Pricing section's CTA, the header's own
// CTA); HowItWorksModal (components/marketing/HowItWorksModal.tsx) is
// still rendered by MarketingPage but currently has no button that
// opens it — see the note in MarketingPage.tsx.
//
// The scripted "connect → verify → track" demo (ConnectedSiteShowcase,
// below) is unaffected by this change — it's its own section, already
// separate from Hero before this edit and still is now.

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

// Hero used to be a two-column section: headline/subcopy/CTAs on the
// left, the animated mascot on the right. The left column (eyebrow,
// "Your website. Your rules." headline, subcopy, Connect site / See
// how it works buttons, trust row, side decor) is removed entirely —
// on mobile it read as generic/AI-templated, so rather than patch it
// again it's gone on every breakpoint. What's left is just the mascot,
// now its own standalone section (.hero-mascot-section in
// marketing-hero.css) rather than one half of a two-column layout, so
// it isn't carrying leftover column/grid styling meant for a column
// that no longer exists. The Connect-site / How-it-works entry points
// still live on: the Pricing section's buttons and the header's own
// CTA (passed through from MarketingPage) cover that job now.
export function Hero() {
  return (
    <section className="hero-mascot-section">
      <HeroMascotStage />
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
