// app/dashboard/sites/page.tsx — the dedicated "Connected sites" route.
// Same Server Component shell as app/dashboard/visits/page.tsx and
// app/dashboard/leads/page.tsx (own SEO metadata, noindex since this is
// a signed-in per-account view, `dynamic = force-dynamic` for the same
// real-env-vars-at-build-time reason those routes' own comments
// explain). Renders DashboardClient with view="sites" so it shares
// DashboardClient's single auth gate, header and sidebar instead of
// standing up its own copies. The sidebar's "Connected sites" link now
// points here instead of scrolling to the inline rail on Overview (see
// components/layout/Sidebar.tsx).
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { AppSkeleton } from '@/components/AppSkeleton';

// Scoped to this route only — deliberately NOT added to
// app/globals.css's @import list (same trick as visits-page.css — see
// that route's comment).
import '@/styles/dashboard/connected-sites-page.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connected sites',
  description: 'Every site connected to your sitevento account — verification status, connect dates, and traffic, all in one place.',
  robots: { index: false, follow: false, nocache: true },
};

export default function ConnectedSitesRoutePage() {
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading connected sites" />}>
      <DashboardClient view="sites" />
    </Suspense>
  );
}
