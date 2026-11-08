'use client';

// components/marketing/LiveStatsSection.tsx
//
// New early/introductory marketing section, sitting right after
// LaptopShowcase. Two halves:
//
//   1. "One script. No rebuild." — a short, plain-language intro
//      panel (headline + one line + the same script-tag line
//      LaptopShowcase's step 1 already shows), reusing language
//      already established on the page rather than introducing new
//      claims.
//   2. A live-feeling stats demo: a cartoon-styled radar/scanner dial
//      plus 6 stat cards whose numbers gently tick up/down on an
//      interval — same spirit as the dashboard-metrics.html
//      reference, rebuilt in the site's own cartoon language (thick
//      ink borders, flat offset "sticker" shadows, lime/purple/
//      accent fills) instead of its soft glassy/blurred look, so it
//      reads as part of this site rather than a pasted-in widget.
//
// This is clearly a *simulated* demo (ticking numbers on a timer),
// same honesty level as LaptopShowcase's own step cycle — it's
// illustrating what the real dashboard looks like once connected,
// not claiming to be live data from this page. The six metrics
// (visits, active now, widgets live, blocked, uptime, agent replies)
// are drawn from what the product actually tracks/does (see
// components/dashboard/VisitsChartCard.tsx, components/bot-shield,
// components/agent) rather than invented categories.
//
// Mobile (below 760px): only the first 4 cards render initially,
// with a "Show more" pill that expands the other 2 in place — see
// .lss-card.is-extra + .lss-stats.is-expanded in
// live-stats-section.css. Desktop (760px+): all 6 show at once in a
// grid, no expand control (the CSS hides the toggle there).
//
// Same IntersectionObserver-gated interval pattern as
// LaptopShowcase.tsx: ticking (and the radar sweep/blips) stops the
// instant this section scrolls off-screen and resumes from wherever
// it left off when it's back in view.
import { useEffect, useRef, useState, type ReactNode } from 'react';

type MetricKey = 'visits' | 'active' | 'widgets' | 'blocked' | 'uptime' | 'replies';

interface MetricDef {
  key: MetricKey;
  label: string;
  sub: string;
  theme: 'lime' | 'purple' | 'blue' | 'orange';
  icon: ReactNode;
  start: number;
  step: [number, number];
  format: (v: number) => string;
  /** Floor/ceiling so the tick never wanders somewhere nonsensical (e.g. uptime past 100%). */
  min: number;
  max: number;
}

const METRICS: MetricDef[] = [
  {
    key: 'visits',
    label: 'Visits',
    sub: 'Page views today',
    theme: 'lime',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    start: 12480,
    step: [3, 9],
    format: (v) => Math.round(v).toLocaleString(),
    min: 0,
    max: Infinity,
  },
  {
    key: 'active',
    label: 'Active now',
    sub: 'Visitors on your site',
    theme: 'purple',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 18.5V20" />
        <circle cx="9.5" cy="8" r="3.5" />
        <path d="M16 15.2a3.5 3.5 0 0 1 0 6.8" />
        <path d="M15 4.3a3.5 3.5 0 0 1 0 6.8" />
      </svg>
    ),
    start: 42,
    step: [-1, 2],
    format: (v) => Math.round(v).toLocaleString(),
    min: 1,
    max: Infinity,
  },
  {
    key: 'widgets',
    label: 'Widgets live',
    sub: 'Running on your site',
    theme: 'blue',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18" />
      </svg>
    ),
    start: 3,
    step: [0, 0],
    format: (v) => Math.round(v).toLocaleString(),
    min: 0,
    max: Infinity,
  },
  {
    key: 'blocked',
    label: 'Blocked',
    sub: 'Bots & bad traffic',
    theme: 'orange',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4 6v6c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V6l-8-3Z" />
        <path d="m9.5 9.5 5 5m0-5-5 5" />
      </svg>
    ),
    start: 87,
    step: [0, 2],
    format: (v) => Math.round(v).toLocaleString(),
    min: 0,
    max: Infinity,
  },
  {
    key: 'uptime',
    label: 'Uptime',
    sub: 'Last 30 days',
    theme: 'lime',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    start: 99.98,
    step: [-0.01, 0.01],
    format: (v) => v.toFixed(2) + '%',
    min: 99.5,
    max: 100,
  },
  {
    key: 'replies',
    label: 'Agent replies',
    sub: 'Handled automatically',
    theme: 'purple',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16v11H7l-3 3V5Z" />
        <path d="M8 10h8M8 13h5" />
      </svg>
    ),
    start: 214,
    step: [0, 1],
    format: (v) => Math.round(v).toLocaleString(),
    min: 0,
    max: Infinity,
  },
];

const TICK_MS = 1400;

