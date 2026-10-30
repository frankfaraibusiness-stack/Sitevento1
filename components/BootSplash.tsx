'use client';

// components/BootSplash.tsx — full-screen boot splash rendered by
// AppRoot while auth resolves (and for a deliberate hold after).
//
// Redesign: a clean, cartoon-poster style brand-arrival screen built
// around the real product illustration (mascot-on-a-cloud with the
// dashboard widgets, public/mascot/hero-bunny-laptop.png) instead of
// a hand-drawn SVG mascot. Layout mirrors the reference: wordmark up
// top, headline, the illustration in the middle, then a status line
// with a chunky rounded "cartoonic" progress bar underneath.
//
// Background is NOT a fixed/hardcoded color — it's var(--app-bg), the
// same token the rest of the app's <body> uses, so the splash reads
// as part of the app rather than a separate flat-colored screen.
//
// Phases, same contract as before (see MIN_CONFIRMED_HOLD_MS):
//   1. "arriving"   (~700ms)  — content fades/rises in.
//   2. "connecting" (auth-gated) — status line cycles, progress bar
//                                fills in indeterminate sweeps. Does
//                                NOT advance until `ready` is true.
//   3. "confirmed"  (~3000ms hold) — status line settles on the final
//                                line, bar completes to 100%.
//   4. "leaving"    (~480ms)  — splash fades + lifts out, onDone()
//                                fires once.
//
// Reduced-motion: skips the loops/sweeps, single short cross-fade,
// same auth gate + hold.
import { useEffect, useRef, useState } from 'react';

type Phase = 'arriving' | 'connecting' | 'confirmed' | 'leaving';

interface BootSplashProps {
  /** True once the real app is actually ready to show (authReady in AppRoot). The splash will never leave "connecting" before this flips true, however fast or slow that is. */
  ready: boolean;
  onDone?: () => void;
}

const LOGO_URL = 'https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png';
const MASCOT_IMG = '/mascot/hero-bunny-laptop.png';

// Deliberate pause after `ready` flips true, before the splash is
// allowed to leave — runs on top of whatever "connecting" already
// took, never instead of it.
const MIN_CONFIRMED_HOLD_MS = 3000;
const ARRIVE_MS = 700;
const LEAVE_MS = 480;

const CONNECTING_LINES = ['Connecting to your site…', 'Syncing your dashboard…', 'Almost there…'];
const CONFIRMED_LINE = "You're all set.";

export function BootSplash({ ready, onDone }: BootSplashProps) {
  const [phase, setPhase] = useState<Phase>('arriving');
  const [lineIndex, setLineIndex] = useState(0);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Phase 1 → 2: once the arrival animation has had time to play.
  useEffect(() => {
    const t = setTimeout(() => setPhase('connecting'), reducedMotion ? 60 : ARRIVE_MS);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  // Phase 2: cycles the status line for as long as we're waiting on
  // auth. Stops rotating the moment `ready` becomes true.
  useEffect(() => {
    if (phase !== 'connecting') return;
    const interval = setInterval(() => {
      if (readyRef.current) return;
      setLineIndex((i) => (i + 1) % CONNECTING_LINES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [phase]);

  // Phase 2 → 3: only once auth has actually resolved.
  useEffect(() => {
    if (phase !== 'connecting' || !ready) return;
    setPhase('confirmed');
  }, [phase, ready]);

  // Phase 3 → 4: the deliberate 3s buffer AFTER auth resolves — gives
  // background pages/images time to settle and preload before the
  // splash lifts away. Timed from the moment we entered "confirmed"
  // (i.e. the moment `ready` became true), never from mount, so it's
  // always a true 3s on top of however long auth itself took.
  useEffect(() => {
    if (phase !== 'confirmed') return;
    const t = setTimeout(() => setPhase('leaving'), reducedMotion ? 300 : MIN_CONFIRMED_HOLD_MS);
    return () => clearTimeout(t);
  }, [phase, reducedMotion]);

  // Phase 4 → done.
  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = setTimeout(() => onDone?.(), reducedMotion ? 80 : LEAVE_MS);
    return () => clearTimeout(t);
  }, [phase, onDone, reducedMotion]);

  // Mirrors the splash's own background onto <html> for the duration
  // of boot so mobile rubber-band overscroll reveals the same tone
  // underneath instead of flashing to something else. Always the
  // app's own body color (--app-bg), never a separate fixed color.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('is-boot-lime');
    return () => {
      root.classList.remove('is-boot-lime');
    };
  }, []);

  const statusLine = phase === 'confirmed' || phase === 'leaving' ? CONFIRMED_LINE : CONNECTING_LINES[lineIndex];
  const isComplete = phase === 'confirmed' || phase === 'leaving';

  return (
    <div className={`boot-splash is-${phase}`} role="status" aria-live="polite" aria-label="Loading sitevento">
      <div className="boot-splash-atmosphere" aria-hidden="true">
        <span className="boot-splash-glow boot-splash-glow-a" />
        <span className="boot-splash-glow boot-splash-glow-b" />
        <span className="boot-splash-glow boot-splash-glow-c" />
      </div>

      {/* Main content: logo wordmark, headline, mascot — vertically
          centered as its own block, independent of the status/progress
          bar below, which is pinned to the bottom of the screen. */}
      <div className="boot-splash-stage">
        {/* The logo file IS the full "sitevento" wordmark already — no
            extra text beside it and no small boxed container, shown at
            its own aspect ratio, ~80% width, centered. */}
        <img className="boot-splash-logo-mark" src={LOGO_URL} alt="sitevento" />

        <h1 className="boot-splash-headline">
          Your website.
          <br />
          Finally in your{' '}
          <span className="boot-splash-highlight-wrap">
            <span className="boot-splash-highlight-shape" aria-hidden="true" />
            <span className="boot-splash-highlight-text">control.</span>
          </span>
        </h1>

        <p className="boot-splash-tagline">
          <span>Live visitors</span>
          <span className="boot-splash-tagline-dot" aria-hidden="true" />
          <span>Leads</span>
          <span className="boot-splash-tagline-dot" aria-hidden="true" />
          <span>Full control</span>
        </p>

        <div className="boot-splash-mark">
          <img className="boot-splash-mascot-img" src={MASCOT_IMG} alt="" width={583} height={428} />
        </div>
      </div>

      {/* Status block: pinned to the bottom of the screen — spinner,
          status line, then the chunky progress bar underneath it. */}
      <div className="boot-splash-status" aria-live="polite">
        <span className={`boot-splash-spinner${isComplete ? ' is-complete' : ''}`} aria-hidden="true" />
        <p className="boot-splash-status-line" key={statusLine}>
          {statusLine}
        </p>
        <div className={`boot-splash-rail${isComplete ? ' is-complete' : ''}`}>
          <span className="boot-splash-rail-fill" />
        </div>
        <p className="boot-splash-tagline boot-splash-tagline--small">
          <span>Real visitors</span>
          <span className="boot-splash-tagline-dot" aria-hidden="true" />
          <span>Real leads</span>
          <span className="boot-splash-tagline-dot" aria-hidden="true" />
          <span>Real control</span>
        </p>
      </div>
    </div>
  );
}
