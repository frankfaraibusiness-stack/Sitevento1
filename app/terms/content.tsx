// app/terms/content.tsx — the actual Terms of Service copy, kept
// separate from page.tsx (which only wires up metadata + <LegalPage>)
// so the long-form content is easy to find and edit on its own.
//
// Written to match what sitevento actually is (connect a site via a
// script tag, get a dashboard of visits/leads/live banners — see
// components/marketing/Hero.tsx's own description and
// components/marketing/Pricing.tsx's free/paid tiers), not a generic
// SaaS template with placeholder features.
import type { LegalSection } from '@/components/legal/LegalPage';

export const termsIntro = (
  <p>
    These Terms govern your use of sitevento — the dashboard, the tracking/banner script you install on your own
    site, and everything in between. By creating an account or installing the sitevento tag, you agree to them.
  </p>
);

export const termsSections: LegalSection[] = [
  {
    id: 'the-service',
    heading: 'What sitevento is',
    body: (
      <p>
        sitevento lets you connect a website by adding a single script tag, and gives you a dashboard showing who
        visits, which visitors convert into leads, and the ability to run live on-site banners you can push and
        take down in real time. A free plan is available, alongside paid plans with higher limits — see the
        pricing section on our homepage for current details, which may change from time to time.
      </p>
    ),
  },
  {
    id: 'accounts',
    heading: 'Your account',
    body: (
      <>
        <p>You need an account to connect a site. You&apos;re responsible for:</p>
        <ul>
          <li>Keeping your login credentials secure, and telling us if you believe your account has been compromised.</li>
          <li>Any activity that happens under your account, including sites connected to it.</li>
          <li>Providing an accurate email address, since we use it for account recovery and important notices.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'connecting-sites',
    heading: 'Connecting a site',
    body: (
      <>
        <p>When you connect a site to sitevento, you&apos;re confirming that:</p>
        <ul>
          <li>You own that site or are authorized by its owner to install tracking/analytics code on it.</li>
          <li>You&apos;ll comply with applicable law regarding your own visitors — including, where required, disclosing that you use analytics tools and obtaining any consent that law requires in your jurisdiction. sitevento is a tool; compliance with laws covering your own site&apos;s visitors is your responsibility as the site operator.</li>
        </ul>
        <p>
          You can disconnect a site at any time from your dashboard. Doing so stops new data collection for that
          site immediately.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    heading: 'Acceptable use',
    body: (
      <>
        <p>You agree not to use sitevento to:</p>
        <ul>
          <li>Track a site you don&apos;t own or don&apos;t have permission to install code on.</li>
          <li>Collect sensitive personal data through banners or lead forms beyond what visitors knowingly submit (e.g. don&apos;t use a &quot;notify me&quot; field to harvest data visitors didn&apos;t intend to share).</li>
          <li>Push banners that are deceptive, impersonate another party, or distribute malware.</li>
          <li>Attempt to interfere with, reverse-engineer, or overload the service.</li>
        </ul>
        <p>We may suspend or terminate accounts that violate these terms.</p>
      </>
    ),
  },
  {
    id: 'your-content',
    heading: 'Your content',
    body: (
      <p>
        Banner text, images, and other content you create through sitevento remain yours. You&apos;re responsible
        for having the rights to anything you upload or publish through a banner, and for making sure it complies
        with applicable law and doesn&apos;t infringe anyone else&apos;s rights.
      </p>
    ),
  },
  {
    id: 'billing',
    heading: 'Billing and plans',
    body: (
      <p>
        Paid plans are billed in advance on a recurring basis until cancelled. You can cancel at any time from your
        account; cancellation takes effect at the end of the current billing period, and we don&apos;t provide
        partial refunds for unused time except where required by law. Prices and plan features may change — we&apos;ll
        give notice before a change affects an existing subscription.
      </p>
    ),
  },
  {
    id: 'availability',
    heading: 'Service availability',
    body: (
      <p>
        We aim to keep sitevento reliable, but we don&apos;t guarantee uninterrupted availability. The service is
        provided &quot;as is&quot; — we&apos;re not liable for lost data, lost revenue, or other damages arising
        from downtime, bugs, or data loss, to the fullest extent permitted by law.
      </p>
    ),
  },
  {
    id: 'termination',
    heading: 'Ending your account',
    body: (
      <p>
        You can delete your account at any time by contacting us. We may suspend or terminate accounts that violate
        these Terms, with notice where practical. Upon termination, your connected sites stop collecting new data
        and your data is deleted or retained only as described in our Privacy Policy.
      </p>
    ),
  },
  {
    id: 'changes-to-terms',
    heading: 'Changes to these Terms',
    body: (
      <p>
        We may update these Terms as the product changes. If we make a material change, we&apos;ll update the date
        at the top of this page and, where appropriate, notify account owners by email. Continuing to use sitevento
        after a change takes effect means you accept the updated Terms.
      </p>
    ),
  },
  {
    id: 'contact-terms',
    heading: 'Contact us',
    body: (
      <p>
        Questions about these Terms? Reach us at <a href="mailto:hello@sitevento.com">hello@sitevento.com</a>.
      </p>
    ),
  },
];
