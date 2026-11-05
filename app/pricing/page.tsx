// app/pricing/page.tsx — full plan comparison page. Plain Server
// Component, statically generated — same reasoning as every other new
// content route here (see app/privacy/page.tsx's header comment).
// Pulls all plan numbers from lib/plans.ts via PricingPage so this
// never drifts from components/marketing/Pricing.tsx's homepage cards.
// Rebuilt on ContentPageShell (see components/marketing/PricingPage.tsx's
// header comment) as a plan-card stack instead of the old horizontally-
// scrolling comparison table, so it actually works on a phone.
import type { Metadata } from 'next';
import { PricingPage } from '@/components/marketing/PricingPage';
import '@/styles/content/content-pages.css';
import '@/styles/marketing/pricing-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Pricing — Plans, Limits & Widget Caps',
  description:
    'Free, Starter ($20), Scale ($49.99), and Pro Developer ($99) plans compared: connected sites, widget limits, visitor blocking, overlays, automation, and support — side by side.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/pricing`,
    title: 'Pricing — sitevento',
    description:
      'Free, Starter, Scale, and Pro Developer plans compared: connected sites, widget limits, overlays, automation, and support.',
  },
};

export default function Pricing() {
  return <PricingPage />;
}
