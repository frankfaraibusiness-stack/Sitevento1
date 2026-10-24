// app/product/dashboard/page.tsx — Dashboard product page, rebuilt on
// ContentPageShell. See app/product/visit-logs/page.tsx's header
// comment for the full rationale this mirrors. CTA points to the real
// /dashboard app route, not back into this info page.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Dashboard — Everything That Happens On Your Site',
  description:
    'One dashboard for every site you connect: visit logs, leads, widgets, and live overlays — no switching between separate tools for analytics, forms, and announcements.',
  alternates: { canonical: '/product/dashboard' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/product/dashboard`,
    title: 'Dashboard — sitevento',
    description: 'One dashboard for every site you connect.',
  },
};

export default function DashboardProductPage() {
  return (
    <ContentPageShell
      eyebrow="product"
      title="One dashboard. Every site you connect."
      subtitle="Visit logs, leads, widgets, and live overlays, all in one place — no switching between separate tools for analytics, forms, and announcements."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '1', label: 'dashboard, every site' },
        { value: '30', label: 'sites on Pro Developer' },
        { value: '<2min', label: 'typical setup time' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">The problem it solves</span>
        <h2>Everything that happens on your site, in one place</h2>
        <p>
          Most teams stitch together an analytics tool, a form builder, and some way to post a maintenance banner —
          three logins, three bills, none of them talking to each other. sitevento replaces that stack with a
          single dashboard: connect a site once, and visit logs, lead capture, and live overlays all live under the
          same account.
        </p>
        <div className="cp-badge-row">
          <span className="cp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            One login
          </span>
          <span className="cp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            One bill
          </span>
          <span className="cp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            One script tag
          </span>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Multi-site</span>
        <h2>Manage more than one site without switching tools</h2>
        <p>
          Add multiple sites to one account and switch between them from the same dashboard — each with its own
          independent visit history, leads, and widget configuration.
        </p>
        <div className="cp-stat-strip">
          <div className="cp-stat-strip-item">
            <span className="cp-stat-strip-value">Free: 1</span>
            <span className="cp-stat-strip-label">connected site</span>
          </div>
          <div className="cp-stat-strip-item">
            <span className="cp-stat-strip-value">Starter: 5</span>
            <span className="cp-stat-strip-label">connected sites</span>
          </div>
          <div className="cp-stat-strip-item">
            <span className="cp-stat-strip-value">Scale: 15</span>
            <span className="cp-stat-strip-label">connected sites</span>
          </div>
          <div className="cp-stat-strip-item">
            <span className="cp-stat-strip-value">Pro Dev: 30</span>
            <span className="cp-stat-strip-label">connected sites</span>
          </div>
        </div>
        <p style={{ marginTop: 10 }}>See <a href="/pricing">pricing</a> for the full breakdown.</p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">What's inside</span>
        <h2>Widgets and overlays, controlled from the same screen</h2>
        <div className="cp-grid cp-grid-3">
          <div className="cp-tile">
            <div className="cp-tile-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" /><path d="M18.4 8.6 13 14l-3.5-3.5L4 16" />
              </svg>
            </div>
            <h3>Visit logs</h3>
            <p>See who&apos;s on your site in real time, with the ability to block a visitor right from the log.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
              </svg>
            </div>
            <h3>Email capture</h3>
            <p>Lead-capture widgets you configure and toggle live from the dashboard, no code required.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16" />
              </svg>
            </div>
            <h3>Live overlays</h3>
            <p>Push a full-site announcement or maintenance banner instantly, with no redeploy.</p>
          </div>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Details</span>
        <h2>Common questions about the dashboard</h2>
        <div className="cp-accordion">
          <details className="cp-accordion-item" open>
            <summary>
              Can I act on what I see, or is it read-only?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Visit logs aren&apos;t just a report — on plans that include visitor blocking (Starter and above),
                block a specific visitor directly from the log, right where you noticed them. See{' '}
                <a href="/product/visit-logs">visit logs</a> for everything captured on every visit.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              How long does setup take?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                One script tag pasted into your site&apos;s <code>&lt;head&gt;</code>, followed by an automatic
                ownership check. No SDK to install, no build step — most teams watch real visit data within a
                couple of minutes.
              </p>
            </div>
          </details>
        </div>
      </section>

      <a className="cp-banner" href="/dashboard">
        <div className="cp-banner-copy">
          <h4>Open your dashboard</h4>
          <p>Connect a site and see visit logs, leads, and overlays in one place.</p>
        </div>
        <span className="cp-banner-cta">
          Go to dashboard
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>
    </ContentPageShell>
  );
}
