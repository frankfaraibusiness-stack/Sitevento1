import type { LegalSection } from '@/components/legal/LegalPage';

export const emailCaptureIntro = (
  <p>
    A drop-in widget that turns anonymous visits into leads you can actually follow up with — configured from your
    dashboard, with every captured email landing in the same place as your visit logs.
  </p>
);

export const emailCaptureSections: LegalSection[] = [
  {
    id: 'what-it-is',
    heading: 'What the email capture widget does',
    body: (
      <p>
        The email capture widget renders a small, customizable form on your connected site — a banner, corner
        prompt, or inline block, depending on how you configure it — that asks a visitor for their email. Every
        submission is written straight into your sitevento dashboard as a lead, timestamped and tied back to the
        page it was captured on.
      </p>
    ),
  },
  {
    id: 'no-code',
    heading: 'No separate tool, no code changes',
    body: (
      <p>
        You don&apos;t need a separate form builder, a third-party embed, or a code change to your site to turn it
        on or edit it. Enable the widget from your dashboard, write the copy, and it goes live on your site through
        the same tag that already powers visit logging — no redeploy.
      </p>
    ),
  },
  {
    id: 'widget-limits',
    heading: 'How widget limits work',
    body: (
      <>
        <p>
          Email capture is one widget type among several (live overlays and other widgets share the same delivery
          system). To keep any one page from turning into a wall of pop-ups, sitevento caps how many widgets can be{' '}
          <strong>live</strong> on a single connected site at the same time: <strong>3 live widgets per site</strong>,
          on every plan including Free. If you already have a contact-chat widget and a notification widget live and
          want to turn on email capture too, you&apos;ll disable one of the existing three first — switching which
          three are live takes one click and doesn&apos;t require removing a widget&apos;s configuration.
        </p>
        <p>
          Separately, each plan has a limit on how many widgets can be <strong>configured</strong> on a given site at
          all (live or paused) — this is what lets you park widgets you use seasonally without losing their setup.
          Free allows up to 3 configured widgets per site; Starter up to 10; Scale up to 20; Pro Developer up to 30 —
          per connected site, not pooled across your whole account. See the <a href="/pricing">pricing page</a> for
          the complete breakdown.
        </p>
      </>
    ),
  },
  {
    id: 'leads-and-logs',
    heading: 'Leads live next to your visit logs',
    body: (
      <p>
        Because email capture runs through the same tag and dashboard as visit logging, a captured lead isn&apos;t
        an isolated spreadsheet row — you can see the visit history around it: what page they were on, how they got
        there, and what device they used. See <a href="/product/visit-logs">visit logs</a> for the full detail
        captured on every visit.
      </p>
    ),
  },
];
