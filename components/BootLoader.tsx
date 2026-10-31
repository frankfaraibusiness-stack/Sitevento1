'use client';

// components/BootLoader.tsx — the lime UFO / blob-drop boot loader,
// wired to real auth instead of a fixed timer.
//
// Visuals (CSS, markup, blob SVGs, ship, progress bar) are an exact
// copy of the standalone spaceship-blobs.html prototype — nothing
// about the look was changed.
//
// Timing contract:
//   - While `authReady` is false: the progress bar fills in a slow
//     indeterminate creep (never reaching 100%) and blobs keep
//     dropping from the ship on a loop, however long auth takes.
//   - The instant `authReady` becomes true: the bar snaps to 100%,
//     blob-dropping stops, and a 4 second hold begins.
//   - After that 4s hold, onDone() fires once so the parent can
//     unmount/hide this loader.
//
// Usage:
//   const [authReady, setAuthReady] = useState(false);
//   // ...resolve auth, then setAuthReady(true)
//   {!booted && <BootLoader authReady={authReady} onDone={() => setBooted(true)} />}

import { useEffect, useRef, useState } from 'react';

interface BootLoaderProps {
  /** True once real auth/session has resolved. The loader will not
   * leave its "waiting" state before this flips true. */
  authReady: boolean;
  /** Called once, after the 4s post-auth hold completes. */
  onDone?: () => void;
}

const LOGO_URL = 'https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png';
const POST_AUTH_HOLD_MS = 4000;

// --- blob SVG markup, ported 1:1 from the prototype's blobSVG() ---
const EYE_SETS = [
  `<circle cx="16" cy="19" r="5.5" fill="#fff" stroke="#1a3a1a" stroke-width="2.5"/>
   <circle cx="30" cy="19" r="5.5" fill="#fff" stroke="#1a3a1a" stroke-width="2.5"/>
   <circle cx="17.5" cy="20" r="2.4" fill="#1a3a1a"/>
   <circle cx="31.5" cy="20" r="2.4" fill="#1a3a1a"/>`,
  `<path d="M11 19 Q16 13 21 19" fill="none" stroke="#1a3a1a" stroke-width="3" stroke-linecap="round"/>
   <path d="M25 19 Q30 13 35 19" fill="none" stroke="#1a3a1a" stroke-width="3" stroke-linecap="round"/>`,
  `<circle cx="16" cy="19" r="6" fill="#fff" stroke="#1a3a1a" stroke-width="2.5"/>
   <circle cx="30" cy="19" r="6" fill="#fff" stroke="#1a3a1a" stroke-width="2.5"/>
   <circle cx="16" cy="19" r="2.8" fill="#1a3a1a"/>
   <circle cx="30" cy="19" r="2.8" fill="#1a3a1a"/>`,
];
const MOUTHS = [
  `<path d="M16 29 Q23 36 30 29" fill="none" stroke="#1a3a1a" stroke-width="3" stroke-linecap="round"/>`,
  `<ellipse cx="23" cy="30" rx="5" ry="4" fill="#ff8fb3" stroke="#1a3a1a" stroke-width="2.5"/>`,
  `<path d="M17 30 Q23 27 29 30" fill="none" stroke="#1a3a1a" stroke-width="3" stroke-linecap="round"/>`,
];

function blobSVG(): string {
  const i = Math.floor(Math.random() * 3);
  return `<svg viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="23" cy="40" rx="15" ry="3" fill="rgba(26,58,26,.12)"/>
    <path d="M23 4
             C33 4 41 13 41 24
             C41 34 33 42 23 42
             C13 42 5 34 5 24
             C5 13 13 4 23 4 Z"
          fill="var(--blob-skin)" stroke="#1a3a1a" stroke-width="3"/>
    <path d="M12 14 Q18 8 26 10" fill="none" stroke="#c9ff7a" stroke-width="4" stroke-linecap="round" opacity=".8"/>
    ${EYE_SETS[i]}
    ${MOUTHS[i]}
    <circle cx="12" cy="30" r="3" fill="#6fcf2a" opacity=".6"/>
    <circle cx="34" cy="27" r="2.2" fill="#6fcf2a" opacity=".6"/>
  </svg>`;
}

