'use client';

// components/advertise/AdvertiseAdList.tsx
//
// This advertiser's own ads (app/api/advertise's 'list-ads' action),
// each with its status, creative summary, budget/stats, and a
// pause/resume control. Empty state matters here since a brand-new
// advertiser always starts with zero ads — the create-ad form below
// is the obvious next step, so the empty state points at it rather
// than showing a bare "no ads" with nothing to do next.
import type { AdDoc, AdStatus } from '@/lib/adPool';

interface AdvertiseAdListProps {
  ads: AdDoc[];
  busy: boolean;
  onPause: (adId: string) => Promise<{ ok: boolean; error?: string }>;
  onResume: (adId: string) => Promise<{ ok: boolean; error?: string }>;
}

const STATUS_LABEL: Record<AdStatus, string> = {
  draft: 'Draft',
  live: 'Live',
  paused: 'Paused',
  out_of_budget: 'Out of budget',
};

function creativeSummary(ad: AdDoc): string {
  const { creative } = ad;
  if (creative.type === 'banner') return creative.headline || 'Banner ad';
  return creative.headline || `${creative.type[0].toUpperCase()}${creative.type.slice(1)} ad`;
}

export function AdvertiseAdList({ ads, busy, onPause, onResume }: AdvertiseAdListProps) {
  return (
    <section className="adv-section">
      <div className="adv-section-head">
        <h2 className="adv-section-title">Your ads</h2>
        <span className="adv-section-count">{ads.length}</span>
      </div>

      {ads.length === 0 ? (
        <p className="adv-row-note">You haven't created an ad yet — use the form below to launch your first one.</p>
      ) : (
        <div className="adv-ad-list">
          {ads.map((ad) => (
            <div key={ad.id} className="adv-ad-row">
              <div className="adv-ad-main">
                <div className="adv-ad-top">
                  <span className={`adv-status-pill adv-status-${ad.status}`}>{STATUS_LABEL[ad.status]}</span>
                  <span className="adv-ad-formats">{ad.budget.formats.join(', ')}</span>
                </div>
                <span className="adv-ad-headline">{creativeSummary(ad)}</span>
                <div className="adv-ad-stats">
                  <span>{ad.stats.impressions.toLocaleString()} impressions</span>
                  <span>{ad.stats.clicks.toLocaleString()} clicks</span>
                  <span>${ad.budget.spentUsd.toFixed(2)} spent</span>
                  {ad.budget.totalCapUsd && <span>${ad.budget.totalCapUsd.toFixed(2)} cap</span>}
                </div>
              </div>
              <div className="adv-ad-actions">
                {ad.status === 'paused' || ad.status === 'out_of_budget' ? (
                  <button type="button" className="ghost-btn live" disabled={busy} onClick={() => onResume(ad.id)}>
                    Resume
                  </button>
                ) : (
                  <button type="button" className="ghost-btn" disabled={busy} onClick={() => onPause(ad.id)}>
                    Pause
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
