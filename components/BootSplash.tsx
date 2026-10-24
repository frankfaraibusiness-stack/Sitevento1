'use client';

// components/BootSplash.tsx — full-screen splash rendered by AppRoot
// while auth state is resolving (and for a short minimum hold after,
// see the onDone contract below).
//
// Redesign: a "welcome to the app" moment rather than a loading
// spinner — soft drifting gradient atmosphere, the logo arriving
// first, the brand blob rising in underneath it with a toned-down
// (not solid-saturated) lime finish and a continuous idle float/
// breathe/blink loop, and a short welcome line that fades in last.
// Three phases, driven from here (not just CSS), because phase 2's
// arrival timing is staggered across several elements and the parent
// needs to know when the whole thing is actually done:
//   1. "arriving" (~1.1s)  — atmosphere fades in, logo drops/settles
//                             in, blob rises in right after.
//   2. "settled"  (~2.6s)  — everything at rest, blob idles (gentle
//                             float + breathing + occasional blink
//                             and wink), welcome line fades in,
//                             progress dots tick along the bottom.
//   3. "leaving"  (~450ms) — whole splash fades + lifts out, then
//                             onDone() fires once.
//
// Reduced-motion: skips the drift/float loops and plays a single
// short cross-fade instead.

import { useEffect, useMemo, useState } from 'react';

type Phase = 'arriving' | 'settled' | 'leaving';

interface BootSplashProps {
  onDone?: () => void;
}

const WELCOME_LINES = [
  'One script tag. A control panel for your whole site.',
  'Loading your live control panel…',
  'Getting your dashboard ready…',
];

export function BootSplash({ onDone }: BootSplashProps) {
  const [phase, setPhase] = useState<Phase>('arriving');

  // Stable per-mount pick so the line doesn't change if this component
  // re-renders mid-animation.
  const welcomeLine = useMemo(
    () => WELCOME_LINES[Math.floor(Math.random() * WELCOME_LINES.length)],
    []
  );

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('settled'), 1100);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== 'settled') return;
    const t2 = setTimeout(() => setPhase('leaving'), 2600);
    return () => clearTimeout(t2);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t3 = setTimeout(() => {
      onDone?.();
    }, 450);
    return () => clearTimeout(t3);
  }, [phase, onDone]);

  // Mirrors the splash's own background onto <html> for the duration
  // of boot so mobile rubber-band overscroll (which bounces past the
  // fixed, viewport-covering splash) reveals the same tone underneath
  // instead of flashing to something else. base.css owns the actual
  // color value via .is-boot-lime; always cleaned up on unmount so a
  // page navigated to after boot never inherits it.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('is-boot-lime');
    return () => {
      root.classList.remove('is-boot-lime');
    };
  }, []);

  return (
    <div className={`boot-splash is-${phase}`} role="status" aria-label="Loading sitevento">
      <div className="boot-splash-atmosphere" aria-hidden="true">
        <span className="boot-splash-glow boot-splash-glow-a" />
        <span className="boot-splash-glow boot-splash-glow-b" />
        <span className="boot-splash-glow boot-splash-glow-c" />
      </div>

      <div className="boot-splash-stage">
        <div className="boot-splash-mark">
          <img
            className="boot-splash-logo"
            src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
            alt="sitevento"
          />

          <svg className="boot-splash-blob" viewBox="0 0 200 220" aria-hidden="true">
            <defs>
              <linearGradient id="bootBlobFill" x1="0" y1="0" x2="0.3" y2="1">
                <stop offset="0%" stopColor="#dcf7a6" />
                <stop offset="55%" stopColor="#bfe77e" />
                <stop offset="100%" stopColor="#9fc95f" />
              </linearGradient>
            </defs>
            <ellipse className="boot-splash-blob-shadow" cx="100" cy="196" rx="58" ry="10" />
            <g className="boot-splash-blob-body-wrap">
              <path
                className="boot-splash-blob-body"
                d="M100.0 36.0 C122.3 36.9, 140.5 42.3, 152.9 61.9 C167.1 75.9, 169.8 95.4, 169.6 108.0 C170.4 123.8, 163.6 139.6, 150.1 151.9 C139.2 166.9, 119.1 175.4, 100.0 180.0 C80.5 174.6, 61.6 168.4, 48.9 152.9 C33.6 142.3, 29.0 123.6, 30.4 108.0 C28.4 92.9, 33.6 74.9, 47.0 62.9 C58.7 44.8, 79.5 37.3, 100.0 36.0 Z"
              />
              <ellipse className="boot-splash-blob-shine" cx="76" cy="78" rx="18" ry="11" />
              <g className="boot-splash-blob-eyes">
                <g className="boot-splash-blob-eye boot-splash-blob-eye-left">
                  <ellipse className="eye-white" cx="82" cy="104" rx="11" ry="13" />
                  <circle className="eye-pupil" cx="84" cy="106" r="5" />
                </g>
                <g className="boot-splash-blob-eye boot-splash-blob-eye-right">
                  <ellipse className="eye-white" cx="118" cy="104" rx="11" ry="13" />
                  <circle className="eye-pupil" cx="120" cy="106" r="5" />
                </g>
              </g>
              <path className="boot-splash-blob-mouth" d="M 92 126 Q 100 132 108 126" />
              <ellipse className="boot-splash-blob-blush boot-splash-blob-blush-left" cx="66" cy="118" rx="7" ry="4" />
              <ellipse className="boot-splash-blob-blush boot-splash-blob-blush-right" cx="134" cy="118" rx="7" ry="4" />
            </g>
          </svg>
        </div>

        <p className="boot-splash-welcome">{welcomeLine}</p>

        <div className="boot-splash-progress" role="presentation">
          <span className="boot-splash-progress-dot" />
          <span className="boot-splash-progress-dot" />
          <span className="boot-splash-progress-dot" />
        </div>
      </div>
    </div>
  );
}
