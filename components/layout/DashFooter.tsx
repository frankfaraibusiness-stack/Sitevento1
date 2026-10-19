'use client';

// components/layout/DashFooter.tsx — replaces <footer class="dash-footer">.
interface DashFooterProps {
  onBackToMarketing: () => void;
}

export function DashFooter({ onBackToMarketing }: DashFooterProps) {
  return (
    <footer className="dash-footer">
      <div className="dash-footer-inner">
        <span className="dash-footer-brand">sitevento</span>
        <div className="dash-footer-links">
          <a href="/support" target="_blank" rel="noopener noreferrer">Help &amp; support</a>
          <a href="/docs" target="_blank" rel="noopener noreferrer">Documentation</a>
          <a href="/status" target="_blank" rel="noopener noreferrer">Status</a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onBackToMarketing();
              window.scrollTo({ top: 0, behavior: 'auto' });
            }}
          >
            Back to sitevento.com
          </a>
        </div>
        <span className="dash-footer-copy">© 2026 sitevento</span>
      </div>
    </footer>
  );
}
