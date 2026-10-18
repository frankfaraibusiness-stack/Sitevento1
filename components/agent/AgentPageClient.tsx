'use client';

// components/agent/AgentPageClient.tsx
//
// Client half of /dashboard/agent (see app/dashboard/agent/page.tsx).
// Reuses the same Header + Sidebar + useAuth/useSidebar/useSites
// wiring as WidgetsPageClient.tsx and WidgetDesigner.tsx so this page
// carries the exact same top bar as the rest of the app, with its own
// AuthOverlay prompt for anyone who isn't signed in — this is a
// configuration page, not public catalog content, so it gates up
// front rather than letting a signed-out visitor see the builder UI.
//
// This pass adds the 20-option permissions grid (AgentFeatureGrid,
// reading lib/agent.ts's AGENT_FEATURES) with local toggle state and
// plan-based locking. Model picker, country blocker, and actual
// persistence/API wiring still land in follow-up passes — see
// lib/agent.ts's header comment.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { PlanId } from '@/lib/plans';
import { AgentFeatureGrid } from './AgentFeatureGrid';

export default function AgentPageClient() {
  const router = useRouter();
  const { user } = useAuth();
  const sidebar = useSidebar();
  const { activeSite } = useSites(user?.uid ?? null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  // Local-only for this pass — not yet persisted (see file header).
  const [enabledIds, setEnabledIds] = useState<string[]>([]);

  // No billing system exists yet (see lib/types.ts's Site.plan
  // comment) — missing/unknown plan defensively reads as 'free', same
  // fallback the rest of the app already uses rather than assuming a
  // paid tier that was never actually granted.
  const plan: PlanId = isPlanId(activeSite?.plan) ? activeSite.plan : 'free';

  function handleToggle(featureId: string, next: boolean) {
    setEnabledIds((ids) => (next ? [...ids, featureId] : ids.filter((id) => id !== featureId)));
  }

  return (
    <>
      <Header
        user={user}
        onLogoClick={() => router.push('/')}
        onSignupClick={() => {
          setAuthPane('signup');
          setAuthOpen(true);
        }}
        onProfileClick={() => router.push('/dashboard')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={0}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => {
          setAuthPane('signin');
          setAuthOpen(true);
        }}
        onNavigate={(section) => {
          sidebar.setOpen(false);
          router.push(section === 'overview' ? '/dashboard' : `/dashboard#${section}`);
        }}
        onOpenProfile={() => {
          sidebar.setOpen(false);
          router.push('/dashboard/profile');
        }}
      />

      <main className="agt-main">
        <div className="agt-wrap">
          <button type="button" className="agt-back" onClick={() => router.push('/dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            <span>Dashboard</span>
          </button>

          <div className="agt-head">
            <h1>AI Agent</h1>
            <p>Build your own AI agent, grant it permission over your site, and let it work on its own.</p>
          </div>

          {!user ? (
            <p className="agt-row-note">Sign in to build and run your agent.</p>
          ) : !activeSite ? (
            <p className="agt-row-note">Connect a site from your dashboard to build an agent for it.</p>
          ) : (
            <AgentFeatureGrid
              plan={plan}
              enabledIds={enabledIds}
              onToggle={handleToggle}
              onUpgradeClick={() => router.push('/dashboard/plans')}
            />
          )}
        </div>
      </main>

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={() => setAuthOpen(false)}
        onAuthSucceeded={() => setAuthOpen(false)}
      />
    </>
  );
}

function isPlanId(v: string | undefined): v is PlanId {
  return v === 'free' || v === 'starter' || v === 'scale' || v === 'pro-developer';
}
