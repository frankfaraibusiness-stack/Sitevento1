'use client';

// Reviews & Testimonials Carousel. Ported from
// widget-drafts/reviews-carousel.html. The one manual-only,
// inline-embedded widget in the set — unlike every other widget here
// it never auto-mounts into a corner/bar; the site owner places it
// directly inside their own page content (e.g. a "What customers say"
// section), matching the `manual-only` position case in lib/widgets.ts.
// Auto-advancing carousel with arrows + dots, star ratings, verified
// badges, and an aggregate rating line.
//
// `REVIEWS` below is static sample content for preview only, same as
// the draft — the real widget never fabricates reviews or an aggregate
// score; both come from either reviews the owner typed into the
// dashboard directly or a synced connected review source, with the
// "last synced" line reflecting that same real sync rather than a
// cosmetic placeholder. Swapping in real config-driven reviews (plus
// the aggregate rating and "last synced" timestamp) is a later step,
// same as the rest of these components.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'reviews-carousel')
// and WidgetRenderer.tsx's switch.
import { useEffect, useRef, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

interface Review {
  stars: number;
  quote: string;
  name: string;
  meta: string;
  verified: boolean;
}

const REVIEWS: Review[] = [
  {
    stars: 5,
    quote: "Setup took about ten minutes and it's been running itself since. Support actually answers.",
    name: 'Priya N.',
    meta: 'Marketing lead, SaaS',
    verified: true,
  },
  {
    stars: 5,
    quote: 'We tried two other tools before this. This is the first one the whole team actually uses.',
    name: 'Marcus T.',
    meta: 'Agency owner',
    verified: true,
  },
  {
    stars: 4,
    quote: 'Does exactly what it says. Would like a couple more customization options but no complaints.',
    name: 'Dana R.',
    meta: 'E-commerce store',
    verified: false,
  },
];

const AUTO_ADVANCE_MS = 5500;

function starString(n: number): string {
  return '★★★★★☆☆☆☆☆'.slice(5 - n, 10 - n);
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function ReviewsCarouselWidget({ config }: Props) {
  const title = str(config.title, 'What customers say');
  const aggRating = str(config.aggRating, '4.8');
  const aggCount = str(config.aggCount, '212');
  const sourceLine = str(config.sourceLine, 'Reviews imported from your connected review source \u00B7 last synced 2h ago');

  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function restartAuto() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % REVIEWS.length);
    }, AUTO_ADVANCE_MS);
  }

  useEffect(() => {
    restartAuto();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goTo(i: number) {
    setCurrent(i);
    restartAuto();
  }
  function prev() {
    goTo((current - 1 + REVIEWS.length) % REVIEWS.length);
  }
  function next() {
    goTo((current + 1) % REVIEWS.length);
  }

  return (
    <div
      role="region"
      aria-label="Customer reviews"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        background: '#fdfdf7',
        border: '1px solid #eef1e6',
        borderRadius: 18,
        padding: '28px 24px 24px',
        boxShadow: '0 10px 30px rgba(26, 31, 10, 0.06)',
        boxSizing: 'border-box',
        color: '#1a1f0a',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6b7560', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: '#e8b23f', fontSize: 13, letterSpacing: 1 }}>{'\u2605\u2605\u2605\u2605\u2605'}</span>
          <strong style={{ color: '#1a1f0a' }}>{aggRating}</strong>
          {' from '}
          {aggCount}
          {' reviews'}
        </div>
      </div>

      <div style={{ overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
            transform: `translateX(-${current * 100}%)`,
          }}
        >
          {REVIEWS.map((r, i) => (
            <div key={i} style={{ flex: '0 0 100%', padding: '2px 4px', boxSizing: 'border-box' }}>
              <div style={{ background: '#f7f9f3', borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ color: '#e8b23f', fontSize: 14, letterSpacing: 1, marginBottom: 8 }}>{starString(r.stars)}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#2b3220', marginBottom: 14 }}>
                  {'\u201C'}
                  {r.quote}
                  {'\u201D'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: '#dcf7a6',
                      color: '#1a1f0a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {initials(r.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {r.name}
                      {r.verified && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 10,
                            color: '#4d7d2a',
                            background: '#e9f5db',
                            borderRadius: 999,
                            padding: '2px 7px',
                            marginLeft: 6,
                            fontWeight: 700,
                          }}
                        >
                          {'\u2713 Verified'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#8a9480' }}>{r.meta}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 16 }}>
        <button
          type="button"
          onClick={prev}
          aria-label="Previous review"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '1.5px solid #e5ead9',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: '#3a4230',
          }}
        >
          {'\u2039'}
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {REVIEWS.map((_, i) => (
            <div
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === current ? 16 : 6,
                height: 6,
                borderRadius: i === current ? 4 : '50%',
                background: i === current ? '#6fae3f' : '#e5ead9',
                cursor: 'pointer',
                transition: 'background 150ms ease, width 150ms ease',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          aria-label="Next review"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '1.5px solid #e5ead9',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: '#3a4230',
          }}
        >
          {'\u203A'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <div style={{ fontSize: 10.5, color: '#9aa38a' }}>{sourceLine}</div>
      </div>
    </div>
  );
}
