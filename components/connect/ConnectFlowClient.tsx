'use client';

// components/connect/ConnectFlowClient.tsx
//
// Client shell for the standalone /dashboard/connect route (see
// app/dashboard/connect/page.tsx). Owns the auth gate — a signed-out
// visitor landing straight on this URL (bookmark, shared CTA link,
// GlobalNav's "Add site"/"Upload" button, etc.) gets the sign-in
// overlay instead of a blank/broken page — then hands off to
// ConnectFlow, which owns the actual page content/header per the new
// design.
//
// Unlike the old ConnectFlowClient, this does NOT render the shared
// Header/Sidebar: the new design has its own full-page header (logo +
// Next button, see ConnectFlow.tsx / VerifyFlow.tsx), and
// components/layout/GlobalNav.tsx is hidden on this route entirely
// (see its own pathname === '/dashboard/connect' exception), so this
// shell is just the auth gate, the step machine (which step's
// component to render), and the overlays either step can trigger
// (upgrade prompt).
import { useCallback, useEffect, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { GlobalLoader } from '@/components/GlobalLoader';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { UpsellOverlay } from '@/components/dashboard/UpsellOverlay';
import { ConnectFlow, type LimitStatus } from '@/components/connect/ConnectFlow';
import { VerifyFlow, type VerifiedSite } from '@/components/connect/VerifyFlow';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { PlanId } from '@/lib/plans';

export default function ConnectFlowClient() {
  const router = useNavRouter();
  const { user, authReady, authError } = useAuth();
  const { planId } = useUserProfile(user);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const openAuth = useCallback((pane: AuthPane) => {
    setAuthPane(pane);
    setAuthOpen(true);
  }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellInfo, setUpsellInfo] = useState<{ planId: PlanId; limit: number; used: number } | null>(null);
  const closeUpsell = useCallback(() => setUpsellOpen(false), []);

  function handleLimitReached(status: LimitStatus) {
    setUpsellInfo({ planId: (status.planId as PlanId) || 'free', limit: status.limit || 0, used: status.used || 0 });
    setUpsellOpen(true);
  }

  // A signed-out visitor landing straight on /dashboard/connect
  // (bookmark, shared CTA link, GlobalNav's "Add site"/"Upload"
  // button, etc.) gets the sign-in pane instead of a blank gate with
  // no obvious way forward.
  useEffect(() => {
    if (authReady && !user) openAuth('signin');
  }, [authReady, user, openAuth]);

  // Step machine: which step component renders. step 1 (ConnectFlow)
  // creates the real site server-side and hands its {id, url,
  // hostname} forward here; step 2 (VerifyFlow) is built against that
  // same site, no extra Firestore read needed. Steps 3-5 (Connect,
  // Settings, Finish) aren't built yet — VerifyFlow's onVerified lands
  // back on the dashboard for now, same as step 1 used to, until those
  // exist.
  const [activeSite, setActiveSite] = useState<VerifiedSite | null>(null);

  function handleSiteCreated(created: VerifiedSite) {
    setActiveSite(created);
  }

  function handleVerified() {
    // TODO: step 3 (Connect/permissions) lands here once it exists —
    // see components/connect/ConnectFlow.tsx's own header comment on
    // uid/plan being kept on its props for exactly that step. For now
    // this is the end of the built flow: back to the dashboard, where
    // the now-verified site already shows up live via useSites'
    // Firestore subscription.
    router.push('/dashboard');
  }

  if (!authReady) return <GlobalLoader variant="inline" fullScreen label="Loading" />;

  if (authError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong.</p>
          <p style={{ color: 'var(--muted-mid)', fontSize: 14 }}>{authError}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {user ? (
        activeSite ? (
          <VerifyFlow site={activeSite} onVerified={handleVerified} />
        ) : (
          <ConnectFlow
            uid={user.uid}
            plan={planId}
            onSiteCreated={handleSiteCreated}
            onLimitReached={handleLimitReached}
            onUpgradeClick={() => router.push('/dashboard/plans')}
          />
        )
      ) : (
        <div className="cwz-root">
          <div className="cwz-signin-gate">
            <h2>Sign in to connect a site</h2>
            <p>You&apos;ll need an account before linking a site to sitevento.</p>
            <button type="button" onClick={() => openAuth('signin')}>
              Sign in
            </button>
          </div>
        </div>
      )}

      {upsellInfo && (
        <UpsellOverlay
          open={upsellOpen}
          planId={upsellInfo.planId}
          limit={upsellInfo.limit}
          used={upsellInfo.used}
          onClose={closeUpsell}
          onUpgrade={() => {
            closeUpsell();
            router.push('/dashboard/plans');
          }}
        />
      )}

      <AuthOverlay open={authOpen} initialPane={authPane} onClose={closeAuth} onAuthSucceeded={() => closeAuth()} />
    </>
  );
}
