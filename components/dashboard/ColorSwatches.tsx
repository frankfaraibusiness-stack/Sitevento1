// components/dashboard/ColorSwatches.tsx — replaces buildSwatches().
interface ColorSwatchesProps {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
}

export function ColorSwatches({ colors, value, onChange }: ColorSwatchesProps) {
  const isPreset = colors.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <div className="overlay-swatches">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`overlay-swatch${c.toLowerCase() === value.toLowerCase() ? ' active' : ''}`}
          style={{ background: c }}
          aria-label={c}
          onClick={() => onChange(c)}
        />
      ))}
      <span className="overlay-swatch-custom" style={{ background: isPreset ? 'var(--bg)' : value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </div>
  );
}
