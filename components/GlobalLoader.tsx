'use client';

// components/GlobalLoader.tsx
//
// The ONE loading UI for the whole app — replaces what used to be
// three separate things:
//   1. BootSplash.tsx        — the old full-screen "logo + headline +
//                               progress bar" boot sequence shown
//                               while Firebase auth resolved.
//   2. The cartoon hero's own `.loader` (previously inline inside
//      components/marketing/CartoonMobileHero.tsx) — a second,
//      separate boot-style splash (logo + shimmering bars + progress
//      bar) that only ever showed on the mobile marketing hero, on a
//      hardcoded 5s timer with no real connection to whether the app
//      was actually ready. On a slow connection it would finish and
//      disappear before auth (and BootSplash) had — on a fast one, it
//      ran a flat 5s regardless, for no reason, stacked right after
//      BootSplash's own boot animation. Visitors were looking at two
//      back-to-back boot screens.
//   3. AppSkeleton.tsx        — the plain spinning-ring loader reused
//                               inline across ~25 pages (dashboard
//                               pages, settings, the widget designer,
//                               app/loading.tsx) for page-transition /
//                               in-page loading states.
//
// This component keeps the cartoon loader's exact visual design (the
// card, the wordmark, the shimmering placeholder bars, the chunky
// progress bar) — the brief was "keep that one as-is" — but now wired
// to *real* app state instead of a hardcoded timer, and with a second,
// compact "inline" variant for the ~25 in-page spots that don't want a
// full 5-second brand moment every time a page changes.
//
// Two ways to render it:
//
//   <GlobalLoader variant="boot" ready={authReady} onDone={...} onTimeout={...} />
//     Full-screen. Used exactly once, by AppRoot, in place of the old
//     BootSplash + the old inline CartoonLoader. Same phase model
//     BootSplash used to have (arriving → connecting → confirmed →
//     leaving), same 5s boot timeout + retry-toast handoff via
//     onTimeout, same 3s confirmed hold — just skinned with the
//     cartoon loader's card/logo/bars instead of BootSplash's old
//     headline+spinner layout.
//
//   <GlobalLoader variant="inline" />
//     Small, non-full-screen version: logo mark + two shimmering
//     placeholder bars, sized to sit inside a page's own chrome
//     (header/sidebar stay visible around it) — the direct
//     replacement for AppSkeleton's spinning ring at all ~25 of its
//     call sites. Pass fullScreen to cover the viewport instead (same
//     as AppSkeleton's own fullScreen prop, used by app/loading.tsx).
//     No spinner anywhere in this variant — logo + skeleton bars only,
//     per the brief.
import { useEffect, useRef, useState } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import '@/styles/base/global-loader.css';

const LOGO_URL =
  'https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png';

type Phase = 'arriving' | 'connecting' | 'confirmed' | 'leaving';

interface BootVariantProps {
  variant: 'boot';
  /** True once the real app is actually ready to show (authReady in AppRoot). */
  ready: boolean;
  onDone?: () => void;
  /** Fired once, if the boot window elapses before `ready` ever becomes true. The loader still closes either way — this is just the signal to surface the "no network" retry toast. */
  onTimeout?: () => void;
}

interface InlineVariantProps {
  variant?: 'inline';
  label?: string;
  fullScreen?: boolean;
}

type GlobalLoaderProps = BootVariantProps | InlineVariantProps;

// ---- boot variant timing (ported from the old BootSplash.tsx as-is) ----
const MIN_CONFIRMED_HOLD_MS = 3000;
const ARRIVE_MS = 700;
const LEAVE_MS = 480;
const BOOT_TIMEOUT_MS = 5000;

