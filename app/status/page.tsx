import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { statusIntro, statusSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'System Status',
  description:
    'Current operating status for sitevento: tracking tag delivery, the dashboard, widget delivery, and domain verification.',
  alternates: { canonical: '/status' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/status`,
    title: 'System Status — sitevento',
    description: 'Current operating status for sitevento systems.',
  },
};

export default function StatusPage() {
  return (
    <LegalPage
      eyebrow="resources"
      title="System status"
      updatedOn="October 17, 2026"
      intro={statusIntro}
      sections={statusSections}
    />
  );
}
