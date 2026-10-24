// app/dashboard/connect/page.tsx — the dedicated "Connect your site"
// route. Previously this flow lived inside a modal
// (components/connect/ConnectSiteWizard.tsx) mounted over the
// dashboard; it's now a full page with its own URL, so it deep-links,
// bookmarks, and shares correctly, and gets its own SEO metadata
// distinct from the main /dashboard route's.
//
// Same Server Component shell as the other app/dashboard/* routes
// (own metadata, noindex since this is a signed-in per-account view,
// `dynamic = force-dynamic` for the same real-env-vars-at-build-time
// reason those routes' own comments explain). Renders
// ConnectFlowClient, which owns its own auth gate, header and sidebar
// via the shared app chrome.
//
// Scoped CSS: styles/connect/connect-flow.css ships only in this route's
// chunk instead of the global stylesheet every page downloads — same
// trick as app/dashboard/visits/page.tsx's own scoped import.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import ConnectFlowClient from '@/components/connect/ConnectFlowClient';
import { AppSkeleton } from '@/components/AppSkeleton';
import '@/styles/connect/connect-flow.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connect your site',
  description: 'Link a site to sitevento in under a minute — paste one tag, verify, and start seeing live visits.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/dashboard/connect' },
};

export default function ConnectSitePage() {
  return (
    <Suspense fallback={<AppSkeleton fullScreen label="Loading" />}>
      <ConnectFlowClient />
    </Suspense>
  );
}
