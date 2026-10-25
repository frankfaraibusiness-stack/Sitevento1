'use client';

// components/layout/NavPendingOverlay.tsx
//
// Mounted once from app/layout.tsx, alongside GlobalNav, so it's
// present (and already loaded — no separate chunk to fetch after a
// click) on every route. Renders nothing until useNavPending() flips
// true, which happens synchronously on click via useNavRouter().push,
// well before app/loading.tsx would ever get a chance to mount.
//
// Reuses the existing <AppSkeleton fullScreen> — the same visual the
// route-level app/loading.tsx already shows — so a fast navigation
// still looks identical to before; the only change is *when* it can
// appear.
import { usePathname } from 'next/navigation';
import { AppSkeleton } from '@/components/AppSkeleton';
import { useNavPending } from '@/hooks/useNavPending';

export function NavPendingOverlay() {
  const pathname = usePathname() || '/';
  const isPending = useNavPending();

  // Mirrors GlobalNav's own /w/ guard: app/w/[widgetId]/page.tsx is
  // what runs inside a sandboxed iframe on a THIRD-PARTY CUSTOMER'S
  // SITE, not sitevento's own UI, and it still sits under this same
  // root layout. A full-screen sitevento loading overlay has no
  // business appearing inside someone else's page.
  if (pathname.startsWith('/w/')) return null;
  if (!isPending) return null;
  return <AppSkeleton fullScreen label="Loading page" />;
}
