// app/dashboard/page.tsx — the dashboard's own route, split out of the
// old single-page AppRoot view switch so it gets real SEO metadata
// (title, description — distinct from the marketing homepage's) and an
// own URL that deep-links, bookmarks, and shares correctly instead of
// being one state of "/".
//
// Deliberately a plain Server Component (no 'use client' here), same
// reasoning as app/page.tsx: `export const dynamic` is only honored by
// Next.js when read from a Server Component, and the interactive tree
// below needs real NEXT_PUBLIC_FIREBASE_* env vars that aren't present
// during a static build-time prerender. All client logic lives in
// components/dashboard/DashboardClient.tsx.
//
// noindex: this is a signed-in, per-account view — nothing here is
// content a search engine should crawl or list, same reasoning
// app/robots.ts already uses to disallow /api/.
// No stylesheet import here: app/globals.css (imported from
// app/layout.tsx, which wraps every route) already pulls in
// styles/dashboard/dashboard.css — this route's styling lives there, in place of
// the pre-redesign rules of the same name.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { AppSkeleton } from '@/components/AppSkeleton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your connected sites, live visits, and real-time site banners — all in one place.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/dashboard' },
};

export default function DashboardPage() {
  // DashboardClient reads the ?connect=1 query param (useSearchParams),
  // which Next.js requires to sit under a Suspense boundary even on a
  // force-dynamic route — otherwise `next build` warns/fails about a
  // deoptimized client reference. AppSkeleton is the app's
  // shared loading state, so reusing it here means no
  // double-boot flash; it clears the instant DashboardClient's own
  // useAuth/authReady is ready and renders.
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading your dashboard" />}>
      <DashboardClient />
    </Suspense>
  );
}
