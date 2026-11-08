'use client';

// components/monetization/MonetizationBalanceCard.tsx
//
// Full-width card below the stat grid, showing the site's lifetime
// earnings balance. `summary.balanceUsd` is real, lifetime-
// accumulated earnings from hooks/useMonetizationStats.ts — it reads
// $0.000 until the site's embed script actually serves and tracks a
// billed impression or click. "Request payout" stays disabled: no
// payout rail is built yet, so the button stays honest about not
// being wired up. `enabled` only changes the small note under the
// balance (nothing is hidden when monetization is off — a balance
// already earned doesn't disappear just because ads paused).
import type { MonetizationSummary } from '@/lib/monetization-stats';

interface MonetizationBalanceCardProps {
  summary: MonetizationSummary;
  enabled: boolean;
}

export function MonetizationBalanceCard({ summary, enabled }: MonetizationBalanceCardProps) {
  const progressPct = Math.min(100, (summary.balanceUsd / 25) * 100);

  return (
    <div className="mon-balance-card">
      <div className="mon-balance-glow" aria-hidden="true" />
      <div className="mon-balance-main">
        <span className="mon-balance-label">Available balance</span>
        <span className="mon-balance-num">${summary.balanceUsd.toFixed(3)}</span>
        <div className="mon-balance-progress" role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="mon-balance-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="mon-balance-note">
          {summary.nextPayoutDate}
          {!enabled && ' · ads are currently off'}
        </span>
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
