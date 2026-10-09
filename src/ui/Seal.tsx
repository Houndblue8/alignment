/** A wax-seal mark in the theme accent, with the Alignment monogram. */
export function Seal({ size = 88, className = '' }: { size?: number; className?: string }) {
  const bumps = 28;
  const outer = 46;
  const inner = 41;
  const pts: string[] = [];
  for (let i = 0; i < bumps * 2; i++) {
    const a = (Math.PI * i) / bumps;
    const r = i % 2 === 0 ? outer : inner + 1;
    pts.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
  }
  return (
    <svg className={`seal ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={pts.join(' ')} className="seal-wax" />
      <circle cx="50" cy="50" r="34" className="seal-ring" />
      <circle cx="50" cy="50" r="29" className="seal-ring thin" />
      <text x="50" y="62" textAnchor="middle" className="seal-letter">
        A
      </text>
    </svg>
  );
}
