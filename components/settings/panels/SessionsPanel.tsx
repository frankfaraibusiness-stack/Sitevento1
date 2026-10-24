'use client';

export default function SessionsPanel() {
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <h3>Active Sessions</h3>
      </div>
      <p className="settings-panel-desc">Where you&apos;re currently signed in.</p>
      <hr className="settings-divider" />

      <div className="settings-placeholder-note">Session history isn&apos;t tracked yet.</div>

      <button className="settings-danger-btn" type="button">
        Sign Out All Other Sessions
      </button>
    </>
  );
}
