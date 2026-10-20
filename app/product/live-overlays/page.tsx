import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { liveOverlaysIntro, liveOverlaysSections } from './content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export const metadata: Metadata = {
  title: 'Live Overlays — Push Site-Wide Announcements Instantly',
  description:
    'Publish a live banner, maintenance takeover, or site-wide announcement to any connected site in moments — no redeploy, no code changes.',
  alternates: { canonical: '/product/live-overlays' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/product/live-overlays`,
    title: 'Live Overlays — sitevento',
    description: 'Push a live banner or maintenance takeover to any connected site instantly, no redeploy.',
  },
};

export default function LiveOverlaysPage() {
  return (
    <LegalPage
      eyebrow="product"
      title="Live overlays: say it once, live everywhere instantly"
      updatedOn="October 17, 2026"
      intro={liveOverlaysIntro}
      sections={liveOverlaysSections}
    />
  );
}
