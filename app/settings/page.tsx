// app/settings/page.tsx — the settings route, same Server Component
// shell pattern as app/dashboard/page.tsx (own SEO metadata, noindex
// since this is a signed-in per-account view, force-dynamic for the
// same real-env-vars-at-build-time reason). Renders SettingsPageClient
// with initialPanel="account".
import type { Metadata } from 'next';
import { Suspense } from 'react';
import SettingsPageClient from '@/components/settings/SettingsPageClient';
import { AppSkeleton } from '@/components/AppSkeleton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your account, notifications, API keys, and more.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/settings' },
};

export default function SettingsRoutePage() {
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading settings" />}>
      <SettingsPageClient initialPanel="account" />
    </Suspense>
  );
}
