'use client';

// components/dashboard/ManageSiteModal.tsx
//
// The modal opened by the header's "Manage site" CTA
// (DashboardHeader.tsx). Houses "Quick Tools" — the same seven live
// feature tiles as the current FeatureOptionsGrid.tsx (Site Alert,
// Widgets, Monetization, Advertise, AI Support Agent, Users,
// SECURITY BOT) — reusing that exact id/name/description/icon/href
// lineup rather than redefining it, so there's one source of truth
// for what the tools are and where they route.
//
// Structure-only pass: no colors/visual design decided here, just a
// clean card-per-tool layout and correct routing. Visual styling
// lands in the CSS step.
import { useEffect, useRef } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { QUICK_TOOL_OPTIONS, type QuickToolOption } from './quickToolOptions';

interface ManageSiteModalProps {
  open: boolean;
  onClose: () => void;
}

export function ManageSiteModal({ open, onClose }: ManageSiteModalProps) {
  const router = useNavRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape and on backdrop click — same affordances as the
  // HTML mock's manage-modal-backdrop (onclick=closeManageModal) and
  // its Escape-key handling.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleToolTap(opt: QuickToolOption) {
    onClose();
    if (opt.href) router.push(opt.href);
  }

  return (
    <div
      className="dashv2-manage-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dashv2-manage-modal-card" ref={cardRef} role="dialog" aria-modal="true" aria-label="Manage site">
        <div className="dashv2-manage-modal-head">
          <h2 className="dashv2-manage-modal-title">Quick Tools</h2>
          <button
            type="button"
            className="dashv2-manage-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="dashv2-manage-modal-body">
          {QUICK_TOOL_OPTIONS.length === 0 ? (
            <div className="dashv2-manage-modal-empty">No tools available yet.</div>
          ) : (
            <div className="dashv2-qt-grid">
              {QUICK_TOOL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`dashv2-qt-card dashv2-tone-${opt.tone}`}
                  onClick={() => handleToolTap(opt)}
                >
                  <span className="dashv2-qt-card-icon">{opt.icon}</span>
                  <span className="dashv2-qt-card-body">
                    <span className="dashv2-qt-card-name">{opt.name}</span>
                    <span className="dashv2-qt-card-sub">{opt.subtitle}</span>
                  </span>
                  <span className="dashv2-qt-card-arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
