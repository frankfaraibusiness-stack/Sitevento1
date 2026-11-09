// app/terms/page.tsx — Terms of Service route.
//
// Rebuilt on ContentPageShell, same pattern as app/privacy/page.tsx —
// see that file's header comment for the full rationale (live date,
// --app-bg-aware shell, factual content over boilerplate). This page
// mirrors it structurally so the two "legal" routes feel like one
// family, not two different templates.
//
// Content cross-checked against the real feature set, not a generic
// SaaS terms template:
//   - lib/plans.ts: four real plans (Free/Starter/Scale/Pro Developer),
//     overage billed at $0.10 per 1,000 visits past the plan's monthly
//     allowance (lib/visits.ts's MONTHLY_VISIT_LIMITS).
//   - lib/wallet.ts: a separate prepaid account-wide Wallet balance,
//     sold in 100,000-token bundles, used for daily token-cap overage
//     — distinct from plan billing, gets its own terms coverage.
//   - lib/adRates.ts / lib/adPool.ts / app/api/advertise/route.ts: the
//     Advertise network is a real two-sided marketplace (an advertiser
//     funds a campaign that serves across the network; a publisher
//     earns a split via Monetization) — covered on its own rather than
//     folded silently into "the Service."
//   - lib/botShield.ts: Security Bot can auto-block/restrict a site's
//     own visitors on the owner's behalf — worth a plain acceptable-use
//     note about configuring it responsibly.
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

const PAGE_TITLE = 'Terms of Service — Plans, Billing, Acceptable Use';
const PAGE_DESCRIPTION =
  "The terms covering sitevento's dashboard, the tag you install on your own site, plan billing, Wallet top-ups, the Advertise network, and acceptable use.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/terms' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/terms`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

// FAQPage structured data for search/answer-engine rich results — see
// app/privacy/page.tsx's identical pattern for why this is kept in
// sync by hand with the visible accordion rather than generated from
// it.
const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What happens if I go over my plan\u2019s visit limit?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Your dashboard keeps logging visits \u2014 it doesn\u2019t hard-stop at the limit. Visits past your plan\u2019s monthly allowance are billed as overage at $0.10 per 1,000 visits, charged the same way on every plan.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the Wallet, and how is it different from my plan?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'The Wallet is a separate, prepaid, account-wide USD balance used specifically to cover usage beyond your plan\u2019s daily token cap (for AI-powered features like the Support Agent), sold in fixed 100,000-token bundles rather than metered per token. It\u2019s unrelated to your monthly plan subscription.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I run my own ads through sitevento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Yes, through Advertise \u2014 fund a banner, link, or text campaign that serves across the network. Pricing is per-country CPM/CPC. Creative must comply with acceptable use (no deception, no malware, no impersonation) and is subject to review before it serves.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I earn money from my site through sitevento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Yes, through Monetization \u2014 once a site is verified, you can turn on ad serving for it and earn a revenue share, paid out according to the terms shown in your dashboard\u2019s Wallet/Monetization pages.',
      },
    },
    {
      '@type': 'Question',
      name: 'Am I responsible for how Security Bot treats my own visitors?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Yes. Security Bot can automatically restrict or block visitors to your site based on behavior you configure it to watch for. You\u2019re responsible for setting it up reasonably and for any consequence of blocking a legitimate visitor by mistake \u2014 it\u2019s a tool you control, not a decision we make for you.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I cancel a paid plan, and do I get a refund?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Yes, cancel any time from your account. Cancellation takes effect at the end of the current billing period, and we don\u2019t provide partial refunds for unused time except where required by law.',
      },
    },
    {
      '@type': 'Question',
      name: 'What am I not allowed to do with sitevento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'You may not install the tag on a site you don\u2019t own or don\u2019t have permission for, harvest sensitive data visitors didn\u2019t knowingly submit, push deceptive or malware-carrying content through a widget/overlay/ad, or attempt to interfere with or overload the service.',
      },
    },
  ],
};

