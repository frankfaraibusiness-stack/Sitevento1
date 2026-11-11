'use client';

// components/marketing/WelcomeBackSection.tsx
//
// Sits directly under <Hero /> on the marketing homepage (app/page.tsx
// via AppRoot.tsx → MarketingPage.tsx), and only for a signed-in user —
// MarketingPage renders the exact same pitch (PlatformsMarquee,
// LaptopShowcase, pricing, etc.) to everyone regardless of auth state,
// which is still right: that content is evergreen reference material
// a returning user might want too. This section is the one place on
// "/" that actually reacts to who's looking at it.
//
// Two states, driven by real account data (no invented numbers):
//   - has at least one connected site → "Welcome back" + two quick
//     stats pulled from the same data sources the dashboard/profile
//     pages already use (useSites for the site count, useAccountLimits
//     for this month's visit usage) + a plain text link (not a button)
//     to the dashboard.
//   - no site yet → an inline upsell banner nudging them to connect
//     one, with the one real CTA button on the section.
//
// Nothing here fires its own Firestore query or API call — both hooks
// are already used elsewhere (ProfileHero, DashboardShell) so mounting
// them here just reuses their existing listeners/polling, it doesn't
// add new ones.
import type { User } from 'firebase/auth';
import { useNavRouter } from '@/hooks/useNavPending';
import { useSites } from '@/hooks/useSites';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { fmtNum } from '@/lib/dashboardStats';

interface WelcomeBackSectionProps {
  user: User;
  onConnectClick: () => void;
}

function firstName(user: User): string {
  const dn = user.displayName?.trim();
  if (dn) return dn.split(/\s+/)[0];
  if (user.email) return user.email.split('@')[0];
  return 'there';
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function WelcomeBackSection({ user, onConnectClick }: WelcomeBackSectionProps) {
  const router = useNavRouter();
  const { sites, dashState } = useSites(user.uid, user);
  const { limits } = useAccountLimits(user);

  // Still resolving which state to show (first paint before the sites
  // snapshot lands) — render nothing rather than flash the wrong state.
  if (dashState === 'loading') return null;

  const hasSite = sites.length > 0;
  const name = firstName(user);

  const goToDashboard = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/dashboard');
  };

  return (
    <section className="wb-section" aria-label="Your account">
      <div className="wb-card">
        {hasSite ? (
          <>
            <div className="wb-greet">
              <p className="wb-eyebrow">Welcome back</p>
              <h2>Good to see you, {name} 👋</h2>
            </div>

            <div className="wb-stats">
              <div className="wb-stat">
                <span className="wb-stat-value">{sites.length}</span>
                <span className="wb-stat-label">
                  {sites.length === 1 ? 'site connected' : 'sites connected'}
                </span>
              </div>
              <div className="wb-stat-divider" aria-hidden="true" />
              <div className="wb-stat">
                <span className="wb-stat-value">{limits ? fmtNum(limits.visitUsage.used) : '—'}</span>
                <span className="wb-stat-label">visits this month</span>
              </div>
              {limits && (
                <>
                  <div className="wb-stat-divider" aria-hidden="true" />
                  <div className="wb-stat">
                    <span className="wb-stat-value">{limits.planName}</span>
                    <span className="wb-stat-label">your plan</span>
                  </div>
                </>
              )}
            </div>

            <a href="/dashboard" className="wb-link" onClick={goToDashboard}>
              Go to your dashboard <ArrowIcon />
            </a>
          </>
        ) : (
          <div className="wb-upsell">
            <div className="wb-upsell-copy">
              <p className="wb-eyebrow">Welcome back, {name}</p>
              <h2>You haven’t connected a site yet</h2>
              <p className="wb-upsell-sub">Paste one script tag and start seeing real visitors in minutes.</p>
            </div>
            <button type="button" className="btn btn-primary wb-upsell-btn" onClick={onConnectClick}>
              Connect your site <span aria-hidden="true">➔</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
