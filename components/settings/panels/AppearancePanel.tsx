'use client';

import type { SettingsState } from '@/hooks/useSettingsState';

const FONT_SIZES: { key: 'small' | 'medium' | 'large'; label: string; glyphSize: string }[] = [
  { key: 'small', label: 'Small', glyphSize: '0.72rem' },
  { key: 'medium', label: 'Medium', glyphSize: '0.9rem' },
  { key: 'large', label: 'Large', glyphSize: '1.1rem' },
];

export default function AppearancePanel({
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
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 0 20" />
        </svg>
        <h3>Appearance</h3>
      </div>
      <p className="settings-panel-desc">Adjust how the dashboard displays for you.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Font Size</label>
        <p className="settings-field-desc">Applies across the dashboard.</p>
        <div className="settings-picker-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {FONT_SIZES.map((f) => {
            const active = state.fontSize === f.key;
            return (
              <button
                key={f.key}
                type="button"
                className={`settings-picker-btn${active ? ' active' : ''}`}
                onClick={() => setState((p) => ({ ...p, fontSize: f.key }))}
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
            checked={state.compactMode}
            onChange={(e) => setState((p) => ({ ...p, compactMode: e.target.checked }))}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-input-group">
        <label>Dashboard Landing View</label>
        <p className="settings-field-desc">Which panel opens first when you sign in.</p>
        <select className="settings-select">
          <option>Overview</option>
          <option>Visit Logs</option>
          <option>Email Capture</option>
          <option>Connected Sites</option>
        </select>
      </div>

      <button className="settings-save-btn" type="button">
        Save Appearance
      </button>
    </>
  );
}
