'use client';

// components/advertise/AdvertiseBillingPanel.tsx
//
// Balance + top-up panel, first thing shown on /dashboard/advertise —
// an advertiser needs to know (and fund) their prepaid balance before
// anything about creating an ad matters (see lib/adPool.ts's
// AdvertiserBillingDoc: a $0-balance ad is created but immediately
// 'out_of_budget', so funding genuinely comes first in the flow).
//
// No real payment provider is wired up (see app/api/advertise/
// route.ts's header) — 'top-up' is a direct prepaid-ledger
// adjustment, so this is a plain amount input + button, not a card
// form.
import { useState } from 'react';

interface AdvertiseBillingPanelProps {
  balanceUsd: number;
  busy: boolean;
  onTopUp: (amountUsd: number) => Promise<{ ok: boolean; error?: string }>;
}

const QUICK_AMOUNTS = [25, 50, 100];

export function AdvertiseBillingPanel({ balanceUsd, busy, onTopUp }: AdvertiseBillingPanelProps) {
  const [amount, setAmount] = useState('25');
  const [error, setError] = useState<string | null>(null);
  const [justTopped, setJustTopped] = useState(false);

  async function handleTopUp() {
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError('Enter an amount of at least $1.');
      return;
    }
    const result = await onTopUp(parsed);
    if (result.ok) {
      setJustTopped(true);
      setTimeout(() => setJustTopped(false), 2200);
    } else {
      setError(result.error || 'Something went wrong adding funds.');
    }
  }

  return (
    <div className="adv-balance-card">
      <div className="adv-balance-glow" aria-hidden="true" />
      <div className="adv-balance-main">
        <span className="adv-balance-label">Prepaid balance</span>
        <span className="adv-balance-num">${balanceUsd.toFixed(2)}</span>
        <span className="adv-balance-note">Funds your ads' CPM/CPC spend as they serve across the network.</span>
      </div>
      <div className="adv-balance-side">
        <div className="adv-topup-row">
          <span className="adv-topup-dollar">$</span>
          <input
            type="number"
            min={1}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="adv-topup-input"
            aria-label="Top-up amount in USD"
          />
          <button type="button" className="ghost-btn live" disabled={busy} onClick={handleTopUp}>
            {busy ? 'Adding…' : 'Add funds'}
          </button>
        </div>
        <div className="adv-quick-amounts">
          {QUICK_AMOUNTS.map((v) => (
            <button key={v} type="button" className="adv-quick-pill" onClick={() => setAmount(String(v))}>
              ${v}
            </button>
          ))}
        </div>
        {error && <span className="adv-form-error">{error}</span>}
        {justTopped && !error && <span className="adv-saved-note">Balance updated</span>}
      </div>
    </div>
  );
}
