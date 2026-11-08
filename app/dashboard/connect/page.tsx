// app/dashboard/connect/page.tsx — the "Connect your site" route.
//
// Rebuilt from scratch against the new cartoonic/3D design. Two steps
// built so far, both wired to real backends (no mock data anywhere):
//
//   Step 1 (components/connect/ConnectFlow.tsx, styles/connect/
//   connect-flow.css) — domain + live RDAP registration lookup (POST
//   /api/domain-lookup), then actually creates the site server-side on
//   "Next" (POST /api/connect-site).
//
//   Step 2 (components/connect/VerifyFlow.tsx, styles/connect/
//   verify-flow.css) — real install-tag ownership check (POST
//   /api/verify-site, pre-existing) PLUS a separate live-reachability +
//   metadata check (POST /api/site-reachability, new) since a
//   registered domain can still have no real site behind it.
//
// Which step renders is decided in components/connect/
// ConnectFlowClient.tsx's own small step machine. Steps 3-5 (Connect,
// Settings, Finish — see VerifyFlow's STEP_LABELS) aren't built yet.
//
// Same Server Component shell as the other app/dashboard/* routes
// (own metadata, noindex since this is a signed-in per-account view,
// `dynamic = force-dynamic` for the same real-env-vars-at-build-time
// reason those routes' own comments explain). components/layout/
// GlobalNav.tsx is hidden on this one route (see its own
// pathname === '/dashboard/connect' exception) since each step's own
// header replaces it here.
//
// Scoped CSS: both stylesheets ship only in this route's chunk
// instead of the global stylesheet every page downloads — same trick
// as app/dashboard/wallet/page.tsx's own scoped import.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import ConnectFlowClient from '@/components/connect/ConnectFlowClient';
import { GlobalLoader } from '@/components/GlobalLoader';
import '@/styles/connect/connect-flow.css';
import '@/styles/connect/verify-flow.css';

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
