// app/changelog/page.tsx — Changelog route, rebuilt on
// ContentPageShell. See styles/content/content-pages.css's header comment for
// design rationale, app/about/page.tsx's header comment for the
// live-date approach.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Changelog',
  description: "What's shipped recently on sitevento: plan changes, widget limits, new documentation, and more.",
  alternates: { canonical: '/changelog' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/changelog`,
    title: 'Changelog — sitevento',
    description: "What's shipped recently on sitevento.",
  },
};

export default function ChangelogPage() {
  return (
    <ContentPageShell
      eyebrow="resources"
      title="Changelog"
      subtitle="What's shipped recently across the dashboard, the tag, and plan limits. Updated as changes go live, not on a fixed schedule."
      updatedOn={formatLiveDate()}
    >
      <section className="cp-card">
        <div className="cp-log-entry">
          <span className="cp-log-date">October 2026</span>
          <span className="cp-log-title">Live-widget cap now scales by plan; permissions redesigned with free daily trials</span>
          <ul style={{ marginTop: 4 }}>
            <li>
              The live-widget cap is no longer flat across plans: it&apos;s now 3 on Free, 5 on Starter, 10 on Scale,
              and 15 on Pro Developer.
            </li>
            <li>
              Redesigned the connect-site permissions into 30 distinct grants across five categories. Every
              permission is visible on every plan — many below-plan permissions now offer a small daily free trial
              (shown right on the toggle) so you can try the feature before upgrading, instead of a flat lock.
            </li>
            <li>Visitor blocking is now a metered daily allowance rather than on/off: 3/day on Free, 1,000/day on Starter, 5,000/day on Scale, unlimited on Pro Developer.</li>
          </ul>
        </div>
        <div className="cp-log-entry">
          <span className="cp-log-date">October 2026</span>
          <span className="cp-log-title">Four-tier plan structure, standardized widget limits</span>
          <ul style={{ marginTop: 4 }}>
            <li>
              Introduced the four-tier plan structure — Free, Starter, Scale, and Pro Developer — replacing the
              earlier three-plan lineup, with clearer per-site widget and automation limits at every level.
            </li>
            <li>
              Standardized the live-widget cap at 3 per connected site across all plans, with a per-plan limit on
              total configured widgets per site.
            </li>
            <li>Published dedicated documentation pages for visit logs, email capture, live overlays, and the dashboard.</li>
          </ul>
        </div>
        <div className="cp-log-entry">
          <span className="cp-log-date">Earlier</span>
          <span className="cp-log-title">Initial release</span>
          <p style={{ margin: '4px 0 0' }}>
            Visit logging, email capture widgets, and live overlays have been part of sitevento since its initial
            release — see <a href="/product/dashboard">the dashboard overview</a> for how they fit together today.
            Earlier, more granular release notes aren&apos;t separately archived on this page yet.
          </p>
        </div>
      </section>

      <div className="cp-callout">
        <p>
          <strong>What&apos;s next:</strong> deeper automation around overlays and visitor rules, and expanded team
          collaboration on the dashboard. Nothing here is a commitment to a specific date — check back as this page
          updates.
        </p>
      </div>

      <a className="cp-banner" href="/pricing">
        <div className="cp-banner-copy">
          <h4>See the current plan structure</h4>
          <p>Free, Starter, Scale, and Pro Developer — limits side by side.</p>
        </div>
        <span className="cp-banner-cta">
          View pricing
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>
    </ContentPageShell>
  );
}
