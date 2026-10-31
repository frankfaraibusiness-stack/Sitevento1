'use client';

// components/AppSkeleton.tsx
//
// One shared loading state, used everywhere a page needs to show
// "working on it" instead of either (a) the full 6+ second BootSplash
// boot animation replaying on every in-app navigation, or (b) ad hoc
// per-page loading markup (a bare "Loading…" string, a tiny unstyled
// "…", or a skeleton shaped differently from every other page).
//
// Just the orbiting-dot ring from BootSplash's "spinning" phase — the
// same lime dots spinning around a center point — with no blob, no
// logo, and no shimmering placeholder rows underneath. Previously this
// showed the brand blob + logo mark above a stack of shimmering gray
// bars meant to preview incoming content shape; in practice that read
// as a separate, oddly-styled loading state rather than a continuation
// of the boot animation the person just saw, so it's gone. This is
// deliberately the plainer, calmer "still loading" signal — the blob
// and logo stay reserved for the one-time full boot sequence in
// components/BootSplash.tsx.
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

const DOT_COUNT = 10;

// Fixed, evenly-spaced layout (no per-mount random seed, unlike
// BootSplash's makeDots) — this spinner can mount and remount
// frequently during ordinary navigation, so a stable ring avoids any
// layout jitter between mounts and keeps this component simple.
const DOTS = Array.from({ length: DOT_COUNT }, (_, i) => {
  const angleDeg = (360 / DOT_COUNT) * i;
  const rad = (angleDeg * Math.PI) / 180;
  const radius = 68;
  const size = 11;
  return {
    x: Math.sin(rad) * radius,
    y: -Math.cos(rad) * radius,
    size,
    delay: (i * 1400) / DOT_COUNT,
  };
});

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
      <div className="app-skel-ring">
        {DOTS.map((dot, i) => (
          <span
            key={i}
            className="app-skel-dot"
            style={{
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              ['--dot-x' as string]: `${dot.x}px`,
              ['--dot-y' as string]: `${dot.y}px`,
              animationDelay: `${dot.delay}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
