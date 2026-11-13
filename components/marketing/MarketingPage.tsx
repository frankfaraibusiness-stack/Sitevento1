// components/marketing/MarketingPage.tsx
//
// Marketing page. Testimonials, logo marquee, pricing, and FAQ are
// still removed (previously stripped along with their dedicated
// component/CSS files) — this stays intro-focused rather than a full
// features/pricing pitch.
//
// "How it works" used to be a full-screen in-page modal
// (components/marketing/HowItWorksModal.tsx, deleted) opened from
// Hero/PlatformsMarquee's secondary CTA. That modal rendered nothing
// crawlable (client-only, mounted/unmounted on open state, no real
// URL) so it had zero SEO value and nothing for an AI crawler/answer
// engine to read. It's been replaced by a real statically-generated
// route, app/how-it-works/page.tsx (components/marketing/
// HowItWorksPage.tsx) — every CTA that used to call
// setHowItWorksOpen(true) now just links to /how-it-works instead, so
// this component no longer owns any modal-open state at all.
//
// Current stack, in order:
//   1. Hero (components/marketing/Hero.tsx) — cartoon hero on both
//      mobile and desktop.
//   1b. WelcomeBackSection (components/marketing/WelcomeBackSection.tsx)
//      — signed-in users only (user prop). "Welcome back" + a couple
//      of real quick stats and a dashboard link if they've already
//      connected a site, or an inline upsell banner if they haven't.
//      Renders nothing for a signed-out visitor.
//   2. PlatformsMarquee — "Built for the site you already have": a
//      continuous, never-stopping auto-scrolling, full-width row of
//      platform chips (Shopify, Wix, Webflow, WordPress, Squarespace,
//      Framer, Carrd, Ghost, Next.js, custom HTML, any website), each
//      with its own SVG glyph. Moved directly under the hero (was
//      previously lower down, after WidgetShowcaseSection) so it's
//      the first thing visitors see under the hero image/photo, on
//      both mobile and desktop. Also now owns the 2 CTAs (Connect
//      your site / Watch Demo) that used to live in their own block
//      directly under the mobile hero photo, left-aligned under this
//      section's intro copy — that old block's 5-step list was
//      removed outright, not moved.
//   3. LaptopShowcase — the connect-flow demo (paste the script tag
//      → verifying → connected → control panel → security).
//   4. LiveStatsSection — "One script. No rebuild." intro copy plus
//      a cartoon-styled live stats demo (radar + ticking cards),
//      illustrating what the real dashboard looks like once
//      connected.
//   5. WidgetShowcaseSection — "Deploy in one click": mini dark-panel
//      previews of three real widgets (Support Chat, Site Alert,
//      Email Capture) with a one-click deploy pitch for each.
//   6. TestimonialsSection — a grid of mockup customer quotes
//      (3-up desktop, 2-up tablet, 1-up mobile), illustrating the
//      kind of feedback the product aims to earn.
//   7. FeatureHighlightsSection — a 6-tile "everything included"
//      recap of the real product surface (visit tracking, bot
//      shield, AI agent, email capture, site alerts, monetization).
//   8. ComparisonSection — "one tag beats five tools": sitevento vs.
//      piecing together several separate tools yourself, as a real
//      table on desktop and stacked cards on mobile.
//   9. FinalCTASection — closing lime conversion band ("Paste one
//      script. See everything.") reusing the same onConnectClick
//      handler as every other CTA on this page.
//   10. Footer (components/layout/Footer.tsx) — global footer with
//      newsletter signup + link columns for every real page. Also
//      mounted in ContentPageShell.tsx and LegalPage.tsx so it
//      appears on every content/legal/product route, not just here.
'use client';

import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import { trackPlatformVisit } from '@/lib/platformTrackClient';
import { Hero } from './Hero';
import { WelcomeBackSection } from './WelcomeBackSection';
import { LaptopShowcase } from './LaptopShowcase';
import { LiveStatsSection } from './LiveStatsSection';
import { WidgetShowcaseSection } from './WidgetShowcaseSection';
import { PlatformsMarquee } from './PlatformsMarquee';
import { TestimonialsSection } from './TestimonialsSection';
import { FeatureHighlightsSection } from './FeatureHighlightsSection';
import { ComparisonSection } from './ComparisonSection';
import { FinalCTASection } from './FinalCTASection';
import { Footer } from '@/components/layout/Footer';

interface MarketingPageProps {
  onConnectClick: () => void;
  /** Signed-in user, if any — only changes WelcomeBackSection below the hero; every other section here is the same for everyone. */
  user?: User | null;
}

export function MarketingPage({ onConnectClick, user }: MarketingPageProps) {
  // Platform-wide visit beacon (distinct from per-customer-site
  // tracking) — powers the Console dashboard's total-visits and
  // conversion-rate numbers. See lib/platformTrackClient.ts; fires at
  // most once per tab session.
  useEffect(() => {
    trackPlatformVisit('/');
  }, []);

  return (
    <div id="marketingView">
      <Hero onConnectClick={onConnectClick} />
      {user && <WelcomeBackSection user={user} onConnectClick={onConnectClick} />}
      <PlatformsMarquee onConnectClick={onConnectClick} />
      <LaptopShowcase />
      <LiveStatsSection />
      <WidgetShowcaseSection />
      <TestimonialsSection />
      <FeatureHighlightsSection />
      <ComparisonSection />
      <FinalCTASection onConnectClick={onConnectClick} />
      <Footer />
    </div>
  );
}
