// app/widgets/page.tsx — the widget picker's own route.
//
// Previously the picker (WidgetsPanel.tsx) only existed as a full-screen
// client overlay toggled from inside /dashboard, which is noindex (see
// app/dashboard/page.tsx) — so the picker had no URL a search engine
// could ever crawl or rank. Moving it here, as a plain top-level route
// with real metadata, is what actually makes it indexable; everything
// interactive still lives in components/widgets/WidgetsPageClient.tsx
// for the same reason app/dashboard/page.tsx stays a server component
// wrapping DashboardClient — `export const dynamic` below is only
// honored by Next.js when read from a Server Component, and the
// interactive tree needs real NEXT_PUBLIC_FIREBASE_* env vars that
// aren't present during a static build-time prerender.
//
// Unlike /dashboard, this route is NOT noindex: the catalog itself
// (what each widget does) is product content worth ranking for, same
// as the /product/* pages. Only the actual per-site enable/configure
// step — now its own route per widget, /widgets/[widgetId] (see
// app/widgets/[widgetId]/page.tsx + WidgetDesigner) — requires
// sign-in, prompted for right here before navigating there.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import WidgetsPageClient from '@/components/widgets/WidgetsPageClient';
import { AppSkeleton } from '@/components/AppSkeleton';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Widgets — Drop-in On-Site Widgets',
  description:
    'Support chat and a countdown timer — drop-in widgets to make your site more interactive and engaging. No code, no redeploy.',
  alternates: { canonical: '/widgets' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/widgets`,
    title: 'Widgets — sitevento',
    description:
      'Powerful widgets to make your site more interactive and engaging — support chat and a countdown timer.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Widgets — sitevento',
    description: 'Powerful widgets to make your site more interactive and engaging.',
  },
};

export default function WidgetsPage() {
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading widgets" />}>
      <WidgetsPageClient />
    </Suspense>
  );
}
