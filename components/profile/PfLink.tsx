'use client';

// components/profile/PfLink.tsx
//
// Profile-page link: a real <a href> (so open-in-new-tab / copy-link work)
// that navigates through useNavRouter, the same path every dashboard page
// uses, so the NavPendingOverlay shows instantly on slow networks.
import type { ReactNode } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';

export function PfLink({
  href,
  className,
  children,
  title,
  onNavigate,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  title?: string;
  onNavigate?: () => void;
}) {
  const router = useNavRouter();
  return (
    <a
      href={href}
      className={className}
      title={title}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onNavigate?.();
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
