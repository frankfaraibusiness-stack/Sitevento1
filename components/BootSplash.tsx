'use client';

// components/BootSplash.tsx — full-screen boot splash rendered by
// AppRoot while auth resolves (and for a deliberate hold after).
//
// Full redesign from the old "loading-spinner-with-a-mascot" splash:
// this is meant to read as the opening moment of a finished, premium
// product — a brand introduction, not a progress indicator borrowed
// from somewhere else. Four phases, driven from here (the CSS only
// reacts to the phase class; all timing/gating logic lives in this
// component so the "don't close before auth is ready" contract is
// explicit and easy to verify):
//
//   1. "arriving"  (~900ms)   — atmosphere fades in, the mascot rises
//                                and settles onto the stage, then
//                                plays a single welcoming wave.
//   2. "connecting" (auth-gated) — mascot idles (breathing float +
//                                natural blink loop, no arm motion),
//                                a connection-status line steps
//                                through a short real sequence
//                                ("Connecting to your site…" →
//                                "Syncing your dashboard…"), and a
//                                slim progress rail fills continuously
//                                left-to-right so the screen always
//                                reads as busy, never stalled. This
//                                phase does NOT advance on its own —
//                                it waits for the `ready` prop (true
//                                once authReady flips in AppRoot).
//   3. "confirmed" (fixed ~3000ms hold, see MIN_CONFIRMED_HOLD_MS) —
//                                starts only once `ready` is true.
//                                Status line settles on a final
//                                confirmation line, the progress rail
//                                completes, the mascot gives one more
//                                small wave. This is the deliberate
//                                "don't vanish the instant auth
//                                resolves" delay the person asked for
//                                — it runs in addition to however long
//                                phase 2 already took, so total boot
//                                time scales with real auth latency
//                                instead of ever feeling clipped.
//   4. "leaving"   (~480ms)    — whole splash fades + lifts out, then
//                                onDone() fires once. AppRoot has
//                                already mounted (and painted, just
//                                hidden) the real page underneath for
//                                the splash's entire lifetime, so this
//                                is a reveal of already-finished
//                                content, never a blank flash.
//
// Reduced-motion: skips every loop/wave and plays a single short
// cross-fade instead, still respecting the same auth gate + hold.
import { useEffect, useMemo, useRef, useState } from 'react';

type Phase = 'arriving' | 'connecting' | 'confirmed' | 'leaving';

interface BootSplashProps {
  /** True once the real app is actually ready to show (authReady in AppRoot). The splash will never leave "connecting" before this flips true, however fast or slow that is. */
  ready: boolean;
  onDone?: () => void;
}

// Deliberate pause after `ready` flips true, before the splash is
// allowed to leave — the "give it a few more seconds so it doesn't
// feel like it just cut off" ask. Runs on top of whatever the
// "connecting" phase already took, never instead of it.
const MIN_CONFIRMED_HOLD_MS = 3000;
const ARRIVE_MS = 900;
const LEAVE_MS = 480;

const CONNECTING_LINES = ['Connecting to your site…', 'Syncing your dashboard…', 'Almost there…'];
const CONFIRMED_LINE = "You're all set.";