export function BootLoader({ authReady, onDone }: BootLoaderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const [complete, setComplete] = useState(false);
  const authReadyRef = useRef(authReady);
  authReadyRef.current = authReady;

  function hatchPoint() {
    const stage = stageRef.current!.getBoundingClientRect();
    const x = stage.width * 0.5 + 5;
    const y = stage.height * 0.32 + 128;
    return { x, y, groundY: stage.height * 0.84 };
  }

  function dropBlob() {
    const field = fieldRef.current;
    if (!field) return;
    const pt = hatchPoint();

    const el = document.createElement('div');
    el.className = 'blob';
    el.innerHTML = blobSVG();

    const spreadX = (Math.random() - 0.5) * 160;
    const targetX = pt.x + spreadX;
    const targetY = pt.groundY + (Math.random() * 14 - 7);
    const dx = targetX - pt.x;
    const dy = targetY - pt.y;
    const rot = Math.random() * 40 - 20;

    el.style.left = pt.x + 'px';
    el.style.top = pt.y - 23 + 'px';
    el.style.setProperty('--dx', dx + 'px');
    el.style.setProperty('--dy', dy + 'px');
    el.style.setProperty('--rot', rot + 'deg');
    const fallDur = 950 + Math.random() * 250;
    el.style.animationDuration = fallDur + 'ms';

    field.appendChild(el);

    setTimeout(() => {
      const splat = document.createElement('div');
      splat.className = 'splat';
      splat.style.left = targetX + 'px';
      splat.style.top = targetY + 'px';
      field.appendChild(splat);
      setTimeout(() => splat.remove(), 700);
    }, fallDur * 0.85);

    setTimeout(() => el.remove(), fallDur + 200);
  }

  // Blob-dropping loop: runs continuously while waiting on auth,
  // stops the moment authReady flips true.
  useEffect(() => {
    let dropTimer: ReturnType<typeof setTimeout>;
    const startDelay = setTimeout(function keepDropping() {
      if (authReadyRef.current) return;
      dropBlob();
      dropTimer = setTimeout(keepDropping, 550);
    }, 1200);
    return () => {
      clearTimeout(startDelay);
      clearTimeout(dropTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress bar: indeterminate creep toward ~92% while waiting,
  // snaps to 100% once auth resolves, then holds 4s before onDone.
  useEffect(() => {
    if (complete) return;
    if (!authReady) {
      const tick = setInterval(() => {
        setPct((p) => (p < 92 ? p + (92 - p) * 0.045 : p));
      }, 80);
      return () => clearInterval(tick);
    }
    // auth just resolved
    setPct(100);
    setComplete(true);
    const hold = setTimeout(() => onDone?.(), POST_AUTH_HOLD_MS);
    return () => clearTimeout(hold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, complete]);

  return (
    <div className="stage" id="stage" ref={stageRef}>
      <div className="sun" />
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="cloud c3" />

      <div className="logo-bar">
        <img src={LOGO_URL} alt="logo" />
      </div>

      <div className="ship-path" id="shipPath">
        <div className="ship">
          <div className="eyebrow eb1" />
          <div className="eyebrow eb2" />
          <div className="saucer-rim" />
          <div className="rim-light l1" />
          <div className="rim-light l2" />
          <div className="rim-light l3" />
          <div className="rim-light l4" />
          <div className="saucer-top" />
          <div className="dome" />
          <div className="hatch" />
        </div>
      </div>

      <div className="blob-field" id="blobField" ref={fieldRef} />

      <div className="loader-bar">
        <div className="loader-track">
          <div
            className="loader-fill"
            id="loaderFill"
            style={{
              width: `${pct}%`,
              animation: 'none',
              transition: complete ? 'width 420ms cubic-bezier(.22,1,.36,1)' : 'width 120ms linear',
            }}
          />
        </div>
        <div className="loader-pct" id="loaderPct">
          {Math.round(pct)}%
        </div>
        <div className="credit">
          FROM <b>SITEVENTO</b>
        </div>
        <div className="about">Find, plan, and book events near you</div>
      </div>

      <style jsx global>{`
        :root {
          --sky-top: #eafc6e;
          --sky-mid: #c8f24e;
          --sky-bottom: #8fe03f;
          --hull: #fff6d8;
          --hull-shade: #ffd23f;
          --hull-dark: #ff9e2c;
          --outline: #1a3a1a;
          --glow: #2bd1c8;
          --blob-skin: #9bef3a;
          --blob-skin-dark: #5fb81e;
          --text: #1a3a1a;
          color-scheme: light;
        }
        .stage {
          position: fixed;
          inset: 0;
          z-index: 9999;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          font-family: 'Baloo 2', 'Comic Sans MS', system-ui, sans-serif;
          color: var(--text);
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: radial-gradient(
            ellipse at 50% -10%,
            #f7ff9e 0%,
            var(--sky-top) 35%,
            var(--sky-mid) 65%,
            var(--sky-bottom) 100%
          );
        }

        .cloud {
          position: absolute;
          background: #ffffff;
          border-radius: 50px;
          opacity: 0.75;
        }
        .cloud::before,
        .cloud::after {
          content: '';
          position: absolute;
          background: #ffffff;
          border-radius: 50%;
        }
        .c1 {
          width: 120px;
          height: 44px;
          top: 10%;
          left: 8%;
          animation: floatX 18s ease-in-out infinite;
        }
        .c1::before {
          width: 60px;
          height: 60px;
          top: -30px;
          left: 10px;
        }
        .c1::after {
          width: 50px;
          height: 50px;
          top: -22px;
          left: 55px;
        }
        .c2 {
          width: 90px;
          height: 34px;
          top: 18%;
          right: 10%;
          animation: floatX 14s ease-in-out infinite reverse;
        }
        .c2::before {
          width: 44px;
          height: 44px;
          top: -22px;
          left: 8px;
        }
        .c2::after {
          width: 36px;
          height: 36px;
          top: -16px;
          left: 42px;
        }
        .c3 {
          width: 70px;
          height: 28px;
          top: 65%;
          left: 4%;
          opacity: 0.5;
          animation: floatX 22s ease-in-out infinite;
        }
        .c3::before {
          width: 34px;
          height: 34px;
          top: -16px;
          left: 6px;
        }
        @keyframes floatX {
          0%,
          100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(30px);
          }
        }

        .sun {
          position: absolute;
          top: -40px;
          right: 8%;
          width: 90px;
          height: 90px;
          background: radial-gradient(circle at 35% 30%, #fff9c4, #ffe14d 55%, #ffb400 100%);
          border-radius: 50%;
          box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.35);
          animation: pulse 3s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.06);
          }
        }

        .loader-bar {
          position: absolute;
          left: 50%;
          bottom: calc(8% + env(safe-area-inset-bottom, 0px));
          transform: translateX(-50%);
          width: min(78%, 420px);
          z-index: 6;
        }
        .loader-track {
          position: relative;
          width: 100%;
          height: 22px;
          background: #eafccb;
          border: 4px solid var(--outline);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: inset 0 3px 6px rgba(26, 58, 26, 0.25);
        }
        .loader-fill {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 0%;
          background: linear-gradient(180deg, #c9ff6a, var(--blob-skin) 55%, var(--blob-skin-dark));
          border-radius: 16px 0 0 16px;
        }
        .loader-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0 10px, transparent 10px 20px);
          animation: stripeMove 1s linear infinite;
        }
        @keyframes stripeMove {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 28px 0;
          }
        }
        .loader-pct {
          text-align: center;
          margin-top: 8px;
          font-size: 13px;
          font-weight: 800;
          color: #2e6b1a;
          -webkit-text-stroke: 0.5px #1a3a1a;
        }
        .credit {
          text-align: center;
          margin-top: 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #3a6b2a;
          opacity: 0.85;
        }
        .credit b {
          color: #1a3a1a;
        }
        .about {
          text-align: center;
          margin-top: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #3a6b2a;
          opacity: 0.75;
        }

        .logo-bar {
          position: absolute;
          top: env(safe-area-inset-top, 0px);
          left: 0;
          right: 0;
          z-index: 5;
          opacity: 0;
          animation: titleIn 1s ease 0.25s forwards;
        }
        .logo-bar img {
          display: block;
          width: 100%;
          height: auto;
        }
        @keyframes titleIn {
          from {
            opacity: 0;
            transform: translateY(-14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .ship-path {
          position: absolute;
          left: 50%;
          top: 32%;
          width: 1px;
          height: 1px;
          animation: shipEntry 3.2s cubic-bezier(0.2, 0.8, 0.25, 1) forwards,
            shipHover 2.4s ease-in-out 3.2s infinite;
        }
        @keyframes shipEntry {
          0% {
            transform: translate(-130vw, -20vh) rotate(-18deg) scale(0.5);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          55% {
            transform: translate(-4vw, 3vh) rotate(8deg) scale(1.08);
          }
          78% {
            transform: translate(3vw, -1vh) rotate(-4deg) scale(1);
          }
          100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
        }
        @keyframes shipHover {
          0%,
          100% {
            transform: translate(0, 0) rotate(-2deg);
          }
          50% {
            transform: translate(0, 12px) rotate(2deg);
          }
        }

        .ship {
          position: relative;
          width: 240px;
          height: 180px;
          margin-left: -120px;
          margin-top: -90px;
        }

        .saucer-top {
          position: absolute;
          left: 40px;
          top: 50px;
          width: 160px;
          height: 90px;
          background: radial-gradient(circle at 35% 25%, #ffffff, var(--hull) 45%, var(--hull-shade) 90%);
          border-radius: 50%;
          border: 5px solid var(--outline);
          box-shadow: inset -10px -14px 0 -6px rgba(255, 158, 44, 0.5);
          z-index: 4;
        }
        .dome {
          position: absolute;
          left: 85px;
          top: 14px;
          width: 70px;
          height: 56px;
          background: radial-gradient(circle at 35% 25%, #d8fff0, var(--glow) 60%, #159488 100%);
          border-radius: 50% 50% 48% 48%;
          border: 5px solid var(--outline);
          box-shadow: inset -6px -8px 0 -2px rgba(0, 0, 0, 0.15);
          z-index: 5;
        }
        .dome::after {
          content: '';
          position: absolute;
          left: 14px;
          top: 8px;
          width: 18px;
          height: 12px;
          background: rgba(255, 255, 255, 0.85);
          border-radius: 50%;
          filter: blur(0.5px);
        }
        .saucer-rim {
          position: absolute;
          left: 5px;
          top: 108px;
          width: 230px;
          height: 52px;
          background: linear-gradient(180deg, var(--hull-shade), var(--hull-dark));
          border-radius: 50%;
          border: 5px solid var(--outline);
          z-index: 3;
        }
        .rim-light {
          position: absolute;
          width: 16px;
          height: 16px;
          background: #fff6b0;
          border: 3px solid var(--outline);
          border-radius: 50%;
          top: 128px;
          box-shadow: 0 0 8px rgba(255, 214, 60, 0.9);
          animation: twinkle 1.2s ease-in-out infinite;
        }
        .rim-light.l1 {
          left: 30px;
          animation-delay: 0s;
        }
        .rim-light.l2 {
          left: 80px;
          animation-delay: 0.2s;
        }
        .rim-light.l3 {
          left: 135px;
          animation-delay: 0.4s;
        }
        .rim-light.l4 {
          left: 185px;
          animation-delay: 0.6s;
        }
        @keyframes twinkle {
          0%,
          100% {
            opacity: 1;
            background: #fff6b0;
          }
          50% {
            opacity: 0.4;
            background: #ffb300;
          }
        }

        .hatch {
          position: absolute;
          left: 100px;
          top: 118px;
          width: 40px;
          height: 22px;
          background: var(--outline);
          border-radius: 50%;
          z-index: 6;
        }
        .hatch::before {
          content: '';
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          background: #0a1a0a;
          animation: hatchGlow 2s ease-in-out infinite;
        }
        @keyframes hatchGlow {
          0%,
          70%,
          100% {
            background: #0a1a0a;
          }
          85% {
            background: var(--blob-skin);
            box-shadow: 0 0 14px var(--blob-skin);
          }
        }

        .eyebrow {
          position: absolute;
          width: 46px;
          height: 10px;
          background: var(--outline);
          border-radius: 10px;
        }
        .eb1 {
          left: 92px;
          top: 24px;
          transform: rotate(-8deg);
        }
        .eb2 {
          left: 148px;
          top: 28px;
          transform: rotate(10deg);
        }

        .blob-field {
          position: absolute;
          inset: 0;
          z-index: 2;
        }
        :global(.blob) {
          position: absolute;
          width: 46px;
          height: 46px;
          top: 40%;
          opacity: 0;
          animation-name: dropFall;
          animation-timing-function: cubic-bezier(0.4, 0, 0.7, 0.4);
          animation-fill-mode: forwards;
        }
        :global(.blob svg) {
          width: 100%;
          height: 100%;
          display: block;
          overflow: visible;
        }
        @keyframes dropFall {
          0% {
            transform: translate(0, 0) scale(0.2) rotate(0deg);
            opacity: 0;
          }
          6% {
            opacity: 1;
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
          80% {
            transform: translate(var(--dx), var(--dy)) scale(1) rotate(var(--rot));
            opacity: 1;
          }
          88% {
            transform: translate(var(--dx), calc(var(--dy) + 4px)) scale(1.4, 0.55) rotate(var(--rot));
          }
          100% {
            transform: translate(var(--dx), calc(var(--dy) + 4px)) scale(1.4, 0.55) rotate(var(--rot));
            opacity: 0;
          }
        }

        :global(.splat) {
          position: absolute;
          width: 56px;
          height: 20px;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, var(--blob-skin), transparent 72%);
          border: 4px solid var(--outline);
          transform: translate(-6px, -10px) scale(0);
          opacity: 0;
          animation: splatPop 650ms ease-out forwards;
        }
        @keyframes splatPop {
          0% {
            transform: translate(-6px, -10px) scale(0);
            opacity: 0;
          }
          35% {
            opacity: 0.95;
            transform: translate(-6px, -10px) scale(1.1);
          }
          100% {
            opacity: 0;
            transform: translate(-6px, -10px) scale(1.5);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .stage * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
