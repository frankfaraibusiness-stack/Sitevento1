import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { careersIntro, careersSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Careers at sitevento',
  description:
    'Current hiring status at sitevento, what we look for when we do open roles, and how to stay in the loop.',
  alternates: { canonical: '/careers' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/careers`,
    title: 'Careers — sitevento',
    description: 'Current hiring status at sitevento and what we look for when we do open roles.',
  },
};

export default function CareersPage() {
  return (
    <LegalPage
      eyebrow="company"
      title="Careers"
      updatedOn="October 17, 2026"
      intro={careersIntro}
      sections={careersSections}
    />
  );
}
