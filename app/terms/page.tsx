// app/terms/page.tsx — Terms of Service route.
//
// Plain Server Component (no 'use client'): static content, statically
// generated at build time — see app/privacy/page.tsx's header comment
// for the full reasoning (same pattern, mirrored here).
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { formatLastUpdated } from '@/components/legal/formatLastUpdated';
import { termsIntro, termsSections, LAST_UPDATED } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    "The terms that govern using sitevento's dashboard and the tracking/banner tag you install on your own site.",
  alternates: { canonical: '/terms' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/terms`,
    title: 'Terms of Service — sitevento',
    description:
      "The terms that govern using sitevento's dashboard and the tracking/banner tag you install on your own site.",
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="legal"
      title="Terms of Service"
      updatedOn={formatLastUpdated(LAST_UPDATED)}
      intro={termsIntro}
      sections={termsSections}
    />
  );
}
