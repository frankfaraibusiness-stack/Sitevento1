// app/dashboard/connect/page.tsx — the "Connect your site" route.
//
// Rebuilt from scratch against the new cartoonic/3D design (see
// styles/connect/connect-flow.css). Step 1 (domain + live RDAP
// lookup) is wired to the real backend end to end — POST
// /api/domain-lookup for the live card, POST /api/connect-site to
// actually create the site on "Next" — see components/connect/
// ConnectFlow.tsx's header comment for the full data flow. Later
// steps (tag + verify, permissions, finish) land on top of this same
// shell.
//
// Same Server Component shell as the other app/dashboard/* routes
// (own metadata, noindex since this is a signed-in per-account view,
// `dynamic = force-dynamic` for the same real-env-vars-at-build-time
// reason those routes' own comments explain). Renders
// ConnectFlowClient, which owns its own auth gate; the page content
// and header come from ConnectFlow itself. components/layout/
// GlobalNav.tsx is hidden on this one route (see its own
// pathname === '/dashboard/connect' exception) since ConnectFlow's
// header replaces it here.
//
// Scoped CSS: styles/connect/connect-flow.css ships only in this
// route's chunk instead of the global stylesheet every page
// downloads — same trick as app/dashboard/wallet/page.tsx's own
// scoped import.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import ConnectFlowClient from '@/components/connect/ConnectFlowClient';
import { GlobalLoader } from '@/components/GlobalLoader';
import '@/styles/connect/connect-flow.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connect your site',
  description: 'Link a site to sitevento.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/dashboard/connect' },
};

export default function ConnectSitePage() {
  return (
    <Suspense fallback={<GlobalLoader variant="inline" fullScreen label="Loading" />}>
      <ConnectFlowClient />
    </Suspense>
  );
}
