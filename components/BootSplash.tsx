'use client';

// components/BootSplash.tsx — full-screen splash rendered by AppRoot
// while auth state is still resolving (in place of the old `return
// null`). Plays one orchestrated lime "ink splash" reveal, then the
// sitevento wordmark settles on top. Non-looping — it's only ever on
// screen for the brief window before authReady flips true, and this
// component unmounts the moment that happens.
//
// Reduced-motion: the blot and wordmark just fade in together, no
// scale/morph, per styles/boot-splash.css.

export function BootSplash() {
  return (
    <div className="boot-splash" role="status" aria-label="Loading sitevento">
      <div className="boot-splash-stage">
        <svg
          className="boot-splash-blot"
          viewBox="0 0 200 200"
          width="200"
          height="200"
          aria-hidden="true"
        >
          <path
            className="boot-splash-blot-path"
            d="M100,26 C132,24 160,46 168,76 C176,106 166,132 142,152
               C120,170 90,176 64,164 C36,152 20,126 24,98
               C28,68 50,30 100,26 Z"
          />
        </svg>
        <span className="boot-splash-word">sitevento</span>
      </div>
    </div>
  );
}
