'use client';

// components/widgets/designer/CustomSelect.tsx
//
// A from-scratch dropdown — deliberately not a native <select>, which
// on mobile Safari/Chrome hands rendering off to the OS's own sheet
// and can't pick up the designer's styling at all. Opens a floating,
// styled option list positioned under the trigger instead.
import { useEffect, useRef, useState } from 'react';
import type { WidgetFieldOption } from '@/lib/widgets';

interface CustomSelectProps {
  value: string;
  options: WidgetFieldOption[];
  onChange: (v: string) => void;
  label: string;
}

export function CustomSelect({ value, options, onChange, label }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) || options[0];

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

  return (
    <div className="wdg-select" ref={rootRef}>
      <button
        type="button"
        className={`wdg-select-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{current?.label ?? ''}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="wdg-select-chevron">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="wdg-select-list" role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`wdg-select-opt${o.value === value ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.value === value && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="wdg-select-check">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
                <span>{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