export function BootSplash({ ready, onDone }: BootSplashProps) {
  const [phase, setPhase] = useState<Phase>('arriving');
  const [lineIndex, setLineIndex] = useState(0);
  const [waveTick, setWaveTick] = useState(0);
  const [blinking, setBlinking] = useState(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Phase 1 → 2: once the arrival animation has had time to play.
  useEffect(() => {
    const t = setTimeout(() => setPhase('connecting'), reducedMotion ? 60 : ARRIVE_MS);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  // Phase 2: cycles the status line for as long as we're waiting on
  // auth. Stops rotating (and the effect below takes over) the moment
  // `ready` becomes true.
  useEffect(() => {
    if (phase !== 'connecting') return;
    const interval = setInterval(() => {
      if (readyRef.current) return; // frozen on the current line once ready — phase 3 owns the next change
      setLineIndex((i) => (i + 1) % CONNECTING_LINES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [phase]);

  // Phase 2 → 3: only once auth has actually resolved. This is the
  // explicit gate — nothing here is time-based until `ready` is true.
  useEffect(() => {
    if (phase !== 'connecting' || !ready) return;
    setPhase('confirmed');
  }, [phase, ready]);

  // Phase 3 → 4: the deliberate extra hold, timed from the moment we
  // entered "confirmed" (i.e. from the moment auth became ready), not
  // from mount — so it's always a true 3s on top of real auth time.
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

  // One arrival wave, then one farewell wave on "confirmed" — kept as
  // a tick counter (rather than a bare class toggle) so re-entering
  // the same phase (shouldn't normally happen, but defensively) still
  // replays the gesture's keyframe from the start.
  useEffect(() => {
    if (phase === 'connecting' || phase === 'confirmed') {
      setWaveTick((n) => n + 1);
    }
  }, [phase]);

  // Natural, slightly irregular blink loop for the whole time the
  // mascot is on stage — same technique as AuthBlob's blink (real
  // state, not a bare CSS keyframe) so it reads as a glance rather
  // than a mechanical tic.
  useEffect(() => {
    if (reducedMotion) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    function scheduleBlink() {
      const next = 2400 + Math.random() * 2600;
      timeoutId = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 140);
        scheduleBlink();
      }, next);
    }
    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, [reducedMotion]);

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

  const statusLine = phase === 'confirmed' || phase === 'leaving' ? CONFIRMED_LINE : CONNECTING_LINES[lineIndex];
  const stage = phase === 'arriving' ? 'arriving' : 'active';

  return (
    <div className={`boot-splash is-${phase}`} role="status" aria-live="polite" aria-label="Loading sitevento">
      <div className="boot-splash-atmosphere" aria-hidden="true">
        <span className="boot-splash-glow boot-splash-glow-a" />
        <span className="boot-splash-glow boot-splash-glow-b" />
        <span className="boot-splash-glow boot-splash-glow-c" />
      </div>

      <div className="boot-splash-stage">
        <div className={`boot-splash-mark is-${stage}`} key={`wave-${waveTick}`}>
          <svg className="boot-splash-mascot" viewBox="0 0 220 240" aria-hidden="true">
            <defs>
              <linearGradient id="bootMascotFill" x1="0" y1="0" x2="0.3" y2="1">
                <stop offset="0%" stopColor="#e4ffb0" />
                <stop offset="55%" stopColor="#c3f17c" />
                <stop offset="100%" stopColor="#9fc95f" />
              </linearGradient>
              <radialGradient id="bootMascotShade" cx="0.32" cy="0.26" r="0.85">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>

            <ellipse className="boot-mascot-shadow" cx="110" cy="214" rx="56" ry="10" />

            <g className="boot-mascot-body-wrap">
              {/* waving arm — sits behind the body on its near side so the
                  shoulder reads as attached rather than floating */}
              <g className="boot-mascot-arm">
                <path
                  className="boot-mascot-arm-limb"
                  d="M150 132 C 168 122, 182 104, 180 84"
                  fill="none"
                />
                <circle className="boot-mascot-arm-hand" cx="180" cy="84" r="9" />
              </g>

              <path
                className="boot-mascot-body"
                d="M110 40 C133 41, 152 48, 163 68 C176 82, 178 102, 177 115 C178 132, 170 149, 156 161 C145 177, 124 185, 110 189 C90 185, 70 178, 57 161 C42 150, 37 131, 38 115 C36 99, 42 80, 56 68 C68 49, 89 41, 110 40 Z"
              />
              <ellipse className="boot-mascot-shade" cx="110" cy="112" rx="68" ry="72" fill="url(#bootMascotShade)" />
              <ellipse className="boot-mascot-shine" cx="84" cy="84" rx="19" ry="12" />

              <g className={`boot-mascot-eyes${blinking ? ' is-blinking' : ''}`}>
                <g className="boot-mascot-eye boot-mascot-eye-left">
                  <ellipse className="eye-white" cx="90" cy="112" rx="12" ry="14" />
                  <circle className="eye-pupil" cx="92" cy="114" r="5.5" />
                  <circle className="eye-glint" cx="95" cy="110" r="1.8" />
                </g>
                <g className="boot-mascot-eye boot-mascot-eye-right">
                  <ellipse className="eye-white" cx="130" cy="112" rx="12" ry="14" />
                  <circle className="eye-pupil" cx="132" cy="114" r="5.5" />
                  <circle className="eye-glint" cx="135" cy="110" r="1.8" />
                </g>
              </g>

              <path className="boot-mascot-mouth" d="M 98 138 Q 110 146 122 138" />
              <ellipse className="boot-mascot-blush boot-mascot-blush-left" cx="70" cy="128" rx="8" ry="4.5" />
              <ellipse className="boot-mascot-blush boot-mascot-blush-right" cx="150" cy="128" rx="8" ry="4.5" />
            </g>
          </svg>
        </div>

        <img
          className="boot-splash-logo"
          src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
          alt="sitevento"
        />

        <div className="boot-splash-status" aria-live="polite">
          <p className="boot-splash-status-line" key={statusLine}>
            {statusLine}
          </p>
          <div className={`boot-splash-rail${phase === 'confirmed' || phase === 'leaving' ? ' is-complete' : ''}`}>
            <span className="boot-splash-rail-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}
