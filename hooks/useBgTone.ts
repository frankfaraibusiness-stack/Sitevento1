'use client';

// hooks/useBgTone.ts
//
// The dashboard has to follow whatever the page background is — and that
// can be anything: the default lilac, one of the three Appearance presets,
// or ANY hex the user typed into Settings > Appearance (applied as an
// inline --app-bg on <html>, see hooks/useAppliedAppearance.ts). CSS alone
// can't pick readable text for an arbitrary colour, so this reads the
// computed background of <body> (the colour users actually see), works out
// which ink gives the better WCAG contrast, and returns 'light' (dark ink on
// a light page) or 'dark' (light ink on a dark page). The dashboard root
// sets data-tone from it and derives every surface/ink/accent token from there.
//
// It re-reads when <html>'s style/class changes (a theme change) and once
// more after base.css's 450ms background transition has finished, so it
// never settles on a mid-fade colour.
import { useEffect, useState } from 'react';

export type BgTone = 'light' | 'dark';

function parseColor(value: string): [number, number, number] | null {
  const rgb = /rgba?\(([^)]+)\)/.exec(value);
  if (rgb) {
    const p = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every((n) => !isNaN(n))) return [p[0], p[1], p[2]];
  }
  const srgb = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255];
  return null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// Relative luminance of the dashboard's dark ink (#14121c).
const INK_LUM = 0.0062;

export function toneForColor(value: string): BgTone | null {
  const rgb = parseColor(value);
  if (!rgb) return null;
  const L = luminance(rgb);
  const contrastWithDarkInk = (L + 0.05) / (INK_LUM + 0.05);
  const contrastWithWhite = 1.05 / (L + 0.05);
  return contrastWithDarkInk >= contrastWithWhite ? 'light' : 'dark';
}

export function useBgTone(): BgTone {
  const [tone, setTone] = useState<BgTone>('light');

  useEffect(() => {
    // Reads --app-bg (the theme colour itself) through a throwaway probe
    // element rather than <body>'s background: on the dashboard, html/body
    // are repainted with the dashboard surface (see dx-dashboard.css), which
    // is derived FROM this tone — reading it back would feed on itself.
    const read = () => {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;width:0;height:0;visibility:hidden;pointer-events:none;background-color:var(--app-bg)';
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const next = toneForColor(color) ?? toneForColor(getComputedStyle(document.body).backgroundColor);
      if (next) setTone(next);
    };
    let settle = 0;
    const readSoon = () => {
      read();
      window.clearTimeout(settle);
      settle = window.setTimeout(read, 520);
    };
    readSoon();
    const observer = new MutationObserver(readSoon);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    return () => {
      observer.disconnect();
      window.clearTimeout(settle);
    };
  }, []);

  return tone;
}
