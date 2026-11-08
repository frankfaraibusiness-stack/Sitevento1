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
import { useEffect, useState } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';

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

// Shared scroll-lock + Escape-to-close behavior for every popup in
// this file. Centered here so WidgetStatusPopup and ConfirmPopup can't
// drift apart on this (e.g. one forgetting to restore body scroll).
function useModalBehavior(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);
  useScrollLock(open);
}

export function WidgetStatusPopup({ open, kind, title, message, onClose }: WidgetStatusPopupProps) {
  useModalBehavior(open, onClose);

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

// ── ConfirmPopup ─────────────────────────────────────────────────────
// Same shared card (wsp-* classes, same backdrop, same scroll-lock —
// useModalBehavior above) but for "are you sure?" moments instead of a
// one-button status notice: a Confirm/Cancel footer, an optional
// danger style for destructive actions, and an optional "type this to
// confirm" text gate for the most irreversible ones (deleting an
// account). Used for sign-out confirmation and every Danger Zone
// action instead of each place rolling its own dialog.
export interface ConfirmPopupProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red/destructive styling for irreversible or data-deleting actions. */
  danger?: boolean;
  /** Disables Confirm and shows a spinner-ish label while an action is in flight. */
  busy?: boolean;
  busyLabel?: string;
  /** If set, Confirm stays disabled until the typed value matches this exactly (case-insensitive). */
  requireText?: string;
  requireTextLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmPopup({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  busyLabel = 'Working…',
  requireText,
  requireTextLabel,
  onConfirm,
  onClose,
}: ConfirmPopupProps) {
  useModalBehavior(open, onClose);
  const [typed, setTyped] = useState('');

  // Reset the typed-confirmation field each time the dialog opens, so
  // a leftover value from a previous open can't silently satisfy the
  // gate on a fresh one.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  if (!open) return null;

  const textGateOk = !requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase();
  const confirmDisabled = busy || !textGateOk;

  return (
    <div className="wsp-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className={`wsp-card wsp-is-${danger ? 'error' : 'on'}`}
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
          <button type="button" className="wsp-close" aria-label="Close" onClick={onClose} disabled={busy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <div className="wsp-body">
          <span className="wsp-icon" aria-hidden="true">
            <StatusIcon kind={danger ? 'error' : 'off'} />
          </span>
          <h3 className="wsp-title">{title}</h3>
          <p className="wsp-message">{message}</p>

          {requireText ? (
            <div className="wsp-confirm-field">
              <label htmlFor="wsp-confirm-input">
                {requireTextLabel ?? `Type "${requireText}" to confirm`}
              </label>
              <input
                id="wsp-confirm-input"
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={requireText}
                disabled={busy}
              />
            </div>
          ) : null}

          <div className="wsp-confirm-actions">
            <button type="button" className="wsp-cancel" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={danger ? 'wsp-ok wsp-ok-danger' : 'wsp-ok'}
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── UpsellPopup ──────────────────────────────────────────────────────
// Same shared card/backdrop/scroll-lock as the two above, for the one
// moment where "Got it" isn't enough: the owner tried to flip a widget
// live but the site isn't verified yet (WidgetDesigner.tsx's toggle
// guard and `saved_but_blocked` / reason `SITE_NOT_VERIFIED` from
// useSiteWidget's liveStatus). A plain status popup would just tell
// them no; this one hands them the actual "go verify" CTA right there
// instead of making them find /dashboard/connect on their own.
export interface UpsellPopupProps {
  open: boolean;
  title: string;
  message: string;
  ctaLabel?: string;
  onGoLive: () => void;
  onClose: () => void;
}

export function UpsellPopup({
  open,
  title,
  message,
  ctaLabel = 'Verify site & go live',
  onGoLive,
  onClose,
}: UpsellPopupProps) {
  useModalBehavior(open, onClose);

  if (!open) return null;

  return (
    <div className="wsp-backdrop" role="presentation" onClick={onClose}>
      <div
        className="wsp-card wsp-is-off"
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
            <StatusIcon kind="off" />
          </span>
          <h3 className="wsp-title">{title}</h3>
          <p className="wsp-message">{message}</p>

          <div className="wsp-confirm-actions">
            <button type="button" className="wsp-cancel" onClick={onClose}>
              Maybe later
            </button>
            <button type="button" className="wsp-ok" onClick={onGoLive}>
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
