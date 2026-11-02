// app/not-found.tsx — sitevento's own 404, rendered by Next.js for any
// unmatched route instead of the framework default. Plain Server
// Component (no 'use client' needed here): the only client pieces are
// AuthBlob and SiteFooter, which are already client components
// themselves and work fine mounted inside a server tree.
import Link from 'next/link';
import { AuthBlob } from '@/components/auth/AuthBlob';
import { SiteFooter } from '@/components/layout/SiteFooter';

export default function NotFound() {
  return (
    <>
      <header className="nf-header">
        <div className="pill-nav">
          <Link href="/" aria-label="sitevento home">
            <img
              className="nav-logo"
              src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
              alt="sitevento"
            />
          </Link>
        </div>
      </header>

      <main className="nf-main">
        <div className="nf-card">
          <span className="nf-code">404</span>
          <AuthBlob className="nf-blob" />
          <h1>This page wandered off</h1>
          <p>
            The page you&apos;re looking for doesn&apos;t exist, moved, or never did. Let&apos;s get you back
            somewhere useful.
          </p>
          <div className="nf-actions">
            <Link href="/" className="nf-cta-primary">
              Back to home
            </Link>
            <Link href="/support" className="nf-cta-secondary">
              Contact support
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
