import type { LegalSection } from '@/components/legal/LegalPage';

export const supportIntro = (
  <p>
    Most questions are answered faster in <a href="/docs">the docs</a> or the <a href="/#faq">FAQ</a> on our
    homepage. For anything specific to your account or a bug you&apos;ve hit, here&apos;s how support works by plan.
  </p>
);

export const supportSections: LegalSection[] = [
  {
    id: 'before-you-reach-out',
    heading: 'Before you reach out',
    body: (
      <>
        <p>A few common questions are answered directly elsewhere:</p>
        <ul>
          <li>Tag not logging visits? Check <a href="/docs#domain-verification">domain verification</a> — the tag only delivers data for the domain a site was registered under.</li>
          <li>Can&apos;t enable another widget? You&apos;ve likely hit the 3-live-widget-per-site cap — see <a href="/pricing#widget-limits">how widget limits work</a>.</li>
          <li>Need to know what&apos;s included on your plan? The full breakdown is on <a href="/pricing">pricing</a>.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'support-by-plan',
    heading: 'Support by plan',
    body: (
      <>
        <p>Response channel and priority scale with your plan:</p>
        <ul>
          <li><strong>Free</strong> — community support via documentation and the FAQ.</li>
          <li><strong>Starter</strong> — email support.</li>
          <li><strong>Scale</strong> — priority email support with faster response targets.</li>
          <li><strong>Pro Developer</strong> — dedicated support contact for your account.</li>
        </ul>
        <p>See <a href="/pricing">pricing</a> for the full plan comparison, including support alongside every other limit.</p>
      </>
    ),
  },
  {
    id: 'what-to-include',
    heading: 'What to include when you contact us',
    body: (
      <>
        <p>Whatever the issue, these details help us resolve it faster:</p>
        <ul>
          <li>The connected site&apos;s domain.</li>
          <li>What you expected to happen vs. what actually happened.</li>
          <li>Roughly when you noticed the issue, so we can cross-reference your visit logs.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'security',
    heading: 'Reporting a security issue',
    body: (
      <p>
        If you believe you&apos;ve found a security vulnerability in sitevento or the tag itself, please report it
        privately rather than publicly, so it can be addressed before details are disclosed. We take these reports
        seriously regardless of your plan tier.
      </p>
    ),
  },
];
