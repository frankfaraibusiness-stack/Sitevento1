'use client';

// components/marketing/LiveTracking.tsx
//
// Replaces the old one-line <StatusStrip /> ("Currently tracking 2,418
// active sessions") with a full-width, premium showcase section: a
// mock "search your visit log" bar that animates through a few
// canned queries, typewriter-style, with live visit rows streaming
// in underneath and a pulsing live counter. Purely illustrative —
// nothing here is wired to real traffic, same as DashboardPreview.
//
// Visuals only — no new deps. Typewriter + row-cycling driven by a
// handful of timeouts in a single effect; everything respects
// prefers-reduced-motion by skipping straight to a static end state
// (see the CSS + the reduced-motion check below).

import { useEffect, useRef, useState } from 'react';
import { useCountUp } from '@/hooks/useCountUp';

const QUERIES = ['/pricing', 'referrer: twitter.com', 'device: mobile', '/blog/launch'];

const ALL_ROWS = [
  { page: '/pricing', loc: 'Austin, US', device: 'Desktop', time: 'now' },
  { page: '/', loc: 'Lagos, NG', device: 'Mobile', time: '2s ago' },
  { page: '/blog/launch', loc: 'Berlin, DE', device: 'Mobile', time: '6s ago' },
  { page: '/docs/setup', loc: 'Manila, PH', device: 'Desktop', time: '11s ago' },
  { page: '/pricing', loc: 'Toronto, CA', device: 'Tablet', time: '15s ago' },
  { page: '/', loc: 'Mumbai, IN', device: 'Mobile', time: '19s ago' },
];

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function LiveTracking() {
  const [typed, setTyped] = useState('');
  const [rows, setRows] = useState(ALL_ROWS.slice(0, 4));
  const { ref: countRef, value: liveCount } = useCountUp(2418);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion.current) {
      setTyped(QUERIES[0]);
      return;
    }

    let cancelled = false;
    let charTimer: ReturnType<typeof setTimeout>;
    let holdTimer: ReturnType<typeof setTimeout>;
    let eraseTimer: ReturnType<typeof setTimeout>;

    function typeQuery(qIdx: number, charIdx: number) {
      if (cancelled) return;
      const q = QUERIES[qIdx];
      setTyped(q.slice(0, charIdx));

      if (charIdx < q.length) {
        charTimer = setTimeout(() => typeQuery(qIdx, charIdx + 1), 55);
      } else {
        holdTimer = setTimeout(() => eraseQuery(qIdx, q.length), 1400);
      }
    }

    function eraseQuery(qIdx: number, charIdx: number) {
      if (cancelled) return;
      setTyped(QUERIES[qIdx].slice(0, charIdx));

      if (charIdx > 0) {
        eraseTimer = setTimeout(() => eraseQuery(qIdx, charIdx - 1), 28);
      } else {
        const nextIdx = (qIdx + 1) % QUERIES.length;
        charTimer = setTimeout(() => typeQuery(nextIdx, 0), 400);
      }
    }

    typeQuery(0, 0);

    return () => {
      cancelled = true;
      clearTimeout(charTimer);
      clearTimeout(holdTimer);
      clearTimeout(eraseTimer);
    };
  }, []);

  // Rows gently cycle — drop the oldest, insert a "new" one up top —
  // independent of the typing loop, so the panel always feels live.
  useEffect(() => {
    if (reduceMotion.current) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % ALL_ROWS.length;
      setRows((prev) => [ALL_ROWS[i], ...prev.slice(0, 3)]);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="lt-section">
      <div className="lt-head">
        <span className="lt-eyebrow">Live right now</span>
        <h2 className="lt-title">Search your traffic, as it happens</h2>
        <p className="lt-sub">
          Every session lands here instantly — filter by page, referrer, or device and watch results update in
          real time.
        </p>
      </div>

      <div className="lt-panel">
        <div className="lt-search-bar">
          <span className="lt-search-icon">
            <IconSearch />
          </span>
          <span className="lt-search-text">
            {typed}
            <span className="lt-caret" aria-hidden="true" />
          </span>
          <div className="lt-live-badge" ref={countRef}>
            <span className="lt-live-dot" />
            {liveCount.toLocaleString('en-US')} active
          </div>
        </div>

        <ul className="lt-rows" aria-hidden="true">
          {rows.map((r, i) => (
            <li className="lt-row" key={`${r.page}-${i}`} style={{ animationDelay: `${i * 40}ms` }}>
              <span className="lt-row-page">{r.page}</span>
              <span className="lt-row-loc">{r.loc}</span>
              <span className="lt-row-device">{r.device}</span>
              <span className="lt-row-time">{r.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