function BootLoader({ ready, onDone, onTimeout }: BootVariantProps) {
  const [phase, setPhase] = useState<Phase>('arriving');
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const settledRef = useRef(false);

  // The boot loader is full-screen for its entire mounted lifetime, so
  // it must lock scroll the whole time it's up — not just on iOS, where
  // `overflow:hidden` alone doesn't stop rubber-band scrolling behind a
  // fixed overlay. Without this, scrolling while the boot loader is on
  // screen silently scrolls the page underneath, so when the loader
  // closes the user lands wherever that background scroll left off.
  useScrollLock(true);

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Phase 1 → 2
  useEffect(() => {
    const t = setTimeout(() => setPhase('connecting'), reducedMotion ? 60 : ARRIVE_MS);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  // Phase 2 → 3: auth resolves while still inside the boot window.
  useEffect(() => {
    if (phase !== 'connecting' || !ready || settledRef.current) return;
    settledRef.current = true;
    setPhase('confirmed');
  }, [phase, ready]);

  // Phase 2 timeout: boots for BOOT_TIMEOUT_MS, then checks whether
  // auth has settled. Falls through to "confirmed" if it has right at
  // the boundary, otherwise closes anyway and fires onTimeout so the
  // caller can show the "no network" retry toast.
  useEffect(() => {
    if (phase !== 'connecting') return;
    const t = setTimeout(
      () => {
        if (settledRef.current) return;
        settledRef.current = true;
        if (readyRef.current) {
          setPhase('confirmed');
        } else {
          onTimeout?.();
          setPhase('leaving');
        }
      },
      reducedMotion ? 300 : BOOT_TIMEOUT_MS
    );
    return () => clearTimeout(t);
  }, [phase, reducedMotion, onTimeout]);

  // Phase 3 → 4: deliberate hold after ready, timed from the moment
  // we entered "confirmed", not from mount.
  useEffect(() => {
    if (phase !== 'confirmed') return;
    const t = setTimeout(() => setPhase('leaving'), reducedMotion ? 300 : MIN_CONFIRMED_HOLD_MS);
    return () => clearTimeout(t);
  }, [phase, reducedMotion]);

  // Phase 4 → done. Also fires a window-level signal the instant the
  // boot loader is gone — components mounted underneath it (e.g. the
  // marketing hero's sites-connected stat, components/marketing/
  // CartoonMobileHero.tsx) listen for this instead of running their
  // own entrance animations while still hidden behind this overlay.
  // See markBootLoaderDone()/onBootLoaderDone() below.
  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = setTimeout(() => {
      markBootLoaderDone();
      onDone?.();
    }, reducedMotion ? 80 : LEAVE_MS);
    return () => clearTimeout(t);
  }, [phase, onDone, reducedMotion]);

  // Same app-bg mirror onto <html> BootSplash used to do, so mobile
  // rubber-band overscroll shows the same tone underneath instead of
  // flashing to something else.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('is-boot-lime');
    return () => {
      root.classList.remove('is-boot-lime');
    };
  }, []);

  const isComplete = phase === 'confirmed' || phase === 'leaving';

  return (
    <div
      className={`global-loader global-loader-boot is-${phase}`}
      role="status"
      aria-live="polite"
      aria-label="Loading sitevento"
    >
      <div className="global-loader-atmosphere" aria-hidden="true" />
      <div className="global-loader-card">
        <img className="global-loader-mark" src={LOGO_URL} alt="sitevento" />
        <div className="global-loader-bar global-loader-bar--title" aria-hidden="true" />
        <div className="global-loader-bar global-loader-bar--title short" aria-hidden="true" />
        <div className="global-loader-bar global-loader-bar--line" aria-hidden="true" />
        <div className="global-loader-bar global-loader-bar--line short" aria-hidden="true" />
        <div className={`global-loader-progress${isComplete ? ' is-complete' : ''}`} aria-hidden="true">
          <div className="global-loader-progress-fill" />
        </div>
        <div className="global-loader-caption">
          <span>{isComplete ? "You're all set" : 'Warming things up'}</span>
          <span className="global-loader-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}

function InlineLoader({ label = 'Loading\u2026', fullScreen = false }: InlineVariantProps) {
  // Same scroll-lock convention every other full-page overlay in the
  // app uses — only engaged for the fullScreen case (app/loading.tsx);
  // the inline (in-page) usage sits alongside real content and
  // shouldn't lock scroll.
  useScrollLock(fullScreen);

  return (
    <div
      className={`global-loader global-loader-inline${fullScreen ? ' is-full' : ''}`}
      role="status"
      aria-label={label}
    >
      <img className="global-loader-inline-mark" src={LOGO_URL} alt="" aria-hidden="true" />
      <div className="global-loader-inline-bars" aria-hidden="true">
        <div className="global-loader-bar global-loader-bar--line" />
        <div className="global-loader-bar global-loader-bar--line short" />
      </div>
    </div>
  );
}

export function GlobalLoader(props: GlobalLoaderProps) {
  if (props.variant === 'boot') {
    return <BootLoader {...props} />;
  }
  return <InlineLoader {...props} />;
}

// ---------------------------------------------------------------
// Boot-done signal — lets content mounted underneath the full-screen
// boot variant (which covers everything, including the marketing
// page behind it) know the moment it's actually safe to start an
// entrance animation, instead of running on mount while still hidden
// behind the overlay. A plain window event rather than React context:
// the boot loader is mounted once at the app root, several pages/
// components deep from anything that might care, and this is a single
// one-shot signal, not ongoing shared state.
const BOOT_DONE_EVENT = 'sitevento:boot-loader-done';
let bootLoaderDone = false;

function markBootLoaderDone() {
  if (bootLoaderDone) return;
  bootLoaderDone = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(BOOT_DONE_EVENT));
  }
}

/**
 * Calls `callback` once the boot loader has finished closing. If it
 * has already finished by the time this runs (e.g. the caller mounted
 * after boot), fires immediately instead of waiting for an event that
 * already happened.
 */
export function onBootLoaderDone(callback: () => void): () => void {
  if (bootLoaderDone) {
    callback();
    return () => {};
  }
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(BOOT_DONE_EVENT, handler, { once: true });
  return () => window.removeEventListener(BOOT_DONE_EVENT, handler);
}
