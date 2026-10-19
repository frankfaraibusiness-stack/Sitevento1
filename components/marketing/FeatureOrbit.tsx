'use client';

// components/marketing/FeatureOrbit.tsx — new homepage section: an
// animated, cartoon-like "feature wheel". A ring of real product
// feature icons orbits a pulsing center hub (reusing the same
// rotating-ring / per-item --dot-x,--dot-y offset technique as
// BootSplash, see styles/boot-splash.css), auto-advancing through the
// features one at a time. Hovering or clicking an orbit item jumps the
// hub straight to that feature; otherwise it auto-rotates on its own
// timer.
//
// Items counter-rotate against the ring's own rotation (via an inline
// --spin-duration-synced counter-animation) so icons stay upright while
// the ring turns, same "clock hands, not tumbling dice" approach as the
// boot splash dots.
//
// Feature copy/icons are pulled 1:1 from the real product surfaces —
// four from CapabilitiesAndStats.tsx's TOP_CAPS, plus visitor blocking
// (BlockedVisitorsPanel.tsx) — not invented copy.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

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
const RING_SPIN_S = 26; // slow, full rotation period for the whole ring

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

  // Stage width varies responsively via CSS (min(92vw,420px) desktop,
  // min(88vw,320px) at the 640px breakpoint — see feature-orbit.css),
  // so the orbit radius is derived from the *actual rendered* stage
  // size rather than a fixed JS constant — otherwise a fixed radius
  // sized for the 420px desktop stage would push items past the edge
  // of the smaller mobile stage. Recomputed on resize.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState(420);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageSize(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Orbit items are 60px (44px at/under the 360px breakpoint, 48px
  // between that and 640px) — keep the ring comfortably inside the
  // stage by sizing the radius as a fraction of the actual stage width
  // rather than a fixed pixel value. The hub itself also shrinks at
  // these widths (see feature-orbit.css), so its own radius has to be
  // subtracted here too — otherwise, on real small phones (320px and
  // up), the ring radius and the hub's edge land close enough that the
  // orbit items clip the hub as they swing past it.
  const itemHalf = stageSize <= 360 ? 22 : stageSize <= 480 ? 24 : 30;
  const hubRadius = stageSize <= 360 ? stageSize * 0.23 : stageSize <= 480 ? stageSize * 0.26 : stageSize * 0.28;
  const minClearance = stageSize <= 360 ? 14 : 10;
  const radius = Math.max(stageSize / 2 - itemHalf - 6, hubRadius + itemHalf + minClearance, 40);

  // Stable positions around the ring — evenly spaced, same --dot-x/
  // --dot-y offset technique as BootSplash — recomputed whenever the
  // measured stage radius changes.
  const positions = useMemo(() => {
    return FEATURES.map((_, i) => {
      const angleDeg = (360 / ITEM_COUNT) * i;
      const rad = (angleDeg * Math.PI) / 180;
      const x = Math.sin(rad) * radius;
      const y = -Math.cos(rad) * radius;
      return { x, y };
    });
  }, [radius]);

  const active = FEATURES[activeIndex];

  return (
    <section className="section-heading feature-orbit-heading" style={{ marginTop: 8 }}>
      <h2>Everything orbiting one dashboard</h2>
      <p>
        <span className="mark">Five moving parts</span>, one simple hub — watch them circle, or tap one to jump
        straight to it.
      </p>

      <div
        className="orbit-section"
        onMouseEnter={() => canHoverRef.current && setIsPaused(true)}
        onMouseLeave={() => canHoverRef.current && setIsPaused(false)}
      >
        <div
          className="orbit-stage"
          ref={stageRef}
          style={{ ['--ring-spin-duration' as string]: `${RING_SPIN_S}s` }}
        >
          <div className={`orbit-ring${isPaused ? ' is-paused' : ''}`}>
            {FEATURES.map((f, i) => {
              const { x, y } = positions[i];
              const isActive = i === activeIndex;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`orbit-item${isActive ? ' is-active' : ''}`}
                  style={{
                    ['--dot-x' as string]: `${x}px`,
                    ['--dot-y' as string]: `${y}px`,
                  }}
                  onClick={() => setActiveIndex(i)}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  aria-pressed={isActive}
                  aria-label={f.title}
                >
                  <span className="orbit-item-icon">{f.icon}</span>
                </button>
              );
            })}
          </div>

          <div className="orbit-hub" key={active.id}>
            <span className="orbit-hub-icon">{active.icon}</span>
            <h3 className="orbit-hub-title">{active.title}</h3>
            <p className="orbit-hub-body">{active.body}</p>
          </div>
        </div>

        <div className="orbit-dots-nav" role="tablist" aria-label="Features">
          {FEATURES.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={f.title}
              className={`orbit-nav-dot${i === activeIndex ? ' is-active' : ''}`}
              onClick={() => setActiveIndex(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
