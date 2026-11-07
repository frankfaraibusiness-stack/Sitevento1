import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import Script from "next/script";
import { getPublicBaseUrl } from "@/lib/server/adminDb";
import "./globals.css";
import NavDrawer from "@/components/layout/NavDrawer";
import NavDrawerOverlay from "@/components/layout/NavDrawerOverlay";
import { NavDrawerProvider } from "@/components/layout/NavDrawerProvider";
import HomeMarketplaceOnly from "@/components/layout/HomeMarketplaceOnly";
import ConditionalFooter from "@/components/layout/ConditionalFooter";
import ScrollToTop from "@/components/layout/ScrollToTop";
import SiteVisitBeacon from "@/components/layout/SiteVisitBeacon";
import ConditionalHeader from "@/components/layout/ConditionalHeader";
import BootOverlay from "@/components/layout/BootOverlay";
import PushServiceWorkerRegister from "@/components/layout/PushServiceWorkerRegister";
import { AuthProvider } from "@/lib/AuthContext";
import { StaffModeProvider } from "@/lib/StaffModeContext";
import { CurrencyProvider } from "@/lib/CurrencyContext";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { WalletModalProvider } from "@/components/wallet/WalletModalProvider";
import { AgentModalProvider } from "@/components/agent/AgentModalProvider";
import { EditListingModalProvider } from "@/components/listing/EditListingModalProvider";
import { PlansModalProvider } from "@/components/billing/PlansModalProvider";
import { ThemeModalProvider } from "@/components/theme/ThemeModalProvider";
import { WalkthroughModalProvider } from "@/components/onboarding/WalkthroughModalProvider";
import NotificationsProvider from "@/components/notifications/NotificationsProvider";
import PaymentRequestModalProvider from "@/components/notifications/PaymentRequestModalProvider";
import { NotificationsFeedProvider } from "@/lib/NotificationsFeedContext";
import SystemStatusProvider from "@/components/system/SystemStatusProvider";
import AccountWarningGate from "@/components/system/AccountWarningGate";
import OnboardingGateProvider from "@/components/system/OnboardingGateProvider";
import WelcomeBackScreen from "@/components/system/WelcomeBackScreen";
import { AiSupportChatModalProvider } from "@/components/support/AiSupportChatModalProvider";
import { DealPopupProvider } from "@/components/deal/DealPopupProvider";
import { DisputePickerProvider } from "@/components/dispute/DisputePickerProvider";
import { ImageLightboxProvider } from "@/components/listing/ImageLightboxProvider";
import { MarketplaceSearchProvider } from "@/components/marketplace/MarketplaceSearchProvider";
import { SrToastProvider } from "@/components/system/SrToastProvider";

const SITE_TITLE =
  "Siterifty — Buy & Sell Websites, Apps & Games";
const SITE_DESCRIPTION =
  "Siterifty is an escrow-protected marketplace for indie developers to buy and sell websites, apps, and games — safe, verified deals start to finish.";

