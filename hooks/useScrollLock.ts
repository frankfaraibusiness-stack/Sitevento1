// hooks/useScrollLock.ts
//
// ONE shared scroll lock for every modal/overlay/bottom-sheet/sidebar in
// the app (Sidebar, OnboardingFlow, AuthOverlay, UpsellOverlay,
// WidgetStatusPopup, InstallPromptOverlay, AppSkeleton, DashboardShell's
// mobile drawer, etc). Replaces the old pattern of each component doing
// its own `document.body.style.overflow = 'hidden'` on mount/unmount,
// which was duplicated 9+ times and never actually stopped scrolling —
// `overflow: hidden` on body does nothing to stop iOS Safari's
// touch-driven rubber-band scroll of the page behind a `position: fixed`
// overlay, so the page underneath a modal/sidebar/onboarding step could
// still be dragged and scrolled while the overlay sat on top of it.
//
// This hook instead:
//   1. Fixes body in place (position: fixed) at its current scroll
//      offset while locked, which is what actually stops iOS from
//      scrolling the page behind a fixed-position overlay — not just
//      `overflow: hidden`.
//   2. Restores the exact scroll position on unlock.
//   3. Compensates the width lost to the (now invisible) scrollbar on
//      desktop, so the page doesn't visibly shift/jump sideways by
//      ~15px when the lock engages.
//   4. Supports multiple overlays locking at once (e.g. the sidebar
//      opened from inside a modal) via a simple reference count on
//      <html>, so the first one to unlock doesn't prematurely unlock
//      scroll for a still-open second one.
//
// Usage: const locked = someCondition; useScrollLock(locked);

import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;

function applyLock() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.documentElement.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function releaseLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.paddingRight = '';
    document.documentElement.style.overflow = '';
    window.scrollTo(0, savedScrollY);
  }
}

/** Locks page scroll (body + html) while `active` is true. Safe to call
 * from multiple components at once — locks stack via a reference count,
 * so scroll only actually unlocks once every lock has released. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    applyLock();
    return () => releaseLock();
  }, [active]);
}
