// app/product/email-capture/page.tsx — Email Capture product page,
// rebuilt on ContentPageShell. See app/product/visit-logs/page.tsx's
// header comment for the full rationale this mirrors.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Email Capture — Turn Visits Into Leads',
  description:
    'A drop-in widget that turns anonymous visits into leads you can follow up with — configured from your dashboard, no code, no separate tool.',
  alternates: { canonical: '/product/email-capture' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/product/email-capture`,
    title: 'Email Capture — sitevento',
    description: 'Turn anonymous visits into leads you can actually follow up with.',
  },
};

export default function EmailCapturePage() {
  return (
    <ContentPageShell
      eyebrow="product"
      title="Turn anonymous visits into leads"
      subtitle="A drop-in widget that asks visitors for their email — configured from your dashboard, with every submission landing in the same place as your visit logs."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '3', label: 'live widgets per site' },
        { value: '0', label: 'code changes needed' },
        { value: '1 click', label: 'to enable or swap' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">What it is</span>
        <h2>What the email capture widget does</h2>
        <p>
          The widget renders a small, customizable form on your connected site — a banner, corner prompt, or inline
          block, depending on how you configure it — that asks a visitor for their email. Every submission is
          written straight into your dashboard as a lead, timestamped and tied back to the page it was captured on.
        </p>
        <div className="cp-grid cp-grid-3">
          <div className="cp-tile">
            <div className="cp-tile-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </div>
            <h3>Three layouts</h3>
            <p>Banner, corner prompt, or inline block — pick the one that fits your page.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3>No code changes</h3>
            <p>Enable it from your dashboard and it goes live through the same tag that powers logging.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M18.4 8.6 13 14l-3.5-3.5L4 16" />
              </svg>
            </div>
            <h3>Leads next to logs</h3>
            <p>See the visit history around every captured lead — page, referrer, device.</p>
          </div>
        </div>
        <div className="cp-badge-row">
          <span className="cp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            No redeploy
          </span>
          <span className="cp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            Sandboxed iframe
          </span>
          <span className="cp-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            Timestamped leads
          </span>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Widget limits</span>
        <h2>How widget limits work</h2>
        <p>
          Email capture is one widget type among several — live overlays and other widgets share the same delivery
          system. To keep any one page from turning into a wall of pop-ups, sitevento caps how many widgets can be{' '}
          <strong>live</strong> on a single site at once.
        </p>
        <div className="cp-accordion">
          <details className="cp-accordion-item" open>
            <summary>
              What's the live-widget cap?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                3 live widgets per site, on every plan including Free. If you already have two others live and want
                to turn on email capture, you&apos;ll disable one first — switching which three are live takes one
                click and doesn&apos;t remove a widget&apos;s saved configuration.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              What about widgets that are configured but paused?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Each plan has a separate limit on how many widgets can be <strong>configured</strong> per site at
                all (live or paused) — this is what lets you park seasonal widgets without losing their setup. Free
                allows up to 3, Starter up to 10, Scale up to 20, Pro Developer up to 30 — per connected site, not
                pooled across your account. See <a href="/pricing">pricing</a> for the complete breakdown.
              </p>
            </div>
          </details>
        </div>
      </section>

      <div className="cp-stat-strip">
        <div className="cp-stat-strip-item">
          <span className="cp-stat-strip-value">Free: 3</span>
          <span className="cp-stat-strip-label">configured widgets per site</span>
        </div>
        <div className="cp-stat-strip-item">
          <span className="cp-stat-strip-value">Starter: 10</span>
          <span className="cp-stat-strip-label">configured widgets per site</span>
        </div>
        <div className="cp-stat-strip-item">
          <span className="cp-stat-strip-value">Scale: 20</span>
          <span className="cp-stat-strip-label">configured widgets per site</span>
        </div>
        <div className="cp-stat-strip-item">
          <span className="cp-stat-strip-value">Pro Dev: 30</span>
          <span className="cp-stat-strip-label">configured widgets per site</span>
        </div>
      </div>

      <a className="cp-banner" href="/dashboard">
        <div className="cp-banner-copy">
          <h4>Turn it on for your site</h4>
          <p>Enable the widget, write your copy, and start capturing leads in minutes.</p>
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
          Email capture runs through the same tag as <a href="/product/visit-logs">visit logs</a> and{' '}
          <a href="/product/live-overlays">live overlays</a> — see <a href="/product/dashboard">the dashboard
          overview</a>, or <a href="/contact">contact us</a> if you&apos;re not sure which layout fits your page.
        </p>
      </section>
    </ContentPageShell>
  );
}
