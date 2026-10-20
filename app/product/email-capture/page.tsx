import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { emailCaptureIntro, emailCaptureSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Email Capture Widget — Turn Visits Into Leads',
  description:
    'Drop a no-code email capture widget onto any connected site and see every lead land straight in your sitevento dashboard, right next to your visit logs.',
  alternates: { canonical: '/product/email-capture' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/product/email-capture`,
    title: 'Email Capture Widget — sitevento',
    description: 'A no-code email capture widget that turns visits into leads inside your sitevento dashboard.',
  },
};

export default function EmailCapturePage() {
  return (
    <LegalPage
      eyebrow="product"
      title="Email capture, built into the dashboard you already use"
      updatedOn="October 17, 2026"
      intro={emailCaptureIntro}
      sections={emailCaptureSections}
    />
  );
}
