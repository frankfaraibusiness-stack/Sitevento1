// app/privacy/page.tsx — Privacy Policy route.
//
// Plain Server Component (no 'use client'): this is static content with
// no interactivity beyond anchor-link scrolling, which <a href="#id">
// already handles for free, so the route is statically generated at
// build time — fast first paint, fully crawlable, no client JS bundle
// needed just to read a policy. Its own real metadata (distinct from
// the root layout's homepage title/description, same `template`
// mechanism documented in app/layout.tsx) rather than inheriting the
// homepage's — a policy page needs its own title/description for
// search results and social previews, and should be indexed (contrast
// with app/dashboard/page.tsx, which explicitly opts OUT of indexing
// since it's a signed-in, per-account view).
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { privacyIntro, privacySections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How sitevento collects, uses, and protects data from account owners and the visitors to sites that use the sitevento tracking tag.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/privacy`,
    title: 'Privacy Policy — sitevento',
    description:
      'How sitevento collects, uses, and protects data from account owners and the visitors to sites that use the sitevento tracking tag.',
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="legal"
      title="Privacy Policy"
      updatedOn="October 17, 2026"
      intro={privacyIntro}
      sections={privacySections}
    />
  );
}
