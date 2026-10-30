'use client';

// components/settings/panels/AccountPanel.tsx
//
// Full rebuild of the Account panel — own card-based layout and its
// own CSS namespace (.settings-account-*, styles/settings/settings-page.css)
// instead of reusing the generic .settings-input-group rows every
// other panel uses. Still wraps the exact same real functions as
// before:
//  - Display Name: saved to Firebase Auth via updateProfile (same call
//    useUserProfile.updateDisplayName already wraps for ProfilePage.tsx).
//  - Time Zone: saved to Firestore at users/{uid}.settings.timezone via
//    useUserSettings, and reloads correctly on every page load because
//    that hook subscribes with onSnapshot rather than holding local
//    state only.
import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { UserSettings } from '@/hooks/useUserSettings';

const TIMEZONES: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto-detect from browser' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Central Europe (CET)' },
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST)' },
];

interface AccountPanelProps {
  user: User | null;
  settings: UserSettings;
  settingsLoaded: boolean;
  updateSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
  updateDisplayName: (name: string) => Promise<boolean>;
}

function timezoneLabel(value: string): string {
  if (value === 'auto') {
    try {
      return `Auto · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    } catch {
      return 'Auto-detect';
    }
  }
  return TIMEZONES.find((tz) => tz.value === value)?.label || value;
}

export default function AccountPanel({ user, settings, settingsLoaded, updateSettings, updateDisplayName }: AccountPanelProps) {
  const email = user?.email || '';
  const providerId = user?.providerData?.[0]?.providerId || 'password';
  const signInMethod = providerId === 'google.com' ? 'Google' : 'Email & password';
  const joined = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const [name, setName] = useState(user?.displayName || '');
  useEffect(() => setName(user?.displayName || ''), [user?.displayName]);
  const nameDirty = name.trim() !== (user?.displayName || '').trim() && name.trim().length > 0;

  const [timezone, setTimezone] = useState(settings.timezone);
  useEffect(() => setTimezone(settings.timezone), [settings.timezone]);

  const [savingName, setSavingName] = useState(false);
  const [savingTz, setSavingTz] = useState(false);
  const [toast, setToast] = useState<null | { kind: 'ok' | 'error'; text: string }>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function flashToast(kind: 'ok' | 'error', text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2800);
  }

  async function handleSaveName() {
    setSavingName(true);
    const ok = await updateDisplayName(name);
    setSavingName(false);
    flashToast(ok ? 'ok' : 'error', ok ? 'Name updated.' : "Couldn't save your name. Try again.");
  }

  async function handleSaveTimezone(next: string) {
    setTimezone(next);
    setSavingTz(true);
    const ok = await updateSettings({ timezone: next });
    setSavingTz(false);
    if (!ok) flashToast('error', "Couldn't save time zone. Try again.");
  }

  const displayLabel = (user?.displayName || email || 'A').trim();
  const initial = displayLabel.charAt(0).toUpperCase() || 'A';

  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        </svg>
        <h3>Account</h3>
      </div>
      <p className="settings-panel-desc">Your identity on sitevento — who you are, how you sign in, and how timestamps are shown.</p>
      <hr className="settings-divider" />

      {/* Identity card — avatar + name/email summary + quick meta chips.
          The corner glow is a background-image on .acct-card itself
          now (settings-page.css), not a separate absolutely-positioned
          child, so there's no element here for it anymore. */}
      <div className="acct-card">
        <div className="acct-identity">
          <button
            type="button"
            className="acct-avatar"
            onClick={() => nameInputRef.current?.focus()}
            aria-label="Edit your display name"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt={displayLabel} />
            ) : (
              <span>{initial}</span>
            )}
          </button>
          <div className="acct-identity-text">
            <span className="acct-name">{user?.displayName || 'Add your name'}</span>
            <span className="acct-email">{email}</span>
          </div>
        </div>

        <div className="acct-meta-chips">
          <span className="acct-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {providerId === 'google.com' ? (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4l2.5 2.5" />
                </>
              ) : (
                <>
                  <rect x="4" y="11" width="16" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </>
              )}
            </svg>
            {signInMethod}
          </span>
          {joined && (
            <span className="acct-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 10h18M8 2v4M16 2v4" />
              </svg>
              Joined {joined}
            </span>
          )}
          <span className="acct-chip acct-chip-tz">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" />
            </svg>
            {savingTz ? 'Saving…' : timezoneLabel(timezone)}
          </span>
        </div>
      </div>

      {/* Editable fields — own two-column grid on desktop */}
      <div className="acct-fields-grid">
        <div className="acct-field">
          <label htmlFor="acct-name-input">Display name</label>
          <div className="acct-field-row">
            <input
              id="acct-name-input"
              ref={nameInputRef}
              className="acct-input"
              value={name}
              maxLength={80}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              className="acct-save-btn"
              disabled={!nameDirty || savingName}
              onClick={handleSaveName}
            >
              {savingName ? (
                <span className="acct-save-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              {savingName ? 'Saving' : 'Save'}
            </button>
          </div>
          <span className="acct-field-hint">Shown across your dashboard and in your account menu.</span>
        </div>

        <div className="acct-field">
          <label htmlFor="acct-email-input">Email address</label>
          <div className="acct-field-row">
            <input id="acct-email-input" className="acct-input acct-input-locked" defaultValue={email} disabled />
            <span className="acct-locked-badge" title="Sign-in email can&apos;t be changed here">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
          </div>
          <span className="acct-field-hint">Your sign-in email can&apos;t be changed here.</span>
        </div>

        <div className="acct-field acct-field-wide">
          <label htmlFor="acct-tz-select">Time zone</label>
          <div className="acct-field-row">
            <select
              id="acct-tz-select"
              className="acct-select"
              value={timezone}
              disabled={!settingsLoaded || savingTz}
              onChange={(e) => handleSaveTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          <span className="acct-field-hint">
            {savingTz ? 'Saving…' : 'Used for timestamps on visit logs and reports. Saved automatically.'}
          </span>
        </div>
      </div>

      {toast && <div className={`settings-toast is-${toast.kind}`}>{toast.text}</div>}
    </>
  );
}
