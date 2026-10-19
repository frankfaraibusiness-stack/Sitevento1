// components/content/ContentBlob.tsx
//
// Static corner mascot for ContentPageShell's hero, reusing
// AgentBlob.tsx's body-path generator (same fixed seed, so the
// silhouette reads as the same character across the whole app) but
// without AgentBlob's blink-interval state — ContentPageShell and
// every page built on it are plain Server Components with no 'use
// client', and these content routes don't need the blink's tiny bit
// of personality enough to justify pulling client JS into otherwise
// statically-generated pages. Eyes stay open, same as AgentBlob's
// resting frame.
//
// The blob SVG parts (.agt-blob-*) are styled by styles/agent-page.css,
// which every page using ContentPageShell must import alongside
// styles/content-pages.css — see each page.tsx's import list.
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

const BODY_PATH = makeBlobPath(60, 64, 44, 6.5, 11, 4242);

export function ContentBlob({ className = '' }: { className?: string }) {
  return (
    <div className={`agt-blob ${className}`} aria-hidden="true">
      <svg className="agt-blob-svg" viewBox="0 0 120 134">
        <ellipse className="agt-blob-shadow" cx="60" cy="118" rx="34" ry="6" />
        <g className="agt-blob-wrap">
          <path className="agt-blob-body" d={BODY_PATH} />
          <ellipse className="agt-blob-shine" cx="46" cy="46" rx="11" ry="7" />
          <g className="agt-blob-eyes">
            <g className="agt-blob-eye">
              <ellipse className="agt-blob-eye-white" cx="49" cy="62" rx="6.5" ry="7.5" />
              <circle className="agt-blob-eye-pupil" cx="51" cy="64" r="3" />
            </g>
            <g className="agt-blob-eye">
              <ellipse className="agt-blob-eye-white" cx="71" cy="62" rx="6.5" ry="7.5" />
              <circle className="agt-blob-eye-pupil" cx="73" cy="64" r="3" />
            </g>
          </g>
          <path className="agt-blob-mouth" d="M 55 76 Q 60 80 65 76" />
        </g>
      </svg>
    </div>
  );
}
