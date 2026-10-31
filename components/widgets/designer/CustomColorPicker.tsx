'use client';

// components/widgets/designer/CustomColorPicker.tsx
//
// A from-scratch colour picker — not <input type="color">, which opens
// the OS's own colour sheet with none of the designer's styling.
//
// Renders as a true centered MODAL (via a portal to document.body),
// not an inline popover anchored under the trigger. It used to be an
// absolutely-positioned popover (.wdg-color-pop, `position: absolute;
// top: calc(100% + 6px)`) living directly inside the trigger's own
// wrapper — which put it inside the designer form's own DOM, and that
// form sits inside containers that clip it: .wdg-group has
// `overflow: hidden` (so the popover got cut off against the bottom
// of its field group) and the scrollable form panel itself has
// `overflow-y: auto` (so the popover could also get clipped/scrolled
// away whenever the picker's row wasn't near the top of the panel).
// Any inline/absolute popover is fundamentally at the mercy of every
// ancestor's overflow and stacking context between it and the page —
// a portal + fixed-position backdrop sidesteps all of that the same
// way WidgetStatusPopup/ConfirmPopup already do for every other modal
// in this app (see components/widgets/WidgetStatusPopup.tsx), so this
// reuses that exact pattern: useScrollLock while open, Escape to
// close, click-the-backdrop to close, portal to document.body.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/hooks/useScrollLock';

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
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const safeValue = isValidHex(value) ? value : '#8a5a3c';

  // Portals need a real DOM to render into; this flips true after the
  // first client render so SSR never tries to touch document.body.
  useEffect(() => setMounted(true), []);

  useEffect(() => setHexDraft(value || '#8a5a3c'), [value]);

  // Re-sync the draft hex field to the live value every time the modal
  // opens, so re-opening after an outside change (or after closing
  // without committing a half-typed hex) never shows stale text.
  useEffect(() => {
    if (open) setHexDraft(safeValue);
  }, [open, safeValue]);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open]);

  function commitHex(raw: string) {
    const v = raw.startsWith('#') ? raw : `#${raw}`;
    setHexDraft(v);
    if (isValidHex(v)) onChange(v);
  }

  const modal =
    open &&
    mounted &&
    createPortal(
      <div className="wdg-color-backdrop" role="presentation" onClick={() => setOpen(false)}>
        <div
          ref={cardRef}
          className="wdg-color-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} colour picker`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="wdg-color-modal-head">
            <h3>{label} colour</h3>
            <button type="button" className="wdg-color-modal-close" aria-label="Close" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
          </div>

          <div className="wdg-color-modal-preview" style={{ background: safeValue }} aria-hidden="true" />

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

          <button type="button" className="wdg-color-modal-done" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="wdg-color">
      <button
        type="button"
        className={`wdg-color-trigger${open ? ' is-open' : ''}`}
        aria-label={`${label} colour picker`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="wdg-color-swatch" style={{ background: safeValue }} />
        <span className="wdg-color-hex">{safeValue.toUpperCase()}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="wdg-select-chevron">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {modal}
    </div>
  );
}
