'use client';

// components/api/useCopy.ts — copy-to-clipboard with a short "copied" flag per key.
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCopy(resetMs = 1600) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const copy = useCallback(
    async (text: string, id: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard can be blocked (insecure context, permissions). Fall back
        // to a hidden textarea so the button still works.
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } catch {
          return;
        }
      }
      setCopied(id);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied((c) => (c === id ? null : c)), resetMs);
    },
    [resetMs]
  );

  return { copied, copy };
}
