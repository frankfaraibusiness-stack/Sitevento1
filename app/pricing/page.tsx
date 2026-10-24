// app/pricing/page.tsx — full plan comparison page. Plain Server
// Component, statically generated — same reasoning as every other new
// content route here (see app/privacy/page.tsx's header comment).
// Pulls all plan numbers from lib/plans.ts via PricingTablePage so this
// never drifts from components/marketing/Pricing.tsx's homepage cards.
import type { Metadata } from 'next';
import { PricingTablePage } from '@/components/marketing/PricingTablePage';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Pricing — Plans, Limits & Widget Caps',
  description:
    'Free, Starter ($20), Scale ($49.99), and Pro Developer ($99) plans compared: connected sites, widget limits, visitor blocking, overlays, automation, and support — all in one table.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/pricing`,
    title: 'Pricing — sitevento',
    description:
      'Free, Starter, Scale, and Pro Developer plans compared: connected sites, widget limits, overlays, automation, and support.',
  },
};

export default function PricingPage() {
  return <PricingTablePage />;
}
