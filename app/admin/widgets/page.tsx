// app/admin/widgets/page.tsx — public admin tool for the global
// widgets/{id} Firestore catalog: shows whether each shipped widget
// (support-chat, countdown-timer, email-capture — see lib/widgets.ts's
// WIDGET_CATALOG) is currently pushed, lets you delete a single doc or push all of
// them at once. See app/api/admin/widgets/route.ts (status),
// app/api/admin/widgets/[id]/route.ts (delete), and
// app/api/seed-widget-catalog/route.ts (push all) for what each action
// calls and why every one of them is safe to leave public (every route
// only ever touches the fixed, known catalog ids — never a
// caller-supplied widgetId or URL).
//
// Linked from the dashboard sidebar ("Admin"), but still rendered
// standalone here — no Header/Sidebar/auth gate, not nested under
// /dashboard — since it's an internal tool, not part of the customer
// product surface, so it stays out of search (noindex below) and out
// of the dashboard's own chrome even though it's one click away from
// it.
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
