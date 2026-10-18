// app/dashboard/plans/page.tsx — the plan-switch/compare route. Same
// Server Component shell as app/dashboard/profile/page.tsx (own SEO
// metadata, noindex since this is a signed-in per-account view,
// `dynamic = force-dynamic` for the same real-env-vars-at-build-time
// reason that route's own comment explains). Renders DashboardClient
// with view="plans" so it shares DashboardClient's single auth gate,
// header and sidebar instead of standing up its own copies — GlobalNav
// (the floating nav) comes along for free too, since it renders
// site-wide from app/layout.tsx.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { BootSplash } from '@/components/BootSplash';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Plans & billing',
  description: 'Compare sitevento plans and switch anytime — connected sites, widget limits, overlays, automation and support, all in one place.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/dashboard/plans' },
};

export default function PlansRoutePage() {
  return (
    <Suspense fallback={<BootSplash />}>
      <DashboardClient view="plans" />
    </Suspense>
  );
}
