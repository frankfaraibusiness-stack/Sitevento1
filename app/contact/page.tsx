// app/contact/page.tsx — Contact route, built on ContentPageShell (the
// same rich banner/stats shell as About, Careers, Changelog, Status —
// see styles/content/content-pages.css's header comment). The form itself is
// ContactForm.tsx (client component, posts to app/api/contact).
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { ContactForm } from '@/components/content/ContactForm';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with the sitevento team — questions about your account, a bug you hit, or anything else. Send a message and we\'ll reply by email.',
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/contact`,
    title: 'Contact Us — sitevento',
    description: 'Get in touch with the sitevento team.',
  },
};

export default function ContactPage() {
  return (
    <ContentPageShell
      eyebrow="get in touch"
      title="Tell us what's going on"
      subtitle="Account question, a bug you've hit, or something in between — send a message and a real person on the team replies by email."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '<24h', label: 'typical reply time' },
        { value: '7', label: 'days a week' },
        { value: '100%', label: 'read by a human' },
      ]}
    >
      <section className="cp-card">
        <span className="cp-card-eyebrow">Contact form</span>
        <h2>Send us a message</h2>
        <p>
          Fill in your name, email, and what&apos;s going on — we&apos;ll reply straight to the address you give us.
          For a faster answer on common issues, check <a href="/docs">the docs</a> or{' '}
          <a href="/support">support by plan</a> first.
        </p>
        <ContactForm />
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Before you write in</span>
        <h2>A few things people usually ask</h2>
        <div className="cp-accordion">
          <details className="cp-accordion-item" open>
            <summary>
              How fast will I hear back?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Most messages get a reply within a day, often faster. Response time and priority also scale with
                your plan — see <a href="/support#support-by-plan">support by plan</a> for specifics.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              What should I include?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Your connected site&apos;s domain, what you expected vs. what happened, and roughly when you noticed
                it — that&apos;s usually enough for us to cross-reference your visit logs and move fast.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Found a security issue?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Please report it here rather than publicly, so it can be fixed before details are disclosed. We take
                every report seriously regardless of plan tier.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Is this the right place for billing questions?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Yes — billing, plan changes, and account questions all come through this same form. Mention your
                account email if it&apos;s different from the one you&apos;re writing from.
              </p>
            </div>
          </details>
        </div>
      </section>

      <a className="cp-banner" href="/dashboard">
        <div className="cp-banner-copy">
          <h4>Already have an account?</h4>
          <p>Skip the wait — your visit logs, widgets, and overlays are one click away.</p>
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
