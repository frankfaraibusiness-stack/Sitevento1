'use client';

// hooks/useScrollReveal.ts — drives the .is-visible class that triggers
// the capabilities cards' entrance animation (see .cap.is-visible in
// marketing-hero.css). One IntersectionObserver watching every ref in
// the returned callback, each element revealed once and then
// unobserved — this is a one-time "welcome in" on scroll, not a
// repeating show/hide toggle.
import { useCallback, useRef } from 'react';

export function useScrollReveal<T extends HTMLElement = HTMLElement>() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const register = useCallback((el: T | null) => {
    if (!el) return;
    el.setAttribute('data-reveal', '');

    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observerRef.current?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
      );
    }

    observerRef.current.observe(el);
  }, []);

  return register;
}
