'use client';

// components/analytics/AnalyticsRangePicker.tsx
//
// Period control for the analytics header: quick chips (7D / 30D / ...), a
// date button, and a full calendar popover with a presets rail and a
// "compare to previous period" toggle. On phones the popover becomes a
// bottom sheet (portalled into .anx so no ancestor's blur/transform can
// break its fixed positioning).
//
// Design phase: it only reports the chosen range up to the page, nothing is
// fetched from it yet.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/hooks/useScrollLock';
import {
  PRESET_LABELS,
  PRESET_ORDER,
  QUICK_CHIPS,
  WEEKDAYS,
  addMonths,
  daysBetween,
  formatRange,
  isSameDay,
  monthCells,
  monthTitle,
  presetRange,
  previousWindow,
  rangeHeadline,
  startOfDay,
  startOfMonth,
  type PresetId,
  type RangeSel,
} from './analyticsUtils';
import { IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight } from './AnalyticsIcons';

interface Props {
  value: RangeSel;
  compare: boolean;
  onChange: (range: RangeSel, compare: boolean) => void;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, [query]);
  return matches;
}

/* ── One month of the calendar ─────────────────────────────────── */
interface MonthProps {
  month: Date;
  today: Date;
  start: Date | null;
  end: Date | null;
  onPick: (d: Date) => void;
  onHover: (d: Date | null) => void;
}

