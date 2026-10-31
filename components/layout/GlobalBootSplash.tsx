'use client';

// components/layout/GlobalBootSplash.tsx
//
// Mounted once from app/layout.tsx so the full lime UFO / blob-drop
// boot loader (components/BootLoader.tsx) shows on every route, not
// just `/`. Previously this only lived inside components/AppRoot.tsx
// (the marketing page's client tree), so it never appeared when
// someone's first real page load was e.g. `/dashboard` directly.
//
// Must fire on every real browser page load (hard refresh, typing a
// URL, opening a link in a new tab) and NEVER on in-app client-side
// `router.push` navigation. app/layout.tsx and everything mounted from
// it only remounts on an actual new document load — SPA route changes
// keep the layout (and this component) mounted across navigations.
// That means a plain module-scope flag does exactly what's needed: it
// starts `false` on every fresh JS execution context (i.e. every real
// page load, including a hard refresh) and flips to `true` after the
// first boot, staying `true` for the rest of that load no matter how
// many client-side navigations happen afterward.
//
// Deliberately NOT sessionStorage/localStorage: those persist across
// *all* navigation within a tab (including hard refresh) and would
// need to be explicitly cleared on refresh to behave correctly, which
// is more moving parts for the same result this module flag gives for
// free — and localStorage would wrongly suppress the boot screen on a
// refresh in a brand-new tab that happens to share origin storage.
let hasBootedThisPageLoad = false;

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { BootLoader } from '@/components/BootLoader';
import { useAuth } from '@/hooks/useAuth';
import { useScrollLock } from '@/hooks/useScrollLock';

export function GlobalBootSplash() {
  const pathname = usePathname() || '/';
  const { authReady } = useAuth();
  const [splashDone, setSplashDone] = useState(hasBootedThisPageLoad);

  const booting = !splashDone;

  // Same /w/ guard as NavPendingOverlay/GlobalNav: app/w/[widgetId] is
  // rendered inside a sandboxed iframe embedded on a THIRD-PARTY
  // CUSTOMER'S SITE, not sitevento's own UI. A full-screen sitevento
  // boot splash has no business appearing inside someone else's page.
  const suppressed = pathname.startsWith('/w/') || hasBootedThisPageLoad;

  useScrollLock(!suppressed && booting);

  if (suppressed) return null;

  return (
    <BootLoader
      authReady={authReady}
      onDone={() => {
        hasBootedThisPageLoad = true;
        setSplashDone(true);
      }}
    />
  );
}
