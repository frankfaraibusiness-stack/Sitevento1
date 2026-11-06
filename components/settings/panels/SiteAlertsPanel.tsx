'use client';

export default function SiteAlertsPanel() {
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <circle cx="12" cy="3" r="1.5" />
        </svg>
        <h3>Site Alerts</h3>
      </div>
      <p className="settings-panel-desc">How you&apos;re alerted about activity on your connected sites.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Alert Threshold</label>
        <select className="settings-select">
          <option>Any activity</option>
          <option>Unusual traffic spikes only</option>
          <option>Errors only</option>
        </select>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Push Notifications</span>
          <span className="settings-toggle-sublabel">Send a browser push notification for live alerts.</span>
        </div>
        <label className="settings-toggle-switch">
          <input type="checkbox" />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Site Down Alerts</span>
          <span className="settings-toggle-sublabel">Notify me if a connected site stops responding.</span>
        </div>
        <label className="settings-toggle-switch">
          <input type="checkbox" defaultChecked />
          <span className="slider" />
        </label>
      </div>
    </>
  );
}
