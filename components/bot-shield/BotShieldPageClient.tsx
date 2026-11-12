'use client';

// components/bot-shield/BotShieldPageClient.tsx
//
// Client half of /dashboard/bot-shield. Same Header + Sidebar +
// useAuth/useSidebar/useSites scaffold as AgentPageClient.tsx and
// SiteAlertPageClient.tsx — see those files for why this needs to be
// a real standalone route rather than an in-dashboard overlay.
//
// Surfaces the four in-house (non-AI) security widgets built on top of
// lib/botShield.ts's detection engine (user-facing product name:
// SECURITY BOT), each its own small card with its own on/off switch:
//   1. Rapid Refresh   — wired into app/api/track (pageview)
//   2. Rapid Clicks    — wired into app/api/click-track (click)
//   3. Country Restrict — blocks visitors from chosen countries
//   4. Device Restrict  — blocks visitors on a chosen OS (Android,
//      iOS, desktop platforms, etc.)
// (Form Flood Guard — email-capture, contact-us, appointment-booking,
// feedback-survey — is its own card below these four, unchanged.)
// Refresh/Click/Country/Device all run automatically with zero human
// review off the SAME botShield/_config doc (see lib/botShieldConfig.ts's
// header) — app/api/track reads it ONCE per beacon and checks all four
// conditions against that one object, rather than one Firestore read
// per widget. A 'moderate' refresh/click verdict restricts the visitor
// for 1 hour (self-expiring); a 'severe' verdict, a country match, or a
// device match blocks them permanently (see lib/botShield.ts's header
// for the exact refresh/click thresholds) — this page's job is to make
// that accountable: each widget has one clear on/off switch, and every
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
import { useBgTone } from '@/hooks/useBgTone';
import { useBotShield, type BotShieldLogEntry, type BotShieldThresholdState, type BlockableDeviceOs } from '@/hooks/useBotShield';
import { COUNTRIES } from '@/lib/countries';
import type { AuthPane } from '@/hooks/useAuthForms';

// Human-readable labels for the OS-family buckets Device Restrict
// blocks by — same values classifyOS(ua) in app/api/track/route.ts
// produces (and already writes onto every visit as `os`), just with
// friendlier copy than the raw bucket name where it helps ("Desktop
// macOS" instead of a bare "macOS" reads less like a typo next to
// "Android"/"iOS"). Order is deliberate: the two mobile OSes the
// request specifically asked for first, then desktop platforms.
const DEVICE_OS_LABELS: Record<BlockableDeviceOs, string> = {
  Android: 'Android',
  iOS: 'iOS (iPhone/iPad)',
  Windows: 'Windows',
  macOS: 'macOS',
  Linux: 'Linux',
  ChromeOS: 'ChromeOS',
  Other: 'Other / unknown',
};

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

