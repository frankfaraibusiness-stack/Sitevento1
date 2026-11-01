'use client';

// components/dashboard/PlanLimitsSection.tsx
//
// The plan-upgrade upsell + token-limit counter the HTML mock didn't
// include (per your note). Rather than reimplementing plan tiers,
// token math, or wallet balance — all real business logic that
// already lives in PlanUsageStrip.tsx, DailyLimitCard.tsx, and
// TokenLedgerCard.tsx — this wraps those three, unchanged, in clean
// individual dashv2-styled cards so they sit visually consistent with
// the rest of the new dashboard. Props mirror exactly what
// DashboardShell.tsx already passes each of them today, so the
// backend-wiring step is a straight copy of that call site.
import type { PlanId } from '@/lib/plans';
import type { TokenUsage } from '@/hooks/useAccountLimits';
import type { WalletSummary } from '@/lib/wallet';
import { PlanUsageStrip } from './PlanUsageStrip';
import { DailyLimitCard } from './DailyLimitCard';
import { TokenLedgerCard } from './TokenLedgerCard';

interface PlanLimitsSectionProps {
  planId: PlanId;
  connectedSitesUsed: number;
  tokenUsage: TokenUsage | null | undefined;
  dailyTokenLimits?: Record<PlanId, number | null> | null;
  walletBalanceUsd?: number;
  wallet: WalletSummary | null | undefined;
  onUpgrade: () => void;
  onOpenWallet: () => void;
}

export function PlanLimitsSection({
  planId,
  connectedSitesUsed,
  tokenUsage,
  dailyTokenLimits,
  walletBalanceUsd,
  wallet,
  onUpgrade,
  onOpenWallet,
}: PlanLimitsSectionProps) {
  return (
    <div className="dashv2-upsell-limits-section">
      <div className="dashv2-upsell-card">
        <PlanUsageStrip planId={planId} used={connectedSitesUsed} onUpgrade={onUpgrade} />
      </div>

      <div className="dashv2-upsell-card">
        <DailyLimitCard
          planId={planId}
          tokenUsage={tokenUsage}
          dailyTokenLimits={dailyTokenLimits}
          walletBalanceUsd={walletBalanceUsd}
          onUpgrade={onUpgrade}
          onOpenWallet={onOpenWallet}
          variant="compact"
        />
      </div>

      <div className="dashv2-upsell-card">
        <TokenLedgerCard wallet={wallet} onOpenWallet={onOpenWallet} variant="compact" />
      </div>
    </div>
  );
}
