import type { LegalSection } from '@/components/legal/LegalPage';

export const docsIntro = (
  <p>
    Everything you need to connect a site, configure widgets, and push your first overlay — no SDK to install,
    no build step, just a tag and a dashboard.
  </p>
);

export const docsSections: LegalSection[] = [
  {
    id: 'quick-start',
    heading: 'Quick start',
    body: (
      <>
        <p>Getting a site connected takes three steps:</p>
        <ol className="legal-list">
          <li>Create an account and start a new site connection from your dashboard.</li>
          <li>
            Paste the generated script tag into your site&apos;s <code>&lt;head&gt;</code> — it works on any static
            site, CMS, or framework, since it&apos;s a single async-loading tag with no build-time dependency.
          </li>
          <li>
            Return to the dashboard and confirm verification. Once the tag is detected live on your domain, visit
            logging starts immediately.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'the-tag',
    heading: 'How the tag works',
    body: (
      <>
        <p>
          The sitevento tag loads asynchronously and defers all work off the main thread, so it doesn&apos;t block
          render or affect page load time. It&apos;s responsible for three things: logging visits, delivering any
          widgets you&apos;ve enabled for that site, and rendering a live overlay if one is currently published.
        </p>
        <p>
          Widgets are never executed directly in your page&apos;s own JavaScript context — each one loads inside a
          sandboxed iframe, so enabling a widget doesn&apos;t hand a third party full access to your page&apos;s DOM
          or cookies.
        </p>
      </>
    ),
  },
  {
    id: 'domain-verification',
    heading: 'Domain verification',
    body: (
      <p>
        A site is verified once sitevento detects the tag loading from a real page request on the domain you
        registered. Requests from other domains carrying the same site ID are rejected — the tag only delivers
        widgets and overlays to the domain the site was registered under (plus its <code>www.</code> variant),
        which keeps a copied tag from quietly running on an unauthorized domain.
      </p>
    ),
  },
  {
    id: 'widgets',
    heading: 'Configuring widgets',
    body: (
      <>
        <p>
          Widgets are enabled per site from the dashboard&apos;s widget panel. Each widget you turn on is delivered
          live automatically — there&apos;s no redeploy step. Keep two limits in mind:
        </p>
        <ul>
          <li>
            <strong>Live limit:</strong> up to 3 widgets can be live on one site at a time, on every plan. Disable
            one to make room for another.
          </li>
          <li>
            <strong>Configured limit:</strong> how many widgets you can have set up (live or paused) on one site
            scales with your plan — 3 on Free, up to 30 on Pro Developer. See <a href="/pricing">pricing</a> for
            exact numbers.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'overlays',
    heading: 'Publishing an overlay',
    body: (
      <p>
        From a site&apos;s dashboard, choose an overlay template, fill in the copy, and publish. The overlay appears
        on the live site within moments through the same tag, and can be taken down just as quickly. Available on
        Starter and above — see <a href="/product/live-overlays">live overlays</a> for the full behavior.
      </p>
    ),
  },
  {
    id: 'disconnecting',
    heading: 'Disconnecting a site',
    body: (
      <p>
        Removing a site from your dashboard stops new data collection immediately. Existing visit history and leads
        remain available for export until you choose to delete the site entirely.
      </p>
    ),
  },
];
