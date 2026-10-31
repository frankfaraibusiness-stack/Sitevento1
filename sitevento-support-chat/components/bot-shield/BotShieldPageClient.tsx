'use client';

// components/bot-shield/BotShieldPageClient.tsx
//
// Client half of /dashboard/bot-shield. Same Header + Sidebar +
// useAuth/useSidebar/useSites scaffold as AgentPageClient.tsx and
// SiteAlertPageClient.tsx — see those files for why this needs to be
// a real standalone route rather than an in-dashboard overlay.
//
// Surfaces the two in-house (non-AI) security widgets built on top of
// lib/botShield.ts's detection engine:
//   1. Refresh & Click Shield — wired into app/api/track
//   2. Form Flood Guard       — wired into email-capture, contact-us,
//      appointment-booking, feedback-survey
// Both run automatically and auto-block with zero human review (see
// lib/botShield.ts's header for the two-strike safety rule that makes
// that safe to do) — this page's job is to make that accountable:
// each widget has one clear on/off switch, and every block (or
// near-block) the engine made is listed with a one-click Unblock.
import { useMemo, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { AppSkeleton } from '@/components/AppSkeleton';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useBotShield, type BotShieldLogEntry } from '@/hooks/useBotShield';
import type { AuthPane } from '@/hooks/useAuthForms';

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`bsh-toggle${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span className="bsh-toggle-knob" />
    </button>
  );
}

function kindLabel(kind: BotShieldLogEntry['kind']): string {
  switch (kind) {
    case 'pageview':
      return 'Rapid refresh';
    case 'click':
      return 'Rapid clicks';
    case 'form-submit':
      return 'Form flood';
    default:
      return 'Activity';
  }
}

function formatTs(ts: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function BotShieldPageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();
  const { activeSiteId } = useSites(user?.uid ?? null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');

  const { config, log, loading, error, updateConfig, unblockVisitor } = useBotShield(user, activeSiteId);

  const blockedEntries = useMemo(() => log.filter((e) => e.blocked), [log]);
  const flaggedEntries = useMemo(() => log.filter((e) => !e.blocked), [log]);

  const showSignInPrompt = authReady && !user;

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

      <main className="bsh-main">
        <div className="bsh-wrap">
          <button type="button" className="bsh-back" onClick={() => router.push('/dashboard')}>
            <BackIcon />
            <span>Dashboard</span>
          </button>

          <div className="bsh-head">
            <span className="bsh-head-icon" aria-hidden="true">
              <ShieldIcon />
            </span>
            <div className="bsh-head-text">
              <h1>Bot Shield</h1>
              <p>Automatic, in-house abuse detection — no AI model, no extra cost. Catches scripted bursts a human could never produce and blocks them on the spot.</p>
            </div>
          </div>

          {!user && !authReady && <AppSkeleton label="Loading Bot Shield" />}

          {showSignInPrompt && (
            <div className="bsh-signin-card">
              <p>Sign in to view and manage Bot Shield for your connected site.</p>
              <button
                type="button"
                className="bsh-signin-btn"
                onClick={() => {
                  setAuthPane('signin');
                  setAuthOpen(true);
                }}
              >
                Sign in
              </button>
            </div>
          )}

          {user && !activeSiteId && (
            <p className="bsh-note">Connect a site from your dashboard to turn Bot Shield on.</p>
          )}

          {user && activeSiteId && (
            <>
              <div className="bsh-widget-grid">
                <div className="bsh-widget-card">
                  <div className="bsh-widget-card-top">
                    <div>
                      <h2>Refresh &amp; Click Shield</h2>
                      <p>Auto-blocks a visitor replaying page loads or clicks far faster than a human can — 5+ refreshes in 10s or 10+ clicks in 5s.</p>
                    </div>
                    {config && (
                      <Toggle
                        on={config.refreshShieldEnabled}
                        onChange={(v) => updateConfig({ refreshShieldEnabled: v })}
                        label="Refresh & Click Shield"
                      />
                    )}
                  </div>
                  <span className={`bsh-status-pill${config?.refreshShieldEnabled ? ' is-on' : ''}`}>
                    {config?.refreshShieldEnabled ? 'Protecting your site' : 'Off'}
                  </span>
                </div>

                <div className="bsh-widget-card">
                  <div className="bsh-widget-card-top">
                    <div>
                      <h2>Form Flood Guard</h2>
                      <p>Auto-blocks a script hammering your lead forms — email capture, contact, booking, surveys — before it burns through your write limit.</p>
                    </div>
                    {config && (
                      <Toggle
                        on={config.formFloodGuardEnabled}
                        onChange={(v) => updateConfig({ formFloodGuardEnabled: v })}
                        label="Form Flood Guard"
                      />
                    )}
                  </div>
                  <span className={`bsh-status-pill${config?.formFloodGuardEnabled ? ' is-on' : ''}`}>
                    {config?.formFloodGuardEnabled ? 'Protecting your forms' : 'Off'}
                  </span>
                </div>
              </div>

              {error && <p className="bsh-error">{error}</p>}

              <div className="bsh-log-section">
                <h3>Recent activity</h3>
                {loading && <p className="bsh-note">Loading…</p>}
                {!loading && log.length === 0 && (
                  <p className="bsh-note">No suspicious activity detected yet — this list fills in the moment Bot Shield flags something.</p>
                )}

                {blockedEntries.length > 0 && (
                  <ul className="bsh-log-list">
                    {blockedEntries.map((entry) => (
                      <li key={entry.id} className="bsh-log-row bsh-log-row-blocked">
                        <span className="bsh-log-dot" aria-hidden="true" />
                        <div className="bsh-log-body">
                          <span className="bsh-log-title">
                            {kindLabel(entry.kind)} — blocked
                          </span>
                          <span className="bsh-log-reason">{entry.reason}</span>
                        </div>
                        <span className="bsh-log-time">{formatTs(entry.ts)}</span>
                        {entry.visitorId && (
                          <button type="button" className="bsh-unblock-btn" onClick={() => unblockVisitor(entry.visitorId!)}>
                            Unblock
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {flaggedEntries.length > 0 && (
                  <ul className="bsh-log-list bsh-log-list-flagged">
                    {flaggedEntries.map((entry) => (
                      <li key={entry.id} className="bsh-log-row">
                        <span className="bsh-log-dot bsh-log-dot-warn" aria-hidden="true" />
                        <div className="bsh-log-body">
                          <span className="bsh-log-title">{kindLabel(entry.kind)} — flagged, not blocked yet</span>
                          <span className="bsh-log-reason">{entry.countInWindow} events in the burst window — one more like this and this visitor is auto-blocked.</span>
                        </div>
                        <span className="bsh-log-time">{formatTs(entry.ts)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <AuthOverlay open={authOpen} initialPane={authPane} onClose={() => setAuthOpen(false)} onAuthSucceeded={() => setAuthOpen(false)} />
    </>
  );
}
