// components/marketing/PricingPage.tsx — the dedicated /pricing route's
// content. Rebuilt from zero to replace the old PricingTablePage (now
// deleted), which rendered one wide comparison <table> inside a
// horizontal-scroll container — on a phone that meant a narrow strip
// of the table plus a "scroll sideways to see the rest" interaction,
// the opposite of a good mobile layout.
//
// This version is a plan-card stack instead: each plan is its own
// full-width card (name, price, writes/day, a short highlight list,
// a CTA), and <= 639px those cards simply stack top to bottom — no
// horizontal scrolling, no cut-off columns, just normal vertical
// scrolling, which is the natural reading motion on a phone. At
// >= 900px the cards lay out side by side in a row instead (see
// styles/marketing/pricing-page.css's breakpoint), so desktop still
// gets the at-a-glance side-by-side comparison a table gave, without
// actually using a <table> (a CSS grid of cards reflows far more
// gracefully across breakpoints than a table does).
//
// Built on ContentPageShell — the same shared chrome every other
// rebuilt content route uses (About, Status, Changelog, ...) — so this
// page gets the real app header (see components/layout/ContentHeader.tsx)
// instead of the bare back-link the old PricingTablePage rendered via
// its own copy of the .legal-topbar markup.
import { PLANS } from '@/lib/plans';
import { dailyWriteLimit } from '@/lib/limits';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';

function formatRetention(days: number | null): string {
  return days === null ? 'Unlimited visit history' : `${days}-day visit history`;
}

function formatWrites(limit: number | null): string {
  return limit === null ? 'Unlimited writes/day' : `${limit.toLocaleString()} writes/day`;
}

const FAQS: { id: string; q: string; a: string }[] = [
  {
    id: 'widget-limits',
    q: 'How does the live-widget limit work?',
    a: 'Every plan caps how many widgets can be live on a single connected site at the same time: 3 on Free, 5 on Starter, 10 on Scale, 15 on Pro Developer. A live widget is one currently switched on and rendering for visitors — a contact-chat widget, an email capture form, and a visitor-tracking badge would already use 3 slots. To turn on one more than your limit, disable an existing live widget first; switching which ones are live is instant and never deletes a paused widget\u2019s configuration. What also scales with your plan is how many widgets you can have configured and parked per site, and how many sites you can run your own live-widget allowance on.',
  },
  {
    id: 'per-site',
    q: 'Are limits per site, or pooled across my account?',
    a: 'Per connected site, not pooled. A Pro Developer account with 30 sites connected gets up to 30 configured widgets on each of those 30 sites \u2014 not 30 total spread across the account. The same goes for automation rules.',
  },
  {
    id: 'visitor-blocking',
    q: 'Why isn\u2019t visitor blocking on the Free plan?',
    a: 'Free is built to prove out visit logging and a first lead-capture widget on one site before you commit to a paid plan. Blocking individual visitors \u2014 along with live overlays and unlimited history \u2014 is a Starter-and-up feature.',
  },
  {
    id: 'upgrading',
    q: 'Can I change plans later?',
    a: 'Yes, any time from your dashboard. If you downgrade to a plan with a lower connected-site limit than the number of sites you currently have connected, you\u2019ll need to disconnect sites down to the new limit before the change takes effect \u2014 nothing is deleted automatically out from under you.',
  },
];

export function PricingPage() {
  return (
    <ContentPageShell
      eyebrow="pricing"
      title="Plans and limits, laid out in full"
      subtitle="Four plans, from a free single-site tier to a 30-site Pro Developer plan. No hidden limits — everything that caps out by plan is listed below."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '4', label: 'plans' },
        { value: '$0', label: 'to start' },
      ]}
    >
      <div className="pp-grid">
        {PLANS.map((p) => (
          <div key={p.id} className={`pp-card${p.featured ? ' is-featured' : ''}`}>
            {p.featured && <span className="pp-card-badge">Most popular</span>}
            <p className="pp-card-name">{p.name}</p>
            <p className="pp-card-tagline">{p.tagline}</p>
            <p className="pp-card-price">
              {p.priceDisplay}
              <span>/mo</span>
            </p>
            <p className="pp-card-writes">{formatWrites(dailyWriteLimit(p.id))}</p>

            <ul className="pp-card-features">
              <li>{p.limits.connectedSites} connected site{p.limits.connectedSites === 1 ? '' : 's'}</li>
              <li>{formatRetention(p.limits.historyRetentionDays)}</li>
              <li>{p.limits.liveWidgetsPerSite} live widgets per site</li>
              {p.highlights
                .slice(4)
                .filter((h) => !/writes\/day/.test(h))
                .map((h) => (
                  <li key={h}>{h}</li>
                ))}
            </ul>

            <a href="/" className={`pp-card-cta${p.featured ? ' is-featured' : ''}`}>
              {p.cta}
            </a>
          </div>
        ))}
      </div>

      <section className="cp-card" aria-labelledby="pp-faq-heading">
        <h2 id="pp-faq-heading">Questions about plans</h2>
        {FAQS.map((f) => (
          <div className="pp-faq-item" key={f.id} id={f.id}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>
    </ContentPageShell>
  );
}
