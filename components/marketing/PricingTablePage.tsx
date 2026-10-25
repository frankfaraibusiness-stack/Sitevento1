// components/marketing/PricingTablePage.tsx — the dedicated /pricing
// route's content. Reuses the same .legal-topbar / .legal-hero chrome
// as components/legal/LegalPage.tsx (so this page matches the rest of
// the statically-rendered, crawlable content routes visually) but
// swaps the prose-sections body for a full plan comparison table,
// since that's what someone landing on /pricing actually wants: the
// numbers, side by side, not paragraphs. The page footer is the one
// shared components/layout/SiteFooter.tsx — same component every
// other marketing/content page renders — not a page-specific one.
import { PLANS } from '@/lib/plans';
import { SiteFooter } from '@/components/layout/SiteFooter';

function formatRetention(days: number | null): string {
  return days === null ? 'Unlimited' : `${days} days`;
}

function yesNo(v: boolean): string {
  return v ? 'Yes' : 'No';
}

export function PricingTablePage() {
  return (
    <div className="legal-page">
      <div className="legal-topbar">
        <a className="legal-back" href="/">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          sitevento
        </a>
      </div>

      <div className="legal-hero">
        <div className="legal-hero-inner">
          <span className="legal-eyebrow">
            <span className="dot" />
            pricing
          </span>
          <h1>Plans and limits, laid out in full</h1>
          <p className="legal-updated">
            Four plans, from a free single-site tier to a 30-site Pro Developer plan. No hidden limits — everything
            that caps out by plan is listed below.
          </p>
        </div>
      </div>

      <div className="pricing-table-wrap">
        <div className="pricing-table-scroll">
          <table className="pricing-table">
            <thead>
              <tr>
                <th scope="col" className="pricing-table-row-label">Plan</th>
                {PLANS.map((p) => (
                  <th scope="col" key={p.id} className={p.featured ? 'pricing-table-featured-col' : undefined}>
                    <div className="pricing-table-plan-name">{p.name}</div>
                    <div className="pricing-table-plan-price">
                      {p.priceDisplay}
                      <span>/mo</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Connected sites</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{p.limits.connectedSites}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Visit history retention</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{formatRetention(p.limits.historyRetentionDays)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Widgets configured per site</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{p.limits.widgetsPerSite}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Live widgets per site, at once</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{p.limits.liveWidgetsPerSite}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Block visitors from dashboard</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{yesNo(p.limits.canBlockVisitors)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Live overlays &amp; announcements</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{yesNo(p.limits.liveOverlays)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Automation rules per site</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{p.limits.automation ? p.limits.automationRulesPerSite : 'Not included'}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Team seats</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{p.limits.teamSeats}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Support</th>
                {PLANS.map((p) => (
                  <td key={p.id} className="pricing-table-support">
                    {p.limits.support}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="pricing-table-ctas-scroll">
          <div className="pricing-table-ctas">
            {PLANS.map((p) => (
              <a key={p.id} href="/" className={`pricing-table-cta${p.featured ? ' featured' : ''}`}>
                {p.cta}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="legal-body">
        <div className="legal-body-inner pricing-faq-inner">
          <div />
          <div className="legal-content">
            <section id="widget-limits">
              <h2>How the live-widget limit actually works</h2>
              <p>
                Every plan caps how many widgets can be <strong>live</strong> on a single connected site at the same
                time — and that cap now scales with your plan: <strong>3</strong> on Free, <strong>5</strong> on
                Starter, <strong>10</strong> on Scale, and <strong>15</strong> on Pro Developer. A live widget is one
                currently switched on and rendering for visitors — a contact-chat widget, an email capture form, and
                a visitor-tracking badge would already use up 3 slots. To turn on one more than your plan&apos;s
                limit, you&apos;d disable an existing live widget first; switching which ones are live is instant and
                doesn&apos;t delete the paused widget&apos;s configuration.
              </p>
              <p>
                What also scales with your plan is how many widgets you can have <strong>configured</strong> and
                parked per site (so switching between them is instant) and how many separate sites you can run your
                own live-widget allowance on.
              </p>
            </section>
            <section id="per-site">
              <h2>Limits are per connected site, not pooled</h2>
              <p>
                Widget and automation limits apply to each connected site individually. A Pro Developer account with
                30 sites connected gets up to 30 configured widgets on <em>each</em> of those 30 sites — not 30 total
                spread across the account. The same goes for automation rules.
              </p>
            </section>
            <section id="visitor-blocking">
              <h2>Why visitor blocking isn&apos;t on the Free plan</h2>
              <p>
                Free is built to prove out visit logging and a first lead-capture widget on one site before you
                commit to a paid plan. Blocking individual visitors — along with live overlays and unlimited history
                — is a Starter-and-up feature. See <a href="/product/visit-logs">visit logs</a> for what Free still
                includes.
              </p>
            </section>
            <section id="upgrading">
              <h2>Changing plans later</h2>
              <p>
                You can upgrade or downgrade from your dashboard at any time. If you downgrade to a plan with a
                lower connected-site limit than the number of sites you currently have connected, you&apos;ll need to
                disconnect sites down to the new limit before the change takes effect — nothing is deleted
                automatically out from under you.
              </p>
            </section>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
