'use client';

// components/dashboard/WalletPage.tsx
//
// Standalone route (/dashboard/wallet, see app/dashboard/wallet/page.tsx)
// — same "own page, own route, own stylesheet" shape as PlansPage and
// ProfilePage, rendered through DashboardClient's view switch so it
// shares the dashboard's single auth gate, Header and Sidebar.
//
// What it's for: the account-wide prepaid wallet (lib/wallet.ts) that
// pays for writes beyond a plan's daily cap (lib/limits.ts's
// DEFAULT_DAILY_WRITE_LIMITS) in 100,000-write bundles (always rounded
// up to a whole bundle) priced per-plan — $2.00/$1.50/$1.00/$0.50 for
// free/starter/scale/pro-developer — instead of the account
// hard-pausing the instant the free daily allowance runs out. Enforcement lives server-side
// (lib/serverAuth.ts's checkAndIncrementAccountWrites /
// assertWidgetWriteAllowed) — this page is the deposit + balance +
// history surface for it, via hooks/useWallet.ts (app/api/wallet).
//
// ── No payment provider wired up ──────────────────────────────────
// Same honest limitation as app/api/wallet's own header: deposits are
// a prepaid-ledger adjustment only, no card is actually charged yet.
// The deposit form still collects a real-looking amount and submits
// it the same way it eventually will once a processor is wired in —
// nothing about the UI pretends otherwise beyond that.
import { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { useNavRouter } from '@/hooks/useNavPending';
import { useWallet } from '@/hooks/useWallet';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import {
  DEPOSIT_PRESETS_USD,
  MIN_DEPOSIT_USD,
  MAX_DEPOSIT_USD,
  OVERAGE_WRITE_BUNDLE_SIZE,
  overageMicrocentsPerBundle,
  overageCostUsd,
  type WalletLedgerEntry,
} from '@/lib/wallet';
import { getPlan } from '@/lib/plans';

interface WalletPageProps {
  user: User;
}

function formatUsd(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatLedgerDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function LedgerIcon({ kind }: { kind: WalletLedgerEntry['kind'] }) {
  if (kind === 'deposit') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    );
  }
  if (kind === 'overage-debit') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h16" />
    </svg>
  );
}

function ledgerLabel(entry: WalletLedgerEntry): string {
  if (entry.kind === 'deposit') return 'Wallet top-up';
  if (entry.kind === 'overage-debit') {
    const writes = entry.writesCovered ? entry.writesCovered.toLocaleString() : 'extra';
    return `${writes} extra write${entry.writesCovered === 1 ? '' : 's'}${entry.note ? ` · ${entry.note}` : ''}`;
  }
  return entry.note || 'Balance adjustment';
}

