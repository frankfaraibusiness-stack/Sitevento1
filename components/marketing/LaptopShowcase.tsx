'use client';

import { useEffect, useRef, useState } from 'react';
import { SitesConnectedStat } from './CartoonMobileHero';

// components/marketing/LaptopShowcase.tsx
//
// Full rebuild (second pass). The previous version had 5 steps packed
// into the laptop screen — a code card, a spinner panel, a check
// panel, a 4-stat grid, and a shield/badges panel — plus a 5-dot
// progress row under the screen AND a 5-row synced list in the right
// column. Too much text and too many dots for what's meant to be a
// quick, legible glance: on desktop the right-column copy also used
// pale lilac/violet tones (--text-1 / --text-2) meant for the dark
// screen's own color-scheme, sitting directly on the site's light
// --app-bg background, so it barely registered as readable.
//
// Rebuilt clean and small:
//   - Down to 3 steps — Connect, Verify, Live — the actual flow, not
//     padded out to match an unrelated 5-item hero list.
//   - The laptop screen itself is now light, matching the rest of the
//     site's light mode (white/--app-bg-tinted panel, --ink text)
//     instead of a separate dark violet theme living inside it.
//   - No more dot row under the screen — the right-column numbered
//     list (desktop) / the screen's own step label (mobile) is enough
//     to show progress; a second redundant indicator was just clutter.
//   - Right-column step text now uses the site's real light-mode ink
//     colors (--ink / --surface-ink-soft), with a solid lime chip
//     (not a translucent highlight) marking the active step, so it
//     actually stands out against the light page background instead
//     of a low-contrast glow.
//
// Still lightweight by construction: one `step` index advanced on a
// plain setInterval, a single CSS opacity cross-fade between panels,
// no per-frame DOM work. The existing IntersectionObserver `.is-paused`
// gating (stop advancing + freeze animations off-screen) is unchanged.
//
// Desktop layout is unchanged in shape: laptop on the left, a
// numbered steps column on the right, kept in sync via the
// [data-step] attribute on the section root. Mobile: single column,
// just the laptop (its own step label does the job there).
const STEPS = [
  {
    title: 'Connect your site',
    desc: 'Paste one script tag into your site\u2019s <head>.',
  },
  {
    title: 'Verify the tag',
    desc: 'We check your page for the sitevento tag.',
  },
  {
    title: 'You\u2019re live',
    desc: 'Data starts flowing in immediately \u2014 no rebuild.',
  },
];

const STEP_COUNT = STEPS.length;
const STEP_DURATION_MS = 2400;

export function LaptopShowcase() {
  const rootRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let intervalId: number | undefined;

    const start = () => {
      if (intervalId !== undefined) return;
      if (prefersReducedMotion) return; // stay on step 0, no auto-advance
      intervalId = window.setInterval(() => {
        setStep((s) => (s + 1) % STEP_COUNT);
      }, STEP_DURATION_MS);
    };
    const stop = () => {
      if (intervalId === undefined) return;
      window.clearInterval(intervalId);
      intervalId = undefined;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        root.classList.toggle('is-paused', !entry.isIntersecting);
        if (entry.isIntersecting) {
          start();
        } else {
          stop();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(root);

    return () => {
      stop();
      observer.disconnect();
    };
  }, []);

  return (
    <section className="sv-laptop-demo" ref={rootRef} data-step={step} aria-label="How connecting your site works">
      {/* Mobile-only (hidden at 1024px+): the sites-connected stat,
          centered above the laptop stage. Desktop renders this same
          stat under the hero instead (.dhero__statStrip). */}
      <div className="sv-stat-strip">
        <SitesConnectedStat />
      </div>

      <div className="sv-laptop-demo-grid">
        <div className="stage">
          <div className="laptop">
            <div className="screen-wrap">
              <div className="screen">
                <div className="browser-bar">
                  <div className="traffic"><span /><span /><span /></div>
                  <div className="addr-field">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5z" /></svg>
                    <span className="addr-text"><span className="proto">https://</span><span className="typed">yoursite.com</span><span className="caret" /></span>
                  </div>
                </div>

                <div className="cstep-stage">
                  {/* Step 1 — connect: the script tag */}
                  <div className={`cstep-panel${step === 0 ? ' is-active' : ''}`}>
                    <div className="cstep-codecard">
                      <span className="cstep-codeline">&lt;head&gt;</span>
                      <span className="cstep-codeline is-tag">
                        <span className="tag-punc">&lt;script</span>
                        <span className="tag-attr">&nbsp;src=</span>
                        <span className="tag-val">&quot;sitevento.js&quot;</span>
                        <span className="tag-attr">&nbsp;defer</span>
                        <span className="tag-punc">&gt;&lt;/script&gt;</span>
                        <span className="cs-caret" />
                      </span>
                      <span className="cstep-codeline">&lt;/head&gt;</span>
                    </div>
                  </div>

                  {/* Step 2 — verifying */}
                  <div className={`cstep-panel${step === 1 ? ' is-active' : ''}`}>
                    <div className="cstep-center">
                      <div className="cstep-spinner" aria-hidden="true" />
                      <span className="cstep-sub">Checking your site for the tag&hellip;</span>
                    </div>
                  </div>

                  {/* Step 3 — live */}
                  <div className={`cstep-panel${step === 2 ? ' is-active' : ''}`}>
                    <div className="cstep-center">
                      <div className="cstep-check" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6"><path d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="cstep-sub">You&apos;re connected &mdash; data is live</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="base" />
          </div>
          <div className="shadow-pool" />
        </div>

        {/* Desktop-only right column (hidden below 1024px). Synced to
            the laptop's current panel via [data-step] on the section
            root, same mechanism the laptop uses internally. */}
        <ol className="sv-steps-col" aria-label="How it works">
          {STEPS.map((s, index) => (
            <li className="sv-step-row" key={s.title}>
              <span className="sv-step-num" aria-hidden="true">{index + 1}</span>
              <div className="sv-step-copy">
                <span className="sv-step-title">{s.title}</span>
                <span className="sv-step-desc">{s.desc}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
