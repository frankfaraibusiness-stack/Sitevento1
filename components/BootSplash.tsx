'use client';

// components/BootSplash.tsx — full-screen splash rendered by AppRoot
// while auth state is resolving (and for a short minimum hold after,
// see the onDone contract below).
//
// The main blot is sized to flood the entire viewport edge-to-edge
// (the SVG viewBox is stretched to 100vw x 100vh with
// preserveAspectRatio="none"), so this reads as the whole screen
// filling with slime rather than a small shape centered in empty
// space. Real spilled paint isn't a smooth circle either, so the main
// blot and its satellite droplets are each generated as an irregular,
// jittered closed path (randomized per mount — no two boots look
// identical), with a jelly squash/stretch wobble instead of a uniform
// scale animation.
//
// Lifecycle has three phases, driven from here (not just CSS), because
// phase 3's duration is randomized and the parent needs to know when
// the whole thing is actually done:
//   1. "forming"  (~3s)   — droplets wobble and gather, spreading
//                           unevenly like paint pooling, growing from
//                           nothing up to flood the full screen.
//   2. "splash"   (~420ms)— a sharp jelly overshoot/snap, like the
//                           paint just hit the surface. The logo is
//                           mounted the instant forming ends and plays
//                           its own bouncy entrance on top.
//   3. "holding"  (3-5s,  — fully formed, idle (a very slight ambient
//       randomized)         jiggle so it doesn't look frozen), then
//                           calls onDone().
//
// onDone is called exactly once, after the full randomized lifecycle
// finishes — NOT tied to how long auth actually takes. The parent
// (AppRoot) is expected to keep rendering BootSplash until onDone
// fires, even if authReady flips true earlier, so the splash always
// gets its full, deliberate screen time rather than flickering by
// instantly on a fast connection. See AppRoot.tsx for how this is
// wired up.
//
// Reduced-motion: skips the wobble/jelly animation entirely and just
// cross-fades the (still irregular, still randomized-shape) blot and
// wordmark in and out on a short fixed timer — still respects the
// person's motion preference, but doesn't fall back to the old clean
// circle.

import { useEffect, useMemo, useState } from 'react';

type Phase = 'forming' | 'splash' | 'holding';

interface BootSplashProps {
  onDone?: () => void;
}

// ---- Irregular blob path generation ------------------------------
// Builds a closed SVG path around a circle of the given radius, but
// jitters each control point outward/inward by a random amount so the
// outline reads as an uneven splatter instead of a perfect round blob.
// Smooth (cubic Bezier through the jittered points) so it still looks
// like viscous paint/jelly, not a jagged polygon.
function makeBlobPath(cx: number, cy: number, baseR: number, jitter: number, points: number, seed: number): string {
  // Simple deterministic-from-seed pseudo-random, so each droplet in a
  // given boot is stable across re-renders within that mount but still
  // differs boot-to-boot (seed itself is randomized once per mount).
  let s = seed;
  function rand() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }

  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const r = baseR + (rand() - 0.5) * jitter * 2;
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }

  // Catmull-Rom-ish smoothing via cubic beziers through the jittered
  // ring, so curves bulge and pinch unevenly rather than being perfect
  // circular arcs — this is what reads as "paint", not "sticker".
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    const c1x = p1.x + (p2.x - p0.x) / 5;
    const c1y = p1.y + (p2.y - p0.y) / 5;
    const c2x = p2.x - (p3.x - p1.x) / 5;
    const c2y = p2.y - (p3.y - p1.y) / 5;
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
  }
  return d + 'Z';
}

interface Droplet {
  path: string;
  cx: number;
  cy: number;
  scale: number;
  delayMs: number;
  durationMs: number;
  wobbleSeed: number;
}

