'use client';

// components/apidocs/TocSpy.tsx — marks the sidebar link of the section
// currently in view. Pure enhancement: without JS the links still work.
import { useEffect } from 'react';

export function TocSpy({ rootSelector = '.apd-side' }: { rootSelector?: string }) {
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    const byId = new Map<string, HTMLAnchorElement>();
    links.forEach((a) => byId.set(decodeURIComponent(a.hash.slice(1)), a));
    const targets = Array.from(byId.keys())
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;
    let current: HTMLAnchorElement | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        const a = byId.get(visible[0].target.id);
        if (!a || a === current) return;
        current?.removeAttribute('aria-current');
        a.setAttribute('aria-current', 'location');
        current = a;
        const box = root as HTMLElement;
        const top = a.offsetTop - box.clientHeight / 2;
        if (box.scrollHeight > box.clientHeight) box.scrollTo({ top, behavior: 'smooth' });
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0 }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [rootSelector]);
  return null;
}
