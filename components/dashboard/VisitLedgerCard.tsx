'use client';

// components/dashboard/VisitLedgerCard.tsx
//
// Companion card to VisitUsageCard, rendered right beside it in both
// contexts (compact on DashboardShell, full on ProfilePage) — the
// visit-model counterpart to TokenLedgerCard. Where VisitUsageCard is
// purely about the RESETTING monthly allowance (resets every UTC month
// start, countdown, tone-shifting urgency), this card is purely about
// the PERMANENT overage-visit balance: visits the account already owns
// outright because real wallet money paid for them — see
// lib/wallet.ts's VisitWalletSummary.bankedVisits (already-purchased,
// not-yet-spent overage visits, lib/serverAuth.ts's
// checkAndIncrementAccountVisits / assertWidgetVisitsAllowed) plus
// visitsAffordable (what the remaining dollar balance could still buy
// at the flat $0.10-per-1,000-visits rate). Together,
// totalPermanentVisits.
//
// This balance is only ever drawn on once the monthly free allowance
// runs out — it's the fallback, not a parallel pool spent alongside
// the monthly one — and it NEVER resets or expires on its own: no
// countdown, no month-start rollover, no urgency tone. Deliberately a
// calmer, quieter card than VisitUsageCard for exactly that reason —
// there's nothing ticking here to create urgency about.
//
// Data comes from the same useAccountLimits() poll as VisitUsageCard
// (AccountLimits.visitWallet, a VisitWalletSummary) — no separate
// fetch, so this can sit right next to VisitUsageCard with zero extra
// network cost.
import type { VisitWalletSummary } from '@/lib/wallet';

interface VisitLedgerCardProps {
  visitWallet: VisitWalletSummary | null | undefined;
  onOpenWallet: () => void;
  /** 'compact' for the dashboard strip, 'full' for the profile section. Defaults to 'compact'. */
  variant?: 'compact' | 'full';
}

export function VisitLedgerCard({ visitWallet, onOpenWallet, variant = 'compact' }: VisitLedgerCardProps) {
  const loading = !visitWallet;
  const bankedVisits = visitWallet?.bankedVisits ?? 0;
  const visitsAffordable = visitWallet?.visitsAffordable ?? 0;
  const totalPermanentVisits = visitWallet?.totalPermanentVisits ?? 0;
  const balanceUsd = visitWallet?.balanceUsd ?? 0;
  const hasAnyPermanentVisits = totalPermanentVisits > 0;

  return (
    <div className={`vlc-card vlc-${variant}${loading ? ' is-loading' : ''}`}>
      <div className="vlc-top">
        <span className="vlc-kicker">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <rect x="3" y="7" width="18" height="12" rx="2.5" />
            <path d="M3 11h18" />
            <circle cx="7.5" cy="15" r="1" fill="currentColor" stroke="none" />
          </svg>
          Visit ledger
        </span>
        {variant === 'full' && <h2>Your permanent balance</h2>}
        <span className="vlc-never-pill">Never expires</span>
      </div>

      {loading ? (
        <div className="vlc-skeleton" aria-hidden="true">
          <div className="vlc-skeleton-line" />
          <div className="vlc-skeleton-line vlc-skeleton-narrow" />
        </div>
      ) : (
        <>
          <div className="vlc-counter">
            <span className="vlc-counter-num">{totalPermanentVisits.toLocaleString()}</span>
            <span className="vlc-counter-label">visits you own</span>
          </div>

          <p className="vlc-explainer">
            {hasAnyPermanentVisits
              ? "Used only once your monthly allowance runs out. Paid for with your own money, so it stays yours — no countdown, no reset."
              : "Empty right now. Add wallet funds and it's yours permanently — only spent once your monthly allowance runs out, and it never resets."}
          </p>

          {(bankedVisits > 0 || visitsAffordable > 0) && (
            <div className="vlc-breakdown">
              {bankedVisits > 0 && (
                <div className="vlc-breakdown-row">
                  <span className="vlc-breakdown-label">Already purchased</span>
                  <span className="vlc-breakdown-value">{bankedVisits.toLocaleString()} visits</span>
                </div>
              )}
              {visitsAffordable > 0 && (
                <div className="vlc-breakdown-row">
                  <span className="vlc-breakdown-label">${balanceUsd.toFixed(2)} wallet balance could buy</span>
                  <span className="vlc-breakdown-value">{visitsAffordable.toLocaleString()} more</span>
                </div>
              )}
            </div>
          )}

          <button type="button" className="vlc-wallet-link" onClick={onOpenWallet}>
            <span>{hasAnyPermanentVisits ? 'Manage wallet' : 'Add wallet funds'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
