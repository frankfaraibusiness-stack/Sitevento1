// hooks/useSidebar.ts
//
// Replaces toggleSidebar(open) + its Escape-key listener. Plain open/
// close boolean state instead of toggling classList on module-scoped
// element references.
//
// Scroll locking itself lives in components/layout/Sidebar.tsx (via the
// shared useScrollLock, hooks/useScrollLock.ts) — not duplicated here —
// since that's the component that actually renders while `open` is
// true and knows when its own close animation, if any, finishes.
'use client';

import { useEffect, useState } from 'react';

export function useSidebar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return { open, setOpen };
}
