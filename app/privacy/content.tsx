// app/privacy/content.tsx — the actual Privacy Policy copy, kept
// separate from page.tsx (which only wires up metadata + <LegalPage>)
// so the long-form content is easy to find and edit on its own.
//
// Written to describe what sitevento's own code actually does, not
// generic boilerplate — cross-checked against:
//   - app/api/track/route.ts: visitor IDs are a one-way hash of IP +
//     User-Agent (not stored raw, not a cookie), country/city come from
//     Vercel's edge geo headers (derived from IP at the edge, no
//     third-party geo-IP lookup, no precise/GPS location), device/
//     browser/OS are parsed from the User-Agent string server-side.
//   - lib/firebase.ts + hooks/useAuth.ts: account data (email, display
//     name, auth state) is handled by Firebase Authentication; site/
//     visit/lead data lives in Firestore, scoped per account.
//   - api/sitevento.js: the tracking snippet sets no cookies and reads
//     no fingerprinting-grade signal — only viewport size + browser
//     language, both sent in the same beacon as the page view.
import type { LegalSection } from '@/components/legal/LegalPage';

export const privacyIntro = (
  <p>
    This policy explains what sitevento collects, why, and how account owners and their site visitors can control
    it. sitevento is a small team building a lightweight analytics and on-site messaging tool — we try to collect
    the minimum that makes the product work, and nothing more.
  </p>
);

export const privacySections: LegalSection[] = [
  {
    id: 'who-this-covers',
    heading: 'Who this covers',
    body: (
      <>
        <p>This policy applies to two different groups, and what we collect from each is different:</p>
        <ul>
          <li>
            <strong>Account owners</strong> — people who sign up for sitevento to connect a site and view its
            dashboard.
          </li>
          <li>
            <strong>Site visitors</strong> — people who visit a website that has the sitevento tracking tag
            installed. Visitors never create a sitevento account and never interact with sitevento directly; the
            tag runs on the site owner&apos;s page.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'account-data',
    heading: 'Data we collect from account owners',
    body: (
      <>
        <p>When you create a sitevento account, we collect:</p>
        <ul>
          <li>Your email address and a hashed password (handled by Firebase Authentication — we never see or store your password in plain text).</li>
          <li>Your display name, if you set one.</li>
          <li>The sites you connect (domain, verification status, and the banners/overlays you create for them).</li>
        </ul>
        <p>
          This data is used to run your account: signing you in, showing your own sites and dashboard data, and
          nothing else. We don&apos;t sell it, and we don&apos;t share it with advertisers.
        </p>
      </>
    ),
  },
  {
    id: 'visitor-data',
    heading: 'Data we collect from site visitors',
    body: (
      <>
        <p>
          When someone visits a site with the sitevento tag installed, the tag sends a small, anonymous beacon
          for each page view. That beacon includes:
        </p>
        <ul>
          <li>The page path and referrer.</li>
          <li>Viewport size and browser language, read directly from the browser (not a fingerprint — just these two values).</li>
          <li>Device type, browser, and OS — parsed from the User-Agent string on our server, not sent by the script.</li>
          <li>Country and city, derived from the visitor&apos;s IP address at the network edge (not a GPS or precise location, and not looked up via a third-party geo-IP service).</li>
        </ul>
        <div className="legal-callout">
          <p>
            <strong>We don&apos;t store a visitor&apos;s raw IP address or set any cookies.</strong> Instead, each
            visitor is assigned a one-way hashed ID, generated from their IP address and User-Agent string combined.
            That hash can&apos;t be reversed back into the original IP, and it exists only so the dashboard can tell
            &quot;the same visitor came back&quot; from &quot;a new visitor arrived&quot; — not to identify who
            someone is.
          </p>
        </div>
        <p>
          If a visitor submits an email address through a banner&apos;s &quot;notify me&quot; form, that email is
          stored as a lead, visible only to the owner of that specific site.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-it',
    heading: 'How this data is used',
    body: (
      <>
        <p>Site visit data is used only to power the dashboard an account owner sees for their own site: visit counts, referrers, device breakdowns, and leads captured through their banners.</p>
        <p>Account data is used to run authentication, show you your own sites, and — only if you opt in — send occasional product updates by email. You can unsubscribe from those at any time.</p>
        <p>We do not use visitor data for advertising, and we do not sell any data to third parties.</p>
      </>
    ),
  },
  {
    id: 'where-it-lives',
    heading: 'Where your data is stored',
    body: (
      <p>
        Account and site data is stored with Google Firebase (Authentication and Firestore), and the application
        itself runs on Vercel. Both providers maintain their own security and compliance programs; sitevento does
        not operate its own servers for this data.
      </p>
    ),
  },
  {
    id: 'retention',
    heading: 'How long we keep data',
    body: (
      <p>
        Visit and lead data for a connected site is kept for as long as that site stays connected to an account.
        If you disconnect a site, it stops sending new data immediately; existing visit history for that site is
        retained until you request deletion (see &quot;Your choices&quot; below) or the account itself is deleted.
      </p>
    ),
  },
  {
    id: 'your-choices',
    heading: 'Your choices',
    body: (
      <>
        <p>If you&apos;re an account owner, you can:</p>
        <ul>
          <li>Disconnect a site at any time from your dashboard, which stops new data collection for it immediately.</li>
          <li>Request a copy or deletion of your account data by contacting us (see below).</li>
        </ul>
        <p>If you&apos;re a site visitor and want data about your visits removed, you can contact us with the site domain and approximate date of your visit, and we&apos;ll work with the site owner to locate and remove it.</p>
      </>
    ),
  },
  {
    id: 'childrens-privacy',
    heading: "Children's privacy",
    body: (
      <p>
        sitevento is not directed at children under 16, and we don&apos;t knowingly collect personal information
        from them. If you believe a child has provided us with personal information, contact us and we&apos;ll
        remove it.
      </p>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    body: (
      <p>
        If we make a material change to how we handle data, we&apos;ll update the date at the top of this page and,
        for significant changes, notify account owners by email.
      </p>
    ),
  },
  {
    id: 'contact',
    heading: 'Contact us',
    body: (
      <p>
        Questions about this policy or your data? Reach us at{' '}
        <a href="mailto:privacy@sitevento.com">privacy@sitevento.com</a>.
      </p>
    ),
  },
];
