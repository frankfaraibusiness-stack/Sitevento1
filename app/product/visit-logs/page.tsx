// app/product/visit-logs/page.tsx — Visit Logs product page, rebuilt
// on ContentPageShell (the same rich banner/stats/tile shell as About,
// Careers, Changelog, Status) instead of the old LegalPage wall-of-text
// shell. See styles/content/content-pages.css's header comment for the design
// rationale, app/about/page.tsx's header comment for the live-date
// approach. CTA points at /dashboard (the real product), not another
// info page — info pages are for SEO, not for closing the loop.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Visit Logs — See Every Visitor to Your Site',
  description:
    'Searchable, per-visit logs for any site connected to sitevento: page, referrer, device, browser, and location — logged automatically, with visitor blocking built in.',
  alternates: { canonical: '/product/visit-logs' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/product/visit-logs`,
    title: 'Visit Logs — sitevento',
    description:
      'Searchable, per-visit logs for any site connected to sitevento: page, referrer, device, browser, and location.',
  },
};

export default function VisitLogsPage() {
  return (
    <ContentPageShell
      eyebrow="product"
      title="Every visitor, logged the moment they land"
      subtitle="Page, timestamp, referrer, device, browser, and rough location — captured the instant the tag loads, searchable from your dashboard with nothing to configure."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '6', label: 'data points per visit' },
        { value: '0', label: 'config required' },
        { value: '<1s', label: 'to first log entry' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">What gets logged</span>
        <h2>What gets logged on every visit</h2>
        <p>
          The moment the sitevento tag loads on a page, a visit record is written with the details that actually
          help you understand traffic, not vanity metrics.
        </p>
        <div className="cp-grid cp-grid-3">
          <div className="cp-tile">
            <div className="cp-tile-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M18.4 8.6 13 14l-3.5-3.5L4 16" />
              </svg>
            </div>
            <h3>Page &amp; referrer</h3>
            <p>Exactly which URL was viewed and where the visitor came from, campaign links included.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M4 10h16" />
              </svg>
            </div>
            <h3>Device, browser, OS</h3>
            <p>Parsed server-side from the request, so no extra script weight ships to the visitor&apos;s browser.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 21s7-6.6 7-11a7 7 0 1 0-14 0c0 4.4 7 11 7 11Z" />
              </svg>
            </div>
            <h3>Approximate location</h3>
            <p>Country and city level — enough to see geographic spread without collecting anything invasive.</p>
          </div>
        </div>
        <div className="cp-stat-strip">
          <div className="cp-stat-strip-item">
            <span className="cp-stat-strip-value">Screen &amp; locale</span>
            <span className="cp-stat-strip-label">Spot layout issues on specific device classes</span>
          </div>
          <div className="cp-stat-strip-item">
            <span className="cp-stat-strip-value">Landing vs. mid-session</span>
            <span className="cp-stat-strip-label">Entry page separated from later pages in a session</span>
          </div>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Why it's different</span>
        <h2>Why this beats a generic analytics dashboard</h2>
        <p>
          Most analytics tools show aggregated charts and make you dig for the record of one specific visit. Visit
          logs in sitevento work the other way: you get the raw, searchable log first, with every individual visit
          intact — then roll it up into trends when you want to. That matters when a visitor emails support about
          something odd, or you need to confirm a specific referral landed on the right page.
        </p>
        <div className="cp-rating-row">
          <span className="cp-stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} viewBox="0 0 20 20"><path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L1.3 7.7l6.1-.6L10 1.5z" /></svg>
            ))}
          </span>
          <span>Rated by teams who need the raw record, not just a chart</span>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Visitor control</span>
        <h2>Turning logs into control</h2>
        <p>
          Visit logs aren&apos;t just a read-only report. On plans with visitor blocking enabled, act on what you
          see directly from the log: block a specific visitor ID from loading your site further, no code changes or
          redeploy required.
        </p>
        <div className="cp-accordion">
          <details className="cp-accordion-item" open>
            <summary>
              Which plans include visitor blocking?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Visitor blocking isn&apos;t available on the Free plan — it&apos;s included from Starter up. See{' '}
                <a href="/pricing">pricing</a> for exactly which plans include it.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              How long are logs retained?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Free keeps 7 days of visit history — enough to validate the tag is working and see a week of real
                traffic. Starter, Scale, and Pro Developer retain visit history with no time limit, so you can
                compare patterns months later. See <a href="/pricing">the full plan breakdown</a> for exact limits.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Do I need to configure anything to start logging?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                No. Logging starts automatically the moment your site is connected. Add the sitevento tag to your
                site&apos;s <code>&lt;head&gt;</code>, verify ownership, and the first entries appear within moments.
              </p>
            </div>
          </details>
        </div>
      </section>

      <a className="cp-banner" href="/dashboard">
        <div className="cp-banner-copy">
          <h4>See your own visit logs</h4>
          <p>Connect a site and watch real visits land in your dashboard within moments.</p>
        </div>
        <span className="cp-banner-cta">
          Go to dashboard
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>

      <section className="cp-card">
        <span className="cp-card-eyebrow">See also</span>
        <h2>How it fits with the rest of sitevento</h2>
        <p>
          Visit logs power the same dashboard that runs <a href="/product/email-capture">email capture</a> and{' '}
          <a href="/product/live-overlays">live overlays</a> — see <a href="/product/dashboard">the dashboard
          overview</a> for how they all connect, or <a href="/contact">contact us</a> with questions about your
          account.
        </p>
      </section>
    </ContentPageShell>
  );
}
