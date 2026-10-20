'use client';

// A real ticking countdown to a configured end time. Fully functional:
// recomputes remaining time every second client-side (no server calls
// needed once `endsAt` is known), shows days/hours/min/sec, and swaps to
// an "ended" message once it passes. If no endsAt is configured, falls
// back to a sensible default (24h from first render) so the widget is
// never blank for an owner who hasn't set a date yet.
import { useEffect, useMemo, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

function parseEndsAt(v: unknown): number {
  if (typeof v === 'string' && v) {
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return Date.now() + 24 * 60 * 60 * 1000;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function CountdownTimerWidget({ config }: Props) {
  const label = typeof config.label === 'string' && config.label ? config.label : 'Sale ends in';
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';
  const endsAt = useMemo(() => parseEndsAt(config.endsAt), [config.endsAt]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const ended = remaining <= 0;

  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        height: '100%',
        minHeight: 48,
        background: accent,
        color: '#fff',
        padding: '0 14px',
        boxSizing: 'border-box',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {ended ? (
        <span>Offer ended</span>
      ) : (
        <>
          <span style={{ opacity: 0.9 }}>{label}</span>
          <span style={{ display: 'flex', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
            {days > 0 && <TimeChip value={pad(days)} unit="d" />}
            <TimeChip value={pad(hours)} unit="h" />
            <TimeChip value={pad(minutes)} unit="m" />
            <TimeChip value={pad(seconds)} unit="s" />
          </span>
        </>
      )}
    </div>
  );
}

function TimeChip({ value, unit }: { value: string; unit: string }) {
  return (
    <span
      style={{
        background: 'rgba(255,255,255,0.18)',
        borderRadius: 6,
        padding: '3px 7px',
        display: 'inline-flex',
        gap: 2,
      }}
    >
      {value}
      <span style={{ opacity: 0.75, fontWeight: 400 }}>{unit}</span>
    </span>
  );
}
