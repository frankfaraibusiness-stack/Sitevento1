import type { Metadata, Viewport } from 'next';
import { Lexend } from 'next/font/google';
import './globals.css';
import { GlobalNav } from '@/components/layout/GlobalNav';
import { NavPendingProvider } from '@/hooks/useNavPending';
import { NavPendingOverlay } from '@/components/layout/NavPendingOverlay';

// Bundled at build time (no runtime CDN call) — used only for the hero
// headline via --font-display (see styles/marketing/marketing-hero.css), not a
// global font change. Lexend at weight 900 reads as a genuinely bold/
// chunky display face, unlike the previous system-font fallback.
const lexend = Lexend({
  subsets: ['latin'],
  weight: ['800', '900'],
  variable: '--font-display',
  display: 'swap',
});

// Central place for the handful of values SEO metadata below needs
// more than once (title, OG/Twitter image, theme color). Swapping in
// real asset URLs later (see the note on OG_IMAGE_PATH) is a one-line
// change here — nothing else in this file needs to move.
const SITE_NAME = 'sitevento';
const SITE_TITLE = 'sitevento — Connect your site. Run it from here.';
const SITE_DESCRIPTION =
  'Drop a single meta tag into your site and get a control panel for everything that happens on it: who visits, who converts, and what they see right now.';

// Placeholder paths — swap these for real CDN image URLs whenever
// they're ready. They don't need to resolve to actual files yet for
// the metadata/manifest wiring below to be correct; once real assets
// land at these paths (or the strings below are replaced with full
// CDN URLs), social previews and home-screen icons pick them up with
// no other changes.
const OG_IMAGE_PATH = '/og-image.png';
const ICON_PATH = '/icon.png';
const APPLE_ICON_PATH = '/apple-icon.png';

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    // Lets a future route set e.g. `title: 'Pricing'` and have it
    // render as "Pricing — sitevento" automatically.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: ICON_PATH,
    apple: APPLE_ICON_PATH,
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

export const viewport: Viewport = {
  // Muted/toned-down lime — keeps the brand tint on mobile chrome
  // without the full-saturation #c6ff3d shouting at the user. Lower
  // saturation + slightly deeper value than var(--lime), not a plain
  // neutral like --app-bg.
  themeColor: '#b9d98f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lexend.variable}>
      <body>
        <NavPendingProvider>
          {children}
          <GlobalNav />
          <NavPendingOverlay />
        </NavPendingProvider>
      </body>
    </html>
  );
}
