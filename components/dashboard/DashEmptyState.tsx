// components/dashboard/DashEmptyState.tsx — replaces #dashEmptyState.
export function DashEmptyState({ onConnectSite }: { onConnectSite: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="empty-hero">
        <div className="empty-hero-inner">
          <h2>Your dashboard is ready</h2>
          <p>
            Connect your first site and this page fills in with real visits, leads, and live control over
            what&apos;s happening on it right now.
          </p>
          <button className="empty-cta-btn" onClick={onConnectSite}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Connect your site
          </button>
          <div className="empty-cta-note">Takes about 2 minutes. No engineering required.</div>
        </div>

        <div className="empty-preview-grid">
          <div className="empty-preview-card">
            <span className="epc-badge">Live once connected</span>
            <div className="epc-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M3 12h4l2 5 4-14 2 9 2-5h4" />
              </svg>
            </div>
            <h4>Visit log</h4>
            <p>Every visitor, page, referrer, and device — searchable the moment they land.</p>
            <div className="epc-fake">
              <div className="epc-fake-row" />
              <div className="epc-fake-row" />
              <div className="epc-fake-row short" />
            </div>
          </div>

          <div className="empty-preview-card">
            <span className="epc-badge">Live once connected</span>
            <div className="epc-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="9" />
                <path d="m15 9-6 6M9 9l6 6" />
              </svg>
            </div>
            <h4>Block visitors</h4>
            <p>See exactly who&apos;s visiting. Block anyone you don&apos;t want coming back, instantly.</p>
            <div className="epc-fake">
              <div className="epc-fake-row" />
              <div className="epc-fake-row short" />
            </div>
          </div>

          <div className="empty-preview-card">
            <span className="epc-badge">Live once connected</span>
            <div className="epc-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M4 12h16M4 6h16M4 18h10" />
              </svg>
            </div>
            <h4>Live overlays</h4>
            <p>Push a full-screen banner for maintenance mode or an announcement — no redeploy.</p>
            <div className="epc-fake">
              <div className="epc-fake-row" />
              <div className="epc-fake-row" />
            </div>
          </div>

          <div className="empty-preview-card">
            <span className="epc-badge">Live once connected</span>
            <div className="epc-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 9h18M7 13h4" />
              </svg>
            </div>
            <h4>Email capture</h4>
            <p>Turn visits into leads with the built-in widget — every email lands here.</p>
            <div className="epc-fake">
              <div className="epc-fake-row short" />
              <div className="epc-fake-row" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
