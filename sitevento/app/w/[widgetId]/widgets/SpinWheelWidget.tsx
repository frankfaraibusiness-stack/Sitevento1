'use client';

// A real spinning wheel: renders N equal slices as conic-gradient
// wedges, spins to a genuinely randomized slice using a CSS transition
// (not a canned animation), and reveals that slice's prize text once it
// settles. Visitor can only spin once per browser (localStorage), same
// "once to unlock" framing as the dashboard card's own description.
import { useEffect, useMemo, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

const SPIN_KEY = 'sv_w_spin_result';
const COLORS = ['#8a5a3c', '#c6ff3d', '#4f3626', '#efe7d3', '#6b4a34', '#f6f2e7'];

function parsePrizes(v: unknown): string[] {
  if (typeof v === 'string' && v.trim()) {
    const list = v.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length >= 2) return list;
  }
  return ['10% OFF', 'Free Shipping', '15% OFF', 'Try Again', '20% OFF', '5% OFF'];
}

export function SpinWheelWidget({ config }: Props) {
  const prizes = useMemo(() => parsePrizes(config.prizes), [config.prizes]);
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';
  const n = prizes.length;
  const sliceDeg = 360 / n;

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  // Starts null on both server and client's first render (avoiding a
  // hydration mismatch — localStorage doesn't exist during server
  // render), then picks up any prior result right after mount.
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    try {
      const prior = localStorage.getItem(SPIN_KEY);
      if (prior) setResult(prior);
    } catch {
      /* storage unavailable — treat as no prior spin */
    }
  }, []);

  const gradient = useMemo(
    () =>
      prizes
        .map((_, i) => `${COLORS[i % COLORS.length]} ${i * sliceDeg}deg ${(i + 1) * sliceDeg}deg`)
        .join(', '),
    [prizes, sliceDeg]
  );

  function spin() {
    if (spinning || result) return;
    setSpinning(true);
    const winnerIndex = Math.floor(Math.random() * n);
    // Land the pointer (fixed at top, 0deg) on the middle of the winning
    // slice: rotate so that slice's center ends up at 0deg, plus several
    // full turns for visual effect.
    const targetDeg = 360 * 5 + (360 - (winnerIndex * sliceDeg + sliceDeg / 2));
    setRotation(targetDeg);
    setTimeout(() => {
      const prize = prizes[winnerIndex];
      setResult(prize);
      setSpinning(false);
      try {
        localStorage.setItem(SPIN_KEY, prize);
      } catch {
        /* ignore */
      }
    }, 4200);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
        height: '100%',
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ position: 'relative', width: 180, height: 180 }}>
        <div
          style={{
            position: 'absolute',
            top: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: `14px solid ${accent}`,
            zIndex: 2,
          }}
        />
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: `conic-gradient(${gradient})`,
            border: '4px solid #fff',
            boxShadow: '0 2px 14px rgba(0,0,0,0.18)',
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        />
      </div>

      {result ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: accent }}>{result}</div>
          <div style={{ fontSize: 11, color: '#6b655c', marginTop: 2 }}>Your spin result</div>
        </div>
      ) : (
        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          style={{
            background: accent,
            color: '#fff',
            border: 0,
            borderRadius: 999,
            padding: '9px 22px',
            fontSize: 13,
            fontWeight: 700,
            cursor: spinning ? 'default' : 'pointer',
            opacity: spinning ? 0.7 : 1,
          }}
        >
          {spinning ? 'Spinning\u2026' : 'Spin the wheel'}
        </button>
      )}
    </div>
  );
}
