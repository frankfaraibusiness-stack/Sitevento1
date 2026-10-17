'use client';

// components/layout/MarketingFooter.tsx — replaces <footer class="site-footer">.
import { useNewsletterSubmit } from '@/hooks/useNewsletterSubmit';

export function MarketingFooter() {
  const { email, setEmail, submitting, note, handleSubmit } = useNewsletterSubmit();

  return (
    <footer className="site-footer">
      <div className="footer-capture">
        <div>
          <h3>Get setup tips and product updates</h3>
          <p>
            One email a month. What&apos;s new on the dashboard, plus tricks teams are using with overlays and
            widgets.
          </p>
        </div>
        <div>
          <form className="email-form" onSubmit={handleSubmit}>
            <label
              htmlFor="footer-email"
              className="visually-hidden"
              style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
            >
              Email address
            </label>
            <input
              id="footer-email"
              type="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit">{submitting ? '...' : 'Subscribe'}</button>
          </form>
          <p className="footer-note">{note}</p>
        </div>
      </div>

      <div className="footer-grid">
        <div className="footer-col">
          <span className="brand">sitevento</span>
          <p className="tagline">One script tag. A control panel for everything that happens on your site.</p>
        </div>
        <div className="footer-col">
          <h4>Product</h4>
          <ul>
            <li>
              <a href="/product/visit-logs">Visit logs</a>
            </li>
            <li>
              <a href="/product/email-capture">Email capture</a>
            </li>
            <li>
              <a href="/product/live-overlays">Live overlays</a>
            </li>
            <li>
              <a href="/product/dashboard">Dashboard</a>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Company</h4>
          <ul>
            <li>
              <a href="/about">About</a>
            </li>
            <li>
              <a href="/pricing">Pricing</a>
            </li>
            <li>
              <a href="/careers">Careers</a>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Resources</h4>
          <ul>
            <li>
              <a href="/docs">Documentation</a>
            </li>
            <li>
              <a href="/changelog">Changelog</a>
            </li>
            <li>
              <a href="/status">Status</a>
            </li>
            <li>
              <a href="/support">Support</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>
          © 2026 sitevento. All rights reserved. &nbsp;·&nbsp; <a href="/terms">Terms</a> &nbsp;·&nbsp;{' '}
          <a href="/privacy">Privacy</a>
        </span>
        <div className="socials">
          <a href="https://x.com" target="_blank" rel="noopener noreferrer">X</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
      </div>
    </footer>
  );
}
