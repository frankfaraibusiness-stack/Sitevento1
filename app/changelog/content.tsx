import type { LegalSection } from '@/components/legal/LegalPage';

export const changelogIntro = (
  <p>
    What&apos;s shipped recently across the dashboard, the tag, and plan limits. This page is updated as changes
    go live, not on a fixed schedule.
  </p>
);

export const changelogSections: LegalSection[] = [
  {
    id: '2026-10',
    heading: 'October 2026',
    body: (
      <>
        <ul>
          <li>Introduced the four-tier plan structure — Free, Starter, Scale, and Pro Developer — replacing the earlier three-plan lineup, with clearer per-site widget and automation limits at every level.</li>
          <li>Standardized the live-widget cap at 3 per connected site across all plans, with a per-plan limit on total configured widgets per site.</li>
          <li>Published dedicated documentation pages for visit logs, email capture, live overlays, and the dashboard.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'earlier',
    heading: 'Earlier updates',
    body: (
      <p>
        Visit logging, email capture widgets, and live overlays have been part of sitevento since its initial
        release — see <a href="/product/dashboard">the dashboard overview</a> for how they fit together today.
        Earlier, more granular release notes aren&apos;t separately archived on this page yet.
      </p>
    ),
  },
  {
    id: 'whats-next',
    heading: "What's next",
    body: (
      <p>
        Planned work focuses on deeper automation around overlays and visitor rules, and expanding team
        collaboration features on the dashboard. Nothing here is a commitment to a specific date — check back as
        this page updates.
      </p>
    ),
  },
];
