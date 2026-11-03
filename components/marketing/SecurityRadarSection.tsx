// components/marketing/SecurityRadarSection.tsx
//
// New marketing section, sits after ToolsShowcaseSection — a bigger,
// danger-tinted sibling of LiveStatsSection's radar dial, promoting
// the real security engine: lib/botShield.ts ("SECURITY BOT" —
// Refresh & Click Shield + Form Flood Guard), the same system
// ToolsShowcaseSection's auto-restrict / auto-block tiles reference.
//
// Deliberately does NOT claim to scan site code for "bugs" or
// vulnerabilities — no such feature exists in this codebase (it's a
// behavioral traffic-abuse detector, not a static/code scanner). So
// the copy and the two ticking counters are framed honestly around
// what botShield.ts actually does: restrict bursts of bad traffic
// (moderate verdict, self-expiring) and permanently block severe
// bursts (bots, spam clickers, form-flood scripts) — see that file's
// header comment for the exact thresholds this is describing.
//
// Same simulated-demo honesty level as LiveStatsSection: numbers
// tick on a timer to *illustrate* the live dashboard feel, not to
// claim to be reading this visitor's own real traffic.
'use client';

import { useEffect, useRef, useState } from 'react';

interface Blip {
  id: number;
  x: number;
  y: number;
}

const RADIUS = 120;
const CENTER = 130;

function randomBlipPoint(): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const r = RADIUS * (0.25 + Math.random() * 0.7);
  return { x: CENTER + Math.cos(angle) * r, y: CENTER + Math.sin(angle) * r };
}

export function SecurityRadarSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const [blips, setBlips] = useState<Blip[]>([]);
  const [restricted, setRestricted] = useState(482);
  const [blocked, setBlocked] = useState(127);
  const blipIdRef = useRef(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Same IntersectionObserver-gated interval pattern as
  // LiveStatsSection/LaptopShowcase — the sweep, blips and ticking
  // counters only run while this section is actually on screen.
  useEffect(() => {
    if (!inView) return;

    const blipInterval = window.setInterval(() => {
      const point = randomBlipPoint();
      const id = blipIdRef.current++;
      setBlips((prev) => [...prev.slice(-5), { id, ...point }]);
      // A blip landing is what "catches" a threat — bump one of the
      // two counters at the same cadence a blip appears, so the
      // numbers feel tied to what's drawn rather than independent.
      if (Math.random() < 0.72) {
        setRestricted((v) => v + 1);
      } else {
        setBlocked((v) => v + 1);
      }
    }, 1100);

    return () => window.clearInterval(blipInterval);
  }, [inView]);

  // Blips fade via CSS animation; prune them from state once their
  // animation window has passed so the DOM list doesn't grow forever.
  useEffect(() => {
    if (blips.length === 0) return;
    const t = window.setTimeout(() => {
      setBlips((prev) => prev.slice(1));
    }, 1500);
    return () => window.clearTimeout(t);
  }, [blips]);

  return (
    <section className={`sdr${inView ? ' is-in-view' : ''}`} ref={rootRef} aria-label="Automatic traffic security">
      <div className="sdr-inner">
        <div className="sdr-intro">
          <span className="sdr-eyebrow">Security Bot</span>
          <h2 className="sdr-title">Watching your traffic, around the clock</h2>
          <p className="sdr-copy">
            Bots, spam clickers, and form-flood scripts get restricted or blocked automatically —
            no review needed, no action from you.
          </p>
        </div>

        <div className="sdr-panel">
          <div className="sdr-radar-wrap">
            <div className="sdr-radar-glow" aria-hidden="true" />
            <svg viewBox="0 0 260 260" className="sdr-radar-svg" aria-hidden="true">
              <circle cx={CENTER} cy={CENTER} r={118} className="sdr-ring" />
              <circle cx={CENTER} cy={CENTER} r={84} className="sdr-ring" />
              <circle cx={CENTER} cy={CENTER} r={48} className="sdr-ring" />
              <line x1={CENTER} y1={10} x2={CENTER} y2={250} className="sdr-crosshair" />
              <line x1={10} y1={CENTER} x2={250} y2={CENTER} className="sdr-crosshair" />
              <g className="sdr-sweep-group">
                <path
                  d={`M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - 118} A 118 118 0 0 0 ${CENTER - 83.5} ${CENTER - 83.5} Z`}
                  className="sdr-sweep"
                />
              </g>
              {blips.map((b) => (
                <circle key={b.id} cx={b.x} cy={b.y} r={5} className="sdr-blip" />
              ))}
              <circle cx={CENTER} cy={CENTER} r={6} className="sdr-core" />
            </svg>
          </div>

          <div className="sdr-counters">
            <div className="sdr-live-pill">
              <span className="sdr-live-dot" />
              Live protection
            </div>

            <div className="sdr-counter-row">
              <div className="sdr-counter sdr-counter-restrict">
                <span className="sdr-counter-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l4 2" />
                  </svg>
                </span>
                <span className="sdr-counter-value">{restricted.toLocaleString()}</span>
                <span className="sdr-counter-label">Threats restricted</span>
              </div>

              <div className="sdr-counter sdr-counter-block">
                <span className="sdr-counter-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M5.5 5.5l13 13" />
                  </svg>
                </span>
                <span className="sdr-counter-value">{blocked.toLocaleString()}</span>
                <span className="sdr-counter-label">Bots &amp; spam blocked</span>
              </div>
            </div>

            <p className="sdr-footnote">Across every site connected to sitevento, this month.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
