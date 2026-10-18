'use client';

import type { User } from 'firebase/auth';

export default function AccountPanel({ user }: { user: User | null }) {
  const name = user?.displayName || (user?.email ? user.email.split('@')[0] : 'Account');
  const email = user?.email || '';

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
        <input className="settings-text-input" defaultValue={name} placeholder="Your name" />
      </div>

      <div className="settings-input-group">
        <label>Email</label>
        <input className="settings-text-input" defaultValue={email} disabled />
        <span className="settings-hint">Your sign-in email can&apos;t be changed here.</span>
      </div>

      <div className="settings-input-group">
        <label>Time Zone</label>
        <select className="settings-select">
          <option>Auto-detect from browser</option>
          <option>UTC</option>
          <option>Eastern Time (US)</option>
          <option>Central Time (US)</option>
          <option>Mountain Time (US)</option>
          <option>Pacific Time (US)</option>
          <option>London (GMT/BST)</option>
          <option>Central Europe (CET)</option>
        </select>
        <span className="settings-hint">Used for timestamps on visit logs and reports.</span>
      </div>

      <button className="settings-save-btn" type="button">
        Save Changes
      </button>
    </>
  );
}
