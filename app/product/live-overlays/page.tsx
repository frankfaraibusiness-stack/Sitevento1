// app/product/live-overlays/page.tsx — Live Overlays product page,
// rebuilt on ContentPageShell. See app/product/visit-logs/page.tsx's
// header comment for the full rationale this mirrors.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Live Overlays — Push a Message to Your Site Instantly',
  description:
    'A full-screen or banner-style message you can push to a live site instantly — announcement, maintenance mode, or an urgent note — and take down just as fast, with no redeploy.',
  alternates: { canonical: '/product/live-overlays' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/product/live-overlays`,
    title: 'Live Overlays — sitevento',
    description: 'Push a message to your live site instantly, no redeploy required.',
  },
};

export default function LiveOverlaysPage() {
  return (
    <ContentPageShell
      eyebrow="product"
      title="Push a message live, no redeploy"
      subtitle="A full-screen or banner-style message you can publish to a live site instantly — announcement, maintenance mode, or an urgent note — and take down just as fast."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '0', label: 'redeploys needed' },
        { value: 'secs', label: 'to go live' },
        { value: '3', label: 'ready-made templates' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">What it is</span>
        <h2>What a live overlay is</h2>
        <p>
          An overlay renders on top of (or across) your connected site the moment you publish it from the
          dashboard. Use it for a site-wide announcement, a scheduled-maintenance notice, or a time-sensitive
          message every visitor needs to see right now — then pull it down the instant it&apos;s no longer needed.
        </p>
        <div className="cp-grid cp-grid-3">
          <div className="cp-tile">
            <div className="cp-tile-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4" /><path d="M12 17h.01" />
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <h3>Announcement banners</h3>
            <p>A thin strip across the top of your site — new feature, sale, or a quick heads-up.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M4 10h16" />
              </svg>
            </div>
            <h3>Maintenance takeovers</h3>
            <p>A full-screen notice while you&apos;re doing something risky behind the scenes.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
              </svg>
            </div>
            <h3>Plain messages</h3>
            <p>Simple, time-sensitive copy with no layout decisions to make under pressure.</p>
          </div>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Speed</span>
        <h2>Live the moment you hit send</h2>
        <p>
          Because overlays are delivered through the same lightweight tag that powers visit logging, there&apos;s no
          deploy pipeline between you and your visitors. Publish from the dashboard and the overlay appears on your
          live site within moments — and disappears just as fast when you take it down.
        </p>
        <div className="cp-rating-row">
          <span className="cp-stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} viewBox="0 0 20 20"><path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L1.3 7.7l6.1-.6L10 1.5z" /></svg>
            ))}
          </span>
          <span className="muted">Trusted for time-sensitive announcements by teams on Starter and up</span>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Plans &amp; comparison</span>
        <h2>Overlays vs. widgets, and which plans include overlays</h2>
        <div className="cp-accordion">
          <details className="cp-accordion-item" open>
            <summary>
              Which plans include live overlays?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Live overlays are available starting on the Starter plan, and included on Scale and Pro Developer.
                Free is built for logging visits and capturing your first leads on a single site, and doesn&apos;t
                include overlay publishing. Full details on the <a href="/pricing">pricing page</a>.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              How is an overlay different from a widget?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                An overlay is a one-off, dashboard-triggered broadcast meant to be temporary — publish it, remove
                it later. A widget (like <a href="/product/email-capture">email capture</a>) is persistent and
                always-on. Both run through the same tag, but overlays don&apos;t count against your live-widget
                limit.
              </p>
            </div>
          </details>
        </div>
      </section>

      <a className="cp-banner" href="/dashboard">
        <div className="cp-banner-copy">
          <h4>Publish your first overlay</h4>
          <p>Pick a template, write the copy, and push it live from the dashboard.</p>
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
          Overlays share the dashboard with <a href="/product/visit-logs">visit logs</a> and{' '}
          <a href="/product/email-capture">email capture</a> — see <a href="/product/dashboard">the dashboard
          overview</a>, or <a href="/contact">contact us</a> about Starter and above.
        </p>
      </section>
    </ContentPageShell>
  );
}
