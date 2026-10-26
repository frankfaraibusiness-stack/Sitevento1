// app/support/page.tsx — Support page, rebuilt on ContentPageShell
// instead of the old LegalPage wall-of-text shell. See
// app/product/visit-logs/page.tsx's header comment for the rationale.
// Previously this page only told people to "contact us" without any
// way to actually do that — now it links straight to /contact, the
// real working form (app/contact/page.tsx + api/contact/route.ts).
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'How to get help with sitevento: common fixes, support channels by plan, what to include in a request, and how to report a security issue.',
  alternates: { canonical: '/support' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/support`,
    title: 'Support — sitevento',
    description: 'How to get help with sitevento, and what support looks like on each plan.',
  },
};

export default function SupportPage() {
  return (
    <ContentPageShell
      eyebrow="resources"
      title="Get help, fast"
      subtitle="Most questions are answered faster in the docs or the FAQ — for anything specific to your account or a bug you've hit, here's how support works by plan."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '4', label: 'support tiers' },
        { value: '<24h', label: 'typical reply' },
        { value: '2', label: 'self-serve guides' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">Before you reach out</span>
        <h2>A few common questions, answered directly</h2>
        <div className="cp-accordion">
          <details className="cp-accordion-item" open>
            <summary>
              Tag not logging visits?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Check <a href="/docs#domain-verification">domain verification</a> — the tag only delivers data for
                the domain a site was registered under.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Can't enable another widget?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                You&apos;ve likely hit the 3-live-widget-per-site cap — see{' '}
                <a href="/product/email-capture#widget-limits">how widget limits work</a>.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Need to know what's included on your plan?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>The full breakdown is on <a href="/pricing">pricing</a>.</p>
            </div>
          </details>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Support by plan</span>
        <h2>Response channel and priority scale with your plan</h2>
        <div className="cp-grid cp-grid-3">
          <div className="cp-tile">
            <div className="cp-tile-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
            </div>
            <h3>Free</h3>
            <p>Community support via documentation and the FAQ.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </div>
            <h3>Starter</h3>
            <p>Email support.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" /></svg>
            </div>
            <h3>Scale</h3>
            <p>Priority email support with faster response targets.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
            </div>
            <h3>Pro Developer</h3>
            <p>Dedicated support contact for your account.</p>
          </div>
        </div>
        <p style={{ marginTop: 10 }}>See <a href="/pricing">pricing</a> for the full plan comparison, including support alongside every other limit.</p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Before you write in</span>
        <h2>What to include when you contact us</h2>
        <p>Whatever the issue, these details help us resolve it faster:</p>
        <div className="cp-badge-row">
          <span className="cp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            Your site's domain
          </span>
          <span className="cp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            Expected vs. actual
          </span>
          <span className="cp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            Roughly when it happened
          </span>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Security</span>
        <h2>Reporting a security issue</h2>
        <p>
          If you believe you&apos;ve found a security vulnerability in sitevento or the tag itself, please report it
          privately through <a href="/contact">the contact form</a> rather than publicly, so it can be addressed
          before details are disclosed. We take these reports seriously regardless of your plan tier.
        </p>
      </section>

      <a className="cp-banner" href="/contact">
        <div className="cp-banner-copy">
          <h4>Didn't find your answer?</h4>
          <p>Send a message and a real person on the team replies by email.</p>
        </div>
        <span className="cp-banner-cta">
          Contact us
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>
    </ContentPageShell>
  );
}