export default function TermsPage() {
  return (
    <ContentPageShell
      eyebrow="legal"
      title="Terms of Service"
      subtitle="What governs the dashboard, the tag you install, plan billing, the Wallet, the Advertise network, and what you can and can't do with any of it."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '4', label: 'plan tiers' },
        { value: '2', label: 'marketplaces: Advertise + Monetization' },
        { value: '7', label: 'questions answered below' },
      ]}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />

      <section className="cp-card">
        <span className="cp-card-eyebrow">Overview</span>
        <h2>What sitevento is</h2>
        <p>
          sitevento lets you connect a website by adding a single script tag, and gives you a dashboard of who
          visits, what converts, live on-site widgets and overlays, an AI Support Agent, automated abuse blocking
          via Security Bot, and two optional marketplaces — Advertise (run your own campaigns) and Monetization
          (earn from ads on your own verified site). A free plan is available alongside three paid tiers; see{' '}
          <a href="/pricing">pricing</a> for current details, which may change from time to time. By creating an
          account or installing the tag, you agree to these Terms.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Your account</span>
        <h2>Account responsibilities</h2>
        <ul>
          <li>Keep your login credentials secure, and tell us if you believe your account has been compromised.</li>
          <li>You&apos;re responsible for any activity under your account, including every site connected to it.</li>
          <li>Provide an accurate email — we use it for account recovery and important notices.</li>
        </ul>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Connecting a site</span>
        <h2>What you&apos;re confirming when you connect a site</h2>
        <ul>
          <li>You own the site, or are authorized by its owner to install tracking/analytics code on it.</li>
          <li>
            You&apos;ll comply with applicable law covering your own visitors — including, where required,
            disclosing your use of analytics tools and obtaining any consent your jurisdiction requires. sitevento
            is a tool; compliance for your own site&apos;s visitors is your responsibility as the site operator.
          </li>
        </ul>
        <p>You can disconnect a site any time from your dashboard — new data collection stops immediately.</p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Billing</span>
        <h2>Plans, Wallet, and the two marketplaces</h2>
        <div className="cp-grid cp-grid-2">
          <div className="cp-tile">
            <div className="cp-pill blue" style={{ alignSelf: 'flex-start' }}>Plan billing</div>
            <p style={{ margin: 0 }}>
              Paid plans bill in advance, recurring, until cancelled. Visits past your plan&apos;s monthly
              allowance are billed as overage at a flat $0.10 per 1,000 visits — logging never hard-stops at the
              limit.
            </p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill purple" style={{ alignSelf: 'flex-start' }}>Wallet</div>
            <p style={{ margin: 0 }}>
              A separate, prepaid, account-wide balance that covers AI-feature usage beyond your plan&apos;s daily
              token cap, sold in fixed 100,000-token bundles — not a metered per-token charge.
            </p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill green" style={{ alignSelf: 'flex-start' }}>Advertise</div>
            <p style={{ margin: 0 }}>
              Fund a banner, link, or text campaign that serves across the network at per-country CPM/CPC pricing.
              Creative is subject to review and must follow acceptable use below.
            </p>
          </div>
          <div className="cp-tile">
            <div className="cp-pill orange" style={{ alignSelf: 'flex-start' }}>Monetization</div>
            <p style={{ margin: 0 }}>
              Turn on ad serving for a verified site and earn a revenue share, paid out as described in your
              dashboard&apos;s Wallet/Monetization pages.
            </p>
          </div>
        </div>
        <p style={{ marginTop: 14 }}>
          You can cancel a paid plan any time; cancellation takes effect at the end of the current billing period,
          and we don&apos;t provide partial refunds for unused time except where required by law. Prices and
          features may change — we&apos;ll give notice before a change affects an existing subscription.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Acceptable use</span>
        <h2>What you agree not to do</h2>
        <ul>
          <li>Install the tag on a site you don&apos;t own or don&apos;t have permission for.</li>
          <li>
            Collect sensitive data through a widget or lead form beyond what a visitor knowingly submits — e.g.
            don&apos;t repurpose a &quot;notify me&quot; field to harvest data visitors didn&apos;t intend to share.
          </li>
          <li>Push widgets, overlays, or ads that are deceptive, impersonate another party, or distribute malware.</li>
          <li>Attempt to interfere with, reverse-engineer, or overload the service.</li>
        </ul>
        <div className="cp-callout">
          <p>
            <strong>Security Bot is a tool you configure, not a decision we make for you.</strong> It can
            automatically restrict or block visitors to your site based on behavior patterns you choose to watch
            for. You&apos;re responsible for configuring it reasonably and for the consequences of it blocking a
            legitimate visitor by mistake.
          </p>
        </div>
        <p>We may suspend or terminate accounts that violate these terms.</p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Content &amp; availability</span>
        <h2>Your content, and keeping the lights on</h2>
        <p>
          Widget text, images, overlay copy, and ad creative you create through sitevento remain yours. You&apos;re
          responsible for having the rights to anything you upload or publish, and for making sure it complies
          with applicable law and doesn&apos;t infringe anyone else&apos;s rights.
        </p>
        <p>
          We aim to keep sitevento reliable but don&apos;t guarantee uninterrupted availability. The service is
          provided &quot;as is&quot; — we&apos;re not liable for lost data, lost revenue, or other damages arising
          from downtime, bugs, or data loss, to the fullest extent permitted by law.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">FAQ</span>
        <h2>Common questions</h2>
        <div className="cp-accordion">
          <details className="cp-accordion-item" open>
            <summary>
              What happens if I go over my plan&apos;s visit limit?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Logging doesn&apos;t stop. Visits past your plan&apos;s monthly allowance are billed as overage at
                $0.10 per 1,000 visits, on every plan.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              What is the Wallet, and how is it different from my plan?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                A separate, prepaid, account-wide balance that covers usage beyond your plan&apos;s daily AI-token
                cap, sold in fixed 100,000-token bundles rather than metered per token. It&apos;s unrelated to
                your monthly plan subscription.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Can I run my own ads through sitevento?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Yes, through <a href="/dashboard/advertise">Advertise</a> — fund a banner, link, or text campaign
                priced per-country CPM/CPC. Creative must follow acceptable use and is subject to review before it
                serves.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Can I earn money from my site through sitevento?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Yes, through <a href="/dashboard/monetization">Monetization</a> — once a site is verified, turn on
                ad serving and earn a revenue share, paid out as described in your dashboard.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Am I responsible for how Security Bot treats my own visitors?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Yes. It can automatically restrict or block visitors based on behavior you configure it to watch
                for — you&apos;re responsible for setting it up reasonably, including the risk of it blocking a
                legitimate visitor by mistake.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Can I cancel a paid plan, and do I get a refund?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Yes, any time from your account. Cancellation takes effect at the end of the current billing
                period; we don&apos;t provide partial refunds for unused time except where required by law.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              What am I not allowed to do with sitevento?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Install the tag on a site you don&apos;t have permission for, harvest data visitors didn&apos;t
                knowingly submit, push deceptive or malware-carrying content, or try to interfere with or overload
                the service.
              </p>
            </div>
          </details>
        </div>
      </section>

      <a className="cp-banner" href="/pricing">
        <div className="cp-banner-copy">
          <h4>See exactly what each plan includes</h4>
          <p>Visit allowances, widget limits, overage pricing, and what unlocks Advertise and Monetization.</p>
        </div>
        <span className="cp-banner-cta">
          View pricing
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Changes &amp; contact</span>
        <h2>Ending your account, and changes to these Terms</h2>
        <p>
          You can delete your account any time from <strong>Settings → Danger zone</strong>, or by contacting us.
          We may suspend or terminate accounts that violate these Terms, with notice where practical. On
          termination, connected sites stop collecting new data and your data is deleted or retained only as
          described in our <a href="/privacy">Privacy Policy</a>.
        </p>
        <p>
          We may update these Terms as the product changes. Continuing to use sitevento after a material change
          takes effect means you accept the updated Terms. The date above always reflects the version you&apos;re
          reading.
        </p>
        <p>
          Questions about these Terms? Reach us at <a href="mailto:hello@sitevento.com">hello@sitevento.com</a>,
          or use the <a href="/contact">contact form</a>.
        </p>
      </section>
    </ContentPageShell>
  );
}
