// app/dashboard/visits/page.tsx — the dedicated "Visit logs" route.
// Same Server Component shell as app/dashboard/sites/[siteId]/page.tsx
// and app/dashboard/profile/page.tsx (own SEO metadata, noindex since
// this is a signed-in per-account view, `dynamic = force-dynamic` for
// the same real-env-vars-at-build-time reason those routes' own
// comments explain). Renders DashboardClient with view="visits" so it
// shares DashboardClient's single auth gate, header and sidebar
// instead of standing up its own copies.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { AppSkeleton } from '@/components/AppSkeleton';

// Scoped to this route only — deliberately NOT added to
// app/globals.css's @import list (unlike every other styles/*.css
// file). Importing it here means it ships only in this route's chunk
// instead of the global stylesheet every page downloads, while still
// being ordinary CSS (not a CSS Module) so its plain `vlp-` class
// names keep working unchanged across components/dashboard/
// VisitsPage.tsx. Same trick as
// app/dashboard/sites/[siteId]/page.tsx's own
// styles/site-manage-page.css import — see that route's comment.
import '@/styles/visits-page.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Visit logs',
  description: 'Every visitor who has landed on your site — searchable, filterable, with block and restrict controls.',
  robots: { index: false, follow: false, nocache: true },
};

export default function VisitsRoutePage() {
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading visit logs" />}>
      <DashboardClient view="visits" />
    </Suspense>
  );
}
