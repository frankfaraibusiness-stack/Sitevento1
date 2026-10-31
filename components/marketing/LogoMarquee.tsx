// components/marketing/LogoMarquee.tsx — replaces .marquee-wrap. The
// logo list is duplicated (x2) in the original to make the CSS scroll
// loop seamless; kept duplicated here on purpose, not a bug.
const LOGOS = [
  'Northwind Retail',
  'Fernbrook Labs',
  'Harlow & Co.',
  'Driftline Studio',
  'Pacific Analytics',
  'Kestrel Systems',
];

export function LogoMarquee() {
  const doubled = [...LOGOS, ...LOGOS];
  return (
    <div className="marquee-wrap" aria-hidden="true">
      <p className="marquee-label">Trusted by teams running on sitevento</p>
      <div className="marquee-fade">
        <div className="marquee-track">
          {doubled.map((name, i) => (
            <span className="marquee-chip" key={i}>
              <span className="marquee-chip-dot" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
