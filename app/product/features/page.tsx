// app/product/features/page.tsx — Features overview page, built on the
// same ContentPageShell every other rebuilt marketing route uses (see
// app/product/email-capture/page.tsx's header comment for the shell's
// rationale). Pure SEO/marketing content: a Server Component with no
// data fetching and no auth — lists every capability sitevento has
// (the same catalog lib/connectPermissions.ts enforces in the connect
// wizard) as plain, hand-written copy for this page, grouped under the
// same five categories that file uses. This is the page the sidebar's
// "Features" link now points to, replacing the old #panelOverlay
// anchor on the signed-in dashboard, which had no SEO identity of its
// own — see components/layout/Sidebar.tsx's updated comment.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Features — Everything Sitevento Does',
  description:
    'Every sitevento feature in one place: widgets, email capture, visit logs, visitor blocking, live overlays, AI support, automation, and more — grouped by what it does for your site.',
  alternates: { canonical: '/product/features' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/product/features`,
    title: 'Features — sitevento',
    description: 'Every sitevento feature in one place, grouped by what it does for your site.',
  },
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

interface FeatureItem {
  label: string;
  description: string;
  minPlan: 'Free' | 'Starter' | 'Scale' | 'Pro Developer';
  href?: string;
}

interface FeatureCategory {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  iconColor: 'blue' | 'green' | 'purple' | 'orange';
  items: FeatureItem[];
}

// Mirrors lib/connectPermissions.ts's catalog (same ids, labels, and
// minPlan tiers that the connect wizard and dashboard enforce) —
// written here as plain copy for this page rather than imported,
// since this route is pure marketing content with no backend wiring.
const CATEGORIES: FeatureCategory[] = [
  {
    id: 'visitor-intelligence',
    eyebrow: 'see your traffic',
    title: 'Visitor intelligence',
    intro: 'Know who is landing on your site, where they came from, and what they do once they arrive.',
    iconColor: 'blue',
    items: [
      { label: 'Traffic analytics', description: 'Pageviews, visits, referrers, and session counts, updated in real time.', minPlan: 'Free', href: '/product/visit-logs' },
      { label: 'Device intelligence', description: 'Browser, operating system, device type, and viewport for every visit.', minPlan: 'Free', href: '/product/visit-logs' },
      { label: 'Geographic insights', description: 'Estimated visitor country and city from IP-based geolocation.', minPlan: 'Free', href: '/product/visit-logs' },
      { label: 'Interaction tracking', description: 'Clicks, scroll depth, and on-page interaction patterns.', minPlan: 'Starter' },
      { label: 'Session replay', description: 'Privacy-filtered replays of real visitor sessions, for diagnosing usability issues.', minPlan: 'Scale' },
      { label: 'Data export', description: 'Download raw visit records and captured leads in CSV or JSON.', minPlan: 'Free', href: '/dashboard/leads' },
    ],
  },
  {
    id: 'website-experience',
    eyebrow: 'turn visits into leads',
    title: 'Website experience',
    intro: 'The widgets and on-page moments that turn an anonymous visit into a lead or a conversation.',
    iconColor: 'green',
    items: [
      { label: 'Widget publishing', description: 'Display, update, and pause any sitevento widget from your dashboard — no redeploy.', minPlan: 'Free', href: '/widgets' },
      { label: 'Email capture', description: 'A drop-in widget that asks visitors for their email and logs every submission as a lead.', minPlan: 'Free', href: '/product/email-capture' },
      { label: 'Campaign overlays', description: 'Announcement banners, promotions, and maintenance notices, pushed live in one click.', minPlan: 'Starter', href: '/product/live-overlays' },
      { label: 'Audience targeting', description: 'Choose which pages or visitor segments see a given widget.', minPlan: 'Starter' },
      { label: 'Custom widget styling', description: 'Match colors, typography, and spacing to your brand.', minPlan: 'Starter' },
      { label: 'Conversion experiments', description: 'Run A/B tests on widget variants and compare conversion rates.', minPlan: 'Scale' },
      { label: 'Advanced style overrides', description: 'Apply custom CSS to supported sitevento components.', minPlan: 'Pro Developer' },
    ],
  },
  {
    id: 'protection-automation',
    eyebrow: 'stay in control',
    title: 'Protection & automation',
    intro: 'Control who can see your site and automate the busywork of keeping it that way.',
    iconColor: 'orange',
    items: [
      { label: 'Visitor access control', description: 'Block and unblock specific visitors directly from your visit logs.', minPlan: 'Starter', href: '/product/visit-logs' },
      { label: 'Threat response', description: 'Automated rules that respond to suspected bots and abusive traffic.', minPlan: 'Scale' },
      { label: 'Geographic restrictions', description: 'Restrict access from selected countries.', minPlan: 'Scale' },
      { label: 'Scheduled publishing', description: 'Schedule widgets and campaigns to turn on or off automatically.', minPlan: 'Starter' },
      { label: 'Event-driven workflows', description: 'Trigger configured actions automatically when a visitor event occurs.', minPlan: 'Starter' },
      { label: 'Advanced rule engine', description: 'Combine multiple conditions, exceptions, and workflow actions.', minPlan: 'Pro Developer' },
    ],
  },
  {
    id: 'ai-support',
    eyebrow: 'help visitors in real time',
    title: 'AI & support',
    intro: 'A configurable AI agent that can greet, answer, and assist visitors right on your site.',
    iconColor: 'purple',
    items: [
      { label: 'AI response service', description: 'Let a configured AI agent respond automatically in the support chat.', minPlan: 'Starter' },
      { label: 'AI knowledge configuration', description: 'Manage the instructions and approved knowledge the AI draws on.', minPlan: 'Starter' },
      { label: 'Support intelligence', description: 'Review conversation history and surfaced customer-service insights.', minPlan: 'Scale' },
      { label: 'AI action autonomy', description: 'Let explicitly approved AI workflows take defined actions within set limits.', minPlan: 'Pro Developer' },
    ],
  },
  {
    id: 'integrations-admin',
    eyebrow: 'connect everything',
    title: 'Integrations & admin',
    intro: 'Wire sitevento into the rest of your stack, and manage who on your team can touch what.',
    iconColor: 'blue',
    items: [
      { label: 'Event delivery', description: 'Send visit, lead, and access-control events to your own endpoints.', minPlan: 'Scale' },
      { label: 'Integration connections', description: 'Connect supported CRM, Zapier, and Make workflows.', minPlan: 'Scale' },
      { label: 'External alerts', description: 'Send notifications to Slack and supported monitoring destinations.', minPlan: 'Scale' },
      { label: 'Page-context access', description: 'Read explicitly permitted page content for contextual widget targeting.', minPlan: 'Scale' },
      { label: 'Cross-site identity', description: 'Recognize consented visitors across your connected sites.', minPlan: 'Pro Developer' },
      { label: 'Team dashboard access', description: 'Let authorized teammates view a connected site\u2019s dashboard.', minPlan: 'Free' },
      { label: 'Delegated site management', description: 'Grant approved teammates permission to modify settings and widgets.', minPlan: 'Scale' },
      { label: 'Administrative audit trail', description: 'Record sensitive configuration changes made by your team.', minPlan: 'Starter' },
    ],
  },
];

export default function FeaturesPage() {
  const totalFeatures = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <ContentPageShell
      eyebrow="product"
      title="Everything sitevento does"
      subtitle="One tag on your site unlocks visitor intelligence, lead capture, live overlays, protection, and AI support — all managed from a single dashboard."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: String(totalFeatures), label: 'features' },
        { value: '5', label: 'categories' },
        { value: '1 tag', label: 'to enable them all' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">Overview</span>
        <h2>One tag, five categories of capability</h2>
        <p>
          Every feature below runs through the same lightweight snippet that powers sitevento&apos;s core tracking —
          there&apos;s nothing extra to install. Turn a feature on from your dashboard and it goes live immediately,
          no redeploy and no code changes to your site. What&apos;s available depends on your plan; see{' '}
          <a href="/pricing">pricing</a> for the full breakdown.
        </p>
      </section>

      {CATEGORIES.map((category) => (
        <section className="cp-card" key={category.id} id={category.id}>
          <span className="cp-card-eyebrow">{category.eyebrow}</span>
          <h2>{category.title}</h2>
          <p>{category.intro}</p>
          <div className="cp-grid cp-grid-3">
            {category.items.map((item) => {
              const inner = (
                <>
                  <div className={`cp-tile-icon ${category.iconColor}`}>
                    <CheckIcon />
                  </div>
                  <h3>{item.label}</h3>
                  <p>{item.description}</p>
                  <span className="cp-badge" style={{ marginTop: 10 }}>
                    {item.minPlan}
                    {item.minPlan !== 'Free' ? '+' : ''}
                  </span>
                </>
              );
              return item.href ? (
                <a className="cp-tile" href={item.href} key={item.label} style={{ display: 'block', textDecoration: 'none' }}>
                  {inner}
                </a>
              ) : (
                <div className="cp-tile" key={item.label}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="cp-card">
        <span className="cp-card-eyebrow">faq</span>
        <h2>Common questions</h2>
        <div className="cp-accordion">
          <details className="cp-accordion-item" open>
            <summary>
              Do I need to install anything to use these features?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                No. One snippet connects your site to sitevento and powers every feature above. Turning a feature on
                or off happens entirely from your dashboard — nothing to redeploy on your end.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Which features are available on the Free plan?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Traffic analytics, device intelligence, geographic insights, widget publishing, email capture, data
                export, and team dashboard access are all available on Free. Everything else unlocks as you move up
                in plan — see <a href="/pricing">pricing</a> for the complete comparison.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Can I try a higher-tier feature before upgrading?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Several features — like data export and visitor blocking — give Free accounts a small daily trial so
                you can see them work before deciding to upgrade. Others are plan-gated outright. Your dashboard
                always shows which tier a feature needs.
              </p>
            </div>
          </details>
        </div>
      </section>

      <a className="cp-banner" href="/dashboard">
        <div className="cp-banner-copy">
          <h4>See it running on your own site</h4>
          <p>Connect your site and turn on the features that matter to you in minutes.</p>
        </div>
        <span className="cp-banner-cta">
          Go to dashboard
          <ArrowIcon />
        </span>
      </a>

      <section className="cp-card">
        <span className="cp-card-eyebrow">See also</span>
        <h2>Dig into a specific feature</h2>
        <p>
          Read more about <a href="/product/email-capture">email capture</a>,{' '}
          <a href="/product/visit-logs">visit logs</a>, <a href="/product/live-overlays">live overlays</a>, or{' '}
          <a href="/product/dashboard">the dashboard overview</a> — or{' '}
          <a href="/contact">contact us</a> if you&apos;re not sure what fits your site.
        </p>
      </section>
    </ContentPageShell>
  );
}
