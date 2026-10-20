'use client';

// Cycles through the owner's configured messages as small toasts, one
// at a time on a real interval, each auto-dismissing before the next
// appears — fully functional with no external data source, matching
// what the card describes ("Someone in X just signed up" style toasts).
import { useEffect, useMemo, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

function parseMessages(v: unknown): string[] {
  if (typeof v === 'string' && v.trim()) {
    const list = v.split('\n').map((s) => s.trim()).filter(Boolean);
    if (list.length) return list;
  }
  return ['Someone just signed up', 'Someone just made a purchase'];
}

export function SocialProofWidget({ config }: Props) {
  const messages = useMemo(() => parseMessages(config.messages), [config.messages]);
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (messages.length <= 1) return;
    const showMs = 4200;
    const gapMs = 2500;
    let hideTimer: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      setVisible(false);
      hideTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length);
        setVisible(true);
      }, gapMs);
    }, showMs + gapMs);
    return () => {
      clearInterval(cycle);
      clearTimeout(hideTimer);
    };
  }, [messages.length]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        width: '100%',
        height: '100%',
        padding: 10,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#fff',
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
          fontSize: 12.5,
          color: '#22201c',
          maxWidth: 280,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        <span>{messages[index]}</span>
      </div>
    </div>
  );
}
