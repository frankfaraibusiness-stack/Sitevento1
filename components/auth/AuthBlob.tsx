'use client';

// components/auth/AuthBlob.tsx
//
// Small appearance of the brand's "slime" character (same blob-path
// technique as components/marketing/HeroSlime.tsx and
// components/agent/AgentBlob.tsx) sized for the auth overlay. Kept as
// its own tiny file, styled by .auth-blob-* rules inlined in
// styles/auth/auth-overlay.css, so AuthOverlay doesn't need agent-page.css
// (which isn't imported globally) just to greet the visitor.
//
// The overlay sits directly on the lime body background, so this
// variant inverts the usual lime-body/ink-face coloring: ink body,
// lime face, so the character still reads clearly against the lime
// behind it instead of disappearing into it.
import { useEffect, useRef, useState } from 'react';

function makeBlobPath(cx: number, cy: number, baseR: number, jitter: number, points: number, seed: number): string {
  let s = seed;
  function rand() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const r = baseR + (rand() - 0.5) * jitter * 2;
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    const c1x = p1.x + (p2.x - p0.x) / 5;
    const c1y = p1.y + (p2.y - p0.y) / 5;
    const c2x = p2.x - (p3.x - p1.x) / 5;
    const c2y = p2.y - (p3.y - p1.y) / 5;
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
  }
  return d + 'Z';
}

// Same fixed seed/shape family as HeroSlime/AgentBlob so the
// silhouette reads as the same character across the app.
const BODY_PATH = makeBlobPath(60, 64, 44, 6.5, 11, 4242);

interface AuthBlobProps {
  className?: string;
}

export function AuthBlob({ className = '' }: AuthBlobProps) {
  const [blinking, setBlinking] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function scheduleBlink() {
      const next = 2600 + Math.random() * 3200;
      timeoutRef.current = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 150);
        scheduleBlink();
      }, next);
    }
    scheduleBlink();
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div className={`auth-blob ${className}`} aria-hidden="true">
      <svg className="auth-blob-svg" viewBox="0 0 120 134">
        <ellipse className="auth-blob-shadow" cx="60" cy="118" rx="34" ry="6" />
        <g className="auth-blob-wrap">
          <path className="auth-blob-body" d={BODY_PATH} />
          <ellipse className="auth-blob-shine" cx="46" cy="46" rx="11" ry="7" />

          <g className={`auth-blob-eyes${blinking ? ' is-blinking' : ''}`}>
            <g className="auth-blob-eye">
              <ellipse className="auth-blob-eye-white" cx="49" cy="62" rx="6.5" ry="7.5" />
              <circle className="auth-blob-eye-pupil" cx="51" cy="64" r="3" />
            </g>
            <g className="auth-blob-eye">
              <ellipse className="auth-blob-eye-white" cx="71" cy="62" rx="6.5" ry="7.5" />
              <circle className="auth-blob-eye-pupil" cx="73" cy="64" r="3" />
            </g>
          </g>

          <path className="auth-blob-mouth" d="M 55 76 Q 60 80 65 76" />
        </g>
      </svg>
    </div>
  );
}
