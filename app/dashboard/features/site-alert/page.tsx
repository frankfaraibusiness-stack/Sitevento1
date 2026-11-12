// app/dashboard/features/site-alert/page.tsx — route for the Site Alert
// feature. Previously this tile opened an in-place full-screen panel
// over /dashboard (DashboardShell's old `siteAlertOpen` state +
// `.feat-panel-screen`); it's now a real standalone route, same
// Server-Component-wraps-Client-Component pattern as
// app/dashboard/agent/page.tsx, since SiteAlertPageClient needs real
// NEXT_PUBLIC_FIREBASE_* env vars that aren't available at static
// build-time prerendering.
import SiteAlertPageClient from '@/components/site-alert/SiteAlertPageClient';

// Scoped to this route only, same reasoning as styles/agent/agent-page.css's
// header comment — not in app/globals.css's @import list, so it only
// ships in this route's own chunk.
import '@/styles/site-alert/site-alert-page.css';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <SiteAlertPageClient />;
}
