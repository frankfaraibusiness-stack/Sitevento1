'use client';

// components/dashboard/DashboardHeader.tsx
//
// The dashboard's own in-page action bar — NOT a site-wide header.
// DashboardClient.tsx already renders the real app header
// (components/layout/Header.tsx, with the actual sitevento logo)
// once, above every dashboard view including this one — so this bar
// doesn't duplicate a logo. It's just the "Manage site" CTA that
// opens ManageSiteModal (the quick-tools modal), matching the HTML
// mock's .dashv2-header role one level below the real site header.
// Structure only — no color/visual decisions here.
import { useState } from 'react';
import { ManageSiteModal } from './ManageSiteModal';

export function DashboardHeader() {
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <>
      <div className="dashv2-action-bar">
        <button
          type="button"
          className="dashv2-manage-btn"
          aria-label="Manage site"
          onClick={() => setManageOpen(true)}
        >
          <span className="dashv2-manage-icon" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 4.5V19.5L19 12L6 4.5Z" fill="currentColor" />
            </svg>
          </span>
          Manage site
        </button>
      </div>

      <ManageSiteModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </>
  );
}
