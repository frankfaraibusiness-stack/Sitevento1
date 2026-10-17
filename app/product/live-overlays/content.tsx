import type { LegalSection } from '@/components/legal/LegalPage';

export const liveOverlaysIntro = (
  <p>
    A full-screen or banner-style message you can push to a live site instantly — announcement, maintenance mode,
    or an urgent note to visitors — and take down just as fast, with no redeploy.
  </p>
);

export const liveOverlaysSections: LegalSection[] = [
  {
    id: 'what-it-is',
    heading: 'What a live overlay is',
    body: (
      <p>
        An overlay is a message that renders on top of (or across) your connected site the moment you publish it
        from the dashboard. Use it for a site-wide announcement, a scheduled-maintenance notice, or a time-sensitive
        message you need every visitor to see right now — then pull it down the instant it&apos;s no longer needed.
      </p>
    ),
  },
  {
    id: 'templates',
    heading: 'Pick a template, not a design project',
    body: (
      <p>
        Overlays come with ready-made templates for the common cases — announcement banners, maintenance takeovers,
        and plain messages — so publishing one doesn&apos;t mean designing a layout from scratch under time
        pressure. Each template is configurable: copy, art, and basic theme can be adjusted from the dashboard
        before you push it live.
      </p>
    ),
  },
  {
    id: 'instant',
    heading: 'Live the moment you hit send',
    body: (
      <p>
        Because overlays are delivered through the same lightweight tag that powers visit logging, there&apos;s no
        deploy pipeline between you and your visitors. Publish from the dashboard and the overlay appears on your
        live site within moments — and disappears just as fast when you take it down.
      </p>
    ),
  },
  {
    id: 'plan-availability',
    heading: 'Which plans include live overlays',
    body: (
      <p>
        Live overlays are available starting on the Starter plan and included on Scale and Pro Developer as well.
        The Free plan is built for logging visits and capturing your first leads on a single site, and doesn&apos;t
        include overlay publishing — upgrade whenever you need to push a message live. Full details are on the{' '}
        <a href="/pricing">pricing page</a>.
      </p>
    ),
  },
  {
    id: 'overlay-vs-widget',
    heading: 'Overlays vs. widgets',
    body: (
      <p>
        An overlay is a one-off, dashboard-triggered broadcast meant to be temporary — a notice you publish and
        later remove. A widget (like <a href="/product/email-capture">email capture</a>) is a persistent, always-on
        element you configure once and leave running. Both are delivered through the same tag, but they&apos;re
        governed separately: overlays don&apos;t count against your live-widget limit.
      </p>
    ),
  },
];
