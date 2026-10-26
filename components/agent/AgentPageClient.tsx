'use client';

// components/agent/AgentPageClient.tsx
//
// Client half of /dashboard/agent (see app/dashboard/agent/page.tsx).
// Reuses the same Header + Sidebar + useAuth/useSidebar/useSites
// wiring as WidgetsPageClient.tsx and WidgetDesigner.tsx.
//
// This pass wires up what the previous pass's header comment flagged
// as follow-up work: model picker (AgentModelPicker), country blocker
// (AgentCountryBlocker, shown inline once 'country-block' is enabled),
// a time zone picker (shown once a schedule-dependent feature is on),
// real persistence (hooks/useSiteAgent.ts -> app/api/site-agent/
// route.ts), and AgentVerifyPanel, which explains that no second
// install tag is needed (see lib/agent.ts's header comment). Local
// toggle state is gone — draft/saved now comes from useSiteAgent, the
// same draft/saved/dirty/save shape WidgetConfigPanel.tsx already uses
// for widgets, so Save is one explicit action rather than every toggle
// writing immediately.
import { useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useSiteAgent } from '@/hooks/useSiteAgent';
import type { AuthPane } from '@/hooks/useAuthForms';
import type { PlanId } from '@/lib/plans';
import { agentFeatureLimit, AGENT_TIMEZONES } from '@/lib/agent';
import { AgentFeatureGrid } from './AgentFeatureGrid';
import { AgentModelPicker } from './AgentModelPicker';
import { AgentCountryBlocker } from './AgentCountryBlocker';
import { AgentVerifyPanel } from './AgentVerifyPanel';
import { AgentBlob } from './AgentBlob';

export default function AgentPageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();
  const { activeSite } = useSites(user?.uid ?? null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const [justSaved, setJustSaved] = useState(false);

  // No billing system exists yet (see lib/types.ts's Site.plan
  // comment) — missing/unknown plan defensively reads as 'free', same
  // fallback the rest of the app already uses rather than assuming a
  // paid tier that was never actually granted.
  const plan: PlanId = isPlanId(activeSite?.plan) ? activeSite.plan : 'free';

  const {
    draft,
    loading,
    busy,
    dirty,
    wasClamped,
    toggleFeature,
    setModel,
    toggleCountry,
    setTimezone,
    setActive,
    save,
  } = useSiteAgent(user?.uid ?? null, activeSite);

  const limit = agentFeatureLimit(plan);
  const countryBlockOn = draft.enabledFeatureIds.includes('country-block');
  const needsTimezone = draft.enabledFeatureIds.some(
    (id) => id === 'daily-site-toggle' || id === 'maintenance-mode' || id === 'business-hours-chat' || id === 'widget-rotation'
  );

  async function handleSave() {
    const result = await save();
    if (result.ok) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2200);
    }
  }

  function goUpgrade() {
    router.push('/dashboard/plans');
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
            <AgentBlob variant="greet" className="agt-head-blob" />
            <div className="agt-head-top">
              <h1>AI Agent</h1>
              {activeSite && !loading && (
                <span className={`agt-plan-pill agt-plan-${plan}`}>
                  {planLabel(plan)} · {limit}/20 features
                </span>
              )}
            </div>
            <p>Build your own agent, personalize what it does, and grant it permission over your site — it runs on its own, on your schedule.</p>
          </div>

          {!authReady ? (
            <p className="agt-row-note">{'Loading\u2026'}</p>
          ) : !user ? (
            <p className="agt-row-note">Sign in to build and run your agent.</p>
          ) : !activeSite ? (
            <p className="agt-row-note">Connect a site from your dashboard to build an agent for it.</p>
          ) : loading ? (
            <p className="agt-row-note">Loading your agent…</p>
          ) : (
            <>
              <AgentVerifyPanel site={activeSite} />

              <AgentModelPicker plan={plan} selected={draft.model} onSelect={setModel} onUpgradeClick={goUpgrade} />

              <AgentFeatureGrid
                plan={plan}
                enabledIds={draft.enabledFeatureIds}
                onToggle={toggleFeature}
                onUpgradeClick={goUpgrade}
              />

              {countryBlockOn && (
                <section className="agt-section">
                  <div className="agt-section-head">
                    <h4 className="agt-section-title">Blocked countries</h4>
                  </div>
                  <AgentCountryBlocker selected={draft.blockedCountries} onToggle={toggleCountry} />
                </section>
              )}

              {needsTimezone && (
                <section className="agt-section">
                  <div className="agt-section-head">
                    <h4 className="agt-section-title">Your time zone</h4>
                  </div>
                  <p className="agt-row-note agt-tz-note">Used to work out when "11pm" and other scheduled times actually mean for you.</p>
                  <select
                    className="agt-tz-select"
                    value={draft.timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    aria-label="Your time zone"
                  >
                    {AGENT_TIMEZONES.map((tz) => (
                      <option key={tz.id} value={tz.id}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </section>
              )}

              <div className="agt-save-bar">
                <div className="agt-master">
                  <span className="agt-master-label">Agent is {draft.active ? 'active' : 'off'}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.active}
                    aria-label="Turn agent on or off"
                    className={`agt-switch${draft.active ? ' is-on' : ''}`}
                    onClick={() => setActive(!draft.active)}
                  >
                    <span className="agt-switch-knob" />
                  </button>
                </div>
                <div className="agt-save-right">
                  {wasClamped && <span className="agt-row-note agt-clamp-note">Some choices were adjusted to fit your plan.</span>}
                  {justSaved && !dirty && <span className="agt-saved-note">Saved</span>}
                  <button type="button" className="ghost-btn live" disabled={busy || !dirty} onClick={handleSave}>
                    {busy ? 'Saving…' : 'Save agent'}
                  </button>
                </div>
              </div>
            </>
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

function planLabel(plan: PlanId): string {
  if (plan === 'pro-developer') return 'Pro Developer';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
