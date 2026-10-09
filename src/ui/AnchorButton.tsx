import { Check, Snowflake, Sunrise } from 'lucide-react';
import { useState } from 'react';
import { haptic } from '../lib/haptics';

const META = {
  coldShower: { label: 'Cold shower', Icon: Snowflake },
  walk: { label: 'Walk with God', Icon: Sunrise },
} as const;

/** A large circular toggle for a morning anchor. Marking it done plays a fill, a check and a burst ring. */
export function AnchorButton({ kind, done, onToggle }: { kind: keyof typeof META; done: boolean; onToggle: (next: boolean) => void }) {
  const { label, Icon } = META[kind];
  const [burst, setBurst] = useState(0);
  return (
    <button
      type="button"
      className={`anchor ${done ? 'is-done' : ''}`}
      aria-pressed={done}
      aria-label={`${label} ${done ? 'Done' : 'Not yet'}`}
      onClick={() => {
        if (!done) {
          haptic();
          setBurst((n) => n + 1);
        }
        onToggle(!done);
      }}
    >
      {burst > 0 && done && <span key={burst} className="anchor-burst" aria-hidden="true" />}
      <span className="anchor-icon" aria-hidden="true">
        {done ? <Check size={34} strokeWidth={2.5} className="anchor-check" /> : <Icon size={34} strokeWidth={1.5} />}
      </span>
      <span>{label}</span>
      <span className="small">{done ? 'Done' : 'Not yet'}</span>
    </button>
  );
}
