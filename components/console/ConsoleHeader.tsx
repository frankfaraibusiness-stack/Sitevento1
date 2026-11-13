'use client';

// components/console/ConsoleHeader.tsx
//
// Sticky top header for /console — branding image on the left (same
// logo asset as the main app's Header.tsx, so Console still reads as
// "sitevento", just in its own admin context), a hamburger on the
// right that opens a dropdown of quick admin pages. Only "Overview"
// is wired to a real page today — the rest (Users, Plans, Sites,
// Billing) are placeholders for pages to be built next; selecting one
// of them shows a "coming soon" row instead of navigating, so the menu
// never silently 404s.
import { useEffect, useRef, useState } from 'react';

interface QuickLink {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
}

const QUICK_LINKS: QuickLink[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/console',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Users',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16.5 4.5a3.5 3.5 0 0 1 0 7" />
        <path d="M15 13.5c2.8.4 5 2.7 5 6.5" />
      </svg>
    ),
  },
  {
    id: 'sites',
    label: 'Sites',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
      </svg>
    ),
  },
  {
    id: 'plans',
    label: 'Plans & Billing',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    id: 'widgets',
    label: 'Widget Catalog',
    href: '/admin/widgets',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
      </svg>
    ),
  },
];

interface ConsoleHeaderProps {
  onSignOut: () => void;
}

export function ConsoleHeader({ onSignOut }: ConsoleHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <header className="console-header">
      <div className="console-header-inner">
        <div className="console-header-brand">
          <img
            src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
            alt="sitevento"
            className="console-header-logo"
          />
          <span className="console-header-divider" />
          <span className="console-header-tag">Console Panel</span>
        </div>

        <div className="console-header-menu" ref={menuRef}>
          <button
            type="button"
            className={`console-hamburger${open ? ' is-open' : ''}`}
            aria-label="Open quick pages menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          {open && (
            <div className="console-dropdown" role="menu">
              <div className="console-dropdown-label">Quick pages</div>
              {QUICK_LINKS.map((item) =>
                item.href ? (
                  <a key={item.id} className="console-dropdown-item" href={item.href} role="menuitem">
                    {item.icon}
                    {item.label}
                  </a>
                ) : (
                  <button key={item.id} type="button" className="console-dropdown-item is-soon" role="menuitem" disabled>
                    {item.icon}
                    {item.label}
                    <span className="console-dropdown-soon">Soon</span>
                  </button>
                )
              )}
              <div className="console-dropdown-sep" />
              <button type="button" className="console-dropdown-item is-signout" role="menuitem" onClick={onSignOut}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Exit Console
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
