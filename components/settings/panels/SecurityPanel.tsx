'use client';

// components/settings/panels/SecurityPanel.tsx
//
// Real functions, not placeholders:
//  - Change Password: sends a genuine Firebase Auth password-reset
//    email to the signed-in user's own address (sendPasswordResetEmail
//    — the same call hooks/useAuthForms.ts's forgotPassword already
//    uses on the signed-out flow). No in-page "new password" field
//    (that would need a reauthenticate() step this app doesn't have
//    wired up yet) — this is the real, working path: click, check
//    your email, set a new password on Firebase's own hosted page.
//  - Sign-in Alerts: persisted to Firestore (users/{uid}.settings) via
//    useUserSettings, reloads correctly on every page load.
//  - Two-Factor Authentication: sitevento has no SMS/TOTP backend yet,
//    so this stays an honest "coming soon" rather than a toggle that
//    silently does nothing — flipping it does NOT save a false sense
//    of security.
import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { friendlyFirebaseError } from '@/lib/authErrors';
import type { UserSettings } from '@/hooks/useUserSettings';

interface SecurityPanelProps {
  user: User | null;
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
}

export default function SecurityPanel({ user, settings, updateSettings }: SecurityPanelProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [savingAlerts, setSavingAlerts] = useState(false);

  async function handleChangePassword() {
    if (!user?.email) return;
    setSending(true);
    setError('');
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), user.email);
      setSent(true);
      setTimeout(() => setSent(false), 6000);
    } catch (err) {
      setError(friendlyFirebaseError(err));
    } finally {
      setSending(false);
    }
  }

  async function handleToggleSignInAlerts(checked: boolean) {
    setSavingAlerts(true);
    await updateSettings({ signInAlerts: checked });
    setSavingAlerts(false);
  }

  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h3>Security</h3>
      </div>
      <p className="settings-panel-desc">Keep your account secure.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Password</label>
        <p className="settings-field-desc">
          We&apos;ll email a reset link to <strong>{user?.email || 'your account email'}</strong>.
        </p>
        <button
          className="settings-save-btn settings-save-btn-ghost"
          type="button"
          onClick={handleChangePassword}
          disabled={sending || !user?.email}
        >
          {sending ? 'Sending…' : 'Send Password Reset Email'}
        </button>
        {sent && <span className="settings-toast is-ok" style={{ marginTop: '0.6rem' }}>Reset email sent — check your inbox.</span>}
        {error && <span className="settings-toast is-error" style={{ marginTop: '0.6rem' }}>{error}</span>}
      </div>

      <hr className="settings-divider" />

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Two-Factor Authentication</span>
          <span className="settings-toggle-sublabel">Coming soon — require a code from your phone when signing in.</span>
        </div>
        <label className="settings-toggle-switch is-disabled">
          <input type="checkbox" disabled checked={false} readOnly />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Sign-in Alerts</span>
          <span className="settings-toggle-sublabel">Email me when there&apos;s a new sign-in to my account.</span>
        </div>
        <label className="settings-toggle-switch">
          <input
            type="checkbox"
            checked={settings.signInAlerts}
            disabled={savingAlerts}
            onChange={(e) => handleToggleSignInAlerts(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>
    </>
  );
}
