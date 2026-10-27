'use client';

export default function WebhooksPanel() {
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <h3>Webhooks</h3>
      </div>
      <p className="settings-panel-desc">Send sitevento events to your own server.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Endpoint URL</label>
        <input className="settings-text-input" placeholder="https://yourapp.com/webhooks/sitevento" />
      </div>

      <div className="settings-input-group">
        <label>Events to Send</label>
        <select className="settings-select">
          <option>All Events</option>
          <option>New Visit</option>
          <option>New Lead</option>
          <option>Widget Interaction</option>
          <option>Site Connected</option>
          <option>Site Disconnected</option>
        </select>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Enable Webhook</span>
          <span className="settings-toggle-sublabel">Start sending events to the endpoint above.</span>
        </div>
        <label className="settings-toggle-switch">
          <input type="checkbox" />
          <span className="slider" />
        </label>
      </div>

      <button className="settings-save-btn" type="button">
        Save Webhook
      </button>
    </>
  );
}
