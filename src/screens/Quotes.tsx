import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { QuoteTag } from '../data/model';
import { useApp } from '../state/store';
import { Sheet } from '../ui/Sheet';

const TAGS: { id: QuoteTag; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'win', label: 'Win' },
  { id: 'hard_day', label: 'Hard day' },
  { id: 'regret', label: 'Regret' },
];
const tagLabel = (t: QuoteTag) => TAGS.find((x) => x.id === t)?.label ?? t;

export function Quotes() {
  const quotes = useApp((a) => a.s!.quotes);
  const remove = useApp((a) => a.deleteQuote);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="screen-head">
        <h1>Quotes</h1>
        <button className="icon-btn" aria-label="Add a quote" onClick={() => setAdding(true)}>
          <Plus size={22} />
        </button>
      </div>
      {quotes.length === 0 && <p className="muted">No quotes yet. Tap the plus to add one.</p>}
      {quotes.map((q) => (
        <article key={q.id} className="card">
          <p>{q.text}</p>
          <div className="row between">
            <div className="row wrap">
              {q.tags.map((t) => (
                <span key={t} className="chip">
                  {tagLabel(t)}
                </span>
              ))}
            </div>
            <button className="icon-btn" aria-label="Delete quote" onClick={() => remove(q.id)}>
              <Trash2 size={18} />
            </button>
          </div>
        </article>
      ))}
      {adding && <AddQuote onClose={() => setAdding(false)} />}
    </>
  );
}

function AddQuote({ onClose }: { onClose: () => void }) {
  const add = useApp((a) => a.addQuote);
  const [text, setText] = useState('');
  const [tags, setTags] = useState<QuoteTag[]>(['general']);
  const toggle = (t: QuoteTag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  return (
    <Sheet title="Add a quote" onClose={onClose}>
      <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} aria-label="Quote" />
      <div className="row wrap" role="group" aria-label="When to show it">
        {TAGS.map((t) => (
          <button key={t.id} className="chip" aria-pressed={tags.includes(t.id)} onClick={() => toggle(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <button
        className="btn primary block"
        disabled={!text.trim() || tags.length === 0}
        onClick={async () => {
          await add(text, tags);
          onClose();
        }}
      >
        Save quote
      </button>
    </Sheet>
  );
}
