'use client';

// Small expandable feedback form. Fully functional end to end: posts to
// this app's own /api/feedback route, which writes into the site's
// Firestore feedback subcollection via the Admin SDK — same trust model
// as /api/track (public route, server-side writes only).
import { useState } from 'react';

interface Props {
  config: Record<string, unknown>;
  siteId?: string;
}

export function FeedbackWidget({ config, siteId }: Props) {
  const prompt = typeof config.prompt === 'string' && config.prompt ? config.prompt : 'Got feedback?';
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit() {
    if (!text.trim() || !siteId) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, message: text.trim(), pageUrl: document.referrer || '' }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      setStatus(data.ok ? 'sent' : 'error');
      if (data.ok) setText('');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      {open ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 6px 28px rgba(0,0,0,0.18)',
            padding: 14,
            width: 260,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13, color: '#22201c' }}>{prompt}</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 0, fontSize: 16, color: '#9a938a', cursor: 'pointer' }}>&times;</button>
          </div>
          {status === 'sent' ? (
            <p style={{ fontSize: 12.5, color: '#4f4a43' }}>Thanks for letting us know!</p>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="What's on your mind?"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid #e8e4de',
                  borderRadius: 8,
                  padding: 8,
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                  resize: 'none',
                  marginBottom: 8,
                }}
              />
              <button
                type="button"
                onClick={submit}
                disabled={status === 'sending' || !text.trim()}
                style={{
                  width: '100%',
                  background: accent,
                  color: '#fff',
                  border: 0,
                  borderRadius: 8,
                  padding: '8px 0',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: status === 'sending' ? 0.7 : 1,
                }}
              >
                {status === 'sending' ? 'Sending\u2026' : 'Send feedback'}
              </button>
              {status === 'error' && <p style={{ fontSize: 11, color: '#c0392b', marginTop: 6 }}>Couldn&apos;t send that — try again.</p>}
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: accent,
            color: '#fff',
            border: 0,
            borderRadius: '10px 0 0 10px',
            padding: '10px 8px',
            fontSize: 11.5,
            fontWeight: 700,
            writingMode: 'vertical-rl',
            cursor: 'pointer',
          }}
        >
          {prompt}
        </button>
      )}
    </div>
  );
}
