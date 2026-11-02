'use client';

// components/agent/AgentBlob.tsx
//
// Small appearance of the brand's lime "slime" character (same blob-
// path technique as components/marketing/HeroSlime.tsx and
// components/BootSplash.tsx) sized for use inside the AI Agent page
// rather than the marketing hero. Kept as its own tiny file instead of
// importing HeroSlime directly so the agent page's bundle/CSS stays
// fully self-contained (see styles/agent/agent-page.css's header comment) —
// no dependency on marketing-hero.css's layout assumptions.
//
// Two tiny expressions:
//   - 'greet'  — open eyes, slight tilt, used at the top of the page so
//     the agent feels like something the owner is "meeting" rather
//     than a settings form.
//   - 'wink'   — one eye closed, used next to the upsell banner as a
//     little nudge, not a hard sell.
// Both share the same body silhouette (fixed seed) so the character
// reads as consistent across the page.
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

// Same fixed seed/shape family as HeroSlime so the silhouette reads as
// the same character, just re-generated at this component's own
// viewBox scale.
const BODY_PATH = makeBlobPath(60, 64, 44, 6.5, 11, 4242);

interface AgentBlobProps {
  variant?: 'greet' | 'wink';
  className?: string;
}

export function AgentBlob({ variant = 'greet', className = '' }: AgentBlobProps) {
  const [blinking, setBlinking] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (variant !== 'greet') return;
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
  }, [variant]);

  return (
    <div className={`agt-blob ${className}`} aria-hidden="true">
      <svg className="agt-blob-svg" viewBox="0 0 120 134">
        <ellipse className="agt-blob-shadow" cx="60" cy="118" rx="34" ry="6" />
        <g className="agt-blob-wrap">
          <path className="agt-blob-body" d={BODY_PATH} />
          <ellipse className="agt-blob-shine" cx="46" cy="46" rx="11" ry="7" />

          {variant === 'wink' ? (
            <g className="agt-blob-eyes">
              <path className="agt-blob-wink" d="M 38 62 Q 44 57 50 62" />
              <ellipse className="agt-blob-eye-white" cx="74" cy="62" rx="6.5" ry="7.5" />
              <circle className="agt-blob-eye-pupil" cx="76" cy="64" r="3" />
            </g>
          ) : (
            <g className={`agt-blob-eyes${blinking ? ' is-blinking' : ''}`}>
              <g className="agt-blob-eye">
                <ellipse className="agt-blob-eye-white" cx="49" cy="62" rx="6.5" ry="7.5" />
                <circle className="agt-blob-eye-pupil" cx="51" cy="64" r="3" />
              </g>
              <g className="agt-blob-eye">
                <ellipse className="agt-blob-eye-white" cx="71" cy="62" rx="6.5" ry="7.5" />
                <circle className="agt-blob-eye-pupil" cx="73" cy="64" r="3" />
              </g>
            </g>
          )}

          <path className="agt-blob-mouth" d="M 55 76 Q 60 80 65 76" />
        </g>
      </svg>
    </div>
  );
}
