// app/docs/page.tsx — Documentation route, rebuilt on
// ContentPageShell. See styles/content/content-pages.css's header comment for
// design rationale, app/about/page.tsx's header comment for the
// live-date approach. Content pulled forward from the old
// app/docs/content.tsx (deleted), restructured into numbered setup
// steps and a widget-limits callout instead of plain prose sections.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import { MAX_LIVE_WIDGETS_PER_SITE } from '@/lib/plans';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Documentation — Install the Tag, Configure Widgets',
  description:
    'How to connect a site to sitevento, verify your domain, configure widgets within plan limits, and publish live overlays.',
  alternates: { canonical: '/docs' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/docs`,
    title: 'Documentation — sitevento',
    description: 'How to connect a site, verify your domain, configure widgets, and publish live overlays.',
  },
};

export default function DocsPage() {
  return (
    <ContentPageShell
      eyebrow="resources"
      title="Documentation"
      subtitle="Everything you need to connect a site, configure widgets, and push your first overlay — no SDK to install, no build step, just a tag and a dashboard."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '3', label: 'steps to go live' },
        { value: '0', label: 'build dependencies' },
        { value: `${MAX_LIVE_WIDGETS_PER_SITE}`, label: 'max live widgets/site' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">Quick start</span>
        <h2>Connected in three steps</h2>
        <div className="cp-grid cp-grid-3">
          <div className="cp-tile">
            <div className="cp-tile-icon blue"><strong style={{ fontFamily: 'Georgia, serif', fontSize: 16 }}>1</strong></div>
            <h3>Create a site</h3>
            <p>Start a new site connection from your dashboard — generates a unique script tag for that domain.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon blue"><strong style={{ fontFamily: 'Georgia, serif', fontSize: 16 }}>2</strong></div>
            <h3>Paste the tag</h3>
            <p>Drop it into your site&apos;s <code>&lt;head&gt;</code> — works on any static site, CMS, or framework, no build step.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon blue"><strong style={{ fontFamily: 'Georgia, serif', fontSize: 16 }}>3</strong></div>
            <h3>Verify &amp; go live</h3>
            <p>Confirm verification in the dashboard. Once detected live, visit logging starts immediately.</p>
          </div>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">How it works</span>
        <h2>What the tag actually does</h2>
        <p>
          The sitevento tag loads asynchronously and defers all work off the main thread, so it doesn&apos;t block
          render or affect page load time. It&apos;s responsible for three things: logging visits, delivering any
          widgets you&apos;ve enabled for that site, and rendering a live overlay if one is currently published.
        </p>
        <div className="cp-callout">
          <p>
            Widgets are never executed directly in your page&apos;s own JavaScript context — each one loads inside
            a sandboxed iframe, so enabling a widget doesn&apos;t hand a third party full access to your page&apos;s
            DOM or cookies.
          </p>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Security</span>
        <h2>Domain verification</h2>
        <p>
          A site is verified once sitevento detects the tag loading from a real page request on the domain you
          registered. Requests from other domains carrying the same site ID are rejected — the tag only delivers
          widgets and overlays to the domain the site was registered under (plus its <code>www.</code> variant),
          which keeps a copied tag from quietly running on an unauthorized domain.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Widgets</span>
        <h2>Two limits to keep in mind</h2>
        <div className="cp-grid cp-grid-2">
          <div className="cp-tile">
            <div className="cp-pill lime" style={{ alignSelf: 'flex-start' }}>Live limit</div>
            <p style={{ margin: 0 }}>
              Up to <strong>{MAX_LIVE_WIDGETS_PER_SITE} widgets</strong> can be live on one site at a time, flat
              across every plan. Disable one to make room for another — instant, no data lost.
            </p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill purple" style={{ alignSelf: 'flex-start' }}>Configured limit</div>
            <p style={{ margin: 0 }}>
              How many widgets you can have set up (live or paused) on one site scales with your plan — 3 on Free,
              up to 30 on Pro Developer. See <a href="/pricing">pricing</a> for exact numbers.
            </p>
          </div>
        </div>
      </section>

      <a className="cp-banner" href="/product/live-overlays">
        <div className="cp-banner-copy">
          <h4>Publishing an overlay</h4>
          <p>Choose a template, fill in the copy, publish — live within moments, available on Starter and above.</p>
        </div>
        <span className="cp-banner-cta">
          See live overlays
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Disconnecting</span>
        <h2>Removing a site</h2>
        <p>
          Removing a site from your dashboard stops new data collection immediately. Existing visit history and
          leads remain available for export until you choose to delete the site entirely.
        </p>
      </section>
    </ContentPageShell>
  );
}
