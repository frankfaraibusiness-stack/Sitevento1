'use client';

// components/marketing/HeroMascot.tsx
//
// Hand-built, hand-animated replacement for the old static PNG
// (public/mascot/hero-bunny.png). Same character — round head, big
// floppy ears, big dark eyes w/ white highlight, small open smile,
// lime body, two arms — rebuilt as layered SVG shapes grouped per
// body part so each can move independently:
//   - .mascot-body-float   whole character idle bob
//   - .mascot-ears         ear sway (slight independent phase per ear)
//   - .mascot-head         head turning "look around"
//   - .mascot-eyes         eyes track opposite/with the head turn
//   - .mascot-eyelid-*     blink (scaleY closing over the pupil/iris)
//   - .mascot-arm-l/-r     arm micro-movement, offset phase
// All animation is CSS transform/opacity only (GPU-friendly), and
// everything respects prefers-reduced-motion (see hero-mascot.css).
// This single bigger character is what fills the leftover header/
// hero space — not more copies of it.

export function HeroMascot() {
  return (
    <div className="hero-mascot" aria-hidden="true">
      <svg
        className="mascot-svg"
        viewBox="0 0 400 420"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4ff6b" />
            <stop offset="100%" stopColor="#9ed631" />
          </linearGradient>
          <linearGradient id="earGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c7fa56" />
            <stop offset="100%" stopColor="#8fc928" />
          </linearGradient>
          <radialGradient id="earInner" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#5f8a1f" />
            <stop offset="100%" stopColor="#3c5c10" />
          </radialGradient>
        </defs>

        {/* ---- tiny scattered sparkle/crystal accents (built-in, replaces HeroDecor) ---- */}
        <g className="mascot-sparkle mascot-sparkle-a" fill="#8f6ff0">
          <path d="M349 18c0 10-2 18-6 22s-12 6-22 6c10 0 18 2 22 6s6 12 6 22c0-10 2-18 6-22s12-6 22-6c-10 0-18-2-22-6s-6-12-6-22z" />
        </g>
        <g className="mascot-sparkle mascot-sparkle-b" fill="#b7f23d">
          <path d="M60 150c0 6-1.3 11-3.7 13.3S47 167 41 167c6 0 11 1.3 13.3 3.7S57 177 57 183c0-6 1.3-11 3.7-13.3S67 167 73 167c-6 0-11-1.3-13.3-3.7S60 156 60 150z" />
        </g>
        <path
          className="mascot-crystal"
          d="M313 55 338 72l-8 32h-26l-8-32z"
          fill="#8f6ff0"
          opacity="0.9"
        />

        {/* ---- whole-body idle float ---- */}
        <g className="mascot-body-float">
          {/* ---- legs (short, tucked — mostly hidden behind torso like reference) ---- */}
          <g className="mascot-leg-l">
            <ellipse cx="178" cy="368" rx="26" ry="20" fill="#9ed631" />
          </g>
          <g className="mascot-leg-r">
            <ellipse cx="228" cy="372" rx="26" ry="20" fill="url(#bodyGrad)" />
          </g>

          {/* ---- torso ---- */}
          <ellipse cx="203" cy="305" rx="78" ry="70" fill="url(#bodyGrad)" />

          {/* ---- arms ---- */}
          <g className="mascot-arm-l" style={{ transformOrigin: '150px 300px' }}>
            <ellipse cx="128" cy="320" rx="26" ry="38" fill="#a8df38" transform="rotate(18 128 320)" />
          </g>
          <g className="mascot-arm-r" style={{ transformOrigin: '258px 300px' }}>
            <ellipse cx="292" cy="290" rx="26" ry="40" fill="url(#bodyGrad)" transform="rotate(-32 292 290)" />
          </g>

          {/* ---- head group: turns for "look around" ---- */}
          <g className="mascot-head" style={{ transformOrigin: '203px 220px' }}>
            {/* ears */}
            <g className="mascot-ear mascot-ear-l" style={{ transformOrigin: '168px 195px' }}>
              <path
                d="M168 195c-28-18-46-66-38-98 4-16 20-22 32-12 22 18 34 70 30 104-6 10-16 12-24 6z"
                fill="url(#earGrad)"
              />
              <path
                d="M163 178c-16-16-26-50-20-74 10 16 22 46 26 74z"
                fill="url(#earInner)"
                opacity="0.85"
              />
            </g>
            <g className="mascot-ear mascot-ear-r" style={{ transformOrigin: '248px 190px' }}>
              <path
                d="M248 190c30-14 54-58 50-90-2-16-18-24-31-15-24 16-42 66-42 100 4 10 14 13 23 5z"
                fill="url(#earGrad)"
              />
              <path
                d="M255 172c18-14 32-46 28-70-12 14-26 42-32 70z"
                fill="url(#earInner)"
                opacity="0.85"
              />
            </g>

            {/* head */}
            <circle cx="203" cy="245" r="92" fill="url(#bodyGrad)" />

            {/* cheeks (soft shading, static) */}
            <ellipse cx="148" cy="262" rx="20" ry="14" fill="#ffffff" opacity="0.18" />

            {/* eyebrows */}
            <path d="M158 198c8-6 18-6 24-1" stroke="#2b3a0f" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M232 196c7-5 17-5 25 1" stroke="#2b3a0f" strokeWidth="5" strokeLinecap="round" fill="none" />

            {/* ---- eyes ---- */}
            <g className="mascot-eyes" style={{ transformOrigin: '203px 235px' }}>
              {/* left eye */}
              <g>
                <circle cx="170" cy="238" r="30" fill="#ffffff" />
                <circle cx="172" cy="239" r="24" fill="#1a1f0a" />
                <circle cx="163" cy="229" r="7" fill="#ffffff" />
                <g className="mascot-eyelid mascot-eyelid-l" style={{ transformOrigin: '170px 238px' }}>
                  <rect x="138" y="206" width="64" height="64" fill="url(#bodyGrad)" />
                </g>
              </g>
              {/* right eye */}
              <g>
                <circle cx="248" cy="234" r="26" fill="#ffffff" />
                <circle cx="250" cy="235" r="21" fill="#1a1f0a" />
                <circle cx="242" cy="226" r="6" fill="#ffffff" />
                <g className="mascot-eyelid mascot-eyelid-r" style={{ transformOrigin: '248px 234px' }}>
                  <rect x="220" y="204" width="58" height="58" fill="url(#bodyGrad)" />
                </g>
              </g>
            </g>

            {/* nose + mouth */}
            <path d="M200 268c3 3 7 3 10 0" stroke="#2b3a0f" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path
              d="M193 278c6 10 22 10 28 0"
              stroke="#2b3a0f"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="#ffffff"
            />
            <path d="M203 283c3 4 8 4 11 0" fill="#f0776b" />
          </g>
        </g>
      </svg>
    </div>
  );
}
