'use client';

// A slim top-of-page bar. Fully functional: shows the owner's message,
// an optional button, and a close control that hides it for the rest
// of the visitor's session (sessionStorage — comes back on their next
// visit, same spirit as the dashboard's own "every refresh" banner
// option, just scoped to this one simple widget with no persistence
// config needed).
import { useEffect, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

const DISMISS_KEY = 'sv_w_announcement_dismissed';

export function AnnouncementBarWidget({ config }: Props) {
  const message = typeof config.message === 'string' && config.message ? config.message : 'Free shipping on all orders this week!';
  const ctaLabel = typeof config.ctaLabel === 'string' ? config.ctaLabel : '';
  const ctaUrl = typeof config.ctaUrl === 'string' ? config.ctaUrl : '';
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      /* storage unavailable — just show it */
    }
  }, []);

  if (dismissed) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
        height: '100%',
        minHeight: 40,
        background: accent,
        color: '#fff',
        padding: '0 14px',
        fontSize: 13,
        fontWeight: 600,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message}</span>
      {ctaLabel && ctaUrl && (
        <a
          href={ctaUrl}
          target="_top"
          rel="noopener"
          style={{
            flexShrink: 0,
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 700,
            padding: '5px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {ctaLabel}
        </a>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(DISMISS_KEY, '1');
          } catch {
            /* ignore */
          }
        }}
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 0,
          color: '#fff',
          opacity: 0.8,
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: 2,
        }}
      >
        &times;
      </button>
    </div>
  );
}
