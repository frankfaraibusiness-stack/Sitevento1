// components/dashboard/DashEmptyState.tsx — premium "before you connect
// a site" state for a brand-new account.
//
// Previously: a plain headline + single CTA button above four
// identical small cards with no real narrative — didn't explain WHY
// connecting matters, just asked for the click.
//
// Redesign: a proper landing-style sell, built from the same --dnx-*
// glass/shadow tokens used across the live dashboard (so it still
// feels native, not bolted on), structured in four readable layers:
//   1. Hero — headline + sub copy + primary CTA, with a live-look
//      "preview panel" mockup showing what the connected dashboard
//      actually looks like (not just an icon — real numbers/labels).
//   2. Benefit cards — each answers "why does this matter to me",
//      not just "what feature is this".
//   3. "How it works" numbered strip — removes the
//      is-this-complicated hesitation up front.
//   4. Closing CTA band — second, lower-friction chance to convert
//      after the reasoning has landed.
export function DashEmptyState({ onConnectSite }: { onConnectSite: () => void }) {
  return (
    <div className="dnx-empty-root">
      {/* ---------- 1. Hero ---------- */}
      <div className="dnx-empty-hero-band">
        <div className="dnx-empty-hero-copy">
          <span className="dnx-empty-eyebrow">Welcome to your dashboard</span>
          <h2>
            Right now, your site is a <em>black box</em>.
          </h2>
          <p>
            People are visiting it today — you just can&apos;t see them. Connect your site and this page
            turns into a live control room: who&apos;s on your site right now, where they came from, and the
            power to act on it instantly.
          </p>

          <button className="dnx-empty-cta-btn" onClick={onConnectSite}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Connect your site
          </button>
          <div className="dnx-empty-cta-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="m5 12 5 5L20 7" />
            </svg>
            Takes about 2 minutes — one snippet, no engineering required
          </div>
        </div>

        {/* Live-look preview mockup: not a feature icon, an actual
            sample of the dashboard this unlocks, so the value is
            visible before the click. */}
        <div className="dnx-empty-preview-panel" aria-hidden="true">
          <div className="dnx-empty-preview-panel-glow" />
          <div className="dnx-empty-preview-chrome">
            <span className="dnx-empty-preview-dot" />
            <span className="dnx-empty-preview-dot" />
            <span className="dnx-empty-preview-dot" />
            <span className="dnx-empty-preview-chrome-label">yoursite.com — live</span>
          </div>

          <div className="dnx-empty-preview-stats">
            <div className="dnx-empty-preview-stat">
              <span className="dnx-empty-preview-stat-label">
                <span className="dnx-empty-live-dot" />
                Live visitors
              </span>
              <span className="dnx-empty-preview-stat-value">247</span>
            </div>
            <div className="dnx-empty-preview-stat">
              <span className="dnx-empty-preview-stat-label">New leads today</span>
              <span className="dnx-empty-preview-stat-value">12</span>
            </div>
          </div>

          <div className="dnx-empty-preview-rows">
            <div className="dnx-empty-preview-row">
              <span className="dnx-empty-preview-row-dot" />
              <span>Visitor from Lagos, NG opened /pricing</span>
              <span className="dnx-empty-preview-row-time">now</span>
            </div>
            <div className="dnx-empty-preview-row">
              <span className="dnx-empty-preview-row-dot" />
              <span>New lead captured via signup form</span>
              <span className="dnx-empty-preview-row-time">2m</span>
            </div>
            <div className="dnx-empty-preview-row is-dim">
              <span className="dnx-empty-preview-row-dot" />
              <span>Returning visitor from last week</span>
              <span className="dnx-empty-preview-row-time">6m</span>
            </div>
          </div>

          <span className="dnx-empty-preview-badge">This is what connecting unlocks</span>
        </div>
      </div>

      {/* ---------- 2. Benefits: why, not just what ---------- */}
      <div className="dnx-empty-section-head">
        <h3>What changes the moment you connect</h3>
        <p>Four things you can&apos;t do today — and can do the second your site is live here.</p>
      </div>

      <div className="dnx-empty-preview-grid">
        <div className="dnx-empty-preview-card">
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M3 12h4l2 5 4-14 2 9 2-5h4" />
            </svg>
          </div>
          <h4>Stop guessing who's visiting</h4>
          <p>
            Every visitor, page, referrer, and device — searchable the moment they land. No more wondering
            where your traffic is actually coming from.
          </p>
        </div>

        <div className="dnx-empty-preview-card">
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </div>
          <h4>Shut out the visitors you don't want</h4>
          <p>
            See exactly who&apos;s on your site — bots, scrapers, bad actors — and block any of them
            instantly. No code changes, no waiting on a deploy.
          </p>
        </div>

        <div className="dnx-empty-preview-card">
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M4 12h16M4 6h16M4 18h10" />
            </svg>
          </div>
          <h4>Push a message without a redeploy</h4>
          <p>
            Maintenance mode, a launch banner, an urgent notice — publish a full-screen overlay to every
            visitor in seconds, straight from this dashboard.
          </p>
        </div>

        <div className="dnx-empty-preview-card">
          <div className="dnx-empty-preview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 9h18M7 13h4" />
            </svg>
          </div>
          <h4>Turn visits into an actual list</h4>
          <p>
            Drop in the built-in email capture widget and every address lands here automatically — a
            growing list instead of traffic that just disappears.
          </p>
        </div>
      </div>

      {/* ---------- 3. How it works ---------- */}
      <div className="dnx-empty-steps">
        <div className="dnx-empty-step">
          <span className="dnx-empty-step-num">1</span>
          <div>
            <h5>Add your site</h5>
            <p>Paste your site&apos;s URL — we generate a single tracking snippet for it.</p>
          </div>
        </div>
        <div className="dnx-empty-step-connector" aria-hidden="true" />
        <div className="dnx-empty-step">
          <span className="dnx-empty-step-num">2</span>
          <div>
            <h5>Paste one snippet</h5>
            <p>Drop it before <code>&lt;/head&gt;</code> — no package installs, no backend changes.</p>
          </div>
        </div>
        <div className="dnx-empty-step-connector" aria-hidden="true" />
        <div className="dnx-empty-step">
          <span className="dnx-empty-step-num">3</span>
          <div>
            <h5>Watch it go live</h5>
            <p>This page fills in with real visitors within seconds of your next page load.</p>
          </div>
        </div>
      </div>

      {/* ---------- 4. Closing CTA ---------- */}
      <div className="dnx-empty-closing">
        <div>
          <h4>Your dashboard is ready. Your site just isn&apos;t connected yet.</h4>
          <p>Two minutes, one snippet — then every number on this page is real.</p>
        </div>
        <button className="dnx-empty-cta-btn dnx-empty-cta-btn--ghost" onClick={onConnectSite}>
          Connect your site
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
