'use client';

// components/settings/panels/AppearancePanel.tsx
//
// Real functions, not placeholders: every choice here persists to
// Firestore at users/{uid}.settings via useUserSettings, reloads on
// every page load, AND actually changes the app — SettingsPageClient
// applies settings.fontSize/compactMode to <html data-font-size>/
// [data-compact] the moment they load or change (see its own effect),
// and styles/settings/settings-page.css + base.css read those attributes to
// resize text and tighten spacing across the dashboard, not just this
// page. Dashboard Landing View is persisted and read by
// DashboardClient on load to pick the opening panel.
import type { UserSettings } from '@/hooks/useUserSettings';

const FONT_SIZES: { key: UserSettings['fontSize']; label: string; glyphSize: string }[] = [
  { key: 'small', label: 'Small', glyphSize: '0.72rem' },
  { key: 'medium', label: 'Medium', glyphSize: '0.9rem' },
  { key: 'large', label: 'Large', glyphSize: '1.1rem' },
];

const LANDING_VIEWS: { value: UserSettings['landingView']; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'visits', label: 'Visit Logs' },
  { value: 'leads', label: 'Email Capture' },
  { value: 'sites', label: 'Connected Sites' },
];

interface AppearancePanelProps {
  settings: UserSettings;
  settingsLoaded: boolean;
  settingsSaving: boolean;
  updateSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
}

export default function AppearancePanel({ settings, settingsLoaded, settingsSaving, updateSettings }: AppearancePanelProps) {
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 0 20" />
        </svg>
        <h3>Appearance</h3>
      </div>
      <p className="settings-panel-desc">Adjust how the dashboard displays for you.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Font Size</label>
        <p className="settings-field-desc">Applies across the dashboard. Saved automatically.</p>
        <div className="settings-picker-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {FONT_SIZES.map((f) => {
            const active = settings.fontSize === f.key;
            return (
              <button
                key={f.key}
                type="button"
                className={`settings-picker-btn${active ? ' active' : ''}`}
                disabled={!settingsLoaded}
                onClick={() => updateSettings({ fontSize: f.key })}
              >
                <span style={{ fontSize: f.glyphSize }}>Aa</span>
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Compact Mode</span>
          <span className="settings-toggle-sublabel">Reduce spacing to fit more content on screen.</span>
        </div>
        <label className="settings-toggle-switch">
          <input
            type="checkbox"
            checked={settings.compactMode}
            disabled={!settingsLoaded}
            onChange={(e) => updateSettings({ compactMode: e.target.checked })}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-input-group">
        <label>Dashboard Landing View</label>
        <p className="settings-field-desc">Which panel opens first when you sign in. Saved automatically.</p>
        <select
          className="settings-select"
          value={settings.landingView}
          disabled={!settingsLoaded}
          onChange={(e) => updateSettings({ landingView: e.target.value as UserSettings['landingView'] })}
        >
          {LANDING_VIEWS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {settingsSaving && <span className="settings-hint">Saving…</span>}
    </>
  );
}
