'use client';

// components/onboarding/OnboardingFlow.tsx
//
// Full-screen post-signup onboarding — mounted above EVERYTHING else in
// the app (its own fixed overlay, z-index above the header/sidebar/
// footer, see styles/onboarding/onboarding.css), not inside <main> like
// a normal page. It has its own header (sitevento logo on the left,
// Next/Accept button on the right — see OnboardingHeader below)
// instead of the app's usual <Header>/<Sidebar>, because it's meant to
// fully take over the screen the way a native app's onboarding does.
//
// Flow: 3 marketing steps (OnboardingSteps.tsx) introducing what
// sitevento actually does, each full of visuals (not just text) and
// independently scrollable — then ONE more mandatory step that is
// deliberately NOT counted as "step 4 of 4": the Terms & Data-Use
// acceptance gate (TermsStep.tsx). That step cannot be skipped or
// closed, locks its own Accept button behind a 5-second read timer,
// and is the thing that actually flips onboardingRequired to false
// (via useOnboardingStatus's acceptTerms(), which POSTs
// app/api/user-action's 'accept-terms' action and stamps
// users/{uid}.termsAcceptedAt in Firestore). Until that write lands,
// this component re-mounts on every visit (see useOnboardingStatus.ts
// + DashboardClient.tsx's gate) — there is no "skip" or "remind me
// later."
import { useEffect, useState } from 'react';
import { OnboardingSteps } from './OnboardingSteps';
import { TermsStep } from './TermsStep';
import { useScrollLock } from '@/hooks/useScrollLock';

interface OnboardingFlowProps {
  open: boolean;
  accepting: boolean;
  onComplete: () => Promise<boolean>;
}

const TOTAL_MARKETING_STEPS = 3;

export function OnboardingFlow({ open, accepting, onComplete }: OnboardingFlowProps) {
  // step 1..3 = marketing steps, step 'terms' = the mandatory
  // acceptance gate. Deliberately not step 4 — see header comment.
  const [step, setStep] = useState<1 | 2 | 3 | 'terms'>(1);
  const [error, setError] = useState('');
  // Lifted out of TermsStep so the countdown/unlock state can drive
  // BOTH its CTA areas at once (header top-right on desktop, sticky
  // bottom footer on phone) from a single source of truth instead of
  // two independent timers drifting apart.
  const [termsSecondsLeft, setTermsSecondsLeft] = useState(5);
  const termsUnlocked = termsSecondsLeft <= 0;

  // Reset to the first step each time the flow is (re-)opened — e.g.
  // a returning visitor who never finished terms acceptance gets the
  // marketing intro again too, rather than being dropped straight on
  // the terms wall with no context.
  useEffect(() => {
    if (open) {
      setStep(1);
      setError('');
    }
  }, [open]);

  // Shared scroll lock (hooks/useScrollLock.ts) — pins the page behind
  // this full-screen overlay so it can't be dragged/scrolled on touch
  // devices while onboarding is open, same fix applied to every other
  // modal/overlay/sidebar in the app.
  useScrollLock(open);

  if (!open) return null;

  function goNext() {
    setStep((s) => {
      if (s === 'terms') return s;
      if (s === TOTAL_MARKETING_STEPS) return 'terms';
      return (s + 1) as 1 | 2 | 3;
    });
  }

  function goBack() {
    setStep((s) => {
      if (s === 'terms') return TOTAL_MARKETING_STEPS;
      if (s === 1) return s;
      return (s - 1) as 1 | 2 | 3;
    });
  }

  async function handleAccept() {
    setError('');
    const ok = await onComplete();
    if (!ok) setError("Couldn't save that — check your connection and try again.");
  }

  const onTerms = step === 'terms';
  const progress = onTerms ? TOTAL_MARKETING_STEPS : step;

  return (
    <div className="onb-overlay" role="dialog" aria-modal="true" aria-label="Welcome to sitevento">
      <header className="onb-header">
        <div className="onb-header-left">
          <img
            className="onb-logo"
            src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
            alt="sitevento"
          />
        </div>

        <div className="onb-header-center" aria-hidden="true">
          <div className="onb-progress">
            {Array.from({ length: TOTAL_MARKETING_STEPS }).map((_, i) => (
              <span
                key={i}
                className={`onb-progress-dot${i < progress ? ' is-done' : ''}${i === progress - 1 && !onTerms ? ' is-active' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="onb-header-right">
          {!onTerms ? (
            <>
              {step !== 1 && (
                <button type="button" className="onb-btn-ghost" onClick={goBack}>
                  Back
                </button>
              )}
              <button type="button" className="onb-btn-next" onClick={goNext}>
                <span>{step === TOTAL_MARKETING_STEPS ? "Let's go" : 'Next'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : (
            // Terms step keeps a second, compact Accept CTA up here on
            // desktop (top-right, same slot the marketing steps use) —
            // see .onb-header-accept-btn in onboarding-shell.css for
            // why this is hidden on phone instead of duplicating the
            // full sticky-footer CTA below.
            <button
              type="button"
              className={`onb-accept-btn onb-header-accept-btn${!termsUnlocked ? ' is-locked' : ''}`}
              disabled={!termsUnlocked || accepting}
              onClick={handleAccept}
            >
              {accepting ? (
                <span className="onb-accept-spinner" />
              ) : termsUnlocked ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : null}
              <span>{accepting ? 'Saving…' : termsUnlocked ? 'I agree — let’s start' : `Please read (${termsSecondsLeft}s)`}</span>
            </button>
          )}
        </div>
      </header>

      <div className="onb-body">
        {!onTerms ? (
          <OnboardingSteps step={step} />
        ) : (
          <TermsStep
            accepting={accepting}
            error={error}
            onAccept={handleAccept}
            onBack={goBack}
            onCountdownChange={setTermsSecondsLeft}
          />
        )}
      </div>

      {/* Sticky bottom CTA footer — phone only (see the min-width: 720px
         rule in onboarding-shell.css that hides this on desktop, where
         Next/Back/Accept live in the header instead). Full-width
         primary action pinned above the safe-area inset, so the CTA is
         always reachable with a thumb without scrolling the step's own
         content to the bottom first. */}
      <div className="onb-sticky-footer">
        {!onTerms ? (
          <div className="onb-sticky-footer-row">
            {step !== 1 && (
              <button type="button" className="onb-btn-ghost onb-sticky-back" onClick={goBack}>
                Back
              </button>
            )}
            <button type="button" className="onb-btn-next onb-sticky-cta" onClick={goNext}>
              <span>{step === TOTAL_MARKETING_STEPS ? "Let's go" : 'Next'}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={`onb-accept-btn onb-sticky-cta${!termsUnlocked ? ' is-locked' : ''}`}
            disabled={!termsUnlocked || accepting}
            onClick={handleAccept}
          >
            {accepting ? (
              <span className="onb-accept-spinner" />
            ) : termsUnlocked ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <span className="onb-accept-countdown">{termsSecondsLeft}</span>
            )}
            <span>{accepting ? 'Saving…' : termsUnlocked ? 'I agree — let’s start' : `Please read (${termsSecondsLeft}s)`}</span>
          </button>
        )}
      </div>
    </div>
  );
}
