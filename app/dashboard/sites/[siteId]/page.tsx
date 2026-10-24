// app/dashboard/sites/[siteId]/page.tsx — the per-site management
// route. Same Server Component shell as app/dashboard/profile/page.tsx
// and app/dashboard/plans/page.tsx (own SEO metadata, noindex since
// this is a signed-in per-account view, `dynamic = force-dynamic` for
// the same real-env-vars-at-build-time reason those routes' own
// comments explain). Renders DashboardClient with view="site-manage"
// and the siteId route param so it shares DashboardClient's single
// auth gate, header and sidebar instead of standing up its own copies.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { AppSkeleton } from '@/components/AppSkeleton';

// Scoped to this route only — deliberately NOT added to
// app/globals.css's @import list (unlike every other styles/*.css
// file). Importing it here means it ships only in this route's chunk
// instead of the global stylesheet every page downloads, while still
// being ordinary CSS (not a CSS Module) so its plain `smp-` class
// names keep working unchanged across components/dashboard/
// SiteManagePage.tsx. Same trick as app/dashboard/agent/page.tsx's own
// styles/agent/agent-page.css import — see that route's comment.
import '@/styles/dashboard/site-manage-page.css';

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
    <Suspense fallback={<AppSkeleton fullScreen label="Loading site" />}>
      <DashboardClient view="site-manage" siteId={params.siteId} />
    </Suspense>
  );
}
