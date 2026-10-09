const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function ProfitBar({ earned, target, milestone }: { earned: number; target: number; milestone: number }) {
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / target) * 100))}%`;
  return (
    <div className="card stack">
      <div className="row between">
        <span className="small muted">Profit toward {money(target)}</span>
        <span className="small">{money(earned)}</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={earned}
        aria-label={`Profit earned ${money(earned)} of ${money(target)}`}
      >
        <div className="fill" style={{ width: pct(earned) }} />
        <div className="marker" style={{ left: pct(milestone) }} title={`First milestone ${money(milestone)}`} />
      </div>
      <span className="small muted">Marker: first milestone at {money(milestone)}</span>
    </div>
  );
}
