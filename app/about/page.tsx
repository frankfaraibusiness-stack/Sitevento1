import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { aboutIntro, aboutSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'About sitevento',
  description:
    'Why sitevento exists: one script tag and one dashboard for visit logs, lead capture, and live site overlays — replacing a stack of disconnected tools.',
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/about`,
    title: 'About — sitevento',
    description: 'Why sitevento exists, and how we think about building it.',
  },
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="company"
      title="One tag. One dashboard. That's the whole idea."
      updatedOn="October 17, 2026"
      intro={aboutIntro}
      sections={aboutSections}
    />
  );
}
