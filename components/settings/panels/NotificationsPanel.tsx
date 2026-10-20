'use client';

// components/settings/panels/NotificationsPanel.tsx
//
// Real functions, not placeholders: every toggle here persists to
// Firestore at users/{uid}.settings via useUserSettings, and reloads
// correctly on every page load/refresh (onSnapshot-backed, not local
// state).
import type { UserSettings } from '@/hooks/useUserSettings';

interface NotificationsPanelProps {
  settings: UserSettings;
  settingsLoaded: boolean;
  updateSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
}

export default function NotificationsPanel({ settings, settingsLoaded, updateSettings }: NotificationsPanelProps) {
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
            checked={settings.visitAlerts}
            disabled={!settingsLoaded}
            onChange={(e) => updateSettings({ visitAlerts: e.target.checked })}
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
            checked={settings.leadAlerts}
            disabled={!settingsLoaded}
            onChange={(e) => updateSettings({ leadAlerts: e.target.checked })}
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
            checked={settings.weeklySummary}
            disabled={!settingsLoaded}
            onChange={(e) => updateSettings({ weeklySummary: e.target.checked })}
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
            checked={settings.marketingEmails}
            disabled={!settingsLoaded}
            onChange={(e) => updateSettings({ marketingEmails: e.target.checked })}
          />
          <span className="slider" />
        </label>
      </div>
    </>
  );
}
