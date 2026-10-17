import type { LegalSection } from '@/components/legal/LegalPage';

export const aboutIntro = (
  <p>
    sitevento started from a simple frustration: understanding what happens on your own website shouldn&apos;t
    require wiring together three different tools and reading four different dashboards.
  </p>
);

export const aboutSections: LegalSection[] = [
  {
    id: 'the-problem',
    heading: 'The problem we set out to fix',
    body: (
      <p>
        A typical small business or indie site owner ends up with an analytics snippet, a separate email-capture
        form service, and no real way to post an urgent notice to visitors without redeploying the site. Each tool
        has its own login, its own billing, and its own dashboard that doesn&apos;t talk to the others. We built
        sitevento to replace that whole stack with one script tag and one dashboard.
      </p>
    ),
  },
  {
    id: 'what-we-build',
    heading: 'What sitevento actually is',
    body: (
      <p>
        One tag, dropped into your site&apos;s <code>&lt;head&gt;</code>, gives you a live visit log, lead capture
        widgets, and the ability to push a full-site overlay instantly — all run from the same dashboard. See{' '}
        <a href="/product/dashboard">the dashboard overview</a> for the full picture, or{' '}
        <a href="/pricing">pricing</a> for plans and limits.
      </p>
    ),
  },
  {
    id: 'principles',
    heading: 'How we think about building it',
    body: (
      <>
        <p>A few things guide the product decisions behind sitevento:</p>
        <ul>
          <li><strong>No redeploys for day-to-day changes.</strong> Toggling a widget or publishing an overlay should never require touching your site&apos;s codebase.</li>
          <li><strong>Sandboxed by default.</strong> Widgets run inside a sandboxed iframe rather than executing arbitrary code in your site&apos;s own context, so adding a widget doesn&apos;t mean trusting a third party with full access to your page.</li>
          <li><strong>Limits that make sense, not limits that squeeze.</strong> Plan limits (connected sites, widgets, automation) scale with what a growing team actually needs, not arbitrary gates designed to force upgrades.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'where-were-headed',
    heading: "Where we're headed",
    body: (
      <p>
        The roadmap stays close to what site owners actually ask for: more automation around overlays and
        visitor rules, deeper widget types, and better team collaboration on the dashboard. Keep an eye on the{' '}
        <a href="/changelog">changelog</a> for what&apos;s shipped recently.
      </p>
    ),
  },
];
