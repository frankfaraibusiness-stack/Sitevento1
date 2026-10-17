import type { MetadataRoute } from 'next';

// app/sitemap.ts — Next.js generates /sitemap.xml from this at request
// time. sitevento is currently a single-page app (app/page.tsx is the
// only route), so there's just the one entry; add more objects to the
// returned array as real routes are added. See app/robots.ts for the
// NEXT_PUBLIC_SITE_URL note — same fallback here so both stay in sync.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento1.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
