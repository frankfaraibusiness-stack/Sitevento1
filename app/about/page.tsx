// app/about/page.tsx — About route, rebuilt on ContentPageShell
// (components/content/ContentPageShell.tsx) instead of the old
// LegalPage.tsx wall-of-text shell. See styles/content-pages.css's
// header comment for the full design rationale.
//
// "Last updated" now reads from lib/format.ts's formatLiveDate() at
// render time instead of a hand-typed date string — this route has no
// revalidate window set, so on a static deploy that's build time and
// on Vercel's on-demand rebuilds it's request time; either way it can
// never go stale the way a hardcoded string could.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
// Not in app/globals.css's @import list (see styles/content-pages.css's
// header comment) — loaded directly by every page built on
// ContentPageShell. agent-page.css supplies the .agt-blob-* rules the
// hero's corner mascot (components/content/ContentBlob.tsx) needs.
import '@/styles/content-pages.css';
import '@/styles/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'About sitevento',
  description:
    'Why sitevento exists: one script tag and one dashboard for visit logs, lead capture, and live site overlays — replacing a stack of disconnected tools.',
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/about`,
    title: 'About — sitevento',
    description: 'Why sitevento exists, and how we think about building it.',
  },
};

export default function AboutPage() {
  return (
    <ContentPageShell
      eyebrow="company"
      title="One tag. One dashboard. That's the whole idea."
      subtitle="sitevento replaces the analytics snippet, the separate email-capture form tool, and the no-redeploy-required way to post an urgent notice — with one script tag and one dashboard."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '1', label: 'script tag to install' },
        { value: '4', label: 'tools it replaces' },
        { value: '<2min', label: 'typical setup time' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">The problem</span>
        <h2>Four tools, four logins, nothing talking to each other</h2>
        <p>
          A typical small business or indie site owner ends up with an analytics snippet, a separate
          email-capture form service, and no real way to post an urgent notice to visitors without redeploying the
          site. Each tool has its own login, its own billing, and its own dashboard that doesn&apos;t talk to the
          others.
        </p>
        <p>We built sitevento to replace that whole stack with one script tag and one dashboard.</p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">What it actually is</span>
        <h2>One tag, dropped into your site&apos;s &lt;head&gt;</h2>
        <p>
          That single tag gives you a live visit log, lead-capture widgets, and the ability to push a full-site
          overlay instantly — all run from the same dashboard, with no redeploy required for day-to-day changes.
        </p>
        <div className="cp-grid cp-grid-3">
          <div className="cp-tile">
            <div className="cp-tile-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M18.4 8.6 13 14l-3.5-3.5L4 16" />
              </svg>
            </div>
            <h3>Visit logs</h3>
            <p>See who&apos;s on your site in real time, with the ability to block a visitor right from the log.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </div>
            <h3>Email capture</h3>
            <p>Lead-capture widgets you configure and toggle live from the dashboard, no code required.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M4 10h16" />
              </svg>
            </div>
            <h3>Live overlays</h3>
            <p>Push a full-site announcement or maintenance banner instantly, with no redeploy.</p>
          </div>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Principles</span>
        <h2>How we think about building it</h2>
        <ul>
          <li>
            <strong>No redeploys for day-to-day changes.</strong> Toggling a widget or publishing an overlay should
            never require touching your site&apos;s codebase.
          </li>
          <li>
            <strong>Sandboxed by default.</strong> Widgets run inside a sandboxed iframe rather than executing
            arbitrary code in your site&apos;s own context, so adding a widget doesn&apos;t mean trusting a third
            party with full access to your page.
          </li>
          <li>
            <strong>Limits that make sense, not limits that squeeze.</strong> Plan limits (connected sites,
            widgets, automation) scale with what a growing team actually needs, not arbitrary gates designed to
            force upgrades.
          </li>
        </ul>
      </section>

      <a className="cp-banner" href="/product/dashboard">
        <div className="cp-banner-copy">
          <h4>See the dashboard in detail</h4>
          <p>Visit logs, widgets, and overlays — walked through screen by screen.</p>
        </div>
        <span className="cp-banner-cta">
          View dashboard
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>

      <section className="cp-card">
        <span className="cp-card-eyebrow">What&apos;s next</span>
        <h2>Where we&apos;re headed</h2>
        <p>
          The roadmap stays close to what site owners actually ask for: more automation around overlays and
          visitor rules, deeper widget types, and better team collaboration on the dashboard. Keep an eye on the{' '}
          <a href="/changelog">changelog</a> for what&apos;s shipped recently, or see <a href="/pricing">pricing</a>{' '}
          for plans and limits.
        </p>
      </section>
    </ContentPageShell>
  );
}
