'use client';

// components/auth/PasswordStrengthMeter.tsx
//
// Replaces checkStrength(val) — same scoring rule (length >= 8, has
// upper+digit, has symbol + length >= 10) and same bar colors, computed
// as a derived value instead of mutating three bar elements by id.
const COLORS = ['#b3432b', '#d99a2b', '#6ba84f'];

function scoreOf(val: string): number {
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val) && val.length >= 10) score++;
  return score;
}

export function PasswordStrengthMeter({ value }: { value: string }) {
  const score = scoreOf(value);
  return (
    <div className="strength-meter">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="bar"
          style={{ background: i < score ? COLORS[Math.max(score - 1, 0)] : 'var(--line)' }}
        />
      ))}
    </div>
  );
}
