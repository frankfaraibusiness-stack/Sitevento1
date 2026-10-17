import type { MetadataRoute } from 'next';

// app/sitemap.ts — Next.js generates /sitemap.xml from this at request
// time. Add more objects to the returned array as real indexable routes
// are added (app/dashboard is intentionally NOT listed here — it's a
// signed-in, per-account view, see app/dashboard/page.tsx's own
// `robots: { index: false }` and app/robots.ts's disallow entry).
// See app/robots.ts for the NEXT_PUBLIC_SITE_URL note — same fallback
// here so both stay in sync.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
