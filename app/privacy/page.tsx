// app/privacy/page.tsx — Privacy Policy route.
//
// Rebuilt on ContentPageShell (styles/content/content-pages.css) instead of the
// old LegalPage wall-of-text shell — see that stylesheet's header
// comment, which calls out Privacy/Terms by name as a later pass onto
// this exact pattern. Same shell every other content route already
// uses (About, Docs, Support, Changelog, ...), so this page respects
// --app-bg / --ink / --surface-* the same way they all do — nothing
// here hardcodes a color, it all comes from styles/base/theme-tokens.css
// and flows from whatever --app-bg is currently set to.
//
// "Last updated" is `formatLiveDate()` (lib/format.ts), the same
// live-date convention every other rebuilt content page uses — it
// reflects the actual render/deploy date, not a hand-typed constant
// someone has to remember to bump. No LAST_UPDATED string anywhere in
// this file or content.tsx.
//
// Content below is written to match what this codebase actually does
// — cross-checked against the real implementation, not generic SaaS
// boilerplate:
//   - app/api/track/route.ts + lib/visitorIdentity.ts: visitor
//     identity is a server-minted, signed token (not a client-guessed
//     id), stored in the visitor's own browser via localStorage
//     (key sv_vtok — see public/sitevento.js), not a cookie. No raw
//     IP is stored; country/city come from Vercel's edge geo headers.
//   - lib/ipIntel.ts: Security Bot's abuse scoring also makes a
//     network-level lookup (ip-api.com) on suspicious traffic to flag
//     datacenter/proxy IPs — a real third-party call this policy
//     should actually disclose.
//   - lib/firebase.ts + hooks/useAuth.ts: account auth/data via
//     Firebase Authentication + Firestore.
//   - lib/wallet.ts, lib/adRates.ts, lib/adPool.ts: paid plans,
//     wallet top-ups, and the Advertise network involve Stripe-style
//     billing data and ad delivery — both genuinely new since the
//     product's early analytics-only days, so both get their own FAQ
//     entries instead of being silently absent.
//   - lib/agent.ts: the AI Support Agent sends visitor chat messages
//     to a third-party LLM provider to generate replies — disclosed
//     plainly rather than glossed over as "we may use AI."
import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content/ContentPageShell';
import { formatLiveDate } from '@/lib/format';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

const PAGE_TITLE = 'Privacy Policy — What We Collect, and Why';
const PAGE_DESCRIPTION =
  'Exactly what sitevento collects from account owners and site visitors, how visitor identity works without cookies, what Security Bot and the Advertise network touch, and how to request deletion.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/privacy`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

// FAQPage structured data — lets search engines surface these as
// expandable Q&A rich results directly in search, and gives LLM/AI
// answer engines a clean, unambiguous source to quote. Kept in sync
// by hand with the visible <details> accordion below (same questions,
// same answers in plain text) rather than generated from it, since
// the visible copy uses <code>/<a> inline markup that doesn't map
// 1:1 onto plain-text schema fields.
const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Does sitevento use cookies to track visitors?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'No. The sitevento tag never sets a cookie. Each visitor is identified by a signed token the server mints and the browser stores in localStorage (not a cookie), plus a one-way hash derived from IP and User-Agent used only to recognize a returning visitor. Clearing site data or using a different browser resets this identity, the same way clearing cookies would elsewhere.',
      },
    },
    {
      '@type': 'Question',
      name: "Does sitevento store a visitor's raw IP address?",
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          "No. A visitor's raw IP is never written to the database. It is used in-memory, at request time, for two things: deriving country/city from Vercel's edge geo headers, and folding into a one-way hash (combined with the User-Agent) that becomes the visitor's ID. The hash cannot be reversed back into an IP address.",
      },
    },
    {
      '@type': 'Question',
      name: 'Does Security Bot send visitor data to a third party?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          "Security Bot's core scoring is pure arithmetic run on our own servers over timestamps we already record \u2014 no external call. For traffic that already looks suspicious, it makes one additional lookup to a network-intelligence provider (ip-api.com) to check whether the IP belongs to a known datacenter or proxy network, which only receives the IP address itself, nothing else about the visitor.",
      },
    },
    {
      '@type': 'Question',
      name: 'Does the AI Support Agent send my visitors\u2019 messages to a third party?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Yes. When a visitor chats with a site\u2019s AI Support Agent, their message and the conversation context needed to answer it are sent to a third-party AI model provider to generate a reply. We don\u2019t use that content to train our own models, and it\u2019s sent only to generate the reply shown back to that visitor.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does sitevento sell visitor data to advertisers?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          "No, we don't sell visitor or account data to anyone. The Advertise network is opt-in on both sides \u2014 a publisher turns Monetization on for a verified site, an advertiser funds a campaign \u2014 and ad delivery/billing runs on aggregate counts (impressions, clicks, country) rather than a profile built on any individual visitor.",
      },
    },
    {
      '@type': 'Question',
      name: 'How do I delete my account and site data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Disconnect a site from your dashboard at any time to stop new data collection immediately. To delete your account and all associated data entirely, use Delete account in Settings \u2192 Danger zone, or email privacy@sitevento.com and we\u2019ll process the request.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is sitevento for children?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          "No. sitevento is a B2B analytics and site-engagement tool built for site owners, not for use by children, and it isn't directed at them. We don't knowingly collect personal information from anyone under 16.",
      },
    },
  ],
};

