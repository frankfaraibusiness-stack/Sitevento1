// app/careers/page.tsx — Careers route, rebuilt on ContentPageShell.
// See styles/content/content-pages.css's header comment for design rationale
// and app/about/page.tsx's header comment for the live-date approach.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Careers at sitevento',
  description:
    'Current hiring status at sitevento, what we look for when we do open roles, and how to stay in the loop.',
  alternates: { canonical: '/careers' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/careers`,
    title: 'Careers — sitevento',
    description: 'Current hiring status at sitevento and what we look for when we do open roles.',
  },
};

export default function CareersPage() {
  return (
    <ContentPageShell
      eyebrow="company"
      title="Careers"
      subtitle="sitevento is built by a small, product-focused team. No public hiring pipeline right now — this page is kept current so you always know exactly where things stand."
      updatedOn={formatLiveDate()}
    >
      <section className="cp-card">
        <div className="cp-pill">
          <span className="cp-pill-dot" />
          No open roles right now
        </div>
        <h2 style={{ marginTop: 14 }}>Current status</h2>
        <p>
          There are no open roles posted at the moment. When we do open a position, it&apos;ll be listed here
          first, before anywhere else — we don&apos;t run a separate jobs board or third-party listing, so this
          page is always the source of truth.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">What we look for</span>
        <h2>When we do hire</h2>
        <div className="cp-grid cp-grid-3">
          <div className="cp-tile">
            <div className="cp-tile-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <h3>Ownership over a narrow lane</h3>
            <p>A small team means everyone touches more of the product than a &quot;pure&quot; title would suggest.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3>Judgment about what not to build</h3>
            <p>Plan limits, widget caps, and feature scope come from deliberate decisions, not defaults.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
              </svg>
            </div>
            <h3>Comfort with a lean stack</h3>
            <p>We&apos;d rather keep the product simple to operate than add complexity to look more &quot;enterprise.&quot;</p>
          </div>
        </div>
      </section>

      <a className="cp-banner" href="/support">
        <div className="cp-banner-copy">
          <h4>Have a specific question about working with us?</h4>
          <p>The newsletter covers product updates, not hiring — reach out directly instead.</p>
        </div>
        <span className="cp-banner-cta">
          Contact support
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>
    </ContentPageShell>
  );
}
