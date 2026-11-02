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
// Phases:
//   1. "arriving"   (~700ms)  — content fades/rises in.
//   2. "connecting" (up to BOOT_TIMEOUT_MS) — status line cycles,
//                                progress bar fills in indeterminate
//                                sweeps, while we wait for `ready`
//                                (Firebase auth settling).
//   3. "confirmed"  (~3000ms hold) — reached once `ready` becomes
//                                true within the boot window; status
//                                line settles on the final line, bar
//                                completes to 100%.
//   4. "leaving"    (~480ms)  — splash fades + lifts out, onDone()
//                                fires once.
//
// Boot timeout: the splash no longer waits indefinitely on `ready`.
// It boots for BOOT_TIMEOUT_MS (5s) and then checks: if auth settled
// (`ready`) by then, it proceeds straight to "confirmed" as before.
// If auth still hasn't settled, the splash closes anyway (onDone()
// fires) instead of hanging — the caller is responsible for showing
// the "no network" retry toast in that case (onTimeout).
//
// Reduced-motion: skips the loops/sweeps, single short cross-fade,
// same timeout + hold logic.
import { useEffect, useRef, useState } from 'react';

type Phase = 'arriving' | 'connecting' | 'confirmed' | 'leaving';

interface BootSplashProps {
  /** True once the real app is actually ready to show (authReady in AppRoot). */
  ready: boolean;
  onDone?: () => void;
  /** Fired once, if the boot window elapses before `ready` ever becomes true. The splash still closes either way — this is just the signal to surface the "no network" retry toast. */
  onTimeout?: () => void;
}

const LOGO_URL = 'https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png';
const MASCOT_IMG = '/mascot/hero-bunny-laptop.png';

// Deliberate pause after `ready` flips true, before the splash is
// allowed to leave — runs on top of whatever "connecting" already
// took, never instead of it.
const MIN_CONFIRMED_HOLD_MS = 3000;
const ARRIVE_MS = 700;
const LEAVE_MS = 480;

// How long the splash waits on auth before giving up and closing
// anyway. Not a hardcoded "always wait this long" — it's a ceiling:
// if `ready` arrives sooner, the splash moves on immediately.
const BOOT_TIMEOUT_MS = 5000;

const CONNECTING_LINES = ['Connecting to your site…', 'Syncing your dashboard…', 'Almost there…'];
const CONFIRMED_LINE = "You're all set.";

export function BootSplash({ ready, onDone, onTimeout }: BootSplashProps) {
  const [phase, setPhase] = useState<Phase>('arriving');
  const [lineIndex, setLineIndex] = useState(0);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  // Guards against double-firing onTimeout / proceeding twice once the
  // boot window has already been judged (timed out or not).
  const settledRef = useRef(false);

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

  // Phase 2 → 3: once auth has actually resolved — but only while
  // still inside the boot window (the timeout effect below handles
  // what happens if `ready` never arrives in time).
  useEffect(() => {
    if (phase !== 'connecting' || !ready || settledRef.current) return;
    settledRef.current = true;
    setPhase('confirmed');
  }, [phase, ready]);

  // Phase 2 timeout: boots for BOOT_TIMEOUT_MS, then checks whether
  // auth has settled. If it has (readyRef caught up right at the
  // boundary), fall through to "confirmed" same as above. If not,
  // close anyway and tell the caller so it can show the "no network"
  // retry toast — the splash itself never hangs past the boot window.
  useEffect(() => {
    if (phase !== 'connecting') return;
    const t = setTimeout(
      () => {
        if (settledRef.current) return;
        settledRef.current = true;
        if (readyRef.current) {
          setPhase('confirmed');
        } else {
          onTimeout?.();
          setPhase('leaving');
        }
      },
      reducedMotion ? 300 : BOOT_TIMEOUT_MS
    );
    return () => clearTimeout(t);
  }, [phase, reducedMotion, onTimeout]);

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
