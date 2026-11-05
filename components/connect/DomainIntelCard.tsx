'use client';

// components/connect/DomainIntelCard.tsx — the connect wizard's "domain
// intel" reveal. Shows up under the URL field in step 1 once a WHOIS
// (RDAP) lookup for the typed domain resolves. Purely cosmetic: it
// never blocks or changes the actual connect/verify flow, which still
// runs entirely on useConnectSiteWizard's own state.
//
// Three states, mirroring useDomainLookup's status:
//   loading    — a slim "scanning" row with a pulsing dot, shown while
//                the debounced /api/domain-lookup call is in flight.
//   found      — the full card: domain age counts up from 0 to its
//                real value (a quick "credits roll" tween, not a CSS
//                transition, since animating a plain number needs JS),
//                then registrar / status / nameservers reveal one row
//                at a time with a staggered fade+slide so it reads as
//                a sequence of things being discovered rather than a
//                block of text appearing all at once.
//   not-found  — a single quiet line ("Domain detected") — RDAP has no
//                data for a lot of ccTLDs and privacy-redacted domains,
//                and that's an entirely normal outcome, not an error.
//
// Respects prefers-reduced-motion: the count-up becomes an instant
// final value and the staggered rows all appear together instead of
// in sequence.
import { useEffect, useRef, useState } from 'react';
import type { DomainLookupResult, DomainLookupStatus } from '@/hooks/useDomainLookup';

interface DomainIntelCardProps {
  status: DomainLookupStatus;
  result: DomainLookupResult | null;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function formatAge(days: number): string {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years >= 1) return `${years} year${years === 1 ? '' : 's'}${months ? `, ${months} mo` : ''}`;
  if (months >= 1) return `${months} month${months === 1 ? '' : 's'}`;
  return `${days} day${days === 1 ? '' : 's'}`;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Cleans up RDAP's shouty status tokens ("client transfer prohibited")
// into something that reads well as a small pill label.
function prettyStatus(raw: string): string {
  return raw
    .replace(/^client|^server/i, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function useCountUp(target: number | null, active: boolean): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || target === null) {
      setValue(0);
      return;
    }
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const duration = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out-cubic — fast start, settles in, like a counter landing.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, active]);

  return value;
}

export function DomainIntelCard({ status, result }: DomainIntelCardProps) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="domain-intel domain-intel-loading" aria-live="polite">
        <span className="domain-intel-scan-dot" />
        <span>Looking up domain records…</span>
      </div>
    );
  }

  if (status === 'not-found' || !result) {
    return (
      <div className="domain-intel domain-intel-plain" aria-live="polite">
        <span className="domain-intel-ok-dot" />
        <span>Domain detected — we&apos;ll generate your tag next.</span>
      </div>
    );
  }

  return <DomainIntelFound result={result} />;
}

function DomainIntelFound({ result }: { result: DomainLookupResult }) {
  const ageDays = useCountUp(result.ageDays, true);
  const reduced = prefersReducedMotion();
  const created = formatDate(result.createdAt);
  const expires = formatDate(result.expiresAt);

  const rows: { label: string; value: string }[] = [];
  if (created) rows.push({ label: 'Registered', value: created });
  if (result.registrar) rows.push({ label: 'Registrar', value: result.registrar });
  if (expires) rows.push({ label: 'Expires', value: expires });
  if (typeof result.nameserverCount === 'number' && result.nameserverCount > 0) {
    rows.push({
      label: 'Nameservers',
      value: `${result.nameserverCount} active`,
    });
  }

  return (
    <div className="domain-intel domain-intel-card" aria-live="polite">
      <div className="domain-intel-head">
        <span className="domain-intel-ok-dot" />
        <span className="domain-intel-domain">{result.domain}</span>
      </div>

      {result.ageDays !== null && (
        <div className="domain-intel-age">
          <span className="domain-intel-age-num">{ageDays.toLocaleString()}</span>
          <span className="domain-intel-age-unit">days old · {formatAge(result.ageDays)}</span>
        </div>
      )}

      {rows.length > 0 && (
        <dl className="domain-intel-rows">
          {rows.map((row, i) => (
            <div
              className="domain-intel-row"
              key={row.label}
              style={reduced ? undefined : { animationDelay: `${160 + i * 110}ms` }}
            >
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {result.status.length > 0 && (
        <div className="domain-intel-pills">
          {result.status.slice(0, 4).map((s, i) => (
            <span
              className="domain-intel-pill"
              key={s}
              style={reduced ? undefined : { animationDelay: `${160 + (rows.length + i) * 110}ms` }}
            >
              {prettyStatus(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
