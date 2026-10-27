// app/dashboard/profile/page.tsx — the profile/account route. Same
// Server Component shell as app/dashboard/page.tsx (own SEO metadata,
// noindex since this is a signed-in per-account view, `dynamic =
// force-dynamic` for the same real-env-vars-at-build-time reason that
// route's own comment explains). Renders DashboardClient with
// view="profile" so it shares DashboardClient's single auth gate,
// header and sidebar instead of standing up its own copies.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { AppSkeleton } from '@/components/AppSkeleton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your profile',
  description: 'Manage your account, plan, and connected sites.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/dashboard/profile' },
};

export default function ProfileRoutePage() {
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading your profile" />}>
      <DashboardClient view="profile" />
    </Suspense>
  );
}
