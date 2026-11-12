'use client';

// components/marketing/HowItWorksRail.tsx
//
// Small client island for the otherwise-static /how-it-works page
// (app/how-it-works/page.tsx, components/marketing/HowItWorksPage.tsx
// — both plain Server Components so the page stays statically
// generated and fully crawlable). This is the ONLY client piece on
// the page: a sticky, scroll-spy'd step index for desktop
// (>=1040px — hidden below that, see styles/marketing/
// how-it-works-page.css's .hiw2-rail), replacing the old
// HowItWorksModal.tsx's rail/tab-strip with a real in-page nav that
// works with normal browser scrolling instead of a modal's own
// internal scroll container.
//
// No mobile tab-strip / floating progress cards here by design (the
// CSS file hides .hiw2-rail entirely below 1040px) — per request,
// phone just scrolls the page body normally under the page's own
// sticky header.
import { useEffect, useRef, useState } from 'react';

interface RailStep {
  id: string;
  label: string;
}

export function HowItWorksRail({ steps }: { steps: RailStep[] }) {
  const [activeId, setActiveId] = useState(steps[0]?.id ?? '');
  const observedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { threshold: 0.2, rootMargin: '-15% 0px -55% 0px' }
    );

    steps.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) {
        observer.observe(el);
        observedRef.current.add(s.id);
      }
    });

    return () => observer.disconnect();
  }, [steps]);

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="hiw2-rail" aria-label="How it works sections">
      {steps.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={`hiw2-rail-item${activeId === s.id ? ' is-active' : ''}`}
          onClick={() => goTo(s.id)}
          aria-current={activeId === s.id}
        >
          <span className="hiw2-rail-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="hiw2-rail-label">{s.label}</span>
        </button>
      ))}
      <div className="hiw2-rail-cta">
        <p>Ready to see it on your own site?</p>
        <a href="/dashboard/connect">
          Connect your site
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </nav>
  );
}
