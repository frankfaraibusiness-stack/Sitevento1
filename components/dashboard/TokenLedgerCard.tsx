'use client';

// components/dashboard/TokenLedgerCard.tsx
//
// Companion card to DailyLimitCard, rendered right beside it in both
// contexts (compact on DashboardShell, full on ProfilePage). Where
// DailyLimitCard is purely about the RESETTING daily allowance (resets
// every UTC midnight, countdown, tone-shifting urgency), this card is
// purely about the PERMANENT token balance: tokens the account already
// owns outright because real wallet money paid for them — see
// lib/wallet.ts's WalletSummary.bankedTokens (already-purchased,
// not-yet-spent overage tokens, lib/serverAuth.ts's
// checkAndIncrementAccountTokens / assertWidgetTokensAllowed) plus
// tokensAffordable (what the remaining dollar balance could still buy
// at the account's current per-bundle rate). Together,
// totalPermanentTokens.
//
// This balance is only ever drawn on once the daily free allowance
// runs out — it's the fallback, not a parallel pool spent alongside
// the daily one — and it NEVER resets or expires on its own: no
// countdown, no midnight rollover, no urgency tone. Deliberately a
// calmer, quieter card than DailyLimitCard for exactly that reason —
// there's nothing ticking here to create urgency about.
//
// Data comes from the same useAccountLimits() poll as DailyLimitCard
// (AccountLimits.wallet, a WalletSummary) — no separate fetch, so this
// can sit right next to DailyLimitCard with zero extra network cost.
import type { WalletSummary } from '@/lib/wallet';

interface TokenLedgerCardProps {
  wallet: WalletSummary | null | undefined;
  onOpenWallet: () => void;
  /** 'compact' for the dashboard strip, 'full' for the profile section. Defaults to 'compact'. */
  variant?: 'compact' | 'full';
}

export function TokenLedgerCard({ wallet, onOpenWallet, variant = 'compact' }: TokenLedgerCardProps) {
  const loading = !wallet;
  const bankedTokens = wallet?.bankedTokens ?? 0;
  const tokensAffordable = wallet?.tokensAffordable ?? 0;
  const totalPermanentTokens = wallet?.totalPermanentTokens ?? 0;
  const balanceUsd = wallet?.balanceUsd ?? 0;
  const hasAnyPermanentTokens = totalPermanentTokens > 0;

  return (
    <div className={`tlc-card tlc-${variant}${loading ? ' is-loading' : ''}`}>
      <div className="tlc-top">
        <span className="tlc-kicker">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <rect x="3" y="7" width="18" height="12" rx="2.5" />
            <path d="M3 11h18" />
            <circle cx="7.5" cy="15" r="1" fill="currentColor" stroke="none" />
          </svg>
          Token ledger
        </span>
        {variant === 'full' && <h2>Your permanent balance</h2>}
        <span className="tlc-never-pill">Never expires</span>
      </div>

      {loading ? (
        <div className="tlc-skeleton" aria-hidden="true">
          <div className="tlc-skeleton-line" />
          <div className="tlc-skeleton-line tlc-skeleton-narrow" />
        </div>
      ) : (
        <>
          <div className="tlc-counter">
            <span className="tlc-counter-num">{totalPermanentTokens.toLocaleString()}</span>
            <span className="tlc-counter-label">tokens you own</span>
          </div>

          <p className="tlc-explainer">
            {hasAnyPermanentTokens
              ? 'Used only once your daily allowance runs out. Paid for with your own money, so it stays yours — no countdown, no reset.'
              : "Empty right now. Add wallet funds and it's yours permanently — only spent once your daily allowance runs out, and it never resets."}
          </p>

          {(bankedTokens > 0 || tokensAffordable > 0) && (
            <div className="tlc-breakdown">
              {bankedTokens > 0 && (
                <div className="tlc-breakdown-row">
                  <span className="tlc-breakdown-label">Already purchased</span>
                  <span className="tlc-breakdown-value">{bankedTokens.toLocaleString()} tokens</span>
                </div>
              )}
              {tokensAffordable > 0 && (
                <div className="tlc-breakdown-row">
                  <span className="tlc-breakdown-label">${balanceUsd.toFixed(2)} wallet balance could buy</span>
                  <span className="tlc-breakdown-value">{tokensAffordable.toLocaleString()} more</span>
                </div>
              )}
            </div>
          )}

          <button type="button" className="tlc-wallet-link" onClick={onOpenWallet}>
            <span>{hasAnyPermanentTokens ? 'Manage wallet' : 'Add wallet funds'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
