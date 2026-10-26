'use client';

// components/monetization/MonetizationBalanceCard.tsx
//
// Full-width card below the stat grid, showing the site's earnings
// balance. Always $0.000 right now — there's no ad pool serving real
// impressions yet (see lib/monetization.ts's AD_TYPES comment), so
// this is a real field with a real zero, not a placeholder string.
// Heavier visual weight than the stat tiles (bigger type, gradient
// surface, its own glow) since this is the number site owners will
// care about most once the ad pool ships.
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
