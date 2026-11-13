'use client';

// hooks/useImagePreload.ts
//
// Preloads a single image URL and reports back once it has actually
// finished loading (or failed) in the browser, as a plain boolean —
// used by AppRoot to hold the boot loader open until the marketing
// hero photo (public/mascot/hero-bg-desktop.jpg) is ready, not just
// until Firebase auth resolves. Without this, auth can resolve well
// before a slow/cold-cache image request finishes, the boot loader
// closes, and the very first thing a visitor sees is the hero section
// with its background image still blank/half-painted — on a page
// that's now *just* that photo (no title/description left over it),
// a missing image there reads as a broken page, not a slow one.
//
// Resolves `true` on error too (rather than hanging forever) so a
// genuinely broken image URL can't stall the boot loader past its own
// existing 5s timeout in GlobalLoader.tsx — this only ever makes the
// loader wait a *bit* longer for a normal slow load, never hang.
import { useEffect, useState } from 'react';

export function useImagePreload(src: string): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !src) {
      setLoaded(true);
      return;
    }

    // Already cached (e.g. fast repeat visit) — report ready
    // immediately instead of waiting on a new decode/load cycle.
    const probe = new window.Image();
    probe.src = src;
    if (probe.complete && probe.naturalWidth > 0) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const img = new window.Image();
    const finish = () => {
      if (!cancelled) setLoaded(true);
    };
    img.onload = finish;
    img.onerror = finish;
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return loaded;
}
