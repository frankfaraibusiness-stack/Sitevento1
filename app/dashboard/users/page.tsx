// app/dashboard/users/page.tsx — the dedicated "Users" route.
// Same Server Component shell as app/dashboard/leads/page.tsx and
// app/dashboard/visits/page.tsx (own SEO metadata, noindex since this
// is a signed-in per-account view, `dynamic = force-dynamic` for the
// same real-env-vars-at-build-time reason those routes' own comments
// explain). Renders DashboardClient with view="users" so it shares
// DashboardClient's single auth gate, header and sidebar instead of
// standing up its own copies.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { AppSkeleton } from '@/components/AppSkeleton';

// Scoped to this route only — deliberately NOT added to
// app/globals.css's @import list (same trick as visits-page.css and
// email-capture-page.css — see those routes' own comments).
import '@/styles/dashboard/users-page.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Users',
  description: 'Every unique visitor who has landed on your site — recognized by device, with restrict, block, and message controls.',
  robots: { index: false, follow: false, nocache: true },
};

export default function UsersRoutePage() {
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading users" />}>
      <DashboardClient view="users" />
    </Suspense>
  );
}
