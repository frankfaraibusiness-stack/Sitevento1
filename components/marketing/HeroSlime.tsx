'use client';

// components/marketing/HeroSlime.tsx — the lime "slime" character that
// fills the empty right-hand column of the desktop hero. Same irregular-
// blob-path technique as BootSplash (so the brand's "jelly" shape stays
// consistent between boot and marketing), but this one is a single
// character with a face: it sits still, blinks, and has a continuous
// soft jelly idle wobble so that side of the hero reads as alive rather
// than a static illustration. Desktop-only — the CSS hides it below the
// breakpoint where the hero collapses to one column.
//
// Unlike BootSplash's droplets (which are randomized per page load),
// this shape is generated once with a fixed seed so the character has a
// consistent, recognizable silhouette every visit rather than a new
// random blob each time — it's a character, not a loading effect.

import { useEffect, useRef, useState } from 'react';

function makeBlobPath(cx: number, cy: number, baseR: number, jitter: number, points: number, seed: number): string {
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

// Fixed seed — a deliberate, consistent silhouette for the character
// rather than a fresh random shape per load.
const BODY_PATH = makeBlobPath(100, 108, 72, 11, 11, 4242);

// Fixed set of small "tech" particles orbiting the character at
// different radii/speeds/phases — reinforces the "high-tech" feel
// without being randomized (so the silhouette stays consistent between
// visits, same philosophy as BODY_PATH's fixed seed above).
const ORBIT_PARTICLES = [
  { radius: 108, size: 10, duration: 11, delay: 0, dir: 1 },
  { radius: 90, size: 7, duration: 9, delay: -3, dir: -1 },
  { radius: 118, size: 6.5, duration: 14, delay: -6, dir: 1 },
  { radius: 98, size: 8.5, duration: 16, delay: -2, dir: -1 },
];

export function HeroSlime() {
  const [blinking, setBlinking] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Blink on an irregular human-ish cadence (2.5-6s apart) rather than
  // a fixed metronome, so it reads as a living eye and not a loop.
  useEffect(() => {
    function scheduleBlink() {
      const next = 2500 + Math.random() * 3500;
      timeoutRef.current = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 160);
        scheduleBlink();
      }, next);
    }
    scheduleBlink();
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div className="hero-slime" aria-hidden="true">
      {/* Soft ambient glow ring behind the character — gives it a
          premium "lit from within" presence instead of sitting flat
          against the backdrop. Pure CSS, no SVG filter cost. */}
      <div className="hero-slime-glow" />

      {/* Small orbiting tech particles — a high-tech accent ring that
          reads as "data/energy" circling the character, each on its
          own independent orbit so it never looks like one mechanical
          loop. */}
      <div className="hero-slime-orbits">
        {ORBIT_PARTICLES.map((p, i) => (
          <span
            key={i}
            className="hero-slime-particle"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              ['--orbit-radius' as string]: `${p.radius}px`,
              ['--orbit-duration' as string]: `${p.duration}s`,
              ['--orbit-dir' as string]: p.dir,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <svg className="hero-slime-svg" viewBox="0 0 200 220">
        <defs>
          {/* Gradient fill instead of a flat lime — gives the body real
              dimension/shine, like a polished jelly surface rather than
              a flat sticker. */}
          <radialGradient id="heroSlimeBodyGradient" cx="35%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#eaffb8" />
            <stop offset="45%" stopColor="var(--lime)" />
            <stop offset="100%" stopColor="#9fe018" />
          </radialGradient>
        </defs>

        {/* Soft contact shadow grounds the character instead of letting
            it float. */}
        <ellipse className="hero-slime-shadow" cx="100" cy="196" rx="58" ry="10" />

        <g className="hero-slime-body-wrap">
          <path className="hero-slime-body" d={BODY_PATH} fill="url(#heroSlimeBodyGradient)" />

          {/* Glossy highlight, like light catching a wet/jelly surface. */}
          <ellipse className="hero-slime-shine" cx="76" cy="78" rx="18" ry="11" />
          {/* Second, smaller highlight for extra "polished" depth. */}
          <ellipse className="hero-slime-shine hero-slime-shine-sm" cx="128" cy="92" rx="7" ry="5" />

          <g className={`hero-slime-eyes${blinking ? ' is-blinking' : ''}`}>
            <g className="hero-slime-eye hero-slime-eye-left">
              <ellipse className="eye-white" cx="82" cy="104" rx="11" ry="13" />
              <circle className="eye-pupil" cx="84" cy="106" r="5" />
              <circle className="eye-sparkle" cx="81.5" cy="102" r="1.6" />
            </g>
            <g className="hero-slime-eye hero-slime-eye-right">
              <ellipse className="eye-white" cx="118" cy="104" rx="11" ry="13" />
              <circle className="eye-pupil" cx="120" cy="106" r="5" />
              <circle className="eye-sparkle" cx="117.5" cy="102" r="1.6" />
            </g>
          </g>

          {/* Small closed smile — kept minimal so it stays friendly, not
              cartoonish/busy at small render sizes. */}
          <path className="hero-slime-mouth" d="M 92 126 Q 100 132 108 126" />
        </g>
      </svg>
    </div>
  );
}
