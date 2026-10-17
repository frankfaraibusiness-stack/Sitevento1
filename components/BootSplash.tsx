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
//   3. "holding"      (3-5s,  — logo sits still (tiny idle breathing so
//       randomized)             it doesn't look frozen), then calls
//                                onDone().
//
// onDone is called exactly once, after the full randomized lifecycle
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
      holdMs: 3000 + Math.random() * 2000, // random 3-5s hold once formed
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
      </div>
    </div>
  );
}