function MonthGrid({ month, today, start, end, onPick, onHover }: MonthProps) {
  const cells = monthCells(month);
  return (
    <div className="anx-cal-grid" role="group" aria-label={monthTitle(month)} onMouseLeave={() => onHover(null)}>
      {WEEKDAYS.map((w) => (
        <span key={w} className="anx-cal-dow" aria-hidden="true">
          {w}
        </span>
      ))}
      {cells.map((d, i) => {
        if (!d) return <span key={`b${i}`} className="anx-day is-blank" aria-hidden="true" />;
        const future = d.getTime() > today.getTime();
        const isStart = isSameDay(d, start);
        const isEnd = isSameDay(d, end);
        const inside = !!start && !!end && d.getTime() > start.getTime() && d.getTime() < end.getTime();
        const col = i % 7;
        const cls = ['anx-day'];
        if (isSameDay(d, today)) cls.push('is-today');
        if (future) cls.push('is-future');
        if (isStart || isEnd) cls.push('is-edge');
        if (isStart && isEnd) cls.push('is-single');
        else if (isStart && end) cls.push('is-start');
        else if (isEnd && start) cls.push('is-end');
        if (inside) cls.push('is-in');
        if (col === 0) cls.push('col-first');
        if (col === 6) cls.push('col-last');
        return (
          <button
            key={d.getDate()}
            type="button"
            className={cls.join(' ')}
            disabled={future}
            aria-pressed={isStart || isEnd || inside}
            aria-label={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            onClick={() => onPick(d)}
            onMouseEnter={() => onHover(d)}
          >
            <span>{d.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Picker ────────────────────────────────────────────────────── */
export function AnalyticsRangePicker({ value, compare, onChange }: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const isSheet = useMediaQuery('(max-width: 699px)');

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Draft state lives only while the popover is open.
  const [preset, setPreset] = useState<RangeSel['preset']>(value.preset);
  const [from, setFrom] = useState<Date | null>(value.from);
  const [to, setTo] = useState<Date | null>(value.to);
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [hover, setHover] = useState<Date | null>(null);
  const [view, setView] = useState<Date>(() => startOfMonth(value.to));
  const [draftCompare, setDraftCompare] = useState(compare);

  useScrollLock(open && isSheet);

  useEffect(() => {
    setPortalTarget((rootRef.current?.closest('.anx') as HTMLElement | null) ?? null);
  }, []);

  const openPicker = useCallback(() => {
    setPreset(value.preset);
    setFrom(value.from);
    setTo(value.to);
    setAwaitingEnd(false);
    setHover(null);
    setView(startOfMonth(value.to));
    setDraftCompare(compare);
    setOpen(true);
  }, [value, compare]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      // The sheet is portalled out of rootRef; it handles its own backdrop.
      if ((t as HTMLElement).closest?.('.anx-sheet-layer')) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  function applyPreset(id: PresetId) {
    const r = presetRange(id);
    setPreset(r.preset);
    setFrom(r.from);
    setTo(r.to);
    setAwaitingEnd(false);
    setView(startOfMonth(r.to));
    if (id === 'all') setDraftCompare(false);
  }

  function pick(d: Date) {
    setPreset('custom');
    if (!awaitingEnd || !from) {
      setFrom(d);
      setTo(null);
      setAwaitingEnd(true);
      return;
    }
    if (d.getTime() < from.getTime()) {
      setTo(from);
      setFrom(d);
    } else {
      setTo(d);
    }
    setAwaitingEnd(false);
    setHover(null);
  }

  // While picking the second date, preview the span under the cursor.
  let shownStart = from;
  let shownEnd = to;
  if (awaitingEnd && from) {
    const h = hover ?? from;
    shownStart = h.getTime() < from.getTime() ? h : from;
    shownEnd = h.getTime() < from.getTime() ? from : h;
  }

  const isAll = preset === 'all';
  const canApply = isAll || (!!from && !!to);
  const canCompare = !isAll;

  function apply() {
    if (!canApply || !to) return;
    onChange({ preset, from: isAll ? null : from, to }, canCompare && draftCompare);
    close();
  }

  const nextDisabled = view.getTime() >= startOfMonth(today).getTime();
  const draftLabel = isAll ? 'All time' : from && to ? formatRange(from, to) : from ? `${formatRange(from, from)} → pick an end date` : 'Pick a start date';
  const draftDays = !isAll && from && to ? daysBetween(from, to) : null;

  const prev = previousWindow(value);
  const nowLabel = formatRange(value.from, value.to);

  const popover = (
    <div className={isSheet ? 'anx-pop is-sheet' : 'anx-pop'} role="dialog" aria-label="Choose a date range">
      <span className="anx-sheet-handle" aria-hidden="true" />

      <div className="anx-pop-top">
        <div className="anx-pop-sum">
          <span>Selected</span>
          <strong>{draftLabel}</strong>
        </div>
        {draftDays !== null && <em className="anx-pop-days">{draftDays} {draftDays === 1 ? 'day' : 'days'}</em>}
      </div>

      {/* Phones / small tablets: presets as a scrolling chip row. */}
      <div className="anx-pop-chips" role="group" aria-label="Quick ranges">
        {PRESET_ORDER.map((id) => (
          <button key={id} type="button" className={preset === id ? 'anx-pchip is-on' : 'anx-pchip'} onClick={() => applyPreset(id)}>
            {PRESET_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="anx-pop-body">
        <div className="anx-rail" role="group" aria-label="Quick ranges">
          {PRESET_ORDER.map((id) => (
            <button key={id} type="button" className={preset === id ? 'anx-rail-item is-on' : 'anx-rail-item'} onClick={() => applyPreset(id)}>
              {PRESET_LABELS[id]}
            </button>
          ))}
        </div>

        <div className="anx-cals">
          <div className="anx-cal anx-cal-left">
            <div className="anx-cal-head">
              <button type="button" className="anx-nav" aria-label="Previous month" onClick={() => setView((v) => addMonths(v, -1))}>
                <IconChevronLeft />
              </button>
              <strong>{monthTitle(addMonths(view, -1))}</strong>
              <span className="anx-nav is-ghost" aria-hidden="true" />
            </div>
            <MonthGrid month={addMonths(view, -1)} today={today} start={shownStart} end={shownEnd} onPick={pick} onHover={setHover} />
          </div>

          <div className="anx-cal anx-cal-right">
            <div className="anx-cal-head">
              <button type="button" className="anx-nav is-mobile-only" aria-label="Previous month" onClick={() => setView((v) => addMonths(v, -1))}>
                <IconChevronLeft />
              </button>
              <span className="anx-nav is-ghost is-desktop-only" aria-hidden="true" />
              <strong>{monthTitle(view)}</strong>
              <button
                type="button"
                className="anx-nav"
                aria-label="Next month"
                disabled={nextDisabled}
                onClick={() => setView((v) => addMonths(v, 1))}
              >
                <IconChevronRight />
              </button>
            </div>
            <MonthGrid month={view} today={today} start={shownStart} end={shownEnd} onPick={pick} onHover={setHover} />
          </div>
        </div>
      </div>

      <div className="anx-pop-foot">
        <button
          type="button"
          role="switch"
          aria-checked={canCompare && draftCompare}
          disabled={!canCompare}
          className={canCompare && draftCompare ? 'anx-toggle is-on' : 'anx-toggle'}
          onClick={() => setDraftCompare((c) => !c)}
        >
          <span className="anx-toggle-track" aria-hidden="true">
            <i />
          </span>
          <span className="anx-toggle-text">
            Compare to previous period
            <small>{canCompare ? 'See growth against the window just before' : 'Not available for all time'}</small>
          </span>
        </button>
        <div className="anx-pop-actions">
          <button type="button" className="anx-btn is-ghost" onClick={close}>
            Cancel
          </button>
          <button type="button" className="anx-btn is-primary" disabled={!canApply} onClick={apply}>
            Apply range
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="anx-range" ref={rootRef}>
      <div className="anx-chips" role="radiogroup" aria-label="Quick period">
        {QUICK_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value.preset === c.id}
            className={value.preset === c.id ? 'anx-chip is-on' : 'anx-chip'}
            onClick={() => onChange(presetRange(c.id), c.id === 'all' ? false : compare)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={open ? 'anx-datebtn is-open' : 'anx-datebtn'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openPicker())}
      >
        <span className="anx-datebtn-ico" aria-hidden="true">
          <IconCalendar />
        </span>
        <span className="anx-datebtn-text">
          <small>{rangeHeadline(value)}</small>
          <strong>{nowLabel}</strong>
        </span>
        <IconChevronDown className="anx-datebtn-chev" />
      </button>

      {compare && prev && (
        <p className="anx-compare-note">
          Comparing with <b>{formatRange(prev.from, prev.to)}</b>
        </p>
      )}

      {open &&
        (isSheet ? (
          portalTarget &&
          createPortal(
            <div className="anx-sheet-layer">
              <div className="anx-sheet-backdrop" onClick={close} />
              {popover}
            </div>,
            portalTarget
          )
        ) : (
          popover
        ))}
    </div>
  );
}
