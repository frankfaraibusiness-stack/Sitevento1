'use client';

export default function PrivacyPanel() {
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <h3>Privacy &amp; Data</h3>
      </div>
      <p className="settings-panel-desc">Control how visitor data is collected and kept.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Visit Log Retention</label>
        <select className="settings-select">
          <option>30 days</option>
          <option>90 days</option>
          <option>1 year</option>
          <option>Unlimited</option>
        </select>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Anonymize IP Addresses</span>
          <span className="settings-toggle-sublabel">Store visitor IPs in a masked form.</span>
        </div>
        <label className="settings-toggle-switch">
          <input type="checkbox" defaultChecked />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-input-group">
        <label>Export My Data</label>
        <button className="settings-save-btn settings-save-btn-ghost" type="button">
          Request Data Export
        </button>
      </div>
    </>
  );
}
