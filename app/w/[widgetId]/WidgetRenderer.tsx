'use client';

// app/w/[widgetId]/WidgetRenderer.tsx
//
// Reads the #cfg=<json> hash fragment sitevento.js sets on this iframe's
// src (see renderWidget() in public/sitevento.js) and renders the right
// widget. Every sub-component here is pure presentation + the widget's
// own self-contained interaction (countdown ticking, chat input, etc.)
// — none of them talk to Firestore or any API
// directly except Support Chat, which posts to /api/chat (this app's
// own route, same origin as this page).
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { SupportChatWidget } from './widgets/SupportChatWidget';
import { CountdownTimerWidget } from './widgets/CountdownTimerWidget';

export interface WidgetHashPayload {
  siteId: string;
  widgetId: string;
  config: Record<string, unknown>;
}

function readHashConfig(): WidgetHashPayload | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const match = hash.match(/#cfg=(.+)$/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

const WRAP_STYLE: CSSProperties = {
  margin: 0,
  padding: 0,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  background: 'transparent',
  color: '#22201c',
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
};

export function WidgetRenderer({ widgetId }: { widgetId: string }) {
  const [payload, setPayload] = useState<WidgetHashPayload | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPayload(readHashConfig());
    setReady(true);
    // Standalone preview (opening /w/support-chat directly with no hash,
    // e.g. while testing) — keep it working with defaults rather than
    // showing a blank frame.
  }, []);

  const config = useMemo(() => payload?.config || {}, [payload]);
  const siteId = payload?.siteId || '';

  if (!ready) return null;

  return (
    <div style={WRAP_STYLE}>
      {widgetId === 'support-chat' && <SupportChatWidget siteId={siteId} config={config} />}
      {widgetId === 'countdown-timer' && <CountdownTimerWidget config={config} />}
      {!['support-chat', 'countdown-timer'].includes(widgetId) && (
        <div style={{ padding: 12, fontSize: 12, color: '#9a4b4b' }}>Unknown widget.</div>
      )}
    </div>
  );
}
