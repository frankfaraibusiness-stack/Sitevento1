// hooks/useConsoleAuth.ts
//
// Session check + passcode submit for /console — talks to
// app/api/console-auth, entirely separate from the app's real
// hooks/useAuth.ts / Firebase session. See that route's header for
// the testing-phase passcode caveat.
'use client';

import { useCallback, useEffect, useState } from 'react';

export function useConsoleAuth() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/console-auth', { method: 'GET', cache: 'no-store' })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        setAuthorized(!!data?.ok);
      })
      .catch(() => {
        if (!cancelled) setAuthorized(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitPasscode = useCallback(async (passcode: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/console-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Incorrect passcode.');
        setSubmitting(false);
        return false;
      }
      setAuthorized(true);
      setSubmitting(false);
      return true;
    } catch {
      setError('Could not reach the server.');
      setSubmitting(false);
      return false;
    }
  }, []);

  const signOutConsole = useCallback(async () => {
    try {
      await fetch('/api/console-auth', { method: 'DELETE' });
    } catch {
      // ignore
    }
    setAuthorized(false);
  }, []);

  return { checking, authorized, submitting, error, submitPasscode, signOutConsole };
}
