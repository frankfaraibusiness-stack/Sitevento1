// app/dashboard/sites/[siteId]/page.tsx — the per-site management
// route. Same Server Component shell as app/profile/page.tsx
// and app/dashboard/plans/page.tsx (own SEO metadata, noindex since
// this is a signed-in per-account view, `dynamic = force-dynamic` for
// the same real-env-vars-at-build-time reason those routes' own
// comments explain). Renders DashboardClient with view="site-manage"
// and the siteId route param so it shares DashboardClient's single
// auth gate, header and sidebar instead of standing up its own copies.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { GlobalLoader } from '@/components/GlobalLoader';

// Scoped to this route only — deliberately NOT added to
// app/globals.css's @import list (unlike every other styles/*.css
// file). Importing it here means it ships only in this route's chunk
// instead of the global stylesheet every page downloads, while still
// being ordinary CSS (not a CSS Module) so its plain `smp-` class
// names keep working unchanged across components/dashboard/
// SiteManagePage.tsx. Same trick as app/dashboard/agent/page.tsx's own
// styles/agent/agent-page.css import — see that route's comment.
import '@/styles/dashboard/site-manage-page.css';
// PermissionsGrid's cwz-perm-* rules (styles/sites/permissions-grid.css)
// — the old connect wizard's permissions UI, moved to a shared
// location since SiteManagePage's Permissions panel uses it standalone.
import '@/styles/sites/permissions-grid.css';
// AnalyticsPanel's smp-trend-*/smp-rank-*/smp-rum-* rules — own file
// for the same scoping reason as site-manage-page.css itself (see
// that import's comment above); reuses this route's own smp- design
// tokens rather than redefining them.
import '@/styles/dashboard/analytics-panel.css';
// HeatmapPanel's hmp-* rules — own file for the same scoping reason
// as analytics-panel.css above; reuses this route's own design tokens
// rather than redefining them.
import '@/styles/dashboard/heatmap-panel.css';
// RetentionPanel's rtp-* rules — own file for the same scoping reason
// as analytics-panel.css/heatmap-panel.css above.
import '@/styles/dashboard/retention-panel.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Manage site',
  description: 'Site details, domain info, actions, and stats for one connected site.',
  robots: { index: false, follow: false, nocache: true },
};

interface SiteManageRouteProps {
  params: { siteId: string };
}

export default function SiteManageRoutePage({ params }: SiteManageRouteProps) {
  return (
    <Suspense fallback={<GlobalLoader variant="inline" fullScreen label="Loading site" />}>
      <DashboardClient view="site-manage" siteId={params.siteId} />
    </Suspense>
  );
}
