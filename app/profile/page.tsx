// app/profile/page.tsx — the account profile route, now a top-level
// route (moved from app/dashboard/profile/page.tsx — profile is no
// longer nested under /dashboard; /dashboard is just another signed-in
// view now). Same Server Component shell as the other app/dashboard/*
// routes (own SEO metadata, noindex since this is a signed-in
// per-account view, `dynamic = force-dynamic` for the same real-env-
// vars-at-build-time reason those routes' own comments explain).
// Renders DashboardClient with view="profile" so it shares
// DashboardClient's single auth gate, header and sidebar instead of
// standing up its own copies.
//
// Scoped CSS: styles/dashboard/profile-page.css ships only in this
// route's chunk instead of the global stylesheet every page downloads
// — same trick other DashboardClient-backed routes use for their own
// scoped stylesheets.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { GlobalLoader } from '@/components/GlobalLoader';
import '@/styles/dashboard/profile-page.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your account, plan, daily tokens, connected site, and live site performance — all in one place.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/profile' },
};

export default function ProfileRoutePage() {
  return (
    <Suspense fallback={<GlobalLoader variant="inline" fullScreen label="Loading your profile" />}>
      <DashboardClient view="profile" />
    </Suspense>
  );
}
