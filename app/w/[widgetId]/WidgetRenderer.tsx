'use client';

// app/w/[widgetId]/WidgetRenderer.tsx
//
// Reads the #cfg=<json> hash fragment sitevento.js sets on this iframe's
// src (see renderWidget() in public/sitevento.js) and renders the right
// widget. Every sub-component here is pure presentation + the widget's
// own self-contained interaction (countdown ticking, chat input, etc.).
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { SupportChatWidget } from './widgets/SupportChatWidget';
import { EmailCaptureWidget } from './widgets/EmailCaptureWidget';
import { AnnouncementBarWidget } from './widgets/AnnouncementBarWidget';
import { BookingWidget } from './widgets/BookingWidget';

// Previous 11 widgets were retired to be rebuilt from scratch as
// premium widgets — see lib/widgets.ts's WIDGET_CATALOG. Add new
// widget components + their id below as each one ships.
const KNOWN_WIDGET_IDS: string[] = ['support-chat', 'email-capture', 'announcement-bar', 'appointment-booking'];

export interface WidgetHashPayload {
  siteId: string;
  widgetId: string;
  visitorId?: string;
  // The signed token (lib/visitorIdentity.ts) backing visitorId above
  // — see public/sitevento.js's mountWidgetFrame for why this reaches
  // the widget iframe at all. Opaque to this app's own client code
  // too: never decoded here, only ever forwarded verbatim to a route
  // that verifies it server-side (EmailCaptureWidget's POST to
  // /api/email-capture).
  visitorToken?: string;
  // Server-tracked visit count + submitted flag for THIS visitor, as
  // of the page's most recent /api/track beacon — see that route's
  // `emailCapture` response field and public/sitevento.js's
  // mountWidgetFrame, which is what actually puts this here. null (or
  // absent, for an old cached sitevento.js build that doesn't send it
  // yet) means no server data is available; EmailCaptureWidget treats
  // that the same as "not submitted, count unknown" and falls back to
  // its own localStorage-only behavior rather than ever being
  // blocked by a missing field.
  emailCapture?: { visitCount: number; submitted: boolean } | null;
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
  // Falls back to a per-tab random id if sitevento.js hasn't been
  // updated on the embedding page yet (old cached script) — so a
  // write still gets a visitorId instead of an empty string, it just
  // won't persist across page loads the way the real localStorage-
  // backed id does. Real widget-request routes treat this the same
  // either way (just an opaque dedup/display key, never a credential).
  const visitorId = useMemo(() => {
    if (payload?.visitorId) return payload.visitorId;
    if (typeof window === 'undefined') return '';
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }, [payload]);
  // document.referrer — the ONLY way a sandboxed widget iframe can
  // know the host page's URL — forwarded to both leads-producing
  // widgets below for conversion attribution (lib/types.ts's
  // Lead.path), their first real consumers.
  const pageUrl = useMemo(() => {
    if (typeof document === 'undefined') return '';
    return document.referrer || '';
  }, []);
  const emailCapture = payload?.emailCapture ?? null;
  const visitorToken = payload?.visitorToken || '';

  if (!ready) return null;

  if (widgetId === 'support-chat') {
    return (
      <div style={WRAP_STYLE}>
        <SupportChatWidget siteId={siteId} visitorId={visitorId} config={config} />
      </div>
    );
  }

  if (widgetId === 'email-capture') {
    return (
      <div style={WRAP_STYLE}>
        <EmailCaptureWidget
          siteId={siteId}
          visitorId={visitorId}
          pageUrl={pageUrl}
          config={config}
          emailCapture={emailCapture}
          visitorToken={visitorToken}
        />
      </div>
    );
  }

  if (widgetId === 'announcement-bar') {
    return (
      <div style={WRAP_STYLE}>
        <AnnouncementBarWidget siteId={siteId} visitorId={visitorId} config={config} />
      </div>
    );
  }

  if (widgetId === 'appointment-booking') {
    return (
      <div style={WRAP_STYLE}>
        <BookingWidget siteId={siteId} visitorId={visitorId} pageUrl={pageUrl} config={config} />
      </div>
    );
  }

  return (
    <div style={WRAP_STYLE}>
      {!KNOWN_WIDGET_IDS.includes(widgetId) && (
        <div style={{ padding: 12, fontSize: 12, color: '#9a4b4b' }}>Unknown widget.</div>
      )}
    </div>
  );
}
