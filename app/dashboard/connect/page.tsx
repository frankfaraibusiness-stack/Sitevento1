// app/dashboard/connect/page.tsx — the "Connect your site" route.
//
// Rebuilt from scratch against the new cartoonic/3D design. Three
// steps built so far, all wired to real backends (no mock data
// anywhere):
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
//   Step 3 "Connect" (components/connect/ConnectPermissionsStep.tsx,
//   styles/connect/connect-permissions-step.css) — the verified-success
//   screen, then a review/adjust pass over the site's permission grant
//   using the existing components/sites/PermissionsGrid.tsx (same
//   component and same styles/sites/permissions-grid.css SiteManagePage's
//   own Permissions panel uses), saved instantly per-toggle via
//   useSites().updateSitePermissions (POST /api/user-action's
//   'update-site-permissions' action).
//
// Both steps 1-3's desktop (>=1040px) layout also uses a shared side
// rail (components/connect/ConnectSideRail.tsx, styles/connect/
// connect-side-rail.css) with step-specific "How it works"/FAQ content,
// so a wide viewport gets an actual two-column page instead of one
// narrow centered card on an empty background.
//
// Which step renders is decided in components/connect/
// ConnectFlowClient.tsx's own small step machine. Steps 4-5 (Settings,
// Finish — see STEP_LABELS in each step file) aren't built yet; step 3
// currently routes straight to the dashboard when finished.
//
// Same Server Component shell as the other app/dashboard/* routes
// (own metadata, noindex since this is a signed-in per-account view,
// `dynamic = force-dynamic` for the same real-env-vars-at-build-time
// reason those routes' own comments explain). components/layout/
// GlobalNav.tsx is hidden on this one route (see its own
// pathname === '/dashboard/connect' exception) since each step's own
// header replaces it here.
//
// Scoped CSS: every stylesheet here ships only in this route's chunk
// instead of the global stylesheet every page downloads — same trick
// as app/dashboard/wallet/page.tsx's own scoped import.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import ConnectFlowClient from '@/components/connect/ConnectFlowClient';
import { GlobalLoader } from '@/components/GlobalLoader';
import '@/styles/connect/connect-flow.css';
import '@/styles/connect/verify-flow.css';
import '@/styles/connect/connect-side-rail.css';
import '@/styles/sites/permissions-grid.css';
import '@/styles/connect/connect-permissions-step.css';

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
