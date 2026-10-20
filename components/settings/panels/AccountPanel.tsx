'use client';

// components/settings/panels/AccountPanel.tsx
//
// Real functions, not placeholders:
//  - Display Name: saved to Firebase Auth via updateProfile (same call
//    useUserProfile.updateDisplayName already wraps for ProfilePage.tsx).
//  - Time Zone: saved to Firestore at users/{uid}.settings.timezone via
//    useUserSettings, and reloads correctly on every page load because
//    that hook subscribes with onSnapshot rather than holding local
//    state only.
import { useEffect, useState } from 'react';
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

export default function AccountPanel({ user, settings, settingsLoaded, updateSettings, updateDisplayName }: AccountPanelProps) {
  const email = user?.email || '';

  const [name, setName] = useState(user?.displayName || '');
  useEffect(() => setName(user?.displayName || ''), [user?.displayName]);
  const nameDirty = name.trim() !== (user?.displayName || '').trim() && name.trim().length > 0;

  const [timezone, setTimezone] = useState(settings.timezone);
  useEffect(() => setTimezone(settings.timezone), [settings.timezone]);

  const [savingName, setSavingName] = useState(false);
  const [savingTz, setSavingTz] = useState(false);
  const [toast, setToast] = useState<null | { kind: 'ok' | 'error'; text: string }>(null);

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

  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        </svg>
        <h3>Account</h3>
      </div>
      <p className="settings-panel-desc">Your basic account details.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Display Name</label>
        <div className="settings-field-row">
          <input
            className="settings-text-input"
            value={name}
            maxLength={80}
            placeholder="Your name"
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="settings-save-btn settings-save-btn-inline"
            disabled={!nameDirty || savingName}
            onClick={handleSaveName}
          >
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="settings-input-group">
        <label>Email</label>
        <input className="settings-text-input" defaultValue={email} disabled />
        <span className="settings-hint">Your sign-in email can&apos;t be changed here.</span>
      </div>

      <div className="settings-input-group">
        <label>Time Zone</label>
        <select
          className="settings-select"
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
        <span className="settings-hint">
          {savingTz ? 'Saving…' : 'Used for timestamps on visit logs and reports. Saved automatically.'}
        </span>
      </div>

      {toast && <div className={`settings-toast is-${toast.kind}`}>{toast.text}</div>}
    </>
  );
}
