// components/dashboard/DashEmptyState.tsx — premium empty state for a
// brand-new account with no sites connected yet.
export function DashEmptyState({ onConnectSite }: { onConnectSite: () => void }) {
  return (
    <div className="dnx-empty-root">
      <div className="dnx-empty-hero">
        <span className="dnx-empty-eyebrow">Welcome to your dashboard</span>
        <h2>Let&apos;s get your first site live</h2>
        <p>
          Connect your first site and this page fills in with real visits, leads, and live control over
          what&apos;s happening on it right now.
        </p>
        <button className="dnx-empty-cta-btn" onClick={onConnectSite}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Connect your site
        </button>
        <div className="dnx-empty-cta-note">Takes about 2 minutes. No engineering required.</div>
      </div>

      <div className="dnx-empty-preview-grid">
        <div className="dnx-empty-preview-card">
          <span className="dnx-empty-preview-badge">Live once connected</span>
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M3 12h4l2 5 4-14 2 9 2-5h4" />
            </svg>
          </div>
          <h4>Visit log</h4>
          <p>Every visitor, page, referrer, and device — searchable the moment they land.</p>
        </div>

        <div className="dnx-empty-preview-card">
          <span className="dnx-empty-preview-badge">Live once connected</span>
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </div>
          <h4>Block visitors</h4>
          <p>See exactly who&apos;s visiting. Block anyone you don&apos;t want coming back, instantly.</p>
        </div>

        <div className="dnx-empty-preview-card">
          <span className="dnx-empty-preview-badge">Live once connected</span>
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 12h16M4 6h16M4 18h10" />
            </svg>
          </div>
          <h4>Live overlays</h4>
          <p>Push a full-screen banner for maintenance mode or an announcement — no redeploy.</p>
        </div>

        <div className="dnx-empty-preview-card">
          <span className="dnx-empty-preview-badge">Live once connected</span>
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 9h18M7 13h4" />
            </svg>
          </div>
          <h4>Email capture</h4>
          <p>Turn visits into leads with the built-in widget — every email lands here.</p>
        </div>
      </div>
    </div>
  );
}