// Original index.html sets this explicitly via <meta name="viewport"
// content="width=device-width, initial-scale=1.0">. Next.js doesn't
// reliably inject an equivalent default on its own — without this export
// some mobile browsers fall back to a desktop-width viewport (~980px)
// and scale the whole page down to fit, which looks like everything
// rendered correctly but narrower/zoomed-out than the original.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(getPublicBaseUrl()),
  title: {
    default: SITE_TITLE,
    // "%s" (not "%s | Siterifty") because every child page already sets
    // its own full explicit title ending in "— Siterifty" or "| Siterifty"
    // — a template suffix here would double-append it.
    template: "%s",
  },
  description: SITE_DESCRIPTION,
  // Canonical URL for the homepage (and the fallback for any route that
  // doesn't set its own via generateMetadata — Next merges metadata
  // top-down, so a child page's own `alternates.canonical` still wins
  // over this). Nothing set this before, which is exactly what an SEO
  // scan of "/" flags as a missing canonical tag: with metadataBase set
  // above but no explicit canonical, Next has no reason to emit
  // <link rel="canonical"> on its own.
  alternates: {
    canonical: "/",
  },
  // Siterifty domain-ownership verification token — read by
  // handleVerifyCheck (app/api/listings/_handler.js) when a seller clicks
  // "Check now" on a website listing's success page. Renders as
  // <meta name="siterifty-site-verification" content="..." /> in the
  // root <head>, so it's present on every page (including the homepage
  // that handleVerifyCheck actually fetches), not just this one seller's
  // listing.
  other: {
    "siterifty-site-verification": "8591c5b71b965aaf185fb5e5267e72c4",
    // Sitevento analytics — site-verification/identifier meta tag read by
    // the Sitevento tracking script (loaded via <Script> below) to attribute
    // visits to this site. Must live in <head> alongside the other site
    // verification tags, not in <body>.
    sitevento: "idKMA8OeN03nQ6BXqgzm",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    siteName: "Siterifty",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    images: [
      {
        // Site-wide default share-preview banner. This is the only source
        // for "/"'s OG image now — the old app/opengraph-image.tsx
        // file-convention fallback (a plain text-only black card) has been
        // deleted, so there's no second route competing to serve this.
        // Self-hosted under /public/og (not a third-party hotlink host
        // like image2url.com/phototourl.com) so it can't 403/404/rate-limit
        // out from under us the way the old externally-hosted banner did.
        // 1600x900 (16:9) — the source artwork is a widescreen product
        // banner (mascot + laptop/phone mockups + feature strip), not a
        // square crop, so this uses the same 16:9 export as home-x.jpg
        // below rather than forcing a 1:1 crop that would cut off either
        // the logo/headline on the left or the mascot/mockups on the
        // right. Most OG consumers (Facebook included) render 16:9 fine.
        url: "/og/home.jpg",
        width: 1600,
        height: 900,
        alt: "Siterifty — Buy & Sell Websites, Apps & Games",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    // Same 1600x900 banner as openGraph.images above — X's
    // summary_large_image card wants 16:9-ish either way, so this no
    // longer needs its own separately-cropped export.
    images: ["/og/home-x.jpg"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Set by middleware.ts for every authenticated request under /console/*
  // (see its own comment on this header). The staff console has its own
  // shell (components/console/ConsoleShell.tsx), its own light/dark theme
  // handling, and none of the public site's sign-in modals, wallet/deal
  // popups, boot splash, or per-user ban/suspend overlay make sense inside
  // it — SystemStatusProvider in particular renders the SIGNED-IN STAFF
  // MEMBER'S OWN account-restriction overlay, which has nothing to do with
  // the users they're there to moderate. Rather than mount all of that and
  // rely on CSS/z-index to hide it, console requests skip this entire
  // subtree and get a bare passthrough shell instead — each /console page
  // brings whatever chrome it needs itself (see ConsoleShell.tsx).
  //
  // An unauthorized /console request never reaches this branch: middleware
  // only sets the header on a request it's letting through (a valid
  // session, or the login page itself), and rewrites everything else to a
  // non-existent path that renders the ordinary public 404 via the branch
  // below — so nothing about an unauthorized response differs from any
  // other broken URL on the site.
  const headerList = await headers();
  const isConsoleRoute = headerList.get("x-is-console-route") === "1";

  if (isConsoleRoute) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        {/* Google Analytics 4 (GA4) tag — Measurement ID G-MSW3KT364H.
            Without this, GA4's dashboard shows "No data received from
            your website yet" forever, since nothing on the site ever
            calls gtag(). Two scripts, same as Google's own snippet:
            the gtag.js loader (external, async) plus a small inline
            initializer that creates window.dataLayer and calls
            gtag('config', ...). beforeInteractive isn't required here
            (GA4 doesn't need to land in <head> the way AdSense's
            onboarding check does — afterInteractive is Google's own
            documented approach for gtag.js), so this uses the default
            afterInteractive strategy to avoid delaying first paint. */}
        {/* Sitevento analytics tracking script — site idKMA8OeN03nQ6BXqgzm.
            Loaded with the native defer attribute (via next/script's
            beforeInteractive isn't needed here) rather than Next's
            afterInteractive strategy, since the snippet provided uses a
            plain <script defer> tag; afterInteractive would inject it
            without the defer semantics preserved as given. */}
        <script
          src="https://sitevento12.vercel.app/sitevento.js"
          data-site="idKMA8OeN03nQ6BXqgzm"
          defer
        />
        <Script
          id="ga4-loader"
          strategy="afterInteractive"
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-MSW3KT364H"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-MSW3KT364H');`}
        </Script>
        {/* WebSite + Organization structured data (schema.org JSON-LD).
            Nothing like this existed anywhere on the site before — Google
            had no first-party signal for what Siterifty's real primary
            pages, name, logo, or social profiles are, so its search
            result panel was filling in "sitelinks" (My Orders, Sell your
            course) and a description ("Buy your next business on
            http://Siterifty.com…") from whatever it happened to crawl or
            infer on its own, which don't match this site's actual nav or
            copy at all.

            This doesn't force Google to use these exact sitelinks —
            Google always makes the final call on what it shows in search
            results — but it gives it accurate, structured ground truth
            to draw from instead of guessing, which is the standard,
            correct fix for this class of mismatch (the fix on Siterifty's
            side; getting the STALE result actually updated in Google's
            index additionally needs a re-crawl, requested from Google
            Search Console — see the note in this PR/commit for the
            manual step that still has to happen outside this codebase).

            WebSite.name/description mirror SITE_TITLE/SITE_DESCRIPTION
            above so there's one consistent story between this JSON-LD,
            the <title>/<meta description> tags, and OG/Twitter tags —
            no separate copy to drift out of sync.

            Organization.sameAs lists the same social profiles already
            linked from NavDrawer.tsx/FooterNewsletterSocial.tsx (Facebook,
            Instagram, X, YouTube) — this is what tells Google these
            accounts belong to the same entity as this website, which is
            also what a Knowledge Panel (if Google ever creates one for
            this brand) pulls its social icons from. */}
        <Script id="ld-website" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": `${getPublicBaseUrl()}/#website`,
                url: getPublicBaseUrl(),
                name: "Siterifty",
                description: SITE_DESCRIPTION,
                publisher: { "@id": `${getPublicBaseUrl()}/#organization` },
              },
              {
                "@type": "Organization",
                "@id": `${getPublicBaseUrl()}/#organization`,
                name: "Siterifty",
                url: getPublicBaseUrl(),
                logo: `${getPublicBaseUrl()}/icon-512.png`,
                sameAs: [
                  "https://www.facebook.com/share/1HnbnD2135/",
                  "https://www.instagram.com/siterifty",
                  "https://x.com/siterifty",
                  "https://www.youtube.com/@Siterifty",
                ],
              },
              {
                // SiteNavigationElement — the real, current primary pages
                // (matches NavDrawer.tsx's own top-level links), so a
                // sitelinks panel has an accurate menu to draw from
                // instead of surfacing pages like "My Orders" or a
                // nonexistent "Sell your course" that don't reflect this
                // site's actual structure.
                "@type": "SiteNavigationElement",
                name: ["Marketplace", "Sell", "How It Works", "Blog", "About"],
                url: [
                  `${getPublicBaseUrl()}/marketplace`,
                  `${getPublicBaseUrl()}/sell`,
                  `${getPublicBaseUrl()}/how-it-works`,
                  `${getPublicBaseUrl()}/blog`,
                  `${getPublicBaseUrl()}/about`,
                ],
              },
            ],
          })}
        </Script>
        {/* Ports the early FOUC-prevention IIFE from announcement-settings.js
            (index.html lines 162-175) — applies srf_fontSize / srf_compactMode
            from localStorage before paint, so there's no flash of default
            15px/non-compact layout while the rest of the app hydrates and
            useSettingsState's own (Firestore-backed, async, Settings-page-only)
            application catches up. beforeInteractive runs this before React
            hydrates, same timing guarantee the original got from being an
            inline <head> script.

            Also applies siterifty_theme_mode (see ThemeModalProvider.tsx)
            here now, for the same reason: that provider only calls
            applyThemeMode() inside a useEffect, which fires after React
            mounts — i.e. after first paint. BootOverlay/WelcomeBackScreen
            cover the screen for the rest of boot, so this only ever
            mattered for the very first frame, but on a light-mode device
            that first frame was still painted with the CSS's dark
            defaults, which is a visible (if brief) dark flash before the
            snap to light. Reading it here, before paint, closes that gap
            the same way it's already closed for font size/compact mode. */}
        <Script id="srf-early-appearance" strategy="beforeInteractive">
          {`(function(){try{
            if('scrollRestoration' in window.history){window.history.scrollRestoration='manual';}
            var fs=localStorage.getItem('srf_fontSize');
            if(fs){var px={small:'13px',medium:'15px',large:'17px'}[fs]||'15px';
              document.documentElement.style.setProperty('--app-font-size',px);
              document.body.style.fontSize=px;}
            var cm=localStorage.getItem('srf_compactMode');
            if(cm==='1')document.body.classList.add('compact-mode');
            /* Light mode is out of beta. A visitor's explicit choice in
               siterifty_theme_mode (see ThemeModalProvider.tsx) always
               wins. First-time visitors with no saved choice get their
               OS/browser color-scheme preference instead of a hardcoded
               dark default — matchMedia read here, before paint, so
               there's no dark flash for a light-preferring device. */
            var savedMode=localStorage.getItem('siterifty_theme_mode');
            var wantsLight = savedMode
              ? savedMode==='light'
              : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
            document.documentElement.classList.toggle('theme-light', wantsLight);
            document.body.classList.toggle('theme-light', wantsLight);
          }catch(e){}})();`}
        </Script>
        {/* Ports #appThemeBg from index.html — the full-viewport backdrop
            layer that __applyTheme's CSS custom properties
            (--app-theme-bg / --app-theme-color / --app-theme-overlay)
            paint into. Sits outside every provider since it's pure CSS,
            no state needed here. */}
        <div id="appThemeBg" aria-hidden="true" />
        {/* Resets window (and known inner overflow-y:auto panels) scroll
            to top on every real navigation — see ScrollToTop.tsx's own
            comment for the footer-link-leaves-page-scrolled bug this
            fixes. Mounted outside every provider since it has no
            dependency on auth/theme/etc, just route + search params;
            wrapped in Suspense because useSearchParams requires one in
            the App Router. */}
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        {/* Counts one site visit per browser session (not per page/route
            — deliberately outside ScrollToTop's Suspense/routing-aware
            wrapper above, since it only needs to fire once regardless of
            which page happened to be the entry point). See
            SiteVisitBeacon.tsx / app/api/site-visit/route.ts; surfaced on
            the console's Overview page. */}
        <SiteVisitBeacon />
        <PushServiceWorkerRegister />
        {/* Image lightbox — zoomable/pannable full-screen image viewer,
            opened by clicking any element carrying .srf-lightbox-trigger
            (listing cover/gallery images). Self-contained: no auth or
            other context dependency, just a document-level click
            delegation listener + its own state, so it sits outside
            AuthProvider and wraps everything so its trigger listener is
            live from first paint (including on BootOverlay/auth-gated
            screens, matching the original's always-present global DOM
            node behavior). */}
        <ImageLightboxProvider>
        <SrToastProvider>
        <AuthProvider>
        <StaffModeProvider>
          {/* Boot overlay — first thing rendered, removed only after auth
              resolves once + a cooldown, same comment/positioning as the
              original's index.html. */}
          <BootOverlay />
          {/* Maintenance-mode takeover + banned/suspended account
              overlay — both are full-screen, no-dismiss states that
              should render above everything else, same tier as
              BootOverlay. Must be inside AuthProvider (reads
              useAuth()) but works correctly for signed-out visitors
              too, since useAuth() resolves to null rather than
              throwing when nobody's signed in. */}
          <SystemStatusProvider />
          {/* Non-blocking moderation warning — a separate takeover tier
              from SystemStatusProvider on purpose (see the component's
              own comment): a warning never restricts access the way
              ban/suspend/maintenance do, so it must keep working
              independently of whatever SystemStatusProvider is doing. */}
          <AccountWarningGate />
          {/* Redirects a signed-up user who never finished onboarding
              (didn't accept terms) back to /onboarding from anywhere
              else in the app — see the component's own comment for the
              gap this closes. Reads useAuth() like SystemStatusProvider,
              same tier, renders nothing itself. */}
          <OnboardingGateProvider />
          {/* Welcome Back — full-screen daily-objectives takeover shown
              once per sign-in to returning users (account created before
              today), right after the boot splash's own hold. Same tier
              as the overlays above; renders null until it decides to
              open, so it's safe to mount unconditionally here. */}
          <WelcomeBackScreen />
          {/* Single shared onSnapshot on users/{uid}/notifications for
              both NotificationsProvider and PaymentRequestModalProvider
              below — they used to each open their own identical listener
              on the same capped-30-doc query. Just needs to be an
              ancestor of both; CurrencyProvider nests inside it exactly
              as before since neither this context nor NotificationsProvider
              touches currency. */}
          <NotificationsFeedProvider>
          {/* Global notification toasts + "missed while away" panel —
              needs to be inside AuthProvider (reads useAuth()) but has
              no particular nesting requirement relative to the other
              modal providers below, since it doesn't call any of their
              hooks. */}
          <NotificationsProvider />
          {/* Currency conversion context — display-only (see
              lib/CurrencyContext.tsx's own top comment: escrow/PayPal
              always settle in USD regardless of what's selected here).
              Needs useAuth() for the signed-in Firestore sync, so it must
              be inside AuthProvider; wraps everything below it since both
              Header (price displays, if/when added there) and the
              Settings → Appearance panel's currency picker need
              useCurrency(), and neither is nested inside any of the modal
              providers this wraps. */}
          <CurrencyProvider>
          {/* Full-screen "payment requested" takeover — needs useCurrency()
              for formatBalance(), so it has to live inside CurrencyProvider,
              but doesn't touch useAuthModal() or any of the other modal
              providers' contexts below, so it mounts here rather than
              nested deeper among them. */}
          <PaymentRequestModalProvider />
          {/* ThemeModalProvider wraps AuthModalProvider (rather than
              nesting inside it, like Wallet/Plans do) because
              AuthModalProvider's tour-finish handler calls
              useThemeModal() itself — it needs to be a descendant of
              ThemeModalProvider's context, not a sibling/ancestor. */}
          <ThemeModalProvider>
          <WalkthroughModalProvider>
            <AuthModalProvider>
              <WalletModalProvider>
                <AgentModalProvider>
                <EditListingModalProvider>
                <PlansModalProvider>
                <AiSupportChatModalProvider>
                {/* DealPopupProvider needs useAuthModal() for its sign-in
                    gate (same reason WalletModalProvider lives inside
                    AuthModalProvider), and doesn't need to sit above/below
                    any of its siblings here — nested innermost among the
                    modal providers, same tier as AiSupportChatModalProvider. */}
                <DealPopupProvider>
                <DisputePickerProvider>
                  <MarketplaceSearchProvider>
                  <NavDrawerProvider>
                    {/* Header + AnnouncementBar are hidden on /shop (its
                        own standalone nav/promo bar lives in
                        ShopPageContent.tsx instead) — see
                        ConditionalHeader.tsx's own top comment. */}
                    <ConditionalHeader />
                    <NavDrawerOverlay />
                    <NavDrawer />
                    <main>{children}</main>
                    {/* Real, always-crawlable footer on every page except
                        the fixed-height app-shell routes (Settings) where
                        it's structurally unreachable — see
                        ConditionalFooter.tsx's own top comment. */}
                    <ConditionalFooter />
                    {/* BottomNav + the floating feedback launcher only
                        belong on the two "browse" surfaces (Home,
                        Marketplace) — see HomeMarketplaceOnly's own
                        top comment for why they can't just stay
                        globally mounted like in the original. */}
                    <HomeMarketplaceOnly />
                  </NavDrawerProvider>
                  </MarketplaceSearchProvider>
                </DisputePickerProvider>
                </DealPopupProvider>
                </AiSupportChatModalProvider>
                </PlansModalProvider>
                </EditListingModalProvider>
                </AgentModalProvider>
              </WalletModalProvider>
            </AuthModalProvider>
          </WalkthroughModalProvider>
          </ThemeModalProvider>
          </CurrencyProvider>
          </NotificationsFeedProvider>
        </StaffModeProvider>
        </AuthProvider>
        </SrToastProvider>
        </ImageLightboxProvider>
      </body>
    </html>
  );
}
