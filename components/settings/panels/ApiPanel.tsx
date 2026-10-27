'use client';

export default function ApiPanel() {
  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <h3>API Keys</h3>
      </div>
      <p className="settings-panel-desc">Keys used to talk to the sitevento widget and tracking APIs.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Live API Key</label>
        <div className="settings-kv-row">
          <span className="kv-value">sv_live_••••••••••••••••</span>
          <button type="button" className="settings-icon-btn" aria-label="Copy">
            <svg viewBox="0 0 24 24" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button type="button" className="settings-icon-btn" aria-label="Regenerate">
            <svg viewBox="0 0 24 24" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      <div className="settings-input-group">
        <label>Test API Key</label>
        <div className="settings-kv-row">
          <span className="kv-value">sv_test_••••••••••••••••</span>
          <button type="button" className="settings-icon-btn" aria-label="Copy">
            <svg viewBox="0 0 24 24" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button type="button" className="settings-icon-btn" aria-label="Regenerate">
            <svg viewBox="0 0 24 24" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>API Access</label>
        <select className="settings-select">
          <option>Read &amp; Write</option>
          <option>Read Only</option>
          <option>Disabled</option>
        </select>
        <span className="settings-hint">Controls what your API key is allowed to do.</span>
      </div>

      <div className="settings-input-group">
        <label>Allowed Domains</label>
        <input className="settings-text-input" placeholder="example.com, app.example.com" />
        <span className="settings-hint">Requests from other domains will be rejected.</span>
      </div>
    </>
  );
}
