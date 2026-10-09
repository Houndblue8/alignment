import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ContractEditor } from '../ui/ContractEditor';
import { JOURNEYS, type Vision as VisionT } from '../data/model';
import { useApp } from '../state/store';
import { ProfitBar } from '../ui/ProfitBar';

export function Vision() {
  const s = useApp((a) => a.s)!;
  const saveVision = useApp((a) => a.saveVision);
  const saveContract = useApp((a) => a.saveContract);
  const [v, setV] = useState<VisionT>(s.vision);
  const [profit, setProfit] = useState(String(s.contract.profitEarned));
  const [grad, setGrad] = useState(s.contract.graduationDate ?? '');
  const [editingContract, setEditingContract] = useState(false);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  const dirty = JSON.stringify(v) !== JSON.stringify(s.vision);

  return (
    <>
      <div className="screen-head">
        <Link to="/" className="icon-btn" aria-label="Back to home">
          <ChevronLeft size={20} />
        </Link>
        <h1>Vision</h1>
        <span style={{ width: 44 }} />
      </div>

      <section className="card stack">
        <h2>Why</h2>
        <p>{s.vision.whyShort}</p>
        <details className="collapse">
          <summary className="small muted">Read the full why</summary>
          <p>{s.vision.why}</p>
        </details>
      </section>

      <section className="card stack lg">
        <label className="label">
          Identity statement
          <textarea className="field" rows={6} value={v.identity} onChange={(e) => setV({ ...v, identity: e.target.value })} />
        </label>
        <label className="label">
          3 to 5 year end result
          <textarea className="field" rows={6} value={v.endResult} onChange={(e) => setV({ ...v, endResult: e.target.value })} />
        </label>
        <label className="label">
          Perfect day
          <textarea className="field" value={v.perfectDay} onChange={(e) => setV({ ...v, perfectDay: e.target.value })} />
        </label>
        <h2>Best version of me</h2>
        {JOURNEYS.map((j) => (
          <label key={j.id} className="label">
            {j.label}
            <textarea
              className="field"
              rows={2}
              value={v.bestVersion[j.id]}
              onChange={(e) => setV({ ...v, bestVersion: { ...v.bestVersion, [j.id]: e.target.value } })}
            />
          </label>
        ))}
        <button className="btn primary" disabled={!dirty} onClick={() => saveVision(v)}>
          Save vision
        </button>
      </section>

      <section className="card stack lg" id="contract">
        <div className="row between">
          <h2>Contract to Self</h2>
          <span className="chip">{s.contract.locked ? 'Locked' : 'Editable'}</span>
        </div>
        {editingContract ? (
          <ContractEditor onSaved={() => setEditingContract(false)} />
        ) : (
          <ol className="stack" style={{ margin: 0, paddingLeft: 18 }}>
            {s.contract.terms.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        )}
        {!s.contract.locked && !editingContract && (
          <div className="row wrap">
            <button className="btn" onClick={() => setEditingContract(true)}>
              Edit terms
            </button>
            <button
              className="btn"
              onClick={() => {
                if (window.confirm('Lock the contract? You can still read it, but the terms can no longer be edited.')) void saveContract({ locked: true });
              }}
            >
              Lock contract
            </button>
          </div>
        )}
        {s.contract.signedName && (
          <p className="small muted">
            Signed by {s.contract.signedName} on {new Date(s.contract.signedAt!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        <ProfitBar earned={s.contract.profitEarned} target={s.contract.profitTarget} milestone={s.contract.firstMilestone} />
        <div className="row wrap">
          <label className="label grow">
            Profit earned so far ($)
            <input className="field" type="number" min={0} step={1} value={profit} onChange={(e) => setProfit(e.target.value)} />
          </label>
          <label className="label grow">
            Graduation date
            <input className="field" type="date" value={grad} onChange={(e) => setGrad(e.target.value)} />
          </label>
        </div>
        <button className="btn" onClick={() => saveContract({ profitEarned: Math.max(0, Number(profit) || 0), graduationDate: grad || null })}>
          Save
        </button>
      </section>
    </>
  );
}
