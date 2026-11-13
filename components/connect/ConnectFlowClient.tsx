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
import { ConnectPermissionsStep } from '@/components/connect/ConnectPermissionsStep';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSites } from '@/hooks/useSites';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { PlanId } from '@/lib/plans';

export default function ConnectFlowClient() {
  const router = useNavRouter();
  const { user, authReady, authError } = useAuth();
  const { planId } = useUserProfile(user);
  const { sites, dashState: sitesDashState } = useSites(user?.uid ?? null, user);

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
  // hostname} forward here; step 2 (VerifyFlow) and step 3
  // (ConnectPermissionsStep) are both built against that same site, no
  // extra Firestore read needed. Steps 4-5 (Settings, Finish) aren't
  // built yet — step 3's onFinish lands back on the dashboard for now,
  // same as step 2's onVerified used to, until those exist.
  //
  // activeSite used to be plain useState, set only by handleSiteCreated
  // right after step 1's submit — so a reload (or just re-opening
  // /dashboard/connect in a new tab) always lost it and dropped back to
  // step 1, forcing the owner to re-enter the URL even though a
  // 'pending' site (and its install tag, which is keyed off siteId —
  // see VerifyFlow.tsx) already existed from the previous attempt. Now
  // it resumes from useSites' real-time subscription: if any of the
  // signed-in owner's sites is still 'pending' once that subscription
  // has actually loaded, jump straight to VerifyFlow for it instead of
  // defaulting to step 1. A freshly-created site (handleSiteCreated)
  // still wins immediately without waiting on the subscription.
  const [createdSite, setCreatedSite] = useState<VerifiedSite | null>(null);
  const resumableSite = sites.find((s) => s.status === 'pending') || null;
  const activeSite: VerifiedSite | null =
    createdSite ||
    (resumableSite ? { id: resumableSite.id, url: resumableSite.url, hostname: resumableSite.name } : null);
  // Only matters while no site has been created THIS session yet —
  // once createdSite is set we already know what to render and don't
  // need to wait on the subscription.
  const waitingOnSites = !createdSite && user != null && sitesDashState === 'loading';

  // Tracks "verification just succeeded THIS session, show step 3" —
  // can't be derived from the site's own Firestore status the way
  // activeSite/resumableSite are above, because /api/verify-site
  // flips status from 'pending' to 'verified' on success (see that
  // route), which would make resumableSite stop matching and activeSite
  // fall back to null — i.e. without this flag, the moment step 2
  // verifies, the very next render would drop the owner back to step 1
  // instead of forward to step 3. There's no separate "still mid-wizard
  // vs. fully done" marker persisted server-side yet, so a reload
  // during step 3 itself currently lands on the dashboard rather than
  // resuming step 3 — the same honest limitation step 1/2 resumption
  // had before useSites' 'pending' resume was added, just one step
  // later in the flow.
  const [verifiedSite, setVerifiedSite] = useState<VerifiedSite | null>(null);

  function handleSiteCreated(created: VerifiedSite) {
    setCreatedSite(created);
  }

  function handleVerified() {
    if (activeSite) setVerifiedSite(activeSite);
  }

  function handleFinish() {
    // End of the built flow: back to the dashboard, where the now-
    // verified, now-configured site already shows up live via
    // useSites' Firestore subscription.
    router.push('/dashboard/analytics');
  }

  if (!authReady) return <GlobalLoader variant="inline" fullScreen label="Loading" />;

  // Signed in, but we don't yet know whether this owner already has a
  // pending (unverified) site to resume — wait for useSites' first
  // snapshot rather than flashing step 1 and then yanking the owner
  // into step 2 a moment later.
  if (waitingOnSites) return <GlobalLoader variant="inline" fullScreen label="Loading" />;

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
        verifiedSite ? (
          <ConnectPermissionsStep
            site={verifiedSite}
            user={user}
            plan={planId}
            onFinish={handleFinish}
            onUpgradeClick={() => router.push('/dashboard/plans')}
          />
        ) : activeSite ? (
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
