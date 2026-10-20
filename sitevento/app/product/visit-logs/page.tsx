// app/product/visit-logs/page.tsx — Visit Logs product page.
//
// Plain Server Component, statically generated at build time — see
// app/privacy/page.tsx's header comment for the full reasoning this
// mirrors (reused across every new marketing/SEO route here).
import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { visitLogsIntro, visitLogsSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Visit Logs — See Every Visitor to Your Site',
  description:
    'Searchable, per-visit logs for any site connected to sitevento: page, referrer, device, browser, and location — logged automatically, with visitor blocking built in.',
  alternates: { canonical: '/product/visit-logs' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/product/visit-logs`,
    title: 'Visit Logs — sitevento',
    description:
      'Searchable, per-visit logs for any site connected to sitevento: page, referrer, device, browser, and location.',
  },
};

export default function VisitLogsPage() {
  return (
    <LegalPage
      eyebrow="product"
      title="Visit logs for every site you connect"
      updatedOn="October 17, 2026"
      intro={visitLogsIntro}
      sections={visitLogsSections}
    />
  );
}
