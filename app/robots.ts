import type { MetadataRoute } from 'next';

// app/robots.ts — Next.js generates /robots.txt from this at request
// time. No custom production domain was set when this was written, so
// the sitemap URL falls back to the current deployment
// (sitevento12.vercel.app) via an env var that's cheap to override
// later — set NEXT_PUBLIC_SITE_URL in the environment (e.g. to a
// future custom domain) and both this and app/sitemap.ts pick it up
// with no code changes.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sitevento12.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The tracking beacon and site-verification endpoints are for
      // the tracking snippet and the app itself, not content for
      // crawlers to index.
      disallow: ['/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