export function WalletPage({ user }: WalletPageProps) {
  const router = useNavRouter();
  const { wallet, ledger, hasMore, loading, loadingMore, depositing, error, loadMore, deposit, setAutoRecharge } = useWallet(user);
  const { limits } = useAccountLimits(user);

  const [customAmount, setCustomAmount] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(25);
  const [toast, setToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const planId = limits?.planId ?? 'free';
  const plan = getPlan(planId);
  const dailyLimit = limits?.writeUsage.limit ?? null;
  const overageToday = limits?.writeUsage.overageWritesToday ?? 0;

  const effectiveAmount = useMemo(() => {
    if (customAmount.trim()) {
      const parsed = Number(customAmount);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return selectedPreset ?? 0;
  }, [customAmount, selectedPreset]);

  function pickPreset(amount: number) {
    setSelectedPreset(amount);
    setCustomAmount('');
    setFormError(null);
  }

  async function handleDeposit() {
    setFormError(null);
    if (!Number.isFinite(effectiveAmount) || effectiveAmount < MIN_DEPOSIT_USD || effectiveAmount > MAX_DEPOSIT_USD) {
      setFormError(`Enter an amount between $${MIN_DEPOSIT_USD} and $${MAX_DEPOSIT_USD.toLocaleString()}.`);
      return;
    }
    try {
      await deposit(effectiveAmount);
      setToast(`$${formatUsd(effectiveAmount)} added to your wallet.`);
      setCustomAmount('');
      setTimeout(() => setToast(null), 3400);
    } catch {
      // error already surfaced via the hook's `error` state
    }
  }

  const balanceUsd = wallet?.balanceUsd ?? 0;
  const writesAffordable = wallet?.writesAffordable ?? 0;
  const lowBalance = !!wallet && balanceUsd > 0 && balanceUsd < 2;
  const emptyBalance = !!wallet && balanceUsd === 0;

  return (
    <section>
      <div className="wlt-page">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="wlt-hero">
          <div className="wlt-hero-glow" aria-hidden="true" />
          <div className="wlt-hero-glow wlt-hero-glow-2" aria-hidden="true" />

          <div className="wlt-hero-top">
            <span className="wlt-eyebrow">
              <span className="wlt-eyebrow-dot" />
              GLOBAL WALLET
            </span>
            <button type="button" className="wlt-back" onClick={() => router.push('/dashboard/profile')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
              Profile
            </button>
          </div>

          <div className="wlt-balance-row">
            <div className="wlt-balance-main">
              <span className="wlt-balance-label">Available balance</span>
              {loading ? (
                <div className="wlt-balance-skeleton" aria-hidden="true" />
              ) : (
                <span className="wlt-balance-num">
                  <span className="wlt-balance-currency">$</span>
                  {formatUsd(balanceUsd, 3)}
                </span>
              )}
              {!loading && (
                <span className={`wlt-balance-note${emptyBalance ? ' is-empty' : lowBalance ? ' is-low' : ''}`}>
                  {emptyBalance
                    ? 'Empty — add funds to cover writes past your daily cap.'
                    : lowBalance
                    ? 'Running low — this covers only a small overage buffer.'
                    : `Covers up to ${writesAffordable.toLocaleString()} extra writes right now.`}
                </span>
              )}
            </div>

            <div className="wlt-stat-pair">
              <div className="wlt-stat">
                <span className="wlt-stat-label">Lifetime deposited</span>
                <span className="wlt-stat-num">${formatUsd(wallet?.lifetimeDepositedUsd ?? 0)}</span>
              </div>
              <div className="wlt-stat">
                <span className="wlt-stat-label">Lifetime spent</span>
                <span className="wlt-stat-num">${formatUsd(wallet?.lifetimeSpentUsd ?? 0)}</span>
              </div>
            </div>
          </div>

          <div className="wlt-rate-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>
              Overage rate on your {plan.name} plan: <strong>${(overageMicrocentsPerBundle(planId) / 100_000).toFixed(2)}</strong> per{' '}
              {OVERAGE_WRITE_BUNDLE_SIZE.toLocaleString()}-write bundle (rounds up to the next whole bundle — upgrade for a lower rate)
            </span>
          </div>
        </div>

        <div className="wlt-grid">
          {/* ── Left column: deposit + auto-recharge ─────────────── */}
          <div className="wlt-col">
            <div className="wlt-card wlt-deposit-card">
              <h2>Add funds</h2>
              <p className="wlt-card-sub">Top up your wallet to cover writes once you cross your plan&rsquo;s daily limit.</p>

              <div className="wlt-presets">
                {DEPOSIT_PRESETS_USD.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={`wlt-preset${selectedPreset === amount && !customAmount ? ' is-active' : ''}`}
                    onClick={() => pickPreset(amount)}
                  >
                    ${amount}
                  </button>
                ))}
              </div>

              <label className="wlt-custom-amount">
                <span className="wlt-custom-prefix">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Custom amount"
                  min={MIN_DEPOSIT_USD}
                  max={MAX_DEPOSIT_USD}
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedPreset(null);
                    setFormError(null);
                  }}
                />
              </label>

              {(formError || error) && <p className="wlt-form-error">{formError || error}</p>}

              <button type="button" className="wlt-deposit-btn" onClick={handleDeposit} disabled={depositing || loading}>
                {depositing ? (
                  <span className="wlt-btn-spinner" aria-hidden="true" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add ${effectiveAmount > 0 ? formatUsd(effectiveAmount) : '0.00'} to wallet
                  </>
                )}
              </button>

              <p className="wlt-deposit-footnote">
                Deposits are added to your account balance immediately. $5–$2,000 per deposit.
              </p>
            </div>

            <div className="wlt-card wlt-toggle-card">
              <div className="wlt-toggle-row">
                <div className="wlt-toggle-text">
                  <h3>Auto-cover overage writes</h3>
                  <p>
                    When on, writes past your daily cap draw from this wallet automatically instead of pausing your
                    account. Turn off to go back to a hard stop at your plan&rsquo;s limit.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!wallet?.autoRechargeEnabled}
                  className={`wlt-switch${wallet?.autoRechargeEnabled ? ' is-on' : ''}`}
                  disabled={loading || !wallet}
                  onClick={() => wallet && setAutoRecharge(!wallet.autoRechargeEnabled)}
                >
                  <span className="wlt-switch-thumb" />
                </button>
              </div>
            </div>

            <div className="wlt-card wlt-today-card">
              <h3>Today&rsquo;s usage</h3>
              <div className="wlt-today-row">
                <span>Daily write limit</span>
                <strong>{dailyLimit === null ? 'Unlimited' : `${dailyLimit.toLocaleString()} / day`}</strong>
              </div>
              <div className="wlt-today-row">
                <span>Extra writes today</span>
                <strong className={overageToday > 0 ? 'wlt-today-flag' : ''}>{overageToday.toLocaleString()}</strong>
              </div>
              <div className="wlt-today-row">
                <span>Est. cost so far today</span>
                <strong>${formatUsd(overageCostUsd(overageToday, planId), 3)}</strong>
              </div>
              <button type="button" className="wlt-ghost-link" onClick={() => router.push('/dashboard/plans')}>
                {plan.name} plan — compare plans
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Right column: ledger history ─────────────────────── */}
          <div className="wlt-col wlt-col-wide">
            <div className="wlt-card wlt-ledger-card">
              <h2>Activity</h2>

              {loading ? (
                <div className="wlt-ledger-skeleton" aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="wlt-ledger-skel-row" />
                  ))}
                </div>
              ) : ledger.length === 0 ? (
                <div className="wlt-ledger-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                    <rect x="3" y="7" width="18" height="13" rx="2" />
                    <path d="M3 10h18M8 14h4" />
                    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <p>No activity yet. Add funds to get started — your deposits and any overage charges will show up here.</p>
                </div>
              ) : (
                <>
                  <ul className="wlt-ledger-list">
                    {ledger.map((entry) => (
                      <li key={entry.id} className={`wlt-ledger-row wlt-ledger-${entry.kind}`}>
                        <span className={`wlt-ledger-icon wlt-ledger-icon-${entry.kind}`}>
                          <LedgerIcon kind={entry.kind} />
                        </span>
                        <span className="wlt-ledger-main">
                          <span className="wlt-ledger-label">{ledgerLabel(entry)}</span>
                          <span className="wlt-ledger-date">{formatLedgerDate(entry.createdAt)}</span>
                        </span>
                        <span className={`wlt-ledger-amount${entry.amountMicrocents >= 0 ? ' is-credit' : ' is-debit'}`}>
                          {entry.amountMicrocents >= 0 ? '+' : '−'}${formatUsd(Math.abs(entry.amountMicrocents) / 100_000, 3)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {hasMore && (
                    <button type="button" className="wlt-load-more" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="wlt-toast" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}
    </section>
  );
}
