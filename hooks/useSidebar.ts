// hooks/useSidebar.ts
//
// Replaces toggleSidebar(open) + its Escape-key listener. Plain open/
// close boolean state instead of toggling classList on module-scoped
// element references.
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

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  return { open, setOpen };
}
