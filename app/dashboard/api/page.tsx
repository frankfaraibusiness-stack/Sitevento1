// app/dashboard/api/page.tsx — the Developer API route.
//
// Same Server Component shell as app/dashboard/analytics/page.tsx: its own
// metadata, noindex (signed-in, per-account), force-dynamic, and
// DashboardClient with view="api" so it shares the single auth gate, header
// and sidebar. Reuses the Analytics page's look (analytics.css tokens and
// font) and adds styles/api/api-page.css; both load on this route only.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { GlobalLoader } from '@/components/GlobalLoader';
import '@/styles/analytics/analytics.css';
import '@/styles/api/api-page.css';

export const dynamic = 'force-dynamic';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--anx-font',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'API',
  description: 'Connect your backend: choose what your server can send — subscriptions, sales, expenses, sign-ups — and see it in your analytics.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/dashboard/api' },
};

export default function ApiRoutePage() {
  return (
    <div className={jakarta.variable}>
      <Suspense fallback={<GlobalLoader variant="inline" fullScreen label="Loading API" />}>
        <DashboardClient view="api" />
      </Suspense>
    </div>
  );
}
