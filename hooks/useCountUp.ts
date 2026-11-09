'use client';

// hooks/useCountUp.ts — animates a numeric value from 0 up to a
// target once its element scrolls into view (one-time, like
// useScrollReveal's reveal-on-scroll, but driving a number instead of
// a CSS class). Used by the homepage Stats section so the figures
// count up live rather than appearing as static text.
import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function useCountUp(target: number, durationMs = 1400) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();

            function tick(now: number) {
              const elapsed = now - start;
              const t = Math.min(1, elapsed / durationMs);
              setValue(Math.round(target * easeOutExpo(t)));
              if (t < 1) requestAnimationFrame(tick);
            }

            requestAnimationFrame(tick);
            observer.unobserve(el);
          }
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, durationMs]);

  return { ref, value };
}
