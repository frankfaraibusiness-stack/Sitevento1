// hooks/useDomainLookup.ts
//
// Drives the connect-site wizard's "domain intel" reveal: debounces the
// raw domain input, calls /api/domain-lookup, and exposes a small state
// machine the UI can animate off of. Entirely best-effort and
// non-blocking — a failed/empty lookup just means the intel card stays
// hidden, never an error shown to the user, since this is a cosmetic
// enhancement, not part of the actual verification flow.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type DomainLookupStatus = 'idle' | 'loading' | 'found' | 'not-found';

export interface DomainLookupResult {
  found: boolean;
  domain: string;
  registrar: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  ageDays: number | null;
  status: string[];
  nameserverCount: number | null;
}

const DEBOUNCE_MS = 550;

// Pulled out of normalizeUrl's shape in useConnectSiteWizard.ts — just
// enough of a check to decide "does this look like a real domain yet",
// so we don't fire a lookup on every keystroke of a half-typed domain.
function looksLikeDomain(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    const host = u.hostname;
    if (!host.includes('.')) return null;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export function useDomainLookup() {
  const [status, setStatus] = useState<DomainLookupStatus>('idle');
  const [result, setResult] = useState<DomainLookupResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastHostRef = useRef<string | null>(null);

  const clearPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearPending();
    lastHostRef.current = null;
    setStatus('idle');
    setResult(null);
  }, [clearPending]);

  // Call on every keystroke of the domain field — internally debounced
  // and deduped so it's safe/cheap to call this way.
  const onDomainInputChange = useCallback(
    (raw: string) => {
      const host = looksLikeDomain(raw);

      if (!host) {
        clearPending();
        lastHostRef.current = null;
        setStatus('idle');
        setResult(null);
        return;
      }

      if (host === lastHostRef.current && status !== 'idle') return;

      clearPending();
      setStatus('loading');

      timerRef.current = setTimeout(async () => {
        lastHostRef.current = host;
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const res = await fetch('/api/domain-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: host }),
            signal: controller.signal,
          });
          const data = await res.json().catch(() => null);
          if (controller.signal.aborted) return;
          if (data && typeof data === 'object') {
            setResult(data);
            setStatus(data.found ? 'found' : 'not-found');
          } else {
            setResult(null);
            setStatus('not-found');
          }
        } catch {
          if (controller.signal.aborted) return;
          setResult(null);
          setStatus('not-found');
        }
      }, DEBOUNCE_MS);
    },
    [clearPending, status]
  );

  useEffect(() => clearPending, [clearPending]);

  return { status, result, onDomainInputChange, reset };
}
