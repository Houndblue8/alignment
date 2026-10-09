import type { ReactNode } from 'react';

/** A progress ring. value and max are counts; children sit in the center. */
export function Ring({ value, max, size = 168, stroke = 14, label, children }: { value: number; max: number; size?: number; stroke?: number; label: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="ring-wrap" role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <defs>
          {/* Black Panther's chrome outline: a faint metallic sheen on the thin line only. */}
          <linearGradient id="chrome-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8a9099" />
            <stop offset="45%" stopColor="#c9ced6" />
            <stop offset="55%" stopColor="#f2f4f7" />
            <stop offset="100%" stopColor="#8a9099" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 - 3} fill="none" strokeWidth={1} className="ring-outline" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="center">{children}</div>
    </div>
  );
}
