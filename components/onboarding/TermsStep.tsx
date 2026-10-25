'use client';

// components/onboarding/TermsStep.tsx
//
// The mandatory, un-skippable final step of onboarding — not counted
// as "step 4" (see OnboardingFlow.tsx's header comment). This is the
// actual consent-to-data-collection gate: it tells the account owner,
// in plain and fairly thorough terms, what sitevento collects once
// they connect a site (visit/device/location-at-city-level data, never
// raw IPs — matching app/privacy/content.tsx's "Data we collect from
// site visitors" section exactly, not inventing broader claims) and
// that sitevento's widgets/banners render on top of their site. The
// Accept button is disabled behind a 5-second read timer so this can't
// be reflexively dismissed the way a cookie banner usually is.
//
// Accepting calls acceptTerms() (hooks/useOnboardingStatus.ts), which
// POSTs app/api/user-action's 'accept-terms' action and stamps
// users/{uid}.termsAcceptedAt — the one write that makes onboarding
// "done" and stops it from re-appearing on the next visit (see
// DashboardClient.tsx's gate).
import { useEffect, useRef, useState } from 'react';

interface TermsStepProps {
  accepting: boolean;
  error: string;
  onAccept: () => void;
  onBack: () => void;
}

const COUNTDOWN_SECONDS = 5;

export function TermsStep({ accepting, error, onAccept, onBack }: TermsStepProps) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  // New scroll column mounts fresh for this step, so land at the top
  // rather than inheriting a previous step's scroll position.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const unlocked = secondsLeft <= 0;

  return (
    <div className="onb-step-scroll" ref={scrollRef}>
      <div className="onb-terms">
        <button type="button" className="onb-terms-back" onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <span className="onb-eyebrow onb-eyebrow-ink">Last step — required</span>
        <h1 className="onb-h1 onb-terms-h1">Before you get started</h1>
        <p className="onb-lede">
          sitevento only works by collecting data about your site&apos;s visitors and showing it back to you, and by
          putting our own widgets on top of your pages when you turn them on. Please read what that actually means
          before you continue — this is the one thing we need you to agree to.
        </p>

        <div className="onb-terms-sections">
          <TermsSection
            tone="lime"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
            title="We collect activity from every site you connect"
          >
            <p>
              The moment you add the sitevento tag to a site, we start logging a beacon for every page view on
              that site and showing it to you — live — in your dashboard. That includes:
            </p>
            <ul>
              <li>Which pages were viewed, in what order, and what referred each visitor in.</li>
              <li>Viewport size and browser language, read directly from the visitor&apos;s browser.</li>
              <li>Device type, browser, and operating system, parsed from the visitor&apos;s connection.</li>
              <li>
                Country and city — derived from the visitor&apos;s IP address at the network edge. This is not GPS
                or precise location, and we don&apos;t look it up through a third-party geo-IP service.
              </li>
              <li>
                If a visitor submits anything through one of your banners (e.g. an email in a &quot;notify me&quot;
                form), that submission is stored as a lead on your dashboard.
              </li>
            </ul>
            <div className="onb-terms-callout">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <p>
                We never store a visitor&apos;s raw IP address and we never set tracking cookies. Each visitor gets
                a one-way hashed ID (built from their IP and browser string together) just so the dashboard can
                tell &quot;the same visitor came back&quot; from &quot;a new visitor arrived&quot; — the hash can&apos;t
                be reversed back into who someone is.
              </p>
            </div>
          </TermsSection>

          <TermsSection
            tone="purple"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              </svg>
            }
            title="You can see this activity, and so can we"
          >
            <p>
              Everything described above is visible to you, the account owner, inside your dashboard — visit
              counts, device/location breakdowns, referrers, and any leads captured. It is also visible to
              sitevento internally, since our systems are what process and store it in order to show it to you and
              keep the product running, secure, and within the usage limits of your plan.
            </p>
            <p>
              We don&apos;t sell visitor data, we don&apos;t use it for advertising, and we don&apos;t share it
              with third parties outside of what&apos;s needed to run the service itself (e.g. our hosting and
              database providers).
            </p>
          </TermsSection>

          <TermsSection
            tone="blue"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <path d="M3 9h18M8 4v5" />
              </svg>
            }
            title="sitevento can display widgets directly on your site"
          >
            <p>
              Any banner, overlay, or widget you design and push from your dashboard is injected directly onto
              your connected site by the sitevento tag, on top of your existing page, for every visitor until you
              take it down. By continuing, you&apos;re confirming that:
            </p>
            <ul>
              <li>You own each site you connect, or are authorized by its owner to install tracking/banner code on it.</li>
              <li>
                You&apos;re responsible for complying with applicable law regarding your own visitors — including,
                where required, disclosing that you use analytics tools and obtaining any consent your jurisdiction
                requires. sitevento is a tool; compliance for your own site&apos;s visitors is on you as the site
                operator.
              </li>
              <li>You won&apos;t use a banner or lead form to collect data visitors didn&apos;t knowingly submit.</li>
            </ul>
          </TermsSection>

          <TermsSection
            tone="lime"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            }
            title="You stay in control"
          >
            <p>
              You can disconnect any site from your dashboard at any time — doing so stops new data collection for
              that site immediately. You can take down a live banner the instant you don&apos;t want it shown
              anymore. You can delete your account entirely by contacting us, which stops all tracking across every
              site connected to it.
            </p>
            <p>
              Full details live in our <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>{' '}
              and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> — this page is a
              summary of the parts that matter most before you start, not a replacement for those.
            </p>
          </TermsSection>
        </div>

        <div className="onb-terms-accept-bar">
          {error && <p className="onb-terms-error">{error}</p>}
          <button
            type="button"
            className={`onb-accept-btn${!unlocked ? ' is-locked' : ''}`}
            disabled={!unlocked || accepting}
            onClick={onAccept}
          >
            {accepting ? (
              <span className="onb-accept-spinner" />
            ) : unlocked ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <span className="onb-accept-countdown">{secondsLeft}</span>
            )}
            <span>
              {accepting ? 'Saving…' : unlocked ? 'I agree — let’s start' : `Please read (${secondsLeft}s)`}
            </span>
          </button>
          <p className="onb-terms-fineprint">
            By clicking agree, you confirm you&apos;ve read the above and accept sitevento&apos;s collection of
            visitor data and display of widgets on sites you connect, as described here and in our full Terms &amp;
            Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function TermsSection({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'lime' | 'purple' | 'blue';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`onb-terms-card onb-terms-card-${tone}`}>
      <span className="onb-terms-card-icon">{icon}</span>
      <div className="onb-terms-card-body">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
