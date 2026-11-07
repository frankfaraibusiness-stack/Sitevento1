'use client';

// components/widgets/designer/PrizeListField.tsx
//
// Editor for the 'prizeList' field type (lib/widgets.ts) — currently
// only used by spin-reward's `prizes` config field. Each row is one
// wheel prize: a label shown on the wheel, a discount code shown on
// win, and a relative odds weight. Replaces the old hardcoded
// DEFAULT_PRIZES array in SpinRewardWidget.tsx — a site owner now
// edits their own prizes/codes here instead of that ever being a
// code change.
//
// Kept intentionally simple (no drag-reorder) since spin-reward wheels
// read best with a small prize count (3-6) — reordering isn't worth
// the added interaction surface for a list this short.
import { useId } from 'react';
import type { Prize } from '@/lib/widgets';

const MAX_PRIZES = 8;
const MIN_PRIZES = 2;

function emptyPrize(): Prize {
  return { label: '', code: '', weight: 10 };
}

export function PrizeListField({ value, onChange }: { value: Prize[]; onChange: (v: Prize[]) => void }) {
  const idBase = useId();
  const prizes = value.length > 0 ? value : [emptyPrize(), emptyPrize()];
  const total = prizes.reduce((s, p) => s + (Number(p.weight) || 0), 0) || 1;

  function updatePrize(i: number, patch: Partial<Prize>) {
    onChange(prizes.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function removePrize(i: number) {
    onChange(prizes.filter((_, idx) => idx !== i));
  }
  function addPrize() {
    onChange([...prizes, emptyPrize()]);
  }

  return (
    <div className="wdg-prizes">
      {prizes.map((p, i) => {
        const pct = Math.round(((Number(p.weight) || 0) / total) * 100);
        return (
          <div key={i} className="wdg-prize-row">
            <div className="wdg-prize-row-top">
              <span className="wdg-prize-index">{i + 1}</span>
              <input
                className="wdg-input wdg-prize-label"
                value={p.label}
                maxLength={30}
                placeholder="Prize shown on the wheel — e.g. 10% off"
                aria-label={`Prize ${i + 1} label`}
                onChange={(e) => updatePrize(i, { label: e.target.value })}
              />
              <button
                type="button"
                className="wdg-prize-remove"
                aria-label={`Remove prize ${i + 1}`}
                disabled={prizes.length <= MIN_PRIZES}
                onClick={() => removePrize(i)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="wdg-prize-row-bottom">
              <label className="wdg-prize-field" htmlFor={`${idBase}-code-${i}`}>
                <span>Discount code</span>
                <input
                  id={`${idBase}-code-${i}`}
                  className="wdg-input wdg-prize-code"
                  value={p.code}
                  maxLength={24}
                  spellCheck={false}
                  autoCapitalize="characters"
                  placeholder="SPIN10"
                  onChange={(e) => updatePrize(i, { code: e.target.value.toUpperCase() })}
                />
              </label>
              <label className="wdg-prize-field wdg-prize-field-weight" htmlFor={`${idBase}-weight-${i}`}>
                <span>Odds weight</span>
                <input
                  id={`${idBase}-weight-${i}`}
                  className="wdg-input"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={p.weight}
                  onChange={(e) => updatePrize(i, { weight: Math.max(1, Number(e.target.value) || 1) })}
                />
              </label>
              <span className="wdg-prize-pct" title="Chance a visitor lands on this prize">
                {pct}%
              </span>
            </div>
          </div>
        );
      })}

      {prizes.length < MAX_PRIZES && (
        <button type="button" className="wdg-prize-add" onClick={addPrize}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add prize
        </button>
      )}
    </div>
  );
}
