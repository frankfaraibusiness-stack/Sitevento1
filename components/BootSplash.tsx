'use client';

// components/BootSplash.tsx — full-screen splash rendered by AppRoot
// while auth state is resolving (and for a short minimum hold after,
// see the onDone contract below).
//
// Simple orbiting-dots loader, not a giant screen-filling shape:
// a ring of small lime dots spins around the center of the screen.
// After ~3s of spinning, every dot flies inward and converges on the
// exact center, at which point the logo appears (mounted the instant
// convergence starts, with its own entrance animation playing as the
// dots land).
//
// Lifecycle has three phases, driven from here (not just CSS), because
// phase 3's duration is randomized and the parent needs to know when
// the whole thing is actually done:
//   1. "spinning"    (~3s)    — dots orbit the center, evenly spaced,
//                                spinning as a ring.
//   2. "converging"  (~550ms) — each dot flies from its position on the
//                                ring straight into the center and
//                                shrinks to nothing on arrival. The
//                                logo mounts at the same instant and
//                                plays its own pop-in.
//   3. "holding"      (3s,     — logo sits still (tiny idle breathing so
//       fixed)                   it doesn't look frozen), then calls
//                                onDone().
//
// onDone is called exactly once, after the full fixed-length lifecycle
// finishes — NOT tied to how long auth actually takes. The parent
// (AppRoot) is expected to keep rendering BootSplash until onDone
// fires, even if authReady flips true earlier, so the splash always
// gets its full, deliberate screen time rather than flickering by
// instantly on a fast connection. See AppRoot.tsx for how this is
// wired up.
//
// Reduced-motion: skips the orbit/convergence animation entirely and
// just cross-fades a few static dots out and the logo in on a short
// fixed timer.

import { useEffect, useMemo, useState } from 'react';

type Phase = 'spinning' | 'converging' | 'holding';

interface BootSplashProps {
  onDone?: () => void;
}

interface Dot {
  angleDeg: number; // position around the ring, 0 = top, clockwise
  radius: number; // distance from center, in viewBox units
  size: number; // dot diameter, in viewBox units
  wobbleSeed: number; // stable per-mount offset so dots don't pulse in perfect unison
}

const DOT_COUNT = 10;

function makeDots(seedBase: number): Dot[] {
  let s = seedBase;
  function rand() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }

  const dots: Dot[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    // Evenly spaced around the ring with a touch of per-dot jitter so
    // it reads as organic rather than a perfectly mechanical clock
    // face, while still clearly being a ring.
    const baseAngle = (360 / DOT_COUNT) * i;
    const angleDeg = baseAngle + (rand() - 0.5) * 8;
    const radius = 68 + (rand() - 0.5) * 6;
    const size = 9 + rand() * 5;
    dots.push({ angleDeg, radius, size, wobbleSeed: rand() * 1000 });
  }
  return dots;
}

