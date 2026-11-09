// app/console/page.tsx — internal admin dashboard route. Plain Server
// Component (same reasoning as app/page.tsx and app/dashboard/page.tsx:
// `export const dynamic` is only honored from a Server Component, and
// the client tree below needs real env vars that aren't available
// during a static build-time prerender).
//
// noindex + nocache: this is an internal tool, not a customer-facing
// or crawlable page — same treatment app/admin/widgets/page.tsx
// already uses. Not linked from anywhere public; only reachable by
// typing the URL (and, once signed into Console, from Settings' last
// nav item).
import type { Metadata } from 'next';
import ConsoleClient from '@/components/console/ConsoleClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Console Panel',
  robots: { index: false, follow: false, nocache: true },
};

export default function ConsolePage() {
  return <ConsoleClient />;
}
