'use client';

export default function WidgetDefaultsPanel() {
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
        </svg>
        <h3>Widget Defaults</h3>
      </div>
      <p className="settings-panel-desc">Default settings applied to any new widget you add to a site.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Default Position</label>
        <select className="settings-select">
          <option>Bottom Right</option>
          <option>Bottom Left</option>
          <option>Top Right</option>
          <option>Top Left</option>
        </select>
      </div>

      <div className="settings-input-group">
        <label>Default Theme</label>
        <select className="settings-select">
          <option>Match site colors</option>
          <option>Light</option>
          <option>Dark</option>
        </select>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Auto-enable New Widgets</span>
          <span className="settings-toggle-sublabel">Turn new widgets on by default when added to a site.</span>
        </div>
        <label className="settings-toggle-switch">
          <input type="checkbox" />
          <span className="slider" />
        </label>
      </div>
    </>
  );
}
