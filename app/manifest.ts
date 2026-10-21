import type { MetadataRoute } from 'next';

// app/manifest.ts — Next.js generates /manifest.webmanifest from this.
// Lets sitevento be added to a phone home screen with the right name,
// theme color, and icons instead of a bare browser bookmark.
//
// Icon paths are placeholders (see the note in app/layout.tsx) — swap
// for real CDN URLs or drop real files into public/ at these paths
// whenever they're ready; sizes are declared for the standard
// maskable-icon set so nothing else needs to change when they land.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'sitevento',
    short_name: 'sitevento',
    description:
      'Drop a single meta tag into your site and get a control panel for everything that happens on it: who visits, who converts, and what they see right now.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f2e7', // var(--cream)
    theme_color: '#faf9f0', // var(--app-bg) — lime was too loud for home-screen/chrome tint
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