export function BootSplash({ onDone }: BootSplashProps) {
  const [phase, setPhase] = useState<Phase>('spinning');

  const { dots, spinMs, holdMs } = useMemo(() => {
    const seed = Math.floor(Math.random() * 1e9);
    return {
      dots: makeDots(seed),
      spinMs: 3000, // spin for exactly ~3s before converging, as requested
      holdMs: 3000, // fixed exactly 3s hold once formed (was randomized 3-5s)
    };
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('converging'), spinMs);
    return () => clearTimeout(t1);
  }, [spinMs]);

  useEffect(() => {
    if (phase !== 'converging') return;
    // Matches the CSS convergence animation duration below.
    const t2 = setTimeout(() => setPhase('holding'), 550);
    return () => clearTimeout(t2);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'holding') return;
    const t3 = setTimeout(() => {
      onDone?.();
    }, holdMs);
    return () => clearTimeout(t3);
  }, [phase, holdMs, onDone]);

  // Background swap to brand lime: driven from this same phase state
  // (not left to CSS :has()) so it works in any browser, not just ones
  // with :has() support — this is the very first screen every visitor
  // sees, so it can't silently stay cream on an older browser. Lands
  // as soon as we leave "spinning", i.e. right as convergence begins /
  // the logo starts popping in, and the CSS transition below (see
  // boot-splash.css) handles the smooth fade itself.
  const isLime = phase !== 'spinning';

  // Mirror the same lime state onto <html> itself, not just the fixed
  // .boot-splash overlay. The overlay covers the viewport, but mobile
  // rubber-band overscroll (bouncing past the top/bottom edge) reveals
  // whatever color html/body are painted underneath it — without this,
  // that overscroll flashes white/cream while the splash is lime,
  // which reads as a mismatch/flicker. Toggled via a class rather than
  // writing html's inline style directly so base.css stays the single
  // source of truth for the actual color value. Always cleaned up on
  // unmount/phase change so a page navigated to after boot never
  // inherits a stuck lime html background.
  useEffect(() => {
    const root = document.documentElement;
    if (isLime) {
      root.classList.add('is-boot-lime');
    } else {
      root.classList.remove('is-boot-lime');
    }
    return () => {
      root.classList.remove('is-boot-lime');
    };
  }, [isLime]);

  return (
    <div className={`boot-splash${isLime ? ' is-lime' : ''}`} role="status" aria-label="Loading sitevento">
      <div className={`boot-splash-stage is-${phase}`}>
        <div className="boot-splash-ring">
          {dots.map((dot, i) => {
            const rad = (dot.angleDeg * Math.PI) / 180;
            // Start position on the ring, relative to center (0,0).
            const x = Math.sin(rad) * dot.radius;
            const y = -Math.cos(rad) * dot.radius;
            return (
              <span
                key={i}
                className="boot-splash-dot"
                style={{
                  width: `${dot.size}px`,
                  height: `${dot.size}px`,
                  // Custom properties consumed by the keyframes in CSS:
                  // the dot orbits by rotating its own translated
                  // offset around the shared ring center, then on
                  // convergence just animates that offset back to 0,0.
                  ['--dot-x' as string]: `${x}px`,
                  ['--dot-y' as string]: `${y}px`,
                  // Stable per-dot offset so the pulse animation isn't
                  // perfectly synchronized across all dots.
                  animationDelay: `${dot.wobbleSeed % 600}ms`,
                }}
              />
            );
          })}
        </div>
        {/* Logo: mounted the instant convergence begins, so it appears
            exactly as the dots land on the center, then plays its own
            bouncy entrance on top of/after the convergence motion. */}
        {phase !== 'spinning' && (
          <img
            className="boot-splash-logo"
            src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
            alt="sitevento"
          />
        )}

        {/* Blob character: pops in on top of the logo the moment it lands,
            startle/"jump-scare" style (fast overshoot scale-in from
            nothing), then settles and fades back out — same shadow + eyes
            as the hero slime, kept as-is. Purely decorative (aria-hidden),
            mounted only for the window it animates in so it never lingers
            as a static shape sitting over the logo. */}
        {phase === 'holding' && (
          <svg className="boot-splash-blob" viewBox="0 0 200 220" aria-hidden="true">
            <ellipse className="boot-splash-blob-shadow" cx="100" cy="196" rx="58" ry="10" />
            <g className="boot-splash-blob-body-wrap">
              <path
                className="boot-splash-blob-body"
                d="M100.0 36.0 C122.3 36.9, 140.5 42.3, 152.9 61.9 C167.1 75.9, 169.8 95.4, 169.6 108.0 C170.4 123.8, 163.6 139.6, 150.1 151.9 C139.2 166.9, 119.1 175.4, 100.0 180.0 C80.5 174.6, 61.6 168.4, 48.9 152.9 C33.6 142.3, 29.0 123.6, 30.4 108.0 C28.4 92.9, 33.6 74.9, 47.0 62.9 C58.7 44.8, 79.5 37.3, 100.0 36.0 Z"
              />
              <ellipse className="boot-splash-blob-shine" cx="76" cy="78" rx="18" ry="11" />
              <g className="boot-splash-blob-eyes">
                <g>
                  <ellipse className="eye-white" cx="82" cy="104" rx="11" ry="13" />
                  <circle className="eye-pupil" cx="84" cy="106" r="5" />
                </g>
                <g>
                  <ellipse className="eye-white" cx="118" cy="104" rx="11" ry="13" />
                  <circle className="eye-pupil" cx="120" cy="106" r="5" />
                </g>
              </g>
              <path className="boot-splash-blob-mouth" d="M 92 126 Q 100 132 108 126" />
            </g>
          </svg>
        )}

        {/* Keeps the screen visibly alive for the whole holding phase —
            without this, once the logo settles there are a few seconds of
            total stillness that read as the site having frozen rather than
            the boot animation just finishing up. */}
        {phase === 'holding' && (
          <span className="boot-splash-spinner" role="status" aria-label="Loading" />
        )}
      </div>
    </div>
  );
}
