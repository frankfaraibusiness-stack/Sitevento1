// app/dashboard/analytics/page.tsx — the new Analytics route.
//
// Same Server Component shell as app/dashboard/sites/page.tsx and
// app/dashboard/wallet/page.tsx: its own SEO metadata, noindex (signed-in,
// per-account view), `dynamic = force-dynamic` (the interactive tree needs
// real NEXT_PUBLIC_FIREBASE_* env vars that don't exist during a static
// build-time prerender), and DashboardClient with view="analytics" so it
// shares the single auth gate, header and sidebar.
//
// The stylesheets are imported here, NOT added to app/globals.css, so they only
// load on this route — fully namespaced (`anx-` header, `an-` sections) with
// their own tokens, so they neither use nor affect the global dashboard styles.
//
// The font is bundled at build time with next/font and exposed as the
// --anx-font CSS variable on a wrapper element; nothing global changes.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { GlobalLoader } from '@/components/GlobalLoader';
import '@/styles/analytics/analytics.css';
import '@/styles/analytics/analytics-sections.css';

export const dynamic = 'force-dynamic';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--anx-font',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Revenue, growth and customer analytics for your startup — all in one place.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/dashboard/analytics' },
};

export default function AnalyticsRoutePage() {
  return (
    <div className={jakarta.variable}>
      <Suspense fallback={<GlobalLoader variant="inline" fullScreen label="Loading analytics" />}>
        <DashboardClient view="analytics" />
      </Suspense>
    </div>
  );
}
