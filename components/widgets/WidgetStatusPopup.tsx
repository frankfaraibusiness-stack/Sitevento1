'use client';

// components/widgets/WidgetStatusPopup.tsx
//
// Shared "widget turned on/off" confirmation popup — replaces the old
// 3.2s auto-dismiss toast (which gave no indication of *why* a widget
// did or didn't go live, and vanished before some people could read
// it). Used by both WidgetDesigner.tsx (the /widgets/[widgetId] page)
// and anywhere else a widget's live status changes, via one shared
// component instead of a one-off per page.
//
// Centered, non-scrolling modal overlay. Branded (logo-left / close
// button-right header bar) since this is shown across every widget in
// the catalog, not styled per-widget.
import { useEffect } from 'react';

export interface WidgetStatusPopupProps {
  open: boolean;
  kind: 'on' | 'off' | 'error';
  title: string;
  message: string;
  onClose: () => void;
}

function StatusIcon({ kind }: { kind: WidgetStatusPopupProps['kind'] }) {
  if (kind === 'error') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
    );
  }
  if (kind === 'off') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6M15 9l-6 6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function WidgetStatusPopup({ open, kind, title, message, onClose }: WidgetStatusPopupProps) {
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="wsp-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`wsp-card wsp-is-${kind}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wsp-bar">
          <span className="wsp-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2l7.5 4.3v9.4L12 20 4.5 15.7V6.3L12 2z" fill="currentColor" />
              <path d="M9 11.8l2.1 2.1L15.5 9" stroke="var(--lime)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span>sitevento</span>
          </span>
          <button type="button" className="wsp-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <div className="wsp-body">
          <span className="wsp-icon" aria-hidden="true">
            <StatusIcon kind={kind} />
          </span>
          <h3 className="wsp-title">{title}</h3>
          <p className="wsp-message">{message}</p>
          <button type="button" className="wsp-ok" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
