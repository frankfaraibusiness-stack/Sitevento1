import type { LegalSection } from '@/components/legal/LegalPage';

export const dashboardIntro = (
  <p>
    One dashboard for every site you connect: visit logs, leads, widgets, and live overlays, all in one place — no
    switching between separate tools for analytics, forms, and announcements.
  </p>
);

export const dashboardSections: LegalSection[] = [
  {
    id: 'one-place',
    heading: 'Everything that happens on your site, in one place',
    body: (
      <p>
        Most teams end up stitching together an analytics tool, a form builder, and some way to post a maintenance
        banner — three logins, three bills, none of them talking to each other. sitevento replaces that stack with a
        single dashboard: connect a site once, and visit logs, lead capture, and live overlays all live under the
        same account.
      </p>
    ),
  },
  {
    id: 'multi-site',
    heading: 'Manage more than one site without switching tools',
    body: (
      <p>
        Add multiple sites to one account and switch between them from the same dashboard — each with its own
        independent visit history, leads, and widget configuration. How many sites you can connect at once depends
        on your plan: 1 on Free, 5 on Starter, 15 on Scale, and 30 on Pro Developer. See{' '}
        <a href="/pricing">pricing</a> for the full breakdown.
      </p>
    ),
  },
  {
    id: 'widgets-and-overlays',
    heading: 'Widgets and overlays, controlled from the same screen',
    body: (
      <p>
        Toggle which widgets are live on a given site, edit their copy, and publish or pull a live overlay — all
        without touching your site&apos;s code after the initial tag install. See{' '}
        <a href="/product/email-capture">email capture</a> and <a href="/product/live-overlays">live overlays</a> for
        what each does.
      </p>
    ),
  },
  {
    id: 'visitor-control',
    heading: 'Act on what you see',
    body: (
      <p>
        Visit logs aren&apos;t just a report — on plans that include visitor blocking (Starter and above), you can
        block a specific visitor directly from the log, right where you noticed them. See{' '}
        <a href="/product/visit-logs">visit logs</a> for the full detail captured on every visit.
      </p>
    ),
  },
  {
    id: 'setup-time',
    heading: 'Minutes, not a sprint',
    body: (
      <p>
        Setup is one script tag pasted into your site&apos;s <code>&lt;head&gt;</code>, followed by an automatic
        ownership check. There&apos;s no SDK to install, no build step, and nothing to maintain beyond that single
        tag — most teams are watching real visit data within a couple of minutes of starting.
      </p>
    ),
  },
];
