// app/dashboard/advertise/page.tsx — route for the Advertise feature
// (run your own ads across the network). Mirrors
// app/dashboard/agent/page.tsx and app/dashboard/monetization/page.tsx:
// a thin Server Component route that mounts the client component
// holding the actual UI, since AdvertisePageClient needs real
// NEXT_PUBLIC_FIREBASE_* env vars that aren't available during static
// build-time prerendering.
import type { Metadata } from 'next';
import AdvertisePageClient from '@/components/advertise/AdvertisePageClient';

// Scoped to this route only, same as agent-page.css and the
// monetization-*.css pair — ships only in this route's chunk rather
// than the global stylesheet every page downloads.
import '@/styles/advertise/advertise-page.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Advertise · Sitevento',
  description: 'Run your own banner, link, or text ads across the Sitevento network — set your creative, pick your formats, go live.',
};

export default function Page() {
  return <AdvertisePageClient />;
}
