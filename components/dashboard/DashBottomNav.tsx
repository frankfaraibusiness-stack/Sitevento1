'use client';

// components/dashboard/DashBottomNav.tsx
//
// Sticky bottom tab bar for the /dashboard route only — Home / Analytics
// / Settings / Help, fixed to the viewport bottom (siterifty-style quick
// nav). Does not replace or touch Header or DashFooter: this sits above
// both, pinned, while the page's normal content (including DashFooter's
// links) still scrolls underneath it.
//
// "Analytics" scrolls to the visit log panel, "Settings" to the Quick
// Tools / Site Alert panel (closest existing equivalent — there's no
// separate settings page yet), "Help" scrolls down to DashFooter's own
// help links so nothing is duplicated. All four are pure scroll/anchor
// actions; no new routes.
import { useEffect, useState, type ReactNode } from 'react';

export type DashNavTarget = 'home' | 'analytics' | 'settings' | 'help';

interface DashBottomNavProps {
  onNavigate: (target: DashNavTarget) => void;
}

const TABS: { id: DashNavTarget; label: string; icon: (active: boolean) => ReactNode }[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 13.5a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19.5a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4.5a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H10a1.65 1.65 0 0 0 1-1.51V4.5a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a1.65 1.65 0 0 0 1.51 1H19.5a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    id: 'help',
    label: 'Help',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 1.9" />
        <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export function DashBottomNav({ onNavigate }: DashBottomNavProps) {
  const [active, setActive] = useState<DashNavTarget>('home');

  // Keep the active tab in sync with whichever section is actually in
  // view, so the bar still reflects scroll position even when the user
  // scrolls by hand instead of tapping a tab.
  useEffect(() => {
    const sectionMap: { id: DashNavTarget; el: string }[] = [
      { id: 'home', el: 'dashMain' },
      { id: 'analytics', el: 'panelVisits' },
      { id: 'settings', el: 'panelOverlay' },
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const match = sectionMap.find((s) => s.el === entry.target.id);
          if (match) setActive(match.id);
        }
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );
    sectionMap.forEach(({ el }) => {
      const node = document.getElementById(el);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  function handleTap(id: DashNavTarget) {
    setActive(id);
    onNavigate(id);
  }

  return (
    <nav className="dbn-root" aria-label="Dashboard">
      <div className="dbn-inner">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`dbn-tab${isActive ? ' is-active' : ''}`}
              onClick={() => handleTap(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="dbn-icon">{tab.icon(isActive)}</span>
              <span className="dbn-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
