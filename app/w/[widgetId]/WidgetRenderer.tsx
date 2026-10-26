'use client';

// app/w/[widgetId]/WidgetRenderer.tsx
//
// Reads the #cfg=<json> hash fragment sitevento.js sets on this iframe's
// src (see renderWidget() in public/sitevento.js) and renders the right
// widget. Every sub-component here is pure presentation + the widget's
// own self-contained interaction (countdown ticking, chat input, etc.).
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { LimeSupportChatWidget } from './widgets/LimeSupportChatWidget';
import { ModernEmailCaptureWidget } from './widgets/ModernEmailCaptureWidget';
import { CountdownBarWidget } from './widgets/CountdownBarWidget';
import { CampaignBarWidget } from './widgets/CampaignBarWidget';
import { ContactUsWidget } from './widgets/ContactUsWidget';
import { VisitorPulseWidget } from './widgets/VisitorPulseWidget';
import { FeedbackSurveyWidget } from './widgets/FeedbackSurveyWidget';
import { AppointmentBookingWidget } from './widgets/AppointmentBookingWidget';
import { ReviewsCarouselWidget } from './widgets/ReviewsCarouselWidget';
import { SpinRewardWidget } from './widgets/SpinRewardWidget';
import { FaqPageWidget } from './widgets/FaqPageWidget';

const KNOWN_WIDGET_IDS = [
  'support-chat',
  'email-capture',
  'countdown-bar',
  'campaign-bar',
  'contact-us',
  'visitor-pulse',
  'feedback-survey',
  'appointment-booking',
  'reviews-carousel',
  'spin-reward',
  'faq-page',
];

export interface WidgetHashPayload {
  siteId: string;
  widgetId: string;
  visitorId?: string;
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
  const pageUrl = useMemo(() => {
    if (typeof document === 'undefined') return '';
    return document.referrer || '';
  }, []);

  if (!ready) return null;

  return (
    <div style={WRAP_STYLE}>
      {widgetId === 'support-chat' && <LimeSupportChatWidget config={config} siteId={siteId} visitorId={visitorId} />}
      {widgetId === 'email-capture' && <ModernEmailCaptureWidget config={config} siteId={siteId} />}
      {widgetId === 'countdown-bar' && <CountdownBarWidget config={config} />}
      {widgetId === 'campaign-bar' && <CampaignBarWidget config={config} />}
      {widgetId === 'contact-us' && <ContactUsWidget config={config} siteId={siteId} visitorId={visitorId} pageUrl={pageUrl} />}
      {widgetId === 'visitor-pulse' && <VisitorPulseWidget config={config} />}
      {widgetId === 'feedback-survey' && <FeedbackSurveyWidget config={config} siteId={siteId} visitorId={visitorId} pageUrl={pageUrl} />}
      {widgetId === 'appointment-booking' && <AppointmentBookingWidget config={config} siteId={siteId} visitorId={visitorId} pageUrl={pageUrl} />}
      {widgetId === 'reviews-carousel' && <ReviewsCarouselWidget config={config} />}
      {widgetId === 'spin-reward' && <SpinRewardWidget config={config} siteId={siteId} visitorId={visitorId} />}
      {widgetId === 'faq-page' && <FaqPageWidget config={config} />}
      {!KNOWN_WIDGET_IDS.includes(widgetId) && (
        <div style={{ padding: 12, fontSize: 12, color: '#9a4b4b' }}>Unknown widget.</div>
      )}
    </div>
  );
}
