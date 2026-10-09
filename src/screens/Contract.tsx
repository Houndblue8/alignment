import { CalendarCheck, Compass, Mountain, ScrollText, Sunrise, TrendingUp, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { nowLocal } from '../lib/clock';
import { haptic } from '../lib/haptics';
import { useApp } from '../state/store';
import { ContractEditor } from '../ui/ContractEditor';
import { HeroMedia } from '../ui/HeroMedia';
import { ProfitBar } from '../ui/ProfitBar';
import { Seal } from '../ui/Seal';

const ICONS: LucideIcon[] = [Sunrise, TrendingUp, Mountain, Compass, CalendarCheck];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const today = () => {
  const [y, m, d] = nowLocal().date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

/**
 * Contract to Self (Appendix C 4). Shown once. Signing writes the name by hand from left to right, draws the
 * line, fades in the date and stamps the seal; it holds, then the app fades and slides up to the next screen.
 * Tap anywhere to skip. Reduced motion: a plain fade.
 */
export function Contract() {
  const s = useApp((a) => a.s)!;
  const sign = useApp((a) => a.signContract);
  const [name, setName] = useState('');
  const [signed, setSigned] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const saved = useRef(false);

  const finish = () => {
    if (!signed || saved.current) return;
    saved.current = true;
    setLeaving(true);
    setTimeout(() => void sign(signed), reducedMotion() ? 0 : 500);
  };

  useEffect(() => {
    if (!signed) return;
    // Writing 2 s, line and date, seal stamp, then hold about 1.5 s.
    const t = setTimeout(finish, reducedMotion() ? 1500 : 4000);
    return () => clearTimeout(t);
    // finish only depends on signed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signed]);

  const shownName = signed ?? (name.trim() || null);

  return (
    <main className={`fullscreen contract-screen ${leaving ? 'leaving' : ''}`} onClick={signed ? finish : undefined}>
      <HeroMedia name="contract" />
      <article className="contract-doc" aria-labelledby="contract-title">
        <header className="doc-head">
          <Seal size={44} className="doc-mark" />
          <p className="eyebrow">Contract to Self</p>
          <h1 id="contract-title" className="big">
            I already decided.
          </h1>
          <p className="doc-intro">
            I, <span className={`blank ${shownName ? 'filled' : ''}`}>{shownName ?? ' '.repeat(18)}</span>, make this agreement with myself
            on {today()}.
          </p>
        </header>

        {editing ? (
          <ContractEditor onSaved={() => setEditing(false)} />
        ) : (
          <ol className="clauses">
            {s.contract.terms.map((t, i) => {
              const Icon = ICONS[i] ?? ScrollText;
              return (
                <li key={i} className="clause" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="clause-num" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.6} />
                    <span>{ROMAN[i] ?? i + 1}</span>
                  </span>
                  <p>{t}</p>
                </li>
              );
            })}
          </ol>
        )}

        {!signed && !editing && (
          <button className="btn ghost" style={{ justifySelf: 'start' }} onClick={() => setEditing(true)}>
            Edit the terms
          </button>
        )}

        <footer className="sign-area">
          {!signed ? (
            !editing && (
              <form
                className="stack lg"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  haptic();
                  setSigned(name.trim());
                }}
              >
                <label className="label">
                  Type your full name to sign
                  <input className="field sign-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <button className="btn primary block" disabled={!name.trim()}>
                  Sign
                </button>
              </form>
            )
          ) : (
            <div className="signature-block" data-testid="signature">
              <div className="sig">
                <span className="sig-text">{signed}</span>
                <span className="sig-line" aria-hidden="true" />
                <span className="sig-label small muted">Signature</span>
              </div>
              <Seal size={84} className="seal-stamp" />
              <p className="sig-date small muted">{today()}</p>
              <p className="small muted sig-skip">Tap anywhere to continue.</p>
            </div>
          )}
        </footer>
      </article>
      <ProfitBar earned={s.contract.profitEarned} target={s.contract.profitTarget} milestone={s.contract.firstMilestone} />
    </main>
  );
}
