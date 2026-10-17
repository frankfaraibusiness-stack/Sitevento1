import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { docsIntro, docsSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Documentation — Install the Tag, Configure Widgets',
  description:
    'How to connect a site to sitevento, verify your domain, configure widgets within plan limits, and publish live overlays.',
  alternates: { canonical: '/docs' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/docs`,
    title: 'Documentation — sitevento',
    description: 'How to connect a site, verify your domain, configure widgets, and publish live overlays.',
  },
};

export default function DocsPage() {
  return (
    <LegalPage
      eyebrow="resources"
      title="Documentation"
      updatedOn="October 17, 2026"
      intro={docsIntro}
      sections={docsSections}
    />
  );
}
