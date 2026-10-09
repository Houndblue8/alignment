import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { ContractEditor } from '../ui/ContractEditor';
import { ProfitBar } from '../ui/ProfitBar';

/**
 * Contract to Self: shown on first launch only. Signing shows the name and date, holds, then the app
 * moves on (tap to skip). The handwriting animation arrives in Phase 4.
 */
export function Contract() {
  const s = useApp((a) => a.s)!;
  const sign = useApp((a) => a.signContract);
  const [name, setName] = useState('');
  const [signed, setSigned] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const saved = useRef(false);

  const finish = () => {
    if (!signed || saved.current) return;
    saved.current = true;
    void sign(signed);
  };

  useEffect(() => {
    if (!signed) return;
    const t = setTimeout(finish, 2400);
    return () => clearTimeout(t);
    // finish only depends on signed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signed]);

  return (
    <main className="fullscreen" onClick={signed ? finish : undefined}>
      <div className="stack">
        <p className="small muted">Contract to Self</p>
        <h1 className="big">I already decided.</h1>
      </div>
      {editing ? (
        <ContractEditor onSaved={() => setEditing(false)} />
      ) : (
        <>
          <ol className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {s.contract.terms.map((t, i) => (
              <li key={i} className="card row" style={{ alignItems: 'flex-start' }}>
                <span className="chip" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          {!signed && (
            <button className="btn ghost" style={{ justifySelf: 'start' }} onClick={() => setEditing(true)}>
              Edit the terms
            </button>
          )}
        </>
      )}
      {editing ? null : !signed ? (
        <form
          className="stack lg"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setSigned(name.trim());
          }}
        >
          <label className="label">
            Type your full name to sign
            <input className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn primary block" disabled={!name.trim()}>
            Sign
          </button>
        </form>
      ) : (
        <div className="card pad stack" data-testid="signature">
          <p className="signature">{signed}</p>
          <p className="small muted">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <p className="small muted">Tap anywhere to continue.</p>
        </div>
      )}
      <ProfitBar earned={s.contract.profitEarned} target={s.contract.profitTarget} milestone={s.contract.firstMilestone} />
    </main>
  );
}
