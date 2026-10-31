'use client';

// components/monetization/MonetizationBalanceCard.tsx
//
// Full-width card below the stat grid, showing the site's earnings
// balance. `summary.balanceUsd` is real, lifetime-accumulated
// earnings from hooks/useMonetizationStats.ts (every adEarnings day
// doc ever recorded, not period-scoped — see that hook's header
// comment on why) — it reads $0.000 until the site's embed script
// (public/sitevento.js) actually serves and tracks a billed
// impression or click, same as any other real, freshly-created
// balance. "Request payout" stays disabled: there's no payout rail
// built yet (no bank/PayPal/Stripe Connect flow anywhere in this
// codebase), so the button is honest about not being wired up rather
// than appearing clickable and doing nothing. Heavier visual weight
// than the stat tiles (bigger type, gradient surface, its own glow)
// since this is the number site owners will care about most.
import type { MonetizationSummary } from '@/lib/monetization-stats';

interface MonetizationBalanceCardProps {
  summary: MonetizationSummary;
}

export function MonetizationBalanceCard({ summary }: MonetizationBalanceCardProps) {
  return (
    <div className="mon-balance-card">
      <div className="mon-balance-glow" aria-hidden="true" />
      <div className="mon-balance-main">
        <span className="mon-balance-label">Available balance</span>
        <span className="mon-balance-num">${summary.balanceUsd.toFixed(3)}</span>
        <span className="mon-balance-note">{summary.nextPayoutDate}</span>
      </div>
      <div className="mon-balance-side">
        <div className="mon-balance-stat">
          <span className="mon-balance-stat-label">Pending this period</span>
          <span className="mon-balance-stat-num">${summary.pendingPayoutUsd.toFixed(3)}</span>
        </div>
        <button type="button" className="mon-balance-cta" disabled>
          Request payout
        </button>
      </div>
    </div>
  );
}
