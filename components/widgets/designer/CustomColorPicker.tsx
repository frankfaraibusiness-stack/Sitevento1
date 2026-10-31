'use client';

// components/widgets/designer/CustomColorPicker.tsx
//
// A from-scratch colour picker — not <input type="color">, which opens
// the OS's own colour sheet with none of the designer's styling. This
// opens a small styled popover: a curated swatch grid (the palette
// already used across the picker's own card tones, plus the widget
// system's existing default accent) and a hex field for anything else.
import { useEffect, useRef, useState } from 'react';

const SWATCHES = [
  '#8a5a3c', '#1fae63', '#8b5cf6', '#2f8fe0', '#f08b1d',
  '#e8558f', '#19b3a6', '#22201c', '#c6ff3d', '#6b4a34',
  '#d2366f', '#128a80',
];

function isValidHex(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

export function CustomColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(value || '#8a5a3c');
  const rootRef = useRef<HTMLDivElement>(null);
  const safeValue = isValidHex(value) ? value : '#8a5a3c';

  useEffect(() => setHexDraft(value || '#8a5a3c'), [value]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  function commitHex(raw: string) {
    const v = raw.startsWith('#') ? raw : `#${raw}`;
    setHexDraft(v);
    if (isValidHex(v)) onChange(v);
  }

  return (
    <div className="wdg-color" ref={rootRef}>
      <button
        type="button"
        className={`wdg-color-trigger${open ? ' is-open' : ''}`}
        aria-label={`${label} colour picker`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="wdg-color-swatch" style={{ background: safeValue }} />
        <span className="wdg-color-hex">{safeValue.toUpperCase()}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="wdg-select-chevron">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="wdg-color-pop" role="dialog" aria-label={`${label} colour picker`}>
          <div className="wdg-color-grid">
            {SWATCHES.map((sw) => (
              <button
                key={sw}
                type="button"
                className={`wdg-color-dot${sw.toLowerCase() === safeValue.toLowerCase() ? ' is-selected' : ''}`}
                style={{ background: sw }}
                aria-label={sw}
                onClick={() => {
                  onChange(sw);
                  setOpen(false);
                }}
              >
                {sw.toLowerCase() === safeValue.toLowerCase() && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <label className="wdg-color-hexrow">
            <span>#</span>
            <input
              type="text"
              value={hexDraft.replace(/^#/, '')}
              maxLength={6}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              inputMode="text"
              onChange={(e) => commitHex(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
              aria-label="Hex colour value"
            />
          </label>
        </div>
      )}
    </div>
  );
}
