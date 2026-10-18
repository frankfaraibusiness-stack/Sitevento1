'use client';

import type { SettingsState } from '@/hooks/useSettingsState';

export default function NotificationsPanel({
  state,
  setState,
}: {
  state: SettingsState;
  setState: React.Dispatch<React.SetStateAction<SettingsState>>;
}) {
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <h3>Notifications</h3>
      </div>
      <p className="settings-panel-desc">Choose what sitevento emails you about.</p>
      <hr className="settings-divider" />

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">New Visitor Alerts</span>
          <span className="settings-toggle-sublabel">Get notified when a connected site gets a visit spike.</span>
        </div>
        <label className="settings-toggle-switch">
          <input
            type="checkbox"
            checked={state.visitAlerts}
            onChange={(e) => setState((p) => ({ ...p, visitAlerts: e.target.checked }))}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">New Lead Alerts</span>
          <span className="settings-toggle-sublabel">Email me when an email-capture widget gets a new lead.</span>
        </div>
        <label className="settings-toggle-switch">
          <input
            type="checkbox"
            checked={state.leadAlerts}
            onChange={(e) => setState((p) => ({ ...p, leadAlerts: e.target.checked }))}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Weekly Summary</span>
          <span className="settings-toggle-sublabel">A weekly digest of visits, leads, and widget activity.</span>
        </div>
        <label className="settings-toggle-switch">
          <input
            type="checkbox"
            checked={state.weeklySummary}
            onChange={(e) => setState((p) => ({ ...p, weeklySummary: e.target.checked }))}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Product &amp; Tips Emails</span>
          <span className="settings-toggle-sublabel">Occasional emails about new features.</span>
        </div>
        <label className="settings-toggle-switch">
          <input
            type="checkbox"
            checked={state.marketingEmails}
            onChange={(e) => setState((p) => ({ ...p, marketingEmails: e.target.checked }))}
          />
          <span className="slider" />
        </label>
      </div>
    </>
  );
}