// Compact country checklist for the Country Restrict card — same
// search-filtered-checklist shape as components/agent/AgentCountryBlocker.tsx
// (the AI Agent's own, separate country-block picker) but with its own
// `bsh-` styling so it fits this page's now-smaller card instead of
// that one's full-width panel, and wired to this page's own
// toggleBlockedCountry instead of a parent-owned onToggle prop.
function CountryPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (code: string, next: boolean) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [query]);

  const selectedSet = new Set(selected);

  return (
    <div className="bsh-country-box">
      <div className="bsh-country-head">
        <input
          type="text"
          className="bsh-country-search"
          placeholder="Search countries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search countries to restrict"
        />
        <span className="bsh-country-count">{selected.length} blocked</span>
      </div>

      {selected.length > 0 && (
        <div className="bsh-country-chips">
          {selected.map((code) => {
            const c = COUNTRIES.find((x) => x.code === code);
            return (
              <button type="button" key={code} className="bsh-country-chip" onClick={() => onToggle(code, false)}>
                {c?.name || code}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      <div className="bsh-country-list" role="listbox" aria-multiselectable="true">
        {filtered.length === 0 && <p className="bsh-note bsh-country-empty">No countries match &ldquo;{query}&rdquo;.</p>}
        {filtered.map((c) => {
          const isOn = selectedSet.has(c.code);
          return (
            <label key={c.code} className={`bsh-country-row${isOn ? ' is-on' : ''}`}>
              <input type="checkbox" checked={isOn} onChange={(e) => onToggle(c.code, e.target.checked)} />
              <span className="bsh-country-name">{c.name}</span>
              <span className="bsh-country-code">{c.code}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// Checklist for the Device Restrict card — far shorter than the
// country list (7 OS families, see DEVICE_OS_LABELS above) so this is
// a plain static grid of checkboxes rather than a search box.
function DevicePicker({
  options,
  selected,
  onToggle,
}: {
  options: readonly BlockableDeviceOs[];
  selected: BlockableDeviceOs[];
  onToggle: (os: BlockableDeviceOs, next: boolean) => void;
}) {
  const selectedSet = new Set(selected);
  return (
    <div className="bsh-device-grid" role="group" aria-label="Device types to restrict">
      {options.map((os) => {
        const isOn = selectedSet.has(os);
        return (
          <label key={os} className={`bsh-device-row${isOn ? ' is-on' : ''}`}>
            <input type="checkbox" checked={isOn} onChange={(e) => onToggle(os, e.target.checked)} />
            <span>{DEVICE_OS_LABELS[os] ?? os}</span>
          </label>
        );
      })}
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

// How long SECURITY BOT's own self-expiring restrictions last — kept
// in sync with RESTRICT_DURATION_MS (lib/botShield.ts) purely to size
// the progress ring below; the actual lift time always comes from the
// entry's own restrictedUntil, this is only for drawing "how much of
// the hour is left" as a fraction.
const RESTRICT_DURATION_MS = 60 * 60 * 1000;

// Live countdown to a restriction's self-expiry. Ticks every second
// once under a minute remains (so the last stretch visibly counts
// down second by second) and once every 10s before that — frequent
// enough to feel alive without re-rendering a whole list of rows 60
// times a minute for no visible change. Returns both a short display
// string ("42m 10s" / "1h 06m") and 0..1 fraction of the duration
// already elapsed, for the progress ring.
function useRestrictCountdown(restrictedUntil: number | null): { label: string; pct: number; expired: boolean } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!restrictedUntil) return;
    const diff = restrictedUntil - Date.now();
    const tick = () => setNow(Date.now());
    const everySec = diff <= 60_000;
    const interval = setInterval(tick, everySec ? 1000 : 10_000);
    return () => clearInterval(interval);
  }, [restrictedUntil]);

  if (!restrictedUntil) return { label: '', pct: 0, expired: true };
  const diff = Math.max(0, restrictedUntil - now);
  const expired = diff <= 0;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const label = expired
    ? 'Lifting…'
    : h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : diff <= 60_000
    ? `${m}m ${String(s).padStart(2, '0')}s`
    : `${m}m`;
  const elapsed = Math.max(0, Math.min(1, 1 - diff / RESTRICT_DURATION_MS));
  return { label, pct: elapsed, expired };
}

// A restricted entry's own row — deliberately NOT the flat blocked-row
// template (dot + one-line title). A time-boxed restriction has a
// genuinely different shape: it carries a live countdown and heals
// itself, so it reads as a pending/in-progress state (a ring that
// fills in, like a timer) rather than a flat past-tense log line.
function RestrictedRow({
  entry,
  onLift,
}: {
  entry: BotShieldLogEntry;
  onLift: (visitorId: string) => void;
}) {
  const { label, pct, expired } = useRestrictCountdown(entry.restrictedUntil);
  const circumference = 2 * Math.PI * 15;
  const dashOffset = circumference * (1 - pct);

  return (
    <li className="bsh-restrict-row">
      <div className="bsh-restrict-ring" aria-hidden="true">
        <svg viewBox="0 0 36 36">
          <circle className="bsh-restrict-ring-track" cx="18" cy="18" r="15" />
          <circle
            className="bsh-restrict-ring-fill"
            cx="18"
            cy="18"
            r="15"
            style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset }}
          />
        </svg>
        <span className="bsh-restrict-ring-label">{expired ? '⟳' : label.split(' ')[0]}</span>
      </div>

      <div className="bsh-restrict-body">
        <div className="bsh-restrict-top">
          <span className="bsh-restrict-title">{kindLabel(entry.kind)} — restricted</span>
          <span className="bsh-restrict-countdown">{expired ? 'Lifting…' : `lifts in ${label}`}</span>
        </div>
        <p className="bsh-restrict-reason">{entry.reason}</p>
        <SignalTags entry={entry} />
      </div>

      <div className="bsh-restrict-side">
        <span className="bsh-restrict-time">{formatTs(entry.ts)}</span>
        {entry.visitorId && (
          <button type="button" className="bsh-lift-btn" onClick={() => onLift(entry.visitorId!)}>
            Lift now
          </button>
        )}
      </div>
    </li>
  );
}

export default function BotShieldPageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();
  const { activeSiteId } = useSites(user?.uid ?? null);
  // Same pattern as the main dashboard (DashboardShell.tsx): every
  // surface/ink/accent below is a colour-mix of the live --app-bg
  // (Settings > Appearance's Theme Colour, including any custom hex),
  // not a fixed palette — this just measures whether that background
  // currently reads light or dark so text stays legible either way.
  const tone = useBgTone();

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');

  const {
    config,
    effectiveThresholds,
    log,
    blockableDeviceOs,
    loading,
    error,
    updateConfig,
    updateThreshold,
    toggleBlockedCountry,
    toggleBlockedDevice,
    unblockVisitor,
  } = useBotShield(user, activeSiteId);
  // One open/closed flag per card now that Refresh and Click are
  // separate cards (each needs to expand its own "customize
  // sensitivity" section independently of the other).
  const [advancedOpenRefresh, setAdvancedOpenRefresh] = useState(false);
  const [advancedOpenClick, setAdvancedOpenClick] = useState(false);
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

      <main className="bsh-main bsh" data-tone={tone}>
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
                {/* 1. Rapid Refresh — was half of "Refresh & Click Shield";
                    split into its own card so each action SECURITY BOT can
                    take is one option, not two bundled under one switch. */}
                <div className="bsh-widget-card">
                  <div className="bsh-widget-card-top">
                    <div>
                      <h2>Rapid Refresh</h2>
                      <p>Auto-restricts or blocks a visitor reloading the page far faster than a human can — 5 in 60s restricts for 1 hour, 10 in 60s blocks instantly.</p>
                    </div>
                    {config && (
                      <Toggle
                        on={config.refreshShieldEnabled}
                        onChange={(v) => updateConfig({ refreshShieldEnabled: v })}
                        label="Rapid Refresh"
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
                        <ThresholdEditor
                          kindLabel="refreshes"
                          value={effectiveThresholds.pageview}
                          onCommit={(patch) => updateThreshold('pageview', patch)}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* 2. Rapid Clicks — the other half of the old combined
                    card. Used to share refreshShieldEnabled with the
                    Rapid Refresh card above (both toggles flipped the
                    same single flag, so switching either one off also
                    silently switched the other off) — now its own
                    clickShieldEnabled flag end to end: this field,
                    app/api/bot-shield's read/write, and
                    app/api/click-track's enforcement all changed
                    together, so the two cards are genuinely
                    independent now, matching how they already looked. */}
                <div className="bsh-widget-card">
                  <div className="bsh-widget-card-top">
                    <div>
                      <h2>Rapid Clicks</h2>
                      <p>Auto-restricts or blocks a visitor clicking far faster than a human can, including clicks with no think-time between them — 50 in 60s restricts, 100 in 60s blocks.</p>
                    </div>
                    {config && (
                      <Toggle
                        on={config.clickShieldEnabled}
                        onChange={(v) => updateConfig({ clickShieldEnabled: v })}
                        label="Rapid Clicks"
                      />
                    )}
                  </div>
                  <span className={`bsh-status-pill${config?.clickShieldEnabled ? ' is-on' : ''}`}>
                    {config?.clickShieldEnabled ? 'Protecting your site' : 'Off'}
                  </span>
                  {config?.clickShieldEnabled && effectiveThresholds && (
                    <>
                      <button type="button" className="bsh-advanced-toggle" onClick={() => setAdvancedOpenClick((v) => !v)}>
                        {advancedOpenClick ? 'Hide' : 'Customize'} sensitivity
                      </button>
                      {advancedOpenClick && (
                        <ThresholdEditor
                          kindLabel="clicks"
                          value={effectiveThresholds.click}
                          onCommit={(patch) => updateThreshold('click', patch)}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* 3. Country Restrict — new. Independent from the AI
                    Agent's own country-block feature; this one lives in
                    the same botShield/_config doc as every other card
                    here, so app/api/track reads it in the same single
                    call that already drives Rapid Refresh/Rapid Clicks. */}
                <div className="bsh-widget-card">
                  <div className="bsh-widget-card-top">
                    <div>
                      <h2>Country Restrict</h2>
                      <p>Blocks every visitor from the countries you pick below, the moment they land.</p>
                    </div>
                    {config && (
                      <Toggle
                        on={config.countryBlockEnabled}
                        onChange={(v) => updateConfig({ countryBlockEnabled: v })}
                        label="Country Restrict"
                      />
                    )}
                  </div>
                  <span className={`bsh-status-pill${config?.countryBlockEnabled ? ' is-on' : ''}`}>
                    {config?.countryBlockEnabled
                      ? `Blocking ${config.blockedCountries.length} ${config.blockedCountries.length === 1 ? 'country' : 'countries'}`
                      : 'Off'}
                  </span>
                  {config?.countryBlockEnabled && (
                    <CountryPicker selected={config.blockedCountries} onToggle={toggleBlockedCountry} />
                  )}
                </div>

                {/* 4. Device Restrict — new. Matches classifyOS(ua), the
                    same OS value already shown on /dashboard/users, so
                    "block Android" here means exactly the device type an
                    owner sees elsewhere on the dashboard. */}
                <div className="bsh-widget-card">
                  <div className="bsh-widget-card-top">
                    <div>
                      <h2>Device Restrict</h2>
                      <p>Blocks every visitor on the device types you pick below — Android, iOS, desktop, and more.</p>
                    </div>
                    {config && (
                      <Toggle
                        on={config.deviceBlockEnabled}
                        onChange={(v) => updateConfig({ deviceBlockEnabled: v })}
                        label="Device Restrict"
                      />
                    )}
                  </div>
                  <span className={`bsh-status-pill${config?.deviceBlockEnabled ? ' is-on' : ''}`}>
                    {config?.deviceBlockEnabled
                      ? `Blocking ${config.blockedDevices.length} ${config.blockedDevices.length === 1 ? 'device type' : 'device types'}`
                      : 'Off'}
                  </span>
                  {config?.deviceBlockEnabled && (
                    <DevicePicker options={blockableDeviceOs} selected={config.blockedDevices} onToggle={toggleBlockedDevice} />
                  )}
                </div>

                {/* 5. Form Flood Guard — unchanged. */}
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

                {restrictedEntries.length > 0 && (
                  <div className="bsh-log-group">
                    <p className="bsh-log-group-title">
                      Currently restricted
                      <span className="bsh-log-group-count">{restrictedEntries.length}</span>
                    </p>
                    <ul className="bsh-restrict-list">
                      {restrictedEntries.map((entry) => (
                        <RestrictedRow key={entry.id} entry={entry} onLift={unblockVisitor} />
                      ))}
                    </ul>
                  </div>
                )}

                {blockedEntries.length > 0 && (
                  <div className="bsh-log-group">
                    <p className="bsh-log-group-title">
                      Blocked
                      <span className="bsh-log-group-count">{blockedEntries.length}</span>
                    </p>
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
                  </div>
                )}

                {flaggedEntries.length > 0 && (
                  <div className="bsh-log-group">
                    <p className="bsh-log-group-title">
                      Flagged, no action taken
                      <span className="bsh-log-group-count">{flaggedEntries.length}</span>
                    </p>
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
                  </div>
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
