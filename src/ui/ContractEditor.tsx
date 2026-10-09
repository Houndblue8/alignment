import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Contract } from '../data/model';
import { useApp } from '../state/store';

/** Edit the contract terms and profit numbers. Only shown while the contract is unlocked. */
export function ContractEditor({ onSaved }: { onSaved?: () => void }) {
  const contract = useApp((a) => a.s!.contract);
  const save = useApp((a) => a.saveContract);
  const [terms, setTerms] = useState<string[]>(contract.terms);
  const [target, setTarget] = useState(String(contract.profitTarget));
  const [milestone, setMilestone] = useState(String(contract.firstMilestone));
  const patch: Partial<Contract> = {
    terms: terms.map((t) => t.trim()).filter(Boolean),
    profitTarget: Math.max(1, Number(target) || contract.profitTarget),
    firstMilestone: Math.max(0, Number(milestone) || 0),
  };
  const dirty = JSON.stringify(patch.terms) !== JSON.stringify(contract.terms) || patch.profitTarget !== contract.profitTarget || patch.firstMilestone !== contract.firstMilestone;

  return (
    <div className="stack lg">
      <ol className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {terms.map((t, i) => (
          <li key={i} className="row" style={{ alignItems: 'flex-start' }}>
            <span className="chip" aria-hidden="true">
              {i + 1}
            </span>
            <textarea
              className="field grow"
              rows={3}
              value={t}
              aria-label={`Term ${i + 1}`}
              onChange={(e) => setTerms(terms.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button className="icon-btn" aria-label={`Remove term ${i + 1}`} onClick={() => setTerms(terms.filter((_, j) => j !== i))}>
              <Trash2 size={18} />
            </button>
          </li>
        ))}
      </ol>
      <button className="btn" onClick={() => setTerms([...terms, ''])}>
        <Plus size={16} aria-hidden="true" /> Add a term
      </button>
      <div className="row wrap">
        <label className="label grow">
          Profit target ($)
          <input className="field" type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="label grow">
          First milestone ($)
          <input className="field" type="number" min={0} value={milestone} onChange={(e) => setMilestone(e.target.value)} />
        </label>
      </div>
      <button
        className="btn primary"
        disabled={!dirty || patch.terms!.length === 0}
        onClick={async () => {
          await save(patch);
          onSaved?.();
        }}
      >
        Save contract
      </button>
    </div>
  );
}
