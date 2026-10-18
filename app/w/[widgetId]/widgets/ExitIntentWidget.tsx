'use client';

// Listens for the visitor's cursor crossing the top of the viewport
// (the classic "heading for the tab bar" signal) and shows an overlay
// once per session. Real detection, not a timer standing in for it.
import { useEffect, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

const SHOWN_KEY = 'sv_w_exit_shown';

export function ExitIntentWidget({ config }: Props) {
  const headline = typeof config.headline === 'string' && config.headline ? config.headline : 'Wait — before you go!';
  const message = typeof config.message === 'string' ? config.message : 'Here\u2019s 10% off if you stay.';
  const ctaLabel = typeof config.ctaLabel === 'string' && config.ctaLabel ? config.ctaLabel : 'Claim offer';
  const ctaUrl = typeof config.ctaUrl === 'string' ? config.ctaUrl : '';
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem(SHOWN_KEY) === '1';
    } catch {
      /* ignore */
    }
    if (shown) return;

    function handleMouseOut(e: MouseEvent) {
      // relatedTarget null + clientY near 0 = cursor left through the
      // top edge of the (parent) viewport — the standard exit-intent
      // signal. This iframe is sized to its placement by the host
      // page, so we listen on this document; the loader is expected to
      // size an exit-intent container to cover the viewport for this
      // signal to be meaningful (documented in the dashboard's widget
      // settings copy).
      if (e.clientY <= 0 && !e.relatedTarget) {
        setVisible(true);
        try {
          sessionStorage.setItem(SHOWN_KEY, '1');
        } catch {
          /* ignore */
        }
      }
    }

    document.addEventListener('mouseout', handleMouseOut);
    return () => document.removeEventListener('mouseout', handleMouseOut);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
      onClick={() => setVisible(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 24,
          width: 'min(90%, 320px)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setVisible(false)}
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            background: 'transparent',
            border: 0,
            fontSize: 18,
            color: '#9a938a',
            cursor: 'pointer',
          }}
        >
          &times;
        </button>
        <h3 style={{ margin: '4px 0 8px', fontSize: 17, fontWeight: 800, color: '#22201c' }}>{headline}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4f4a43', lineHeight: 1.5 }}>{message}</p>
        {ctaUrl ? (
          <a
            href={ctaUrl}
            target="_top"
            rel="noopener"
            style={{
              display: 'inline-block',
              background: accent,
              color: '#fff',
              textDecoration: 'none',
              borderRadius: 999,
              padding: '9px 22px',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {ctaLabel}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setVisible(false)}
            style={{
              background: accent,
              color: '#fff',
              border: 0,
              borderRadius: 999,
              padding: '9px 22px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
