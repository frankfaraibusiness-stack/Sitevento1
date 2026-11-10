// app/profile/page.tsx — the account profile route (top-level, linked from the
// header avatar, the mobile/desktop nav and the sidebar).
//
// Same Server Component shell as app/settings/page.tsx and
// app/dashboard/page.tsx: `export const dynamic` is only honored from a Server
// Component, and the client tree needs real NEXT_PUBLIC_FIREBASE_* values that
// don't exist during a static build-time prerender. All client logic lives in
// components/profile/ProfilePageClient.tsx; all of this page's styling lives in
// styles/profile/profile-page.css (imported by that component).
//
// SEO: own title/description, canonical, and OpenGraph/Twitter cards. It is
// noindex on purpose — like /dashboard and /settings it is a signed-in,
// per-account view with nothing a search engine should list — so the cards
// only matter for link previews when someone pastes the URL.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProfilePageClient from '@/components/profile/ProfilePageClient';
import { GlobalLoader } from '@/components/GlobalLoader';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';
const TITLE = 'Your profile';
const DESCRIPTION =
  'Your sitevento plan and usage, all-time views and clicks, connected sites, quick tools and recent activity — in one place.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/profile' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/profile`,
    title: `${TITLE} — sitevento`,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} — sitevento`,
    description: DESCRIPTION,
  },
};

export default function ProfileRoutePage() {
  return (
    <Suspense fallback={<GlobalLoader variant="inline" fullScreen label="Loading your profile" />}>
      <ProfilePageClient />
    </Suspense>
  );
}
