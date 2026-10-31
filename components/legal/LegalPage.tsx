// components/legal/LegalPage.tsx — shared chrome for /terms, /support,
// and the four /product/* pages. Still a plain Server Component (no
// 'use client', no hooks of its own) — the only client pieces mounted
// inside it are ContentHeader and SiteFooter, which are fine to mount
// inside a server tree (Next.js still statically generates everything
// else), same as every other content route already does for the
// footer.
//
// Used to render its own bare "← sitevento" back-link (.legal-topbar)
// instead of the real app header, because Header.tsx's clicks are
// state changes inside components/AppRoot.tsx's SPA view switch and
// don't fit a plain, independently-linkable content route. ContentHeader
// is the real-navigation sibling that solves that — same look, real
// <Link>s — so these pages now get the actual header (logo, sign-up/
// avatar, menu) like every other page, instead of just a back-link.
import type { ReactNode } from 'react';
import { ContentHeader } from '@/components/layout/ContentHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';

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
      <ContentHeader />

      <div className="legal-hero">
        <div className="legal-hero-inner">
          <p className="legal-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-updated">Last updated {updatedOn}</p>
        </div>
      </div>

      <div className="legal-body">
        <div className="legal-body-inner">
          <nav className="legal-toc" aria-label="Sections">
            <ol>
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>
                    <span className="legal-toc-num">{String(i + 1).padStart(2, '0')}</span>
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="legal-content">
            {intro && <div className="legal-intro">{intro}</div>}
            {sections.map((s, i) => (
              <section key={s.id} id={s.id}>
                <h2>
                  <span className="legal-section-num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.heading}
                </h2>
                {s.body}
              </section>
            ))}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
