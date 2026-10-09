import { Check, Palette } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../state/store';
import { THEMES } from '../theme/themes';
import { Sheet } from './Sheet';

/** Swatch cards for the six themes. The choice saves to the account and applies at once. */
export function ThemePicker() {
  const current = useApp((a) => a.s!.settings.theme);
  const save = useApp((a) => a.saveSettings);
  return (
    <div className="theme-grid" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => {
        const on = current === t.id;
        return (
          <button key={t.id} role="radio" aria-checked={on} className={`theme-card ${on ? 'on' : ''}`} onClick={() => save({ theme: t.id })} data-theme-id={t.id}>
            <span className="swatch" aria-hidden="true" style={{ background: t.swatch[0] }}>
              <span style={{ background: t.swatch[1], borderColor: t.swatch[2] }} />
              <span className="dot" style={{ background: t.swatch[2] }} />
              <span className="bar" style={{ background: t.swatch[3] }} />
            </span>
            <span className="row between">
              <span className="small">{t.name}</span>
              {on && <Check size={16} aria-hidden="true" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The small palette button in the top bar. */
export function PaletteButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-btn" aria-label="Change theme" onClick={() => setOpen(true)}>
        <Palette size={20} strokeWidth={1.75} />
      </button>
      {open && (
        <Sheet title="Theme" onClose={() => setOpen(false)}>
          <ThemePicker />
        </Sheet>
      )}
    </>
  );
}
