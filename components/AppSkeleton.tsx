'use client';

// components/AppSkeleton.tsx
//
// One shared loading state, used everywhere a page needs to show
// "working on it" instead of either (a) the full 6+ second BootSplash
// boot animation replaying on every in-app navigation, or (b) ad hoc
// per-page loading markup (a bare "Loading…" string, a tiny unstyled
// "…", or a skeleton shaped differently from every other page).
//
// Brand motif, not a generic gray-bars skeleton: the lime blob
// character (same silhouette family as components/BootSplash.tsx and
// components/agent/AgentBlob.tsx, self-contained here so this doesn't
// depend on agent-page.css, which is route-scoped) sits next to the
// sitevento logo, both gently breathing, above a shimmering row of
// placeholder blocks shaped like the content that's about to load.
//
// Deliberately NOT a full-screen overlay like BootSplash — this is
// meant to sit inline, in place of the content that's loading, inside
// whatever page mounts it (settings, dashboard, profile, manage-site,
// the widget designer) so the header/sidebar chrome around it stays
// put instead of flashing to a blank screen on every route change.
// Pass `fullScreen` for the rare case a page has no chrome to sit
// inside of yet.
import '@/styles/app-skeleton.css';

interface AppSkeletonProps {
  label?: string;
  fullScreen?: boolean;
  rows?: number;
}

export function AppSkeleton({ label = 'Loading\u2026', fullScreen = false, rows = 3 }: AppSkeletonProps) {
  return (
    <div
      className={`app-skel${fullScreen ? ' app-skel-full' : ''}`}
      role="status"
      aria-label={label}
    >
      <div className="app-skel-mark">
        <svg className="app-skel-blob" viewBox="0 0 120 134" aria-hidden="true">
          <ellipse className="app-skel-blob-shadow" cx="60" cy="118" rx="34" ry="6" />
          <g className="app-skel-blob-wrap">
            <path
              className="app-skel-blob-body"
              d="M60.0 20.9 C73.4 21.4, 84.3 25.4, 91.7 37.2 C100.3 45.6, 101.9 57.3, 101.8 65.2 C102.3 74.9, 98.2 83.9, 90.1 91.1 C83.5 100.4, 71.4 105.5, 60.0 108.2 C48.3 105.1, 36.9 101.3, 29.3 91.7 C19.9 85.4, 17.4 74.6, 18.2 65.2 C17.0 56.1, 20.2 45.3, 28.2 37.8 C35.2 27.0, 47.7 21.6, 60.0 20.9 Z"
            />
            <ellipse className="app-skel-blob-shine" cx="46" cy="46" rx="11" ry="7" />
            <g className="app-skel-blob-eyes">
              <ellipse className="app-skel-eye-white" cx="49" cy="62" rx="6.5" ry="7.5" />
              <circle className="app-skel-eye-pupil" cx="51" cy="64" r="3" />
              <ellipse className="app-skel-eye-white" cx="71" cy="62" rx="6.5" ry="7.5" />
              <circle className="app-skel-eye-pupil" cx="73" cy="64" r="3" />
            </g>
            <path className="app-skel-blob-mouth" d="M 55 76 Q 60 80 65 76" />
          </g>
        </svg>
        <img
          className="app-skel-logo"
          src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
          alt="sitevento"
        />
      </div>

      <div className="app-skel-rows" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="app-skel-row" style={{ width: `${86 - i * 14}%` }} />
        ))}
      </div>
    </div>
  );
}
