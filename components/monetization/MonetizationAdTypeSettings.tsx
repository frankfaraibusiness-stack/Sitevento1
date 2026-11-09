'use client';

// components/monetization/MonetizationAdTypeSettings.tsx
//
// "Ad types for <site>" section from the supplied mockup — a two-
// column grid of format toggles, each annotated with "about $X per
// 1,000 views", plus a summary bar (estimated eCPM with current
// selection, formats on, max full-screen/popup frequency cap).
//
// Per-format rates come from hooks/useAdCpm.ts, i.e.
// GET /api/ad-cpm — real, dynamic numbers (this site's own country
// mix run through lib/adRates.ts's live tier table), never a fixed
// constant. Toggle state and the write path are unchanged: still
// AD_TYPES (lib/monetization.ts) + useSiteMonetization's setAdFormats.
import { AD_TYPES } from '@/lib/monetization';
import type { AdFormatId } from '@/lib/adPool';
import type { AdCpmFormat } from '@/hooks/useAdCpm';

interface MonetizationAdTypeSettingsProps {
  siteName: string;
  enabled: boolean;
  adFormats: Partial<Record<AdFormatId, boolean>> | undefined;
  cpmFormats: AdCpmFormat[];
  freqCap: number;
  onToggleFormat: (id: AdFormatId) => void;
  onFreqCapChange: (n: number) => void;
}

export function MonetizationAdTypeSettings({
  siteName,
  enabled,
  adFormats,
  cpmFormats,
  freqCap,
  onToggleFormat,
  onFreqCapChange,
}: MonetizationAdTypeSettingsProps) {
  function isOn(id: string): boolean {
    const persisted = adFormats?.[id as AdFormatId];
    if (typeof persisted === 'boolean') return persisted;
    return AD_TYPES.find((t) => t.id === id)?.defaultEnabled ?? false;
  }

  function rateFor(id: string): number {
    const found = cpmFormats.find((f) => f.id === id);
    return found?.estimatedCpmUsd ?? 0;
  }

  const onCount = AD_TYPES.filter((t) => isOn(t.id)).length;
  const estimatedCpm = AD_TYPES.reduce((sum, t) => sum + (enabled && isOn(t.id) ? rateFor(t.id) : 0), 0) / Math.max(onCount, 1);

  return (
    <section aria-labelledby="mon2-types-h">
      <div className="mon2-sp">
        <div>
          <h2 id="mon2-types-h">
            Ad types for <span>{siteName}</span>
          </h2>
          <span className="mon2-mut">Choose which formats this site shows to visitors.</span>
        </div>
        <span className={`mon2-pill${enabled ? '' : ' off'}`}>
          <i />
          <span>{enabled ? 'Ads on' : 'Ads off'}</span>
        </span>
      </div>

      {!enabled && (
        <p className="mon2-off-note">Ads are off for this site. Turn them on in the list above to use these settings.</p>
      )}

      <div className="mon2-set">
        {AD_TYPES.map((t) => {
          const on = isOn(t.id);
          return (
            <div key={t.id} className="mon2-ad" style={enabled ? undefined : { opacity: 0.5 }}>
              <div>
                <b>{t.label}</b>
                <span className="mon2-mut">{t.description}</span>
                <div className="mon2-rate">about ${rateFor(t.id).toFixed(2)} per 1,000 views</div>
              </div>
              <button
                type="button"
                className="mon2-sw"
                role="switch"
                aria-checked={on}
                aria-label={t.label}
                disabled={!enabled}
                onClick={() => onToggleFormat(t.id as AdFormatId)}
              />
            </div>
          );
        })}
      </div>

      <div className="mon2-sum">
        <div>
          <span className="mon2-mut">Estimated eCPM with these formats</span>
          <div className="mon2-num">${(enabled ? estimatedCpm : 0).toFixed(2)}</div>
        </div>
        <div>
          <span className="mon2-mut">Formats switched on</span>
          <div className="mon2-num">
            {enabled ? onCount : 0} of {AD_TYPES.length}
          </div>
        </div>
        <label className="mon2-mut" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          Max full-screen and popup ads per visitor each day
          <select value={freqCap} onChange={(e) => onFreqCapChange(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </label>
      </div>
    </section>
  );
}
