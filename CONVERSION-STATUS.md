# sitevento → Next.js conversion status

This is the completed conversion of the original single-file
`index.html` app into Next.js 14 (App Router) + TypeScript, with real
React components/hooks instead of global `let` state and DOM
manipulation.

## ✅ Done

- **Project setup**: `package.json`, `tsconfig.json`, `next.config.mjs`,
  `.env.local` / `.env.example` (Firebase client config moved to
  `NEXT_PUBLIC_*` env vars), `.gitignore`
- **`app/globals.css`** — the original's full `<style>` block, extracted
  byte-for-byte (all CSS variables/classes intact)
- **`lib/`** — `firebase.ts`, `firebaseAdmin.ts`, `types.ts`,
  `authErrors.ts`, `format.ts`
- **`hooks/`** — all module-level state from the original's
  `<script type="module">`, as real hooks: `useAuth`, `useSites`,
  `useActiveSiteData`, `useConnectSiteWizard`, `useOverlayComposer`,
  `useAuthForms`, `useAppView`, `useSidebar`, `useNewsletterSubmit`
- **`components/auth/`** — `AuthOverlay`, `PasswordStrengthMeter`,
  `GoogleIcon`
- **`components/layout/`** — `Header`, `Sidebar`, `MarketingFooter`,
  `DashFooter`
- **`components/dashboard/`** — `DashboardShell`, `DashEmptyState`,
  `SiteTabs`, `OverviewStats`, `OverlayComposer`, `ColorSwatches`,
  `VisitLogPanel`, `LeadsPanel`, `BlockedVisitorsPanel`
- **`components/connect/`** — `ConnectSiteWizard`
- **`components/marketing/`** — `Hero`, `LogoMarquee`,
  `CapabilitiesAndStats` (status strip + both capability grids +
  stats), `Testimonials` (marquee + static grid), `Faq`, `HowItWorks`,
  `Pricing`, `MarketingPage` (assembles all of the above in the
  original's section order)
- **`app/layout.tsx`** — root layout importing `globals.css`
- **`app/page.tsx`** — wires auth state to marketing vs. dashboard
  view, mounts `Header` / `Sidebar` / `MarketingPage` /
  `DashboardShell` / `AuthOverlay` / `ConnectSiteWizard` / footers
  together, including the Escape-to-close handling for the connect
  modal
- **`app/api/track/route.ts`** — port of `api/track.js` to a Next.js
  Route Handler (Vercel geo headers, visitor hashing, blocked-visitor
  check)
- **`app/api/verify-site/route.ts`** — port of `api/verify-site.js`
- **`public/t.js`** — copied over unchanged (standalone tracking
  snippet, independent of the framework)

## ❌ Not done yet

1. **`npm install` + build/typecheck pass** — this environment has no
   network access, so dependencies have not been installed and nothing
   has been compiled or type-checked yet. Run `npm install` then
   `npm run build` (or `npx tsc --noEmit`) locally as the first step.
2. Wire up real Firebase project credentials in `.env.local` (client)
   and the deployment's env vars (`FIREBASE_PROJECT_ID` /
   `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`, for the two API
   routes).
3. Double check `siteIndex/{siteId}` doc creation still happens
   wherever the original's `createSiteIndex()` call lived client-side
   (in `useConnectSiteWizard` / site creation) — `api/track` depends on
   that index existing.
