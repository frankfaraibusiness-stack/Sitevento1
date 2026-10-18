'use client';

// components/dashboard/WidgetsPanel.tsx
//
// Full-screen "Widgets" picker, opened from the Quick Tools row right
// after Site Alert. Same full-screen-takeover-with-sticky-header
// pattern as the Site Alert panel (DashboardShell's .feat-panel-screen)
// rather than a sheet/dropdown, so it reads as one consistent "opens
// over everything" interaction across the dashboard.
//
// Both widgets are live: clicking a card opens WidgetConfigPanel,
// which lets the owner turn the widget on for the active site and edit
// its settings. The catalog (name/description/config fields) lives in
// lib/widgets.ts so this file only needs icons + layout.
import { useState, type ReactNode } from 'react';
import { WIDGET_CATALOG } from '@/lib/widgets';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import type { Site } from '@/lib/types';

const WIDGET_ICONS: Record<string, ReactNode> = {
  'support-chat': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  'countdown-timer': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9.5 1.5h5M12 1.5V3" />
    </svg>
  ),
};

interface WidgetsPanelProps {
  uid: string | null;
  activeSite: Site | null;
  onClose: () => void;
}

export function WidgetsPanel({ uid, activeSite, onClose }: WidgetsPanelProps) {
  const [openWidgetId, setOpenWidgetId] = useState<string | null>(null);

  if (openWidgetId) {
    return (
      <WidgetConfigPanel
        uid={uid}
        activeSite={activeSite}
        widgetId={openWidgetId}
        onClose={() => setOpenWidgetId(null)}
      />
    );
  }

  return (
    <div className="feat-panel-screen" role="dialog" aria-modal="true" aria-label="Widgets">
      <div className="feat-panel-head">
        <div className="feat-panel-head-text">
          <h2>Widgets</h2>
          <span>Drop-in, on-site widgets you can turn on for this site — no code, no redeploy.</span>
        </div>
        <button type="button" className="feat-panel-close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </div>
      <div className="feat-panel-body">
        <div className="wg-grid">
          {WIDGET_CATALOG.map((w) => (
            <button
              key={w.id}
              type="button"
              className="wg-card"
              onClick={() => setOpenWidgetId(w.id)}
            >
              <span className="wg-card-icon">{WIDGET_ICONS[w.id]}</span>
              <span className="wg-card-body">
                <span className="wg-card-name">{w.name}</span>
                <span className="wg-card-desc">{w.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