function makeDroplets(seedBase: number): Droplet[] {
  // One big main blot slightly off-center, plus 3-5 smaller satellite
  // droplets scattered around it at random angles/distances — the way
  // a dropped blob of paint always throws off a few smaller flecks
  // rather than landing as one isolated shape.
  const rand = (() => {
    let s = seedBase;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  })();

  const droplets: Droplet[] = [];

  // Main blot: centered, now sized to flood the whole 0-200 viewBox
  // (viewBox is stretched to 100vw x 100vh at render time) so the
  // splash reads as the screen itself filling with slime, not a
  // small shape floating in the middle of empty space.
  const mainCx = 100 + (rand() - 0.5) * 6;
  const mainCy = 100 + (rand() - 0.5) * 6;
  droplets.push({
    path: makeBlobPath(mainCx, mainCy, 150, 22, 12, Math.floor(rand() * 100000)),
    cx: mainCx,
    cy: mainCy,
    scale: 1,
    delayMs: 0,
    durationMs: 2600 + rand() * 600, // ~2.6-3.2s forming
    wobbleSeed: rand() * 1000,
  });

  // Satellite droplets scattered out toward and past the edges of the
  // viewBox, so flecks of "overspill" read past the main flood rather
  // than sitting inside a small central cluster.
  const satelliteCount = 5 + Math.floor(rand() * 4); // 5-8
  for (let i = 0; i < satelliteCount; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 130 + rand() * 90;
    const cx = 100 + Math.cos(angle) * dist;
    const cy = 100 + Math.sin(angle) * dist;
    const r = 14 + rand() * 26;
    droplets.push({
      path: makeBlobPath(cx, cy, r, r * 0.4, 7, Math.floor(rand() * 100000)),
      cx,
      cy,
      scale: 1,
      delayMs: rand() * 400,
      durationMs: 2200 + rand() * 900,
      wobbleSeed: rand() * 1000,
    });
  }

  return droplets;
}

export function BootSplash({ onDone }: BootSplashProps) {
  const [phase, setPhase] = useState<Phase>('forming');

  // Generated once per mount: the droplet shapes, the forming duration
  // actually used (randomized per-droplet above, but we need ONE
  // overall "forming is done" instant to advance the phase), and the
  // randomized 3-5s hold duration for phase 3.
  const { droplets, formingMs, holdMs } = useMemo(() => {
    const seed = Math.floor(Math.random() * 1e9);
    const d = makeDroplets(seed);
    return {
      droplets: d,
      formingMs: 2800 + Math.random() * 400, // settle on ~3s, slight natural variance
      holdMs: 3000 + Math.random() * 2000, // random between 3-5s
    };
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('splash'), formingMs);
    return () => clearTimeout(t1);
  }, [formingMs]);

  useEffect(() => {
    if (phase !== 'splash') return;
    // Splash snap itself is quick (~420ms, matches the CSS animation
    // duration below) before settling into the held, idle phase.
    const t2 = setTimeout(() => setPhase('holding'), 420);
    return () => clearTimeout(t2);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'holding') return;
    const t3 = setTimeout(() => {
      onDone?.();
    }, holdMs);
    return () => clearTimeout(t3);
  }, [phase, holdMs, onDone]);

  return (
    <div className="boot-splash" role="status" aria-label="Loading sitevento">
      <div className={`boot-splash-stage is-${phase}`}>
        <svg
          className="boot-splash-blot-group"
          viewBox="0 0 200 200"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {droplets.map((drop, i) => (
            <path
              key={i}
              className={`boot-splash-droplet${i === 0 ? ' is-main' : ''}`}
              d={drop.path}
              style={{
                // Per-droplet timing variance + a stable-per-mount
                // wobble seed used by the CSS animation-delay trick
                // below, so droplets don't all wobble in perfect unison
                // (which would look mechanical, not jelly-like).
                animationDelay: `${drop.delayMs}ms, ${(drop.wobbleSeed % 900)}ms`,
                animationDuration: `${drop.durationMs}ms, ${2400 + (drop.wobbleSeed % 700)}ms`,
                transformOrigin: `${drop.cx}px ${drop.cy}px`,
              }}
            />
          ))}
        </svg>
        {/* Logo reveal: mounted only once forming is done (phase is no
            longer 'forming'), ~3s in, so it always lands after the
            slime has fully spread rather than racing it. Its own
            entrance animation is driven by the is-splash/is-holding
            CSS below, same as the old wordmark was. */}
        {phase !== 'forming' && (
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
