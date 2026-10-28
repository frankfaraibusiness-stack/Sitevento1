'use client';

// components/onboarding/OnboardingSteps.tsx
//
// The 3 marketing steps' actual content. Each is visual-first (a
// mascot stage, stat chips, little "device"/"card" mockups built in
// CSS — not just paragraphs of text), and maps 1:1 to the 3 real
// product moments components/marketing/HowItWorks.tsx already
// describes (paste the tag -> we track visits -> run live banners/
// widgets from the dashboard), so onboarding's claims match the rest
// of the marketing site exactly rather than inventing new ones.
//
// Each step is its own independently scrollable column
// (.onb-step-scroll in styles/onboarding/onboarding.css) so the fixed
// header never has to resize and content can be as long/visual as it
// wants on a short phone screen.
import { OnboardingMascot } from './OnboardingMascot';

interface OnboardingStepsProps {
  step: 1 | 2 | 3;
}

export function OnboardingSteps({ step }: OnboardingStepsProps) {
  if (step === 1) return <StepOne />;
  if (step === 2) return <StepTwo />;
  return <StepThree />;
}

function StepOne() {
  return (
    <div className="onb-step-scroll">
      <div className="onb-step">
        <OnboardingMascot tone="lime" />

        <span className="onb-eyebrow onb-eyebrow-lime">Welcome to sitevento</span>
        <h1 className="onb-h1">
          Your website, <span className="onb-mark onb-mark-lime">finally awake</span>
        </h1>
        <p className="onb-lede">
          One script tag turns your site into a live dashboard — who&apos;s visiting, where they come from, and
          what they do, updated in real time. No redeploys, no waiting on analytics to catch up.
        </p>

        <div className="onb-stat-row">
          <div className="onb-stat-card">
            <span className="onb-stat-num">2,400+</span>
            <span className="onb-stat-label">Sites connected</span>
          </div>
          <div className="onb-stat-card">
            <span className="onb-stat-num">48M</span>
            <span className="onb-stat-label">Visits / month</span>
          </div>
          <div className="onb-stat-card">
            <span className="onb-stat-num">&lt;2 min</span>
            <span className="onb-stat-label">Avg. setup</span>
          </div>
        </div>

        <div className="onb-mock-browser" aria-hidden="true">
          <div className="onb-mock-browser-bar">
            <span className="onb-mock-dot" />
            <span className="onb-mock-dot" />
            <span className="onb-mock-dot" />
            <span className="onb-mock-url">your-site.com</span>
          </div>
          <div className="onb-mock-browser-body">
            <div className="onb-mock-pulse-row">
              <span className="onb-mock-live-dot" />
              <span>2,418 active sessions right now</span>
            </div>
            <div className="onb-mock-bars">
              <span style={{ height: '38%' }} />
              <span style={{ height: '62%' }} />
              <span style={{ height: '48%' }} />
              <span style={{ height: '80%' }} />
              <span style={{ height: '58%' }} />
              <span style={{ height: '91%' }} />
              <span style={{ height: '70%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepTwo() {
  return (
    <div className="onb-step-scroll">
      <div className="onb-step">
        <OnboardingMascot tone="purple" flip />

        <span className="onb-eyebrow onb-eyebrow-purple">Connect in minutes</span>
        <h1 className="onb-h1">
          Paste a tag. <span className="onb-mark onb-mark-purple">We do the rest.</span>
        </h1>
        <p className="onb-lede">
          Add the sitevento tag to your site&apos;s &lt;head&gt; — any static site, CMS, or framework works. The
          moment it goes live, we verify it and start logging every visit automatically.
        </p>

        <div className="onb-flow-rail">
          <div className="onb-flow-step">
            <span className="onb-flow-num">1</span>
            <div>
              <strong>Paste the tag</strong>
              <p>One line, any platform.</p>
            </div>
          </div>
          <span className="onb-flow-connector" />
          <div className="onb-flow-step">
            <span className="onb-flow-num">2</span>
            <div>
              <strong>Verify ownership</strong>
              <p>We confirm it&apos;s live, instantly.</p>
            </div>
          </div>
          <span className="onb-flow-connector" />
          <div className="onb-flow-step onb-flow-step-done">
            <span className="onb-flow-num">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <div>
              <strong>Tracking starts</strong>
              <p>Visits appear in real time.</p>
            </div>
          </div>
        </div>

        <div className="onb-code-card" aria-hidden="true">
          <div className="onb-code-card-head">
            <span className="onb-mock-dot" />
            <span className="onb-mock-dot" />
            <span className="onb-mock-dot" />
            <span>index.html</span>
          </div>
          <pre className="onb-code-card-body">
{`<head>
  ...
  <script src="sitevento.io/tag.js"
          data-site="your-site"></script>
</head>`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function StepThree() {
  return (
    <div className="onb-step-scroll">
      <div className="onb-step">
        <OnboardingMascot tone="blue" />

        <span className="onb-eyebrow onb-eyebrow-blue">Run it live</span>
        <h1 className="onb-h1">
          Push banners. <span className="onb-mark onb-mark-blue">Capture leads.</span> Live.
        </h1>
        <p className="onb-lede">
          From your dashboard, design on-site banners and overlays, push them live to visitors right now, and take
          them down the second you don&apos;t need them — all without a single redeploy.
        </p>

        <div className="onb-widget-mock" aria-hidden="true">
          <div className="onb-widget-mock-page" />
          <div className="onb-widget-mock-banner">
            <span className="onb-widget-mock-banner-dot" />
            <span className="onb-widget-mock-banner-text">🎉 20% off — today only</span>
            <span className="onb-widget-mock-banner-btn">Claim</span>
          </div>
        </div>

        <div className="onb-feature-grid">
          <div className="onb-feature-card">
            <span className="onb-feature-icon onb-feature-icon-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <path d="M3 9h18M8 4v5" />
              </svg>
            </span>
            <strong>Live banners</strong>
            <p>Push a message to every visitor, right now.</p>
          </div>
          <div className="onb-feature-card">
            <span className="onb-feature-icon onb-feature-icon-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            <strong>Live visit logs</strong>
            <p>Every visit, as it happens — no refresh needed.</p>
          </div>
          <div className="onb-feature-card">
            <span className="onb-feature-icon onb-feature-icon-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v4H4zM4 12h10v4H4zM4 20h16" />
              </svg>
            </span>
            <strong>Lead capture</strong>
            <p>Turn banner clicks into a list you own.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
