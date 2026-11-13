'use client';

// components/monetization/MonetizationSiteRow.tsx
//
// One row in the "Your sites" list on the new Monetization dashboard
// (MonetizationDashboard.tsx) — mirrors the supplied mockup's .site
// row markup (favicon-letter chip, name + ads-on/off pill, Earned /
// Ad views / eCPM columns, an on/off switch). Real data in, real
// write out: `earningsUsd`/`impressions`/`cpmUsd` come from each
// site's own useMonetizationStats summary (fetched once per site by
// the parent), and the switch calls the real
// POST /api/site-monetization write via onToggle — nothing here is
// simulated client-side state.
interface MonetizationSiteRowProps {
  name: string;
  domain: string;
  color: string;
  enabled: boolean;
  verified: boolean;
  active: boolean;
  earningsUsd: number;
  impressions: number;
  cpmUsd: number | null;
  busy: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

export function MonetizationSiteRow({
  name,
  domain,
  color,
  enabled,
  verified,
  active,
  earningsUsd,
  impressions,
  cpmUsd,
  busy,
  onSelect,
  onToggle,
}: MonetizationSiteRowProps) {
  const earnedLabel = enabled ? `$${formatMoney(earningsUsd)}` : '$0.00';
  const viewsLabel = enabled ? formatCompact(impressions) : '0';
  const cpmLabel = enabled && cpmUsd != null ? `$${formatMoney(cpmUsd)}` : '—';

  return (
    <div
      className={`mon2-site${enabled ? '' : ' dim'}`}
      role="button"
      tabIndex={0}
      aria-current={active}
      aria-label={`Edit ad types for ${name}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="mon2-fav" style={{ background: color }}>
        {name.charAt(0).toUpperCase()}
      </div>
      <div>
        <b>{name}</b>
        <div className="mon2-mut">
          <span className={`mon2-pill sm${enabled ? '' : ' off'}`}>
            <i />
            <span>{enabled ? 'Ads on' : 'Ads off'}</span>
          </span>
          {!verified && <span style={{ marginLeft: 8 }}>Not verified yet</span>}
        </div>
      </div>
      <div className="mon2-v">
        <b>{earnedLabel}</b>
        <span>Earned</span>
      </div>
      <div className="mon2-v">
        <b>{viewsLabel}</b>
        <span>Ad views</span>
      </div>
      <div className="mon2-v">
        <b>{cpmLabel}</b>
        <span>eCPM</span>
      </div>
      <div className="mon2-row-end">
        <button
          type="button"
          className="mon2-sw"
          role="switch"
          aria-checked={enabled}
          aria-label={`Ads on for ${name}`}
          disabled={busy || (!verified && !enabled)}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
      </div>
      <div className="mon2-v m">
        <span>
          {earnedLabel} earned · {viewsLabel} ad views
        </span>
      </div>
    </div>
  );
}

const PALETTE = ['#5b3fd9', '#0f7a66', '#c2477a', '#b9741a', '#2f6fb3', '#9b4d9b'];

export function colorForSite(index: number): string {
  return PALETTE[index % PALETTE.length];
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}
