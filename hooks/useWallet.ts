// hooks/useWallet.ts
//
// Owns the full wallet page's data lifecycle: initial balance + ledger
// load, "load more history" pagination, depositing, and toggling
// autoRechargeEnabled. Mirrors hooks/useAccountLimits.ts's shape
// (refresh/loading/error) but talks to app/api/wallet directly instead
// of piggybacking on /api/site-limits — this hook also needs to
// trigger real mutations (deposit, toggle), which that shared
// dashboard-wide poll deliberately does not do.
//
// No polling loop here (unlike useAccountLimits): the wallet page is
// a deliberate destination a user navigates to, not an ambient strip
// shown everywhere, so a stale balance for a few seconds while the
// tab sits open is an acceptable trade against a dashboard-wide extra
// poll. `refresh()` is called after every mutation instead, which is
// when the balance could actually have changed from this tab's own
// actions.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { WalletLedgerEntry, WalletSummary } from '@/lib/wallet';

interface WalletState {
  wallet: WalletSummary | null;
  ledger: WalletLedgerEntry[];
  nextCursor: string | null;
}

async function callWallet(user: User, action: string, extra: Record<string, unknown> = {}) {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, action, ...extra }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok || !result.ok) {
    throw new Error(result.error || 'Something went wrong. Please try again.');
  }
  return result;
}

export function useWallet(user: User | null) {
  const [state, setState] = useState<WalletState>({ wallet: null, ledger: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const result = await callWallet(user, 'get-wallet');
      setState({ wallet: result.wallet, ledger: result.ledger || [], nextCursor: result.nextCursor ?? null });
    } catch (err) {
      console.error('useWallet refresh error', err);
      setError(err instanceof Error ? err.message : 'Could not load your wallet.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [user]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || !state.nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await callWallet(user, 'get-wallet', { cursor: state.nextCursor });
      setState((prev) => ({
        wallet: result.wallet,
        ledger: [...prev.ledger, ...(result.ledger || [])],
        nextCursor: result.nextCursor ?? null,
      }));
    } catch (err) {
      console.error('useWallet loadMore error', err);
      setError(err instanceof Error ? err.message : 'Could not load more history.');
    } finally {
      setLoadingMore(false);
    }
  }, [user, loadingMore, state.nextCursor]);

  const deposit = useCallback(
    async (amountUsd: number) => {
      if (!user) throw new Error('Sign in to add funds.');
      setDepositing(true);
      setError(null);
      try {
        await callWallet(user, 'deposit', { amountUsd });
        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Deposit failed. Please try again.';
        setError(message);
        throw new Error(message);
      } finally {
        setDepositing(false);
      }
    },
    [user, refresh]
  );

  const setAutoRecharge = useCallback(
    async (enabled: boolean) => {
      if (!user) return;
      // Optimistic flip — this is a low-stakes preference toggle, not
      // money moving, so updating the UI before the round trip settles
      // keeps the switch feeling instant; refresh() below reconciles
      // with the server's real value right after.
      setState((prev) => (prev.wallet ? { ...prev, wallet: { ...prev.wallet, autoRechargeEnabled: enabled } } : prev));
      try {
        await callWallet(user, 'set-auto-recharge', { enabled });
        await refresh();
      } catch (err) {
        console.error('useWallet setAutoRecharge error', err);
        setError(err instanceof Error ? err.message : 'Could not update that setting.');
        await refresh();
      }
    },
    [user, refresh]
  );

  useEffect(() => {
    if (!user) {
      setState({ wallet: null, ledger: [], nextCursor: null });
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [user, refresh]);

  return {
    wallet: state.wallet,
    ledger: state.ledger,
    hasMore: !!state.nextCursor,
    loading,
    loadingMore,
    depositing,
    error,
    refresh,
    loadMore,
    deposit,
    setAutoRecharge,
  };
}
