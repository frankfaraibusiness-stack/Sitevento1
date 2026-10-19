'use client';

export default function DangerZonePanel() {
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h3>Danger Zone</h3>
      </div>
      <p className="settings-panel-desc">Irreversible actions. Be careful.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Disconnect All Sites</label>
        <p className="settings-field-desc">Removes every connected site from your account.</p>
        <button className="settings-danger-btn" type="button">
          Disconnect All Sites
        </button>
      </div>

      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Delete Account</label>
        <p className="settings-field-desc">Permanently deletes your account and all associated data.</p>
        <button className="settings-danger-btn" type="button">
          Delete My Account
        </button>
      </div>
    </>
  );
}
