'use client';

// components/analytics/AnalyticsDataSwitch.tsx
//
// Two-state sliding switch: the connected website's real data vs. sample
// data (for demos / empty accounts). Visual only for now — the parent owns
// the state and nothing downstream reads it yet.
import { IconSparkle } from './AnalyticsIcons';

export type DataMode = 'live' | 'sample';

interface Props {
  mode: DataMode;
  onChange: (mode: DataMode) => void;
  /** False when there is no verified site to pull real data from. */
  liveAvailable: boolean;
}

export function AnalyticsDataSwitch({ mode, onChange, liveAvailable }: Props) {
  return (
    <div className="anx-seg" role="radiogroup" aria-label="Data source" data-value={mode}>
      <span className="anx-seg-thumb" aria-hidden="true" />
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'live'}
        className="anx-seg-btn is-live"
        disabled={!liveAvailable}
        title={liveAvailable ? 'Show real data from your website' : 'Connect and verify a site to see real data'}
        onClick={() => onChange('live')}
      >
        <i className="anx-livedot" aria-hidden="true" />
        Real data
      </button>
      <button type="button" role="radio" aria-checked={mode === 'sample'} className="anx-seg-btn is-sample" onClick={() => onChange('sample')}>
        <IconSparkle aria-hidden="true" />
        Sample
      </button>
    </div>
  );
}
