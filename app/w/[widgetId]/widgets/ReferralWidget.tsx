'use client';

// Generates a per-visitor referral link (this visitor's persisted id +
// the host page's own URL, as a ?ref= param) and a one-click copy
// button. Fully functional as a link generator; attributing a later
// visit back to that ?ref= code is left to the site owner's own
// analytics (sitevento's own /api/track doesn't currently read ?ref,
// so this widget focuses on what it can do standalone: give the
// visitor something real to share).
import { useEffect, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

const REF_KEY = 'sv_w_referral_code';

function makeCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function ReferralWidget({ config }: Props) {
  const reward = typeof config.reward === 'string' && config.reward ? config.reward : 'Give 10%, Get 10%';
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';

  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let c = '';
    try {
      c = localStorage.getItem(REF_KEY) || '';
      if (!c) {
        c = makeCode();
        localStorage.setItem(REF_KEY, c);
      }
    } catch {
      c = makeCode();
    }
    const base = document.referrer || '';
    try {
      const u = new URL(base || 'https://example.com');
      u.searchParams.set('ref', c);
      setLink(u.toString());
    } catch {
      setLink(`?ref=${c}`);
    }
  }, []);

  function copy() {
    try {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — link is still shown/selectable */
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 14,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        justifyContent: 'center',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: '#22201c' }}>{reward}</div>
      <div style={{ fontSize: 12, color: '#6b655c' }}>Share your link — you both get rewarded.</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          style={{
            flex: 1,
            minWidth: 0,
            border: '1px solid #e8e4de',
            borderRadius: 8,
            padding: '7px 9px',
            fontSize: 11.5,
            background: '#f6f2e7',
          }}
        />
        <button
          type="button"
          onClick={copy}
          style={{
            flexShrink: 0,
            background: accent,
            color: '#fff',
            border: 0,
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
