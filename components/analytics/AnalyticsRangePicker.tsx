'use client';

// components/analytics/AnalyticsRangePicker.tsx
//
// Period control for the analytics header: quick chips (7D / 30D / ...), a
// date button, and a full calendar popover with a presets rail and a
// "compare to previous period" toggle. On phones the popover becomes a
// bottom sheet (portalled into .anx so no ancestor's blur/transform can
// break its fixed positioning).
//
// It reports the chosen range up to AnalyticsPage, which turns it into the
// real query window (see AnalyticsDataContext). What the picker itself knows:
//   • plan limits — periods reaching further back than the plan's history
//     are locked (chips, presets, calendar days), and so is "compare" when
//     the previous window would fall outside it;
//   • the day the site was connected — earlier calendar days are disabled
//     (there can't be data), and "All time" shows its real start date.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useScrollLock } from '@/hooks/useScrollLock';
import type { PlanLimits } from '@/lib/plans';
import {
  PRESET_LABELS,
  PRESET_ORDER,
  QUICK_CHIPS,
  WEEKDAYS,
  addMonths,
  daysBetween,
  earliestAllowedDay,
  formatRange,
  isCompareAllowed,
  isSelAllowed,
  lockHint,
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
import { IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight, IconLock } from './AnalyticsIcons';

interface Props {
  value: RangeSel;
  compare: boolean;
  onChange: (range: RangeSel, compare: boolean) => void;
  /** The viewer's plan; null/undefined = nothing locked (still loading, or unreadable). */
  limits?: PlanLimits | null;
  /** When the site was connected — start of "All time" and the earliest pickable day. */
  siteStart?: Date | null;
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
  /** Days before this are unavailable (site not connected yet / outside plan history). */
  min: Date | null;
  start: Date | null;
  end: Date | null;
  onPick: (d: Date) => void;
  onHover: (d: Date | null) => void;
}

function MonthGrid({ month, today, min, start, end, onPick, onHover }: MonthProps) {
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
        const tooOld = !!min && d.getTime() < min.getTime();
        const isStart = isSameDay(d, start);
        const isEnd = isSameDay(d, end);
        const inside = !!start && !!end && d.getTime() > start.getTime() && d.getTime() < end.getTime();
        const col = i % 7;
        const cls = ['anx-day'];
        if (isSameDay(d, today)) cls.push('is-today');
        if (future) cls.push('is-future');
        else if (tooOld) cls.push('is-out');
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
            disabled={future || tooOld}
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
export function AnalyticsRangePicker({ value, compare, onChange, limits = null, siteStart = null }: Props) {
  const dayStr = new Date().toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => startOfDay(new Date()), [dayStr]);
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

  const [hint, setHint] = useState<string | null>(null);

  useScrollLock(open && isSheet);

  // Earliest day the calendar lets you pick: the later of "site connected"
  // and the plan's history window.
  const minDay = useMemo(() => {
    const a = siteStart ? startOfDay(siteStart) : null;
    const b = earliestAllowedDay(limits, today);
    if (a && b) return a.getTime() > b.getTime() ? a : b;
    return a ?? b;
  }, [siteStart, limits, today]);

  const presetLocked = useCallback((id: PresetId) => !isSelAllowed(limits, presetRange(id), today), [limits, today]);

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
    setHint(null);
    setOpen(true);
  }, [value, compare]);

  const close = useCallback(() => {
    setOpen(false);
    setHint(null);
  }, []);

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
    if (presetLocked(id)) {
      setHint(lockHint(limits));
      return;
    }
    setHint(null);
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
  // "All time" has no window before it; a limited plan can't compare into
  // history it doesn't keep.
  const draftSel: RangeSel | null = isAll ? null : from && to ? { preset, from, to } : null;
  const compareLocked = !!draftSel && !isCompareAllowed(limits, draftSel, today);
  const canCompare = !isAll && !compareLocked;

  function apply() {
    if (!canApply || !to) return;
    onChange({ preset, from: isAll ? null : from, to }, canCompare && draftCompare);
    close();
  }

  const nextDisabled = view.getTime() >= startOfMonth(today).getTime();
  // Left calendar shows view-1: stop paging back once it reaches the earliest pickable month.
  const prevDisabled = !!minDay && addMonths(view, -1).getTime() <= startOfMonth(minDay).getTime();
  // "All time" = from the day the site was connected (or just "All time" if unknown).
  const allLabel = siteStart ? formatRange(startOfDay(siteStart), today) : 'All time';
  const draftLabel = isAll ? allLabel : from && to ? formatRange(from, to) : from ? `${formatRange(from, from)} → pick an end date` : 'Pick a start date';
  const draftDays = isAll ? (siteStart ? daysBetween(siteStart, today) : null) : from && to ? daysBetween(from, to) : null;

  const prev = previousWindow(value);
  const nowLabel = value.from ? formatRange(value.from, value.to) : allLabel;

  const hintNode = hint ? (
    <p className="anx-hint" role="status">
      <IconLock aria-hidden="true" />
      <span>
        {hint}{' '}
        <Link href="/dashboard/plans" className="anx-hint-link">
          See plans
        </Link>
      </span>
    </p>
  ) : null;

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

      {hintNode}

      {/* Phones / small tablets: presets as a scrolling chip row. */}
      <div className="anx-pop-chips" role="group" aria-label="Quick ranges">
        {PRESET_ORDER.map((id) => {
          const locked = presetLocked(id);
          return (
            <button
              key={id}
              type="button"
              aria-disabled={locked}
              className={preset === id ? 'anx-pchip is-on' : locked ? 'anx-pchip is-locked' : 'anx-pchip'}
              onClick={() => applyPreset(id)}
            >
              {locked && <IconLock className="anx-lock" />}
              {PRESET_LABELS[id]}
            </button>
          );
        })}
      </div>

      <div className="anx-pop-body">
        <div className="anx-rail" role="group" aria-label="Quick ranges">
          {PRESET_ORDER.map((id) => {
            const locked = presetLocked(id);
            return (
              <button
                key={id}
                type="button"
                aria-disabled={locked}
                className={preset === id ? 'anx-rail-item is-on' : locked ? 'anx-rail-item is-locked' : 'anx-rail-item'}
                onClick={() => applyPreset(id)}
              >
                {PRESET_LABELS[id]}
                {locked && <IconLock className="anx-lock" />}
              </button>
            );
          })}
        </div>

        <div className="anx-cals">
          <div className="anx-cal anx-cal-left">
            <div className="anx-cal-head">
              <button type="button" className="anx-nav" aria-label="Previous month" disabled={prevDisabled} onClick={() => setView((v) => addMonths(v, -1))}>
                <IconChevronLeft />
              </button>
              <strong>{monthTitle(addMonths(view, -1))}</strong>
              <span className="anx-nav is-ghost" aria-hidden="true" />
            </div>
            <MonthGrid month={addMonths(view, -1)} today={today} min={minDay} start={shownStart} end={shownEnd} onPick={pick} onHover={setHover} />
          </div>

          <div className="anx-cal anx-cal-right">
            <div className="anx-cal-head">
              <button type="button" className="anx-nav is-mobile-only" aria-label="Previous month" disabled={prevDisabled} onClick={() => setView((v) => addMonths(v, -1))}>
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
            <MonthGrid month={view} today={today} min={minDay} start={shownStart} end={shownEnd} onPick={pick} onHover={setHover} />
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
            <small>
              {isAll ? 'Not available for all time' : compareLocked ? 'Your plan’s history doesn’t reach that far back' : 'See growth against the window just before'}
            </small>
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
        {QUICK_CHIPS.map((c) => {
          const locked = presetLocked(c.id);
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={value.preset === c.id}
              aria-disabled={locked}
              title={locked ? lockHint(limits) : undefined}
              className={value.preset === c.id ? 'anx-chip is-on' : locked ? 'anx-chip is-locked' : 'anx-chip'}
              onClick={() => {
                if (locked) {
                  setHint(lockHint(limits));
                  return;
                }
                setHint(null);
                const next = presetRange(c.id);
                onChange(next, compare && isCompareAllowed(limits, next, today));
              }}
            >
              {locked && <IconLock className="anx-lock" />}
              {c.label}
            </button>
          );
        })}
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
      {!open && hintNode}

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
