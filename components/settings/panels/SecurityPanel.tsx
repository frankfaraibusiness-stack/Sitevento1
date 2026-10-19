'use client';

export default function SecurityPanel() {
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
        <p className="settings-field-desc">Change the password used to sign in.</p>
        <button className="settings-save-btn" type="button" style={{ background: '#fff', color: 'var(--ink)', border: '1px solid var(--line)' }}>
          Change Password
        </button>
      </div>

      <hr className="settings-divider" />

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Two-Factor Authentication</span>
          <span className="settings-toggle-sublabel">Require a code from your phone when signing in.</span>
        </div>
        <label className="settings-toggle-switch">
          <input type="checkbox" />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Sign-in Alerts</span>
          <span className="settings-toggle-sublabel">Email me when there&apos;s a new sign-in to my account.</span>
        </div>
        <label className="settings-toggle-switch">
          <input type="checkbox" defaultChecked />
          <span className="slider" />
        </label>
      </div>
    </>
  );
}
