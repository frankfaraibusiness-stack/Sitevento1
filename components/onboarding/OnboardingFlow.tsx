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

  // Reset to the first step each time the flow is (re-)opened — e.g.
  // a returning visitor who never finished terms acceptance gets the
  // marketing intro again too, rather than being dropped straight on
  // the terms wall with no context.
  useEffect(() => {
    if (open) {
      setStep(1);
      setError('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

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
            <span className="onb-header-right-spacer" aria-hidden="true" />
          )}
        </div>
      </header>

      <div className="onb-body">
        {!onTerms ? (
          <OnboardingSteps step={step} />
        ) : (
          <TermsStep accepting={accepting} error={error} onAccept={handleAccept} onBack={goBack} />
        )}
      </div>
    </div>
  );
}
