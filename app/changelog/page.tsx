import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { changelogIntro, changelogSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Changelog',
  description: "What's shipped recently on sitevento: plan changes, widget limits, new documentation, and more.",
  alternates: { canonical: '/changelog' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/changelog`,
    title: 'Changelog — sitevento',
    description: "What's shipped recently on sitevento.",
  },
};

export default function ChangelogPage() {
  return (
    <LegalPage
      eyebrow="resources"
      title="Changelog"
      updatedOn="October 17, 2026"
      intro={changelogIntro}
      sections={changelogSections}
    />
  );
}
