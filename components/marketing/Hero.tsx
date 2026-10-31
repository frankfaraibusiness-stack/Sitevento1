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

// Two hero images that crossfade back and forth, looping forever. Both
// are preloaded up front and the rotation only starts once BOTH have
// finished loading, so the swap never reveals a half-loaded image.
const MASCOT_IMAGES = ['/mascot/hero-bunny.png', '/mascot/hero-bunny-laptop.png'] as const;
const MASCOT_SWAP_MS = 2500; // swap every 2–3s

function HeroMascotStage() {
  const [toneIndex, setToneIndex] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);

  const allLoaded = loadedCount >= MASCOT_IMAGES.length;

  // Catch images that were already cached/complete by the time the
  // refs attach (onLoad won't fire again for those).
  useEffect(() => {
    let already = 0;
    imgRefs.current.forEach((el) => {
      if (el?.complete) already += 1;
    });
    if (already > 0) setLoadedCount((c) => Math.max(c, already));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setToneIndex((i) => (i + 1) % MASCOT_TONES.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Infinite rotation between the two images — only runs once both
  // are fully loaded.
  useEffect(() => {
    if (!allLoaded) return;
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % MASCOT_IMAGES.length);
    }, MASCOT_SWAP_MS);
    return () => clearInterval(interval);
  }, [allLoaded]);

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
        {!allLoaded && (
          <span className="hero-mascot-skeleton" aria-hidden="true">
            <span className="hero-mascot-skeleton-spinner" />
          </span>
        )}
        {MASCOT_IMAGES.map((src, i) => {
          const isActive = allLoaded && i === activeIndex;
          return (
            <img
              key={src}
              ref={(el) => {
                imgRefs.current[i] = el;
              }}
              className={`hero-mascot-img hero-mascot-img--swap${
                allLoaded ? ' is-loaded' : ' is-loading'
              }${isActive ? ' is-active' : ''}`}
              src={src}
              alt=""
              width={1156}
              height={1361}
              onLoad={() => setLoadedCount((c) => c + 1)}
            />
          );
        })}
      </div>

      <div className="hero-mascot-shadow" />
    </div>
  );
}

// Mobile-only character placeholder (<640px). The real mascot artwork
// for this spot is coming later — this is just a reserved stage with
// the same floating-gem/glow scene used elsewhere, sized and
// positioned to match where the final character art will sit, so
// swapping in the real asset later is a drop-in (just the <img> inside
// .hero-char-placeholder-art). Kept as a separate element from
// HeroMascotStage (rendered alongside it, shown/hidden by CSS per
// breakpoint) rather than reusing the animated stage, since the
// animated rings/shapes/colour-cycle are tuned for the tablet/desktop
// mascot and don't need to carry into this placeholder.
function HeroCharacterPlaceholder() {
  return (
    <div className="hero-char-placeholder" aria-hidden="true">
      <span className="hero-char-gem hero-char-gem-1" />
      <span className="hero-char-gem hero-char-gem-2" />
      <span className="hero-char-gem hero-char-gem-3" />
      <span className="hero-char-gem hero-char-gem-4" />
      <div className="hero-char-placeholder-art">
        <span className="hero-char-placeholder-label">Character art coming soon</span>
      </div>
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

          <div className="hero-trust-row" aria-hidden="true">
            <span className="hero-trust-dot" />
            <span>No code. No rebuild. Live in minutes.</span>
          </div>
        </div>

        <div className="hero-character-col">
          {/* Shown/hidden per breakpoint in marketing-hero.css — the
              placeholder below 640px, the real animated stage at
              640px and up. */}
          <HeroCharacterPlaceholder />
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
