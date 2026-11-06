'use client';

// components/widgets/designer/CustomDateTimePicker.tsx
//
// A from-scratch date + time picker — not <input type="datetime-local">,
// whose calendar/clock UI is entirely OS-rendered and unstyleable. This
// opens a popover with a month-grid calendar and a scrollable hour /
// minute / am-pm wheel, and writes the same "YYYY-MM-DDTHH:mm" string
// WidgetFieldDef's existing `datetime` field type already expects
// (see lib/widgets.ts configFields + CountdownTimerWidget), so no
// change is needed anywhere config is read or saved.
import { useEffect, useMemo, useRef, useState } from 'react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseValue(v: string): { y: number; m: number; d: number; h: number; min: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
  const now = new Date();
  if (!match) {
    return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate(), h: now.getHours(), min: 0 };
  }
  return {
    y: Number(match[1]),
    m: Number(match[2]) - 1,
    d: Number(match[3]),
    h: Number(match[4]),
    min: Number(match[5]),
  };
}

function formatValue(y: number, m: number, d: number, h: number, min: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}T${pad(h)}:${pad(min)}`;
}

export function CustomDateTimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseValue(value), [value]);
  const [viewY, setViewY] = useState(parsed.y);
  const [viewM, setViewM] = useState(parsed.m);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setViewY(parsed.y);
    setViewM(parsed.m);
  }, [parsed.y, parsed.m]);

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

  const daysInView = new Date(viewY, viewM + 1, 0).getDate();
  const firstWeekday = new Date(viewY, viewM, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInView }, (_, i) => i + 1),
  ];

  const hour12 = ((parsed.h + 11) % 12) + 1;
  const isPM = parsed.h >= 12;

  function pickDay(d: number) {
    onChange(formatValue(viewY, viewM, d, parsed.h, parsed.min));
  }
  function setHour12(h12: number) {
    const h24 = (h12 % 12) + (isPM ? 12 : 0);
    onChange(formatValue(parsed.y, parsed.m, parsed.d, h24, parsed.min));
  }
  function setMinute(min: number) {
    onChange(formatValue(parsed.y, parsed.m, parsed.d, parsed.h, min));
  }
  function setPeriod(pm: boolean) {
    const h24 = (hour12 % 12) + (pm ? 12 : 0);
    onChange(formatValue(parsed.y, parsed.m, parsed.d, h24, parsed.min));
  }
  function shiftMonth(delta: number) {
    let ny = viewY;
    let nm = viewM + delta;
    if (nm < 0) { nm = 11; ny -= 1; }
    if (nm > 11) { nm = 0; ny += 1; }
    setViewY(ny);
    setViewM(nm);
  }

  const displayLabel = value
    ? `${MONTH_NAMES[parsed.m].slice(0, 3)} ${parsed.d}, ${parsed.y} · ${pad(hour12)}:${pad(parsed.min)} ${isPM ? 'PM' : 'AM'}`
    : 'Set date & time';

  return (
    <div className="wdg-dt" ref={rootRef}>
      <button
        type="button"
        className={`wdg-dt-trigger${open ? ' is-open' : ''}${!value ? ' is-empty' : ''}`}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="wdg-dt-icon">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span>{displayLabel}</span>
      </button>

      {open && (
        <div className="wdg-dt-pop" role="dialog" aria-label={label}>
          <div className="wdg-dt-cal-head">
            <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span>{MONTH_NAMES[viewM]} {viewY}</span>
            <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>

          <div className="wdg-dt-weekdays">
            {WEEKDAY_LABELS.map((w, i) => <span key={`${w}-${i}`}>{w}</span>)}
          </div>

          <div className="wdg-dt-grid">
            {cells.map((d, i) => {
              if (d === null) return <span key={`blank-${i}`} className="wdg-dt-cell-blank" />;
              const isSelected = d === parsed.d && viewM === parsed.m && viewY === parsed.y;
              return (
                <button
                  key={d}
                  type="button"
                  className={`wdg-dt-cell${isSelected ? ' is-selected' : ''}`}
                  onClick={() => pickDay(d)}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="wdg-dt-time">
            <div className="wdg-dt-wheel" role="group" aria-label="Hour">
              <button type="button" aria-label="Increase hour" onClick={() => setHour12(hour12 === 12 ? 1 : hour12 + 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 15l6-6 6 6" /></svg>
              </button>
              <span>{pad(hour12)}</span>
              <button type="button" aria-label="Decrease hour" onClick={() => setHour12(hour12 === 1 ? 12 : hour12 - 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>
            <span className="wdg-dt-colon">:</span>
            <div className="wdg-dt-wheel" role="group" aria-label="Minute">
              <button type="button" aria-label="Increase minute" onClick={() => setMinute((parsed.min + 5) % 60)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 15l6-6 6 6" /></svg>
              </button>
              <span>{pad(parsed.min)}</span>
              <button type="button" aria-label="Decrease minute" onClick={() => setMinute((parsed.min + 55) % 60)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>
            <div className="wdg-dt-period">
              <button type="button" className={!isPM ? 'is-selected' : ''} onClick={() => setPeriod(false)}>AM</button>
              <button type="button" className={isPM ? 'is-selected' : ''} onClick={() => setPeriod(true)}>PM</button>
            </div>
          </div>

          <button type="button" className="wdg-dt-done" onClick={() => setOpen(false)}>Done</button>
        </div>
      )}
    </div>
  );
}
