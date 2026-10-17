// components/legal/LegalPage.tsx — shared chrome for /terms and
// /privacy (app/terms/page.tsx, app/privacy/page.tsx). Deliberately a
// plain Server Component (no 'use client', no hooks) since there's
// nothing interactive here beyond anchor-link scrolling, which plain
// <a href="#id"> already handles with zero JS — keeping these routes
// statically generated at build time rather than needing a client
// bundle, which also helps first-paint/SEO.
//
// Not reusing the app shell's Header/MarketingFooter: those live
// inside components/AppRoot.tsx's client-side view switch (clicking
// the logo is a state change, not real navigation), which doesn't fit
// a plain content route meant to be independently linkable and
// crawlable. A real <a href="/"> back-link plays better with SEO than
// routing back into the SPA shell anyway.
import type { ReactNode } from 'react';

export interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  updatedOn: string;
  intro?: ReactNode;
  sections: LegalSection[];
}

export function LegalPage({ eyebrow, title, updatedOn, intro, sections }: LegalPageProps) {
  return (
    <div className="legal-page">
      <div className="legal-topbar">
        <a className="legal-back" href="/">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          sitevento
        </a>
      </div>

      <div className="legal-hero">
        <div className="legal-hero-inner">
          <span className="legal-eyebrow">
            <span className="dot" />
            {eyebrow}
          </span>
          <h1>{title}</h1>
          <p className="legal-updated">Last updated {updatedOn}</p>
        </div>
      </div>

      <div className="legal-body">
        <div className="legal-body-inner">
          <nav className="legal-toc" aria-label="Sections">
            <h2>On this page</h2>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.heading}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="legal-content">
            {intro}
            {sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{s.heading}</h2>
                {s.body}
              </section>
            ))}
          </div>
        </div>
      </div>

      <footer className="legal-footer">
        <span>&copy; 2026 sitevento. All rights reserved.</span>
        <div className="legal-footer-links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/">Home</a>
        </div>
      </footer>
    </div>
  );
}
