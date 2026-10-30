// app/dashboard/monetization/page.tsx — route for the Monetization
// feature. Mirrors app/dashboard/agent/page.tsx: a thin Server
// Component route that mounts the client component holding the
// actual UI, since MonetizationPageClient needs real
// NEXT_PUBLIC_FIREBASE_* env vars that aren't available during
// static build-time prerendering.
import type { Metadata } from 'next';
import MonetizationPageClient from '@/components/monetization/MonetizationPageClient';

// Scoped to this route only, same as agent-page.css — ships only in
// this route's chunk rather than the global stylesheet every page
// downloads. Two files: monetization-page.css owns the shell + the
// upsell gate, monetization-dashboard.css owns the real dashboard
// content shown once monetization is on (see that file's header
// comment for why they're split).
import '@/styles/monetization/monetization-page.css';
import '@/styles/monetization/monetization-dashboard.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Monetization · Sitevento',
  description: 'Turn your site\u2019s traffic into revenue — impressions, CPM, clicks, and payouts in one dashboard.',
};

export default function Page() {
  return <MonetizationPageClient />;
}
