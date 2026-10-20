import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { supportIntro, supportSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'How to get help with sitevento: common fixes, support channels by plan, what to include in a request, and how to report a security issue.',
  alternates: { canonical: '/support' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/support`,
    title: 'Support — sitevento',
    description: 'How to get help with sitevento, and what support looks like on each plan.',
  },
};

export default function SupportPage() {
  return (
    <LegalPage
      eyebrow="resources"
      title="Support"
      updatedOn="October 17, 2026"
      intro={supportIntro}
      sections={supportSections}
    />
  );
}
