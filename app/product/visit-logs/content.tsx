// app/product/visit-logs/content.tsx — long-form copy for the Visit
// Logs product page, kept separate from page.tsx (metadata + wiring)
// per the pattern established in app/terms/content.tsx.
import type { LegalSection } from '@/components/legal/LegalPage';

export const visitLogsIntro = (
  <p>
    Every person who lands on a site connected to sitevento shows up here first: page, timestamp, referrer,
    device, browser, and rough location — logged the moment the tag loads, searchable from your dashboard with
    nothing to configure.
  </p>
);

export const visitLogsSections: LegalSection[] = [
  {
    id: 'what-gets-logged',
    heading: 'What gets logged on every visit',
    body: (
      <>
        <p>
          The moment the sitevento tag loads on a page, a visit record is written with the details that actually
          help you understand traffic, not vanity metrics:
        </p>
        <ul>
          <li><strong>Page path</strong> — exactly which URL was viewed, not just the domain.</li>
          <li><strong>Referrer</strong> — where the visitor came from, including campaign links and internal navigation.</li>
          <li><strong>Device, browser, and OS</strong> — parsed server-side from the request so no extra script weight ships to the visitor&apos;s browser.</li>
          <li><strong>Screen size and locale</strong> — useful for spotting layout issues on specific device classes.</li>
          <li><strong>Approximate location</strong> — country and city level, enough to understand geographic spread without collecting anything invasive.</li>
          <li><strong>Landing vs. mid-session</strong> — the dashboard distinguishes a visitor&apos;s entry page from pages they browsed to afterward in the same session.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-its-different',
    heading: 'Why this beats a generic analytics dashboard',
    body: (
      <p>
        Most analytics tools show you aggregated charts and make you dig for the record of one specific visit. Visit
        logs in sitevento work the other way: you get the raw, searchable log first, with every individual visit
        intact — then roll it up into trends when you want to. That matters when a visitor emails support asking
        about something odd, or when you need to confirm a specific referral actually landed on the right page.
      </p>
    ),
  },
  {
    id: 'visitor-control',
    heading: 'Turning logs into control',
    body: (
      <>
        <p>
          Visit logs aren&apos;t just a read-only report. On plans with visitor blocking enabled, you can act on
          what you see directly from the log: block a specific visitor ID from loading your site further, no code
          changes or redeploy required. (Visitor blocking isn&apos;t available on the Free plan — see{' '}
          <a href="/pricing">pricing</a> for which plans include it.)
        </p>
        <p>
          Because logging and blocking live in the same place, there&apos;s no gap between noticing a problem
          visitor and doing something about it.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    heading: 'How long logs stick around',
    body: (
      <p>
        The Free plan keeps 7 days of visit history, which is enough to validate that the tag is working and see a
        week of real traffic. Starter, Scale, and Pro Developer plans retain visit history with no time limit, so
        you can go back months later to compare traffic patterns or investigate a historical referral source. See
        the <a href="/pricing">full plan breakdown</a> for exact limits by tier.
      </p>
    ),
  },
  {
    id: 'setup',
    heading: 'Setup',
    body: (
      <p>
        Visit logging starts automatically the moment your site is connected — there&apos;s no separate toggle to
        find. Add the sitevento tag to your site&apos;s <code>&lt;head&gt;</code>, verify ownership, and the first
        visit log entries appear in your dashboard within moments. See{' '}
        <a href="/product/dashboard">how the dashboard ties everything together</a>.
      </p>
    ),
  },
];