export function LiveStatsSection() {
  const rootRef = useRef<HTMLElement>(null);
  const valuesRef = useRef<Record<MetricKey, number>>(
    Object.fromEntries(METRICS.map((m) => [m.key, m.start])) as Record<MetricKey, number>,
  );
  const [display, setDisplay] = useState<Record<MetricKey, number>>(valuesRef.current);
  const [expanded, setExpanded] = useState(false);
  const [blips, setBlips] = useState<{ id: number; x: number; y: number }[]>([]);
  const blipIdRef = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let tickId: number | undefined;
    let blipId: number | undefined;

    const tick = () => {
      const next = { ...valuesRef.current };
      // Nudge 2-3 random metrics per tick rather than all 6 at once,
      // so it reads as organic activity instead of a uniform counter.
      const keys = METRICS.map((m) => m.key);
      const touched = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < touched; i++) {
        const k = keys[Math.floor(Math.random() * keys.length)];
        const def = METRICS.find((m) => m.key === k)!;
        const [lo, hi] = def.step;
        const delta = lo + Math.random() * (hi - lo);
        next[k] = Math.min(def.max, Math.max(def.min, next[k] + delta));
      }
      valuesRef.current = next;
      setDisplay(next);
    };

    const spawnBlip = () => {
      const angle = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 46;
      const x = 72 + Math.cos(angle) * r;
      const y = 72 + Math.sin(angle) * r;
      const id = blipIdRef.current++;
      setBlips((prev) => [...prev.slice(-5), { id, x, y }]);
      window.setTimeout(() => {
        setBlips((prev) => prev.filter((b) => b.id !== id));
      }, 1400);
    };

    const start = () => {
      if (prefersReducedMotion) return;
      if (tickId === undefined) tickId = window.setInterval(tick, TICK_MS);
      if (blipId === undefined) blipId = window.setInterval(spawnBlip, 650);
    };
    const stop = () => {
      if (tickId !== undefined) {
        window.clearInterval(tickId);
        tickId = undefined;
      }
      if (blipId !== undefined) {
        window.clearInterval(blipId);
        blipId = undefined;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        root.classList.toggle('is-paused', !entry.isIntersecting);
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0.1 },
    );
    observer.observe(root);

    return () => {
      stop();
      observer.disconnect();
    };
  }, []);

  const primary = METRICS.slice(0, 4);
  const extra = METRICS.slice(4);

  return (
    <section className="lss" ref={rootRef} aria-label="What you see once you're connected">
      <div className="lss-inner">
        {/* ---- Intro half: "One script. No rebuild." ---- */}
        <div className="lss-intro">
          <span className="lss-eyebrow">How it works</span>
          <h2 className="lss-title">One script. No rebuild.</h2>
          <p className="lss-copy">
            Paste a single tag into your site&apos;s &lt;head&gt; — nothing else about your site changes. No
            migration, no new framework, no redeploy pipeline. The moment it&apos;s live, sitevento starts
            watching.
          </p>
          <div className="lss-tagline">
            <code className="lss-tag-code">&lt;script src=&quot;sitevento.js&quot; defer&gt;&lt;/script&gt;</code>
          </div>
        </div>

        {/* ---- Live demo half: radar + ticking stat cards ---- */}
        <div className="lss-demo">
          <div className="lss-radar-row">
            <div className="lss-radar" aria-hidden="true">
              <div className="lss-radar-glow" />
              <svg viewBox="0 0 144 144" className="lss-radar-svg">
                <circle cx="72" cy="72" r="64" className="lss-radar-ring" />
                <circle cx="72" cy="72" r="46" className="lss-radar-ring" />
                <circle cx="72" cy="72" r="26" className="lss-radar-ring" />
                <g className="lss-radar-sweep-group">
                  <path d="M 72 72 L 72 8 A 64 64 0 0 0 26.7 26.7 Z" className="lss-radar-sweep" />
                </g>
                {blips.map((b) => (
                  <circle key={b.id} cx={b.x} cy={b.y} r={3.4} className="lss-radar-blip" />
                ))}
                <circle cx="72" cy="72" r="4.5" className="lss-radar-core" />
              </svg>
            </div>
            <div className="lss-radar-caption">
              <span className="lss-live-pill">
                <span className="lss-live-dot" />
                Live on your dashboard
              </span>
              <p>Every visit, block, and agent reply shows up the moment it happens.</p>
            </div>
          </div>

          <div className={`lss-stats${expanded ? ' is-expanded' : ''}`}>
            {primary.map((m) => (
              <StatCard key={m.key} metric={m} value={display[m.key]} />
            ))}
            {extra.map((m) => (
              <StatCard key={m.key} metric={m} value={display[m.key]} extra />
            ))}
          </div>

          <button
            type="button"
            className="lss-expand-btn"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show less' : 'Show 2 more'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

function StatCard({ metric, value, extra }: { metric: MetricDef; value: number; extra?: boolean }) {
  return (
    <div className={`lss-card theme-${metric.theme}${extra ? ' is-extra' : ''}`}>
      <div className="lss-card-top">
        <span className="lss-card-icon">{metric.icon}</span>
        <span className="lss-card-label">{metric.label}</span>
      </div>
      <span className="lss-card-value">{metric.format(value)}</span>
      <span className="lss-card-sub">{metric.sub}</span>
    </div>
  );
}
