'use client';

// components/bot-shield/BotShieldPageClient.tsx
//
// Client half of /dashboard/bot-shield. Same Header + Sidebar +
// useAuth/useSidebar/useSites scaffold as AgentPageClient.tsx and
// SiteAlertPageClient.tsx — see those files for why this needs to be
// a real standalone route rather than an in-dashboard overlay.
//
// Surfaces the two in-house (non-AI) security widgets built on top of
// lib/botShield.ts's detection engine (user-facing product name:
// SECURITY BOT):
//   1. Refresh & Click Shield — wired into app/api/track (pageview)
//      and app/api/click-track (click)
//   2. Form Flood Guard       — wired into email-capture, contact-us,
//      appointment-booking, feedback-survey
// Both run automatically with zero human review — a 'moderate' verdict
// restricts the visitor for 1 hour (self-expiring), a 'severe' verdict
// blocks them permanently (see lib/botShield.ts's header for the exact
// thresholds and why acting on the very first moderate burst, not a
// second strike, is still safe) — this page's job is to make that
// accountable: each widget has one clear on/off switch, and every
// restrict/block the engine made is listed with a one-click Lift
// now/Unblock.
import { useEffect, useMemo, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { GlobalLoader } from '@/components/GlobalLoader';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useBotShield, type BotShieldLogEntry, type BotShieldThresholdState } from '@/hooks/useBotShield';
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