export default function PrivacyPage() {
  return (
    <ContentPageShell
      eyebrow="legal"
      title="Privacy Policy"
      subtitle="What sitevento collects from account owners and from the visitors to sites that run our tag — and why. No vague language standing in for what the code actually does."
      updatedOn={formatLiveDate()}
      heroStats={[
        { value: '0', label: 'cookies set' },
        { value: '2', label: 'groups covered' },
        { value: '7', label: 'questions answered below' },
      ]}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />

      <section className="cp-card">
        <span className="cp-card-eyebrow">Overview</span>
        <h2>The short version</h2>
        <p>
          sitevento is a small team building site analytics, on-site widgets, and a few optional tools (Security
          Bot, an AI Support Agent, and an ad network) on top of that same visit data. This policy covers two
          different groups, because what we collect from each is genuinely different:
        </p>
        <div className="cp-grid cp-grid-2">
          <div className="cp-tile">
            <div className="cp-tile-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            </div>
            <h3>Account owners</h3>
            <p>People who sign up for sitevento to connect a site, run widgets, and view a dashboard.</p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="9" cy="8" r="3.4" />
                <path d="M2.5 19c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
                <circle cx="17" cy="7.5" r="2.6" />
              </svg>
            </div>
            <h3>Site visitors</h3>
            <p>People who visit a site that has the sitevento tag installed. They never create an account with us.</p>
          </div>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Account owners</span>
        <h2>Data we collect from account owners</h2>
        <p>When you create a sitevento account, we collect:</p>
        <ul>
          <li>
            Your email address and password, handled entirely by <strong>Firebase Authentication</strong> — we
            never see or store your password in plain text.
          </li>
          <li>Your display name and profile photo, if you set one (or if you sign in with Google).</li>
          <li>The sites you connect: domain, verification status, and the widgets/overlays/agent you configure for each.</li>
          <li>
            If you fund an Advertise campaign or top up your Wallet: billing details needed to process the
            payment, and a ledger of the transaction (not full card numbers, which never touch our servers).
          </li>
        </ul>
        <p>
          This data runs your account — signing you in, showing your own sites and dashboard, billing what you
          actually used. We don&apos;t sell it, and we don&apos;t share it with advertisers.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Site visitors</span>
        <h2>Data we collect from site visitors</h2>
        <p>
          When someone visits a site with the sitevento tag installed, the tag sends a small beacon for each page
          view. That beacon includes the page path and referrer, viewport size and browser language read directly
          from the browser, and device/browser/OS parsed server-side from the User-Agent string. Country and city
          come from the visitor&apos;s IP address at the network edge — not GPS, not a third-party geo-IP lookup.
        </p>
        <div className="cp-callout">
          <p>
            <strong>No cookies, no raw IP stored.</strong> Each visitor gets a signed identity token minted by our
            server and saved in <code>localStorage</code> (key <code>sv_vtok</code>) — never a cookie. A one-way
            hash of IP + User-Agent backs that identity so returning visitors can be recognized; the hash
            can&apos;t be reversed back into an IP. Clearing site data resets this identity, same as clearing
            cookies would anywhere else.
          </p>
        </div>
        <p>
          If a visitor submits an email through a widget&apos;s capture form, that email is stored as a lead,
          visible only to the owner of that specific site. If a visitor chats with a site&apos;s AI Support Agent,
          that message is also sent to a third-party AI provider to generate the reply — see the FAQ below.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Optional tools</span>
        <h2>What Security Bot, the AI Agent, and Advertise each touch</h2>
        <div className="cp-grid cp-grid-3">
          <div className="cp-tile">
            <div className="cp-tile-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h3>Security Bot</h3>
            <p>
              Scores abuse patterns from timestamps we already record — no new data, no AI model. On suspicious
              traffic only, it checks the IP against a network-intelligence provider for datacenter/proxy signals.
            </p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="4" y="7" width="16" height="12" rx="3" />
                <circle cx="9" cy="13" r="1.1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="13" r="1.1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h3>AI Support Agent</h3>
            <p>
              A visitor&apos;s chat messages are sent to a third-party LLM provider to generate replies, scoped to
              that conversation — not used to train our own models.
            </p>
          </div>
          <div className="cp-tile">
            <div className="cp-tile-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="5" width="18" height="10" rx="2" />
                <path d="M7 9h6M7 12h4" />
              </svg>
            </div>
            <h3>Advertise network</h3>
            <p>
              Ad delivery and billing run on aggregate impression/click counts by country, not a profile built on
              any one visitor. Opt-in on both sides: a publisher enables Monetization, an advertiser funds a
              campaign.
            </p>
          </div>
        </div>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Infrastructure</span>
        <h2>Where this data lives, and how long we keep it</h2>
        <p>
          Account and site data is stored with Google Firebase (Authentication and Firestore); the application
          runs on Vercel. Both maintain their own security and compliance programs — we don&apos;t operate our own
          servers for this data.
        </p>
        <p>
          Visit and lead data for a connected site is kept for as long as that site stays connected. Disconnecting
          a site stops new data collection immediately; existing history is retained until you request deletion
          or the account itself is deleted.
        </p>
      </section>

      <section className="cp-card">
        <span className="cp-card-eyebrow">FAQ</span>
        <h2>Common questions</h2>
        <div className="cp-accordion">
          <details className="cp-accordion-item" open>
            <summary>
              Does sitevento use cookies to track visitors?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                No. The tag never sets a cookie. Identity is a signed token stored in <code>localStorage</code>{' '}
                (<code>sv_vtok</code>), backed by a one-way hash of IP + User-Agent. Clearing site data resets it,
                same as clearing cookies would elsewhere.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Does sitevento store a visitor&apos;s raw IP address?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                No. A raw IP is used in-memory at request time — for edge-derived country/city, and folded into
                the one-way visitor hash — but it&apos;s never written to the database, and the hash can&apos;t be
                reversed back into an IP.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Does Security Bot send visitor data to a third party?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Its core scoring runs entirely on our own servers, over data we already record — no external call.
                Only for traffic that already looks suspicious, it checks the IP against a network-intelligence
                provider (ip-api.com) for datacenter/proxy signals; that lookup receives just the IP address.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Does the AI Support Agent send my visitors&apos; messages to a third party?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Yes — a visitor&apos;s message and the context needed to answer it go to a third-party AI model
                provider to generate the reply shown back to them. We don&apos;t use that content to train our own
                models.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Does sitevento sell visitor data to advertisers?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                No. The Advertise network runs on aggregate counts — impressions, clicks, country — not an
                individual profile, and it&apos;s opt-in for both the publisher and the advertiser.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              How do I delete my account and site data?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                Disconnect a site from your dashboard any time to stop new collection immediately. To delete your
                account entirely, use <strong>Settings → Danger zone → Delete account</strong>, or email{' '}
                <a href="mailto:privacy@sitevento.com">privacy@sitevento.com</a>.
              </p>
            </div>
          </details>
          <details className="cp-accordion-item">
            <summary>
              Is sitevento for children?
              <span className="cp-accordion-icon" />
            </summary>
            <div className="cp-accordion-body">
              <p>
                No. sitevento is a B2B tool for site owners and isn&apos;t directed at children. We don&apos;t
                knowingly collect personal information from anyone under 16 — contact us if you believe we have.
              </p>
            </div>
          </details>
        </div>
      </section>

      <a className="cp-banner" href="/dashboard/bot-shield">
        <div className="cp-banner-copy">
          <h4>Want to see what Security Bot actually catches?</h4>
          <p>Refresh bursts, click-timing abuse, and form-flood patterns — scored live, no AI model involved.</p>
        </div>
        <span className="cp-banner-cta">
          Open Security Bot
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>

      <section className="cp-card">
        <span className="cp-card-eyebrow">Changes &amp; contact</span>
        <h2>Changes to this policy</h2>
        <p>
          If we make a material change to how we handle data, we&apos;ll update this page and, for significant
          changes, notify account owners by email. The date above always reflects the version you&apos;re reading.
        </p>
        <p>
          Questions about this policy or your data? Reach us at{' '}
          <a href="mailto:privacy@sitevento.com">privacy@sitevento.com</a>, or use the{' '}
          <a href="/contact">contact form</a>.
        </p>
      </section>
    </ContentPageShell>
  );
}
