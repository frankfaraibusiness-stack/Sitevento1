'use client';

// components/connect/ConnectBlob.tsx
//
// Self-contained copy of the brand's "slime" character (same blob-path
// technique as components/agent/AgentBlob.tsx, components/marketing/
// HeroSlime.tsx and components/BootSplash.tsx), kept independent of
// agent-page.css so the connect wizard's CSS stays self-contained (see
// styles/connect-wizard.css).
//
// Unlike AgentBlob, this one is tintable: a `tone` prop swaps its fill
// between the brand lime (idle/neutral), a green (verification
// succeeded), and a red (verification failed) — used by the full-screen
// status banner in ConnectSiteWizard's tag/verify step so a pass or
// fail reads instantly, not just through the status text.
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

// Same fixed seed/shape family as AgentBlob/HeroSlime so the silhouette
// reads as the same character at this component's own viewBox scale.
const BODY_PATH = makeBlobPath(60, 64, 44, 6.5, 11, 4242);

export type ConnectBlobTone = 'idle' | 'success' | 'fail' | 'scan';
export type ConnectBlobVariant = 'greet' | 'happy' | 'worried';

interface ConnectBlobProps {
  tone?: ConnectBlobTone;
  variant?: ConnectBlobVariant;
  className?: string;
}

export function ConnectBlob({ tone = 'idle', variant = 'greet', className = '' }: ConnectBlobProps) {
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
    <div className={`cnb ${tone === 'success' ? 'cnb-success' : tone === 'fail' ? 'cnb-fail' : tone === 'scan' ? 'cnb-scan' : ''} ${className}`} aria-hidden="true">
      <svg className="cnb-svg" viewBox="0 0 120 134">
        <ellipse className="cnb-shadow" cx="60" cy="118" rx="34" ry="6" />
        <g className="cnb-wrap">
          <path className="cnb-body" d={BODY_PATH} />
          <ellipse className="cnb-shine" cx="46" cy="46" rx="11" ry="7" />

          {variant === 'worried' ? (
            <g className="cnb-eyes">
              <ellipse className="cnb-eye-white" cx="49" cy="64" rx="6" ry="7" />
              <circle className="cnb-eye-pupil" cx="51" cy="67" r="2.6" />
              <ellipse className="cnb-eye-white" cx="71" cy="64" rx="6" ry="7" />
              <circle className="cnb-eye-pupil" cx="69" cy="67" r="2.6" />
              <path className="cnb-brow" d="M 42 54 L 53 57" />
              <path className="cnb-brow" d="M 78 54 L 67 57" />
            </g>
          ) : variant === 'happy' ? (
            <g className="cnb-eyes">
              <path className="cnb-happy-eye" d="M 43 64 Q 49 58 55 64" />
              <path className="cnb-happy-eye" d="M 65 64 Q 71 58 77 64" />
            </g>
          ) : (
            <g className={`cnb-eyes${blinking ? ' is-blinking' : ''}`}>
              <g className="cnb-eye">
                <ellipse className="cnb-eye-white" cx="49" cy="62" rx="6.5" ry="7.5" />
                <circle className="cnb-eye-pupil" cx="51" cy="64" r="3" />
              </g>
              <g className="cnb-eye">
                <ellipse className="cnb-eye-white" cx="71" cy="62" rx="6.5" ry="7.5" />
                <circle className="cnb-eye-pupil" cx="73" cy="64" r="3" />
              </g>
            </g>
          )}

          <path
            className="cnb-mouth"
            d={variant === 'worried' ? 'M 55 80 Q 60 76 65 80' : variant === 'happy' ? 'M 52 76 Q 60 84 68 76' : 'M 55 76 Q 60 80 65 76'}
          />
        </g>
      </svg>
    </div>
  );
}
