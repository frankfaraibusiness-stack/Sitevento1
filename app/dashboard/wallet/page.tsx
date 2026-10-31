// app/dashboard/wallet/page.tsx — the global wallet route. Same
// Server Component shell as app/dashboard/plans/page.tsx and
// app/dashboard/profile/page.tsx (own SEO metadata, noindex since
// this is a signed-in per-account view, `dynamic = force-dynamic` for
// the same real-env-vars-at-build-time reason those routes' own
// comments explain). Renders DashboardClient with view="wallet" so it
// shares DashboardClient's single auth gate, header and sidebar
// instead of standing up its own copies.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { AppSkeleton } from '@/components/AppSkeleton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wallet',
  description: 'Add funds to cover writes beyond your daily plan limit, in 100,000-write bundles priced by plan.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/dashboard/wallet' },
};

export default function WalletRoutePage() {
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading your wallet" />}>
      <DashboardClient view="wallet" />
    </Suspense>
  );
}