// Per-kind threshold editor: "restrict after N in Ws" / "block after M
// in Ws". Deliberately presented in SECONDS (not raw ms) and as two
// plain counts, since that's how an owner actually thinks about this
// ("stop someone who clicks 8 times in 10 seconds"), not how the
// engine stores it internally. Each field commits on blur rather than
// on every keystroke — a threshold is security-relevant config, not a
// live preview, so there's no reason to fire a save per digit typed.
function ThresholdEditor({
  kindLabel,
  value,
  onCommit,
}: {
  kindLabel: string;
  value: BotShieldThresholdState | null;
  onCommit: (patch: Partial<BotShieldThresholdState>) => void;
}) {
  const [windowSec, setWindowSec] = useState<string>(value ? String(Math.round(value.windowMs / 1000)) : '');
  const [moderateCount, setModerateCount] = useState<string>(value ? String(value.moderateCount) : '');
  const [severeCount, setSevereCount] = useState<string>(value ? String(value.severeCount) : '');

  // Re-sync local input state whenever the resolved server value
  // changes underneath us (initial load, or after a save round-trips
  // and comes back clamped to something slightly different than what
  // was typed) — without this, a clamped value would silently diverge
  // from what the input displays.
  useEffect(() => {
    if (!value) return;
    setWindowSec(String(Math.round(value.windowMs / 1000)));
    setModerateCount(String(value.moderateCount));
    setSevereCount(String(value.severeCount));
  }, [value?.windowMs, value?.moderateCount, value?.severeCount]);

  if (!value) return null;

  return (
    <div className="bsh-threshold-editor">
      <div className="bsh-threshold-row">
        <label>
          <span>Within</span>
          <input
            type="number"
            min={5}
            inputMode="numeric"
            value={windowSec}
            onChange={(e) => setWindowSec(e.target.value)}
            onBlur={() => {
              const n = Number(windowSec);
              if (Number.isFinite(n) && n > 0) onCommit({ windowMs: Math.round(n * 1000) });
              else setWindowSec(String(Math.round(value.windowMs / 1000)));
            }}
          />
          <span>seconds</span>
        </label>
      </div>
      <div className="bsh-threshold-row">
        <label>
          <span>Restrict after</span>
          <input
            type="number"
            min={3}
            inputMode="numeric"
            value={moderateCount}
            onChange={(e) => setModerateCount(e.target.value)}
            onBlur={() => {
              const n = Number(moderateCount);
              if (Number.isFinite(n) && n > 0) onCommit({ moderateCount: Math.round(n) });
              else setModerateCount(String(value.moderateCount));
            }}
          />
          <span>{kindLabel}</span>
        </label>
      </div>
      <div className="bsh-threshold-row">
        <label>
          <span>Block after</span>
          <input
            type="number"
            min={4}
            inputMode="numeric"
            value={severeCount}
            onChange={(e) => setSevereCount(e.target.value)}
            onBlur={() => {
              const n = Number(severeCount);
              if (Number.isFinite(n) && n > 0) onCommit({ severeCount: Math.round(n) });
              else setSevereCount(String(value.severeCount));
            }}
          />
          <span>{kindLabel}</span>
        </label>
      </div>
      <p className="bsh-threshold-hint">Caps are floored to sane minimums automatically — too loose a setting can&rsquo;t fully disable protection.</p>
    </div>
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

// Small inline tags next to a log entry's reason, surfacing WHICH
// extra signal(s) contributed beyond the raw burst count — purely
// informational, mirrors nothing enforcement-relevant (the reason
// string already explains the primary cause; these are secondary
// corroborating evidence an owner reviewing a block might want to
// see at a glance).
function SignalTags({ entry }: { entry: BotShieldLogEntry }) {
  const tags: string[] = [];
  if (typeof entry.timingRegularity === 'number' && entry.timingRegularity < 0.12) tags.push('Machine-regular timing');
  if (entry.networkSuspect) tags.push('Datacenter/proxy network');
  if (!tags.length) return null;
  return (
    <span className="bsh-signal-tags">
      {tags.map((t) => (
        <span key={t} className="bsh-signal-tag">{t}</span>
      ))}
    </span>
  );
}

function formatTs(ts: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// "in 42m" / "in 1h" — how long until a time-boxed restriction lifts
// on its own. Returns null once it's already expired (the entry should
// no longer be shown as currently-restricted at that point).
function formatRestrictRemaining(restrictedUntil: number | null): string | null {
  if (!restrictedUntil) return null;
  const diff = restrictedUntil - Date.now();
  if (diff <= 0) return null;
  if (diff < 3_600_000) return `lifts in ${Math.max(1, Math.round(diff / 60_000))}m`;
  return `lifts in ${Math.round(diff / 3_600_000)}h`;
}

export default function BotShieldPageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();
  const { activeSiteId } = useSites(user?.uid ?? null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');

  const { config, effectiveThresholds, log, loading, error, updateConfig, updateThreshold, unblockVisitor } = useBotShield(user, activeSiteId);
  const [advancedOpenRefresh, setAdvancedOpenRefresh] = useState(false);
  const [advancedOpenForm, setAdvancedOpenForm] = useState(false);

  const blockedEntries = useMemo(() => log.filter((e) => e.action === 'block'), [log]);
  const restrictedEntries = useMemo(() => log.filter((e) => e.action === 'restrict'), [log]);
  const flaggedEntries = useMemo(() => log.filter((e) => e.action === 'none'), [log]);

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
        onProfileClick={() => router.push('/profile')}
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
              <h1>SECURITY BOT</h1>
              <p>Automatic, in-house abuse detection — no AI model, no extra cost. Catches scripted bursts a human could never produce and restricts or blocks them on the spot.</p>
            </div>
          </div>

          {!user && !authReady && <GlobalLoader variant="inline" label="Loading SECURITY BOT" />}

          {showSignInPrompt && (
            <div className="bsh-signin-card">
              <p>Sign in to view and manage SECURITY BOT for your connected site.</p>
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
            <p className="bsh-note">Connect a site from your dashboard to turn SECURITY BOT on.</p>
          )}

          {user && activeSiteId && (
            <>
              <div className="bsh-widget-grid">
                <div className="bsh-widget-card">
                  <div className="bsh-widget-card-top">
                    <div>
                      <h2>Refresh &amp; Click Shield</h2>
                      <p>Auto-restricts or blocks a visitor replaying page loads or clicks far faster than a human can — 5 in 60s restricts for 1 hour, 10 in 60s blocks instantly. Also catches clicks with no human think-time between them.</p>
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
                  {config?.refreshShieldEnabled && effectiveThresholds && (
                    <>
                      <button type="button" className="bsh-advanced-toggle" onClick={() => setAdvancedOpenRefresh((v) => !v)}>
                        {advancedOpenRefresh ? 'Hide' : 'Customize'} sensitivity
                      </button>
                      {advancedOpenRefresh && (
                        <>
                          <p className="bsh-threshold-subhead">Page refreshes</p>
                          <ThresholdEditor
                            kindLabel="refreshes"
                            value={effectiveThresholds.pageview}
                            onCommit={(patch) => updateThreshold('pageview', patch)}
                          />
                          <p className="bsh-threshold-subhead">Clicks</p>
                          <ThresholdEditor
                            kindLabel="clicks"
                            value={effectiveThresholds.click}
                            onCommit={(patch) => updateThreshold('click', patch)}
                          />
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="bsh-widget-card">
                  <div className="bsh-widget-card-top">
                    <div>
                      <h2>Form Flood Guard</h2>
                      <p>Auto-blocks a script hammering your lead forms — email capture, contact, booking, surveys — before it burns through your token limit.</p>
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
                  {config?.formFloodGuardEnabled && effectiveThresholds && (
                    <>
                      <button type="button" className="bsh-advanced-toggle" onClick={() => setAdvancedOpenForm((v) => !v)}>
                        {advancedOpenForm ? 'Hide' : 'Customize'} sensitivity
                      </button>
                      {advancedOpenForm && (
                        <ThresholdEditor
                          kindLabel="submissions"
                          value={effectiveThresholds['form-submit']}
                          onCommit={(patch) => updateThreshold('form-submit', patch)}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {error && <p className="bsh-error">{error}</p>}

              <div className="bsh-log-section">
                <h3>Recent activity</h3>
                {loading && <p className="bsh-note">Loading…</p>}
                {!loading && log.length === 0 && (
                  <p className="bsh-note">No suspicious activity detected yet — this list fills in the moment SECURITY BOT flags something.</p>
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
                          <SignalTags entry={entry} />
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

                {restrictedEntries.length > 0 && (
                  <ul className="bsh-log-list bsh-log-list-restricted">
                    {restrictedEntries.map((entry) => {
                      const remaining = formatRestrictRemaining(entry.restrictedUntil);
                      return (
                        <li key={entry.id} className="bsh-log-row bsh-log-row-restricted">
                          <span className="bsh-log-dot bsh-log-dot-warn" aria-hidden="true" />
                          <div className="bsh-log-body">
                            <span className="bsh-log-title">
                              {kindLabel(entry.kind)} — restricted{remaining ? ` (${remaining})` : ''}
                            </span>
                            <span className="bsh-log-reason">{entry.reason}</span>
                            <SignalTags entry={entry} />
                          </div>
                          <span className="bsh-log-time">{formatTs(entry.ts)}</span>
                          {entry.visitorId && (
                            <button type="button" className="bsh-unblock-btn" onClick={() => unblockVisitor(entry.visitorId!)}>
                              Lift now
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {flaggedEntries.length > 0 && (
                  <ul className="bsh-log-list bsh-log-list-flagged">
                    {flaggedEntries.map((entry) => (
                      <li key={entry.id} className="bsh-log-row">
                        <span className="bsh-log-dot bsh-log-dot-warn" aria-hidden="true" />
                        <div className="bsh-log-body">
                          <span className="bsh-log-title">{kindLabel(entry.kind)} — flagged, no action taken</span>
                          <span className="bsh-log-reason">{entry.countInWindow} events in the burst window.</span>
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
