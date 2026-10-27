'use client';

// components/marketing/FeatureOrbit.tsx — homepage "feature wheel"
// section, rebuilt as a safe layout: a row of cartoonic lime "blob"
// cards (one per feature) plus a featured panel showing whichever one
// is active, auto-advancing on a timer. Clicking a card jumps the
// featured panel straight to it.
//
// The previous version positioned items with trigonometry around a
// rotating ring, which clipped/overlapped on real small-phone
// viewports (the maths assumed more clearance than those viewports
// actually had). This version uses plain flex/grid flow instead —
// nothing is ever absolutely positioned on top of anything else, so
// there is no viewport width at which items can overlap.
//
// Feature copy/icons are pulled 1:1 from the real product surfaces —
// four from CapabilitiesAndStats.tsx's TOP_CAPS, plus visitor blocking
// (BlockedVisitorsPanel.tsx) — not invented copy.
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface OrbitFeature {
  id: string;
  title: string;
  body: string;
  icon: ReactNode;
}

const FEATURES: OrbitFeature[] = [
  {
    id: 'visit-logs',
    title: 'Visit logs',
    body: 'Every visit to your site, logged and searchable — pages, timing, referrers.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3m0-8V5a2 2 0 0 0-2-2h-3" />
        <path d="M8 12h3m2 0h3M9.5 9.5v5M14.5 9.5v5" />
      </svg>
    ),
  },
  {
    id: 'email-capture',
    title: 'Email capture widgets',
    body: 'Drop in onboarding flows and lead-capture forms without touching your codebase.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M7 13h4M7 16h7" />
      </svg>
    ),
  },
  {
    id: 'live-overlays',
    title: 'Live overlays',
    body: 'Push a banner, announcement, or full-site maintenance mode instantly, no redeploy.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M4 12h16M4 6h16M4 18h10" />
      </svg>
    ),
  },
  {
    id: 'dashboard',
    title: 'One dashboard',
    body: 'Manage every connected site — leads, logs, and live state — from one place.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="4" width="7" height="7" rx="1.5" />
        <rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="8.5" y="14" width="7" height="7" rx="1.5" />
        <path d="M6.5 11v2.5a1.5 1.5 0 0 0 1.5 1.5h2M17.5 11v2.5A1.5 1.5 0 0 1 16 15h-2" />
      </svg>
    ),
  },
  {
    id: 'visitor-blocking',
    title: 'Visitor blocking',
    body: "See exactly who's visiting and block anyone who shouldn't be there — no code changes, no redeploy.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path d="M5.6 5.6l12.8 12.8" />
      </svg>
    ),
  },
];

const ITEM_COUNT = FEATURES.length;
const AUTO_ADVANCE_MS = 3200;

export function FeatureOrbit() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Touch devices fire onMouseEnter on tap but often never fire a
  // matching onMouseLeave (no cursor to "leave" with), which left this
  // auto-advancing section stuck paused after a single tap. Only real
  // hover-capable pointers (mouse/trackpad) are allowed to pause it this
  // way; checked once since hover capability doesn't change at runtime.
  const canHoverRef = useRef(false);
  useEffect(() => {
    canHoverRef.current = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  }, []);

  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % ITEM_COUNT);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused]);

  const active = FEATURES[activeIndex];

  return (
    <section className="section-heading feature-orbit-heading" style={{ marginTop: 8 }}>
      <h2>Everything orbiting one dashboard</h2>
      <p>
        <span className="mark">Five moving parts</span>, one simple hub — tap one to jump straight to it.
      </p>

      <div
        className="orbit-section"
        onMouseEnter={() => canHoverRef.current && setIsPaused(true)}
        onMouseLeave={() => canHoverRef.current && setIsPaused(false)}
      >
        <div className="orbit-hub" key={active.id}>
          <span className="orbit-hub-icon">{active.icon}</span>
          <h3 className="orbit-hub-title">{active.title}</h3>
          <p className="orbit-hub-body">{active.body}</p>
        </div>

        <div className="orbit-row" role="tablist" aria-label="Features">
          {FEATURES.map((f, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                className={`orbit-item${isActive ? ' is-active' : ''}`}
                onClick={() => setActiveIndex(i)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                aria-selected={isActive}
                aria-label={f.title}
              >
                <span className="orbit-item-icon">{f.icon}</span>
                <span className="orbit-item-label">{f.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
