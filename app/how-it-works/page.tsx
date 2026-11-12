// app/how-it-works/page.tsx — "How it works" route.
//
// Replaces the old client-only HowItWorksModal.tsx (deleted —
// previously opened from Hero/PlatformsMarquee's secondary CTA with
// zero SEO value, since a modal mounted on an open/closed state never
// renders to a crawlable URL). This is a plain Server Component, same
// convention as every other rebuilt content route (About, Docs,
// Pricing, ...) — statically generated at build time, fully readable
// by search engines and AI crawlers/answer engines without executing
// any client JS, with real metadata, a canonical URL, and FAQPage
// structured data (see components/marketing/HowItWorksPage.tsx's own
// FAQ_JSON_LD).
//
// Not built on components/content/ContentPageShell.tsx like the other
// content routes, because this page needs its own header (a "return
// home" variant instead of ContentHeader's signup/avatar/hamburger —
// see HowItWorksPage.tsx's ReturnHomeHeader) and its own two-column
// body shell (sticky left step rail + reading column on desktop,
// single column on mobile — see styles/marketing/how-it-works-page.css)
// rather than ContentPageShell's single prose column.
import type { Metadata } from 'next';
import { HowItWorksPage } from '@/components/marketing/HowItWorksPage';
import '@/styles/content/content-pages.css';
import '@/styles/agent/agent-page.css';
import '@/styles/marketing/how-it-works-page.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

const PAGE_TITLE = 'How sitevento Works — Setup, Tracking, Widgets & Pricing';
const PAGE_DESCRIPTION =
  'How sitevento works: one meta tag for visit tracking, widgets, live overlays, visitor blocking, and alerts — plus every plan\u2019s price and monthly visit allowance (Ventol Free 1,000 \u2014 Ventol Business 1,000,000/mo).';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/how-it-works' },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}/how-it-works`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function Page() {
  return <HowItWorksPage />;
}
