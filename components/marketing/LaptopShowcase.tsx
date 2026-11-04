'use client';

import { useEffect, useRef, useState } from 'react';
import { HOW_IT_WORKS_STEPS } from './CartoonMobileHero';

// components/marketing/LaptopShowcase.tsx
//
// Full rebuild. This used to mimic a generic "watch a website load"
// sequence (fake storefront nav/hero/cards, a chat widget, a
// simulated cursor clicking around) driven by a JS loop that measured
// DOM positions and wrote inline transforms every ~650ms, on top of
// ~8 `infinite` CSS animations and several backdrop-filter/filter
// blurs — all compositing non-stop, which is what was making the page
// laggy on scroll.
//
// It now mirrors the 5 steps the hero itself already lists (see
// ROTATOR_WORDS / the numbered steps in CartoonMobileHero.tsx):
//   1. Paste the script tag  — mimics pasting the sitevento meta
//      script onto the page
//   2. Verifying              — spinner, "Checking your site…"
//   3. Connected               — green check, "Connected!"
//   4. Control panel          — a small stat grid, echoing "Control
//      everything"
//   5. 24/7 Security          — a shield + status badges
//
// Lighter by construction, not just gated: advancing `step` is one
// React state update on a plain setInterval — no per-frame cursor
// math, no getBoundingClientRect calls, no inline style writes. Which
// of the 5 panels shows is a single CSS opacity cross-fade keyed off
// that index (styles/marketing/laptop-showcase.css's `.cstep-panel`),
// so there's no DOM measurement at all.
//
// The existing IntersectionObserver-driven `.is-paused` pattern is
// kept: the interval itself stops (not just the CSS) the instant this
// section scrolls off-screen, and resumes from wherever it left off
// once it's back in view.
//
// Desktop layout: this section is now two columns — the laptop on
// the left, a numbered steps list on the right (same 5 labels as
// HOW_IT_WORKS_STEPS, reused from CartoonMobileHero.tsx rather than
// duplicated), with the step currently highlighted in that list kept
// in sync with whichever panel the laptop is showing. This fills the
// gap left by the desktop hero, which — unlike the mobile hero —
// doesn't render a steps list of its own (see
// .cartoon-hero--desktop .hero__inner in marketing-hero.css). Mobile
// is unchanged: a single column with just the laptop, since the
// mobile hero above it already has its own steps list.
const STEP_COUNT = 5;
const STEP_DURATION_MS = 2200;

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
                <div className="reload-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>
                </div>
              </div>

              <div className="cstep-stage">
                {/* Step 1 — paste the script tag */}
                <div className={`cstep-panel${step === 0 ? ' is-active' : ''}`}>
                  <span className="cstep-label"><span className="cstep-label-dot" />Step 1 — Connect your site</span>
                  <div className="cstep-codecard">
                    <span className="cstep-codeline">&lt;head&gt;</span>
                    <span className="cstep-codeline">&nbsp;&nbsp;…</span>
                    <span className="cstep-codeline is-tag">
                      <span className="tag-punc">&lt;script</span>
                      <span className="tag-attr">&nbsp;src=</span>
                      <span className="tag-val">&quot;sitevento.js&quot;</span>
                      <span className="tag-attr">&nbsp;data-site=</span>
                      <span className="tag-val">&quot;your-id&quot;</span>
                      <span className="tag-attr">&nbsp;defer</span>
                      <span className="tag-punc">&gt;&lt;/script&gt;</span>
                      <span className="cs-caret" />
                    </span>
                    <span className="cstep-codeline">&lt;/head&gt;</span>
                  </div>
                </div>

                {/* Step 2 — verifying */}
                <div className={`cstep-panel${step === 1 ? ' is-active' : ''}`}>
                  <span className="cstep-label"><span className="cstep-label-dot" />Step 2 — Verify the meta tag</span>
                  <div className="cstep-center">
                    <div className="cstep-spinner" aria-hidden="true" />
                    <span className="cstep-sub">Looking for the sitevento tag on your page</span>
                  </div>
                </div>

                {/* Step 3 — connected */}
                <div className={`cstep-panel${step === 2 ? ' is-active' : ''}`}>
                  <span className="cstep-label"><span className="cstep-label-dot" />Step 3 — Connected</span>
                  <div className="cstep-center">
                    <div className="cstep-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="cstep-sub">Your site is now sending data to sitevento</span>
                  </div>
                </div>

                {/* Step 4 — control panel */}
                <div className={`cstep-panel${step === 3 ? ' is-active' : ''}`}>
                  <span className="cstep-label"><span className="cstep-label-dot" />Step 4 — Control everything</span>
                  <div className="cstep-panel-grid">
                    <div className="cstep-stat">
                      <span className="cstep-stat-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h4l2 5 4-14 2 9 2-5h4" /></svg>
                        Visitors today
                      </span>
                      <span className="cstep-stat-value">1,248</span>
                    </div>
                    <div className="cstep-stat">
                      <span className="cstep-stat-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>
                        Status
                      </span>
                      <span className="cstep-stat-value is-green">Live</span>
                    </div>
                    <div className="cstep-stat">
                      <span className="cstep-stat-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18" /></svg>
                        Widgets
                      </span>
                      <span className="cstep-stat-value">3 active</span>
                    </div>
                    <div className="cstep-stat">
                      <span className="cstep-stat-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /></svg>
                        Sites
                      </span>
                      <span className="cstep-stat-value">1 connected</span>
                    </div>
                  </div>
                </div>

                {/* Step 5 — 24/7 security */}
                <div className={`cstep-panel${step === 4 ? ' is-active' : ''}`}>
                  <span className="cstep-label"><span className="cstep-label-dot" />Step 5 — 24/7 Security</span>
                  <div className="cstep-center">
                    <div className="cstep-shield" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
                    </div>
                    <div className="cstep-badge-row">
                      <span className="cstep-badge"><span className="cstep-badge-dot" />Bot shield on</span>
                      <span className="cstep-badge"><span className="cstep-badge-dot" />Alerts on</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="cstep-dots" aria-hidden="true">
                <span /><span /><span /><span /><span />
              </div>
            </div>
          </div>
          <div className="base" />
        </div>
        <div className="shadow-pool" />
      </div>

      {/* Desktop-only right column (hidden below 1024px — see
          .sv-steps-col in laptop-showcase.css). Highlights the step
          matching the laptop's current panel via [data-step] on the
          section above, same mechanism as the laptop's own
          .cstep-dots, so no extra JS state is needed here. */}
      <ol className="sv-steps-col" aria-label="How it works">
        {HOW_IT_WORKS_STEPS.map((label, index) => (
          <li className="sv-step-row" key={label}>
            <span className="sv-step-num" aria-hidden="true">{index + 1}</span>
            <div className="sv-step-copy">
              <span className="sv-step-title">{label}</span>
              <span className="sv-step-desc">{STEP_DESCRIPTIONS[index]}</span>
            </div>
          </li>
        ))}
      </ol>
      </div>
    </section>
  );
}

// Short one-liners under each step label on desktop — the mobile
// steps list (CartoonMobileHero.tsx) only has room for the label
// itself, but this column has space, and a bare numbered label list
// with nothing else wouldn't do much to sell what each step is.
const STEP_DESCRIPTIONS = [
  'Paste one script tag into your site\u2019s <head>.',
  'We check your page for the sitevento tag.',
  'You\u2019re live \u2014 data starts flowing in immediately.',
  'See visitors, manage widgets, and more.',
  'Bot shielding and alerts run around the clock.',
];
