// app/admin/widgets/page.tsx — tiny public admin tool, one job: seed
// the global widgets/{id} Firestore catalog so shipped widgets
// (support-chat, countdown-timer — see lib/widgets.ts's WIDGET_CATALOG)
// can actually render for visitors. See app/api/seed-widget-catalog/
// route.ts for what the Deploy button on this page calls and why this
// is safe to leave public (hard-coded to the known shipped ids and
// this deployment's own origin — no caller-supplied widgetId or URL).
//
// Deliberately standalone — no Header/Sidebar/auth gate, not nested
// under /dashboard. This is an internal tool, not a customer-facing
// page, so it stays out of the main app chrome and out of search
// (noindex below) rather than looking like part of the product.
import type { Metadata } from 'next';
import AdminWidgetsClient from '@/components/admin/AdminWidgetsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin — Widget Catalog',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminWidgetsPage() {
  return <AdminWidgetsClient />;
}
