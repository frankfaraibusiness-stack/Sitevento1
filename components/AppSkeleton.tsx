'use client';

// components/AppSkeleton.tsx
//
// One shared loading state, used everywhere a page needs to show
// "working on it" instead of either (a) the full 6+ second BootSplash
// boot animation replaying on every in-app navigation, or (b) ad hoc
// per-page loading markup (a bare "Loading…" string, a tiny unstyled
// "…", or a skeleton shaped differently from every other page).
//
// The spinner is now the same plain ring style as BootSplash's own
// status spinner (.boot-splash-spinner, styles/base/boot-splash.css)
// — a bordered circle with one accent segment, rotating — instead of
// the previous orbiting-dot ring, so the boot screen and every in-app
// loading state share one consistent spinner design. No blob, no
// logo, no shimmering placeholder rows — those stay reserved for the
// one-time full boot sequence in components/BootSplash.tsx.
//
// Deliberately NOT a full-screen overlay unless `fullScreen` is passed
// (used by app/loading.tsx, which has no page chrome yet to sit
// inside of) — everywhere else this sits inline, in place of the
// content that's loading, inside whatever page mounts it (settings,
// dashboard, profile, manage-site, the widget designer) so the
// header/sidebar chrome around it stays put instead of flashing to a
// blank screen on every route change.
import { useScrollLock } from '@/hooks/useScrollLock';
import '@/styles/base/app-skeleton.css';

interface AppSkeletonProps {
  label?: string;
  fullScreen?: boolean;
}

export function AppSkeleton({ label = 'Loading\u2026', fullScreen = false }: AppSkeletonProps) {
  // Lock body scroll for the duration of a full-screen loading state,
  // same shared lock every full-page overlay uses (hooks/useScrollLock.ts)
  // — a full-page loader should block interaction with whatever's
  // underneath, not leave the page scrollable behind it. Scoped to
  // `fullScreen` only; the inline (in-page) usage elsewhere sits
  // alongside real content and shouldn't lock scroll.
  useScrollLock(fullScreen);

  return (
    <div className={`app-skel${fullScreen ? ' app-skel-full' : ''}`} role="status" aria-label={label}>
      <div className="app-skel-ring" aria-hidden="true" />
    </div>
  );
}
