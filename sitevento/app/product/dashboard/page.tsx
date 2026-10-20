import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { dashboardIntro, dashboardSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Dashboard — Run Every Connected Site From One Screen',
  description:
    'Visit logs, lead capture, widgets, and live overlays for every site you connect — managed from a single sitevento dashboard, no redeploys required.',
  alternates: { canonical: '/product/dashboard' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/product/dashboard`,
    title: 'Dashboard — sitevento',
    description: 'Visit logs, lead capture, widgets, and live overlays for every connected site, in one dashboard.',
  },
};

export default function DashboardProductPage() {
  return (
    <LegalPage
      eyebrow="product"
      title="One dashboard. Every connected site."
      updatedOn="October 17, 2026"
      intro={dashboardIntro}
      sections={dashboardSections}
    />
  );
}
