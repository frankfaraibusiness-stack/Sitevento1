// components/content/ContentPageShell.tsx
//
// Shared chrome for the rebuilt content routes (About, Careers, Docs,
// Changelog, Status, ...): the dark hero card with the lime glow +
// blob corner, the "On this page" topbar, and the footer. Pulled out
// as its own component instead of copy-pasted into each page.tsx the
// way LegalPage.tsx's callers used to share one shell, but swaps that
// shell's single prose column for a flexible `children` slot — each
// page composes its own mix of .cp-card / .cp-grid / .cp-banner
// blocks from styles/content/content-pages.css inside it. See that file's
// header comment for the full design rationale.
//
// Plain Server Component (no 'use client') — nothing here is
// interactive beyond plain <a> links, so these routes stay statically
// generated, same reasoning LegalPage.tsx's header comment gives.
// ContentHeader (the real app header — logo, sign-up/avatar, menu) is
// mounted the same way SiteFooter already is: a small client piece
// inside an otherwise-static server tree. Replaces the old bare
// .cp-topbar back-link so these routes get the actual header instead
// of just "← sitevento".
import type { ReactNode } from 'react';
import { ContentBlob } from './ContentBlob';
import { ContentHeader } from '@/components/layout/ContentHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';

export interface ContentHeroStat {
  value: string;
  label: string;
}

interface ContentPageShellProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  updatedOn: string;
  heroStats?: ContentHeroStat[];
  children: ReactNode;
}

export function ContentPageShell({ eyebrow, title, subtitle, updatedOn, heroStats, children }: ContentPageShellProps) {
  return (
    <div className="cp-page">
      <ContentHeader />

      <div className="cp-hero">
        <ContentBlob className="cp-hero-blob" />
        <div className="cp-hero-inner">
          <span className="cp-eyebrow">
            <span className="dot" />
            {eyebrow}
          </span>
          <h1>{title}</h1>
          {subtitle && <p className="cp-hero-sub">{subtitle}</p>}
          <p className="cp-updated">Last updated {updatedOn}</p>

          {heroStats && heroStats.length > 0 && (
            <div className="cp-hero-stats">
              {heroStats.map((s) => (
                <div className="cp-hero-stat" key={s.label}>
                  <span className="cp-hero-stat-value">{s.value}</span>
                  <span className="cp-hero-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="cp-body">
        <div className="cp-body-inner">{children}</div>
      </div>

      <SiteFooter />
    </div>
  );
}
