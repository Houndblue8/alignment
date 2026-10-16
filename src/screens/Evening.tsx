import { useMemo, useState } from 'react';
import { fmtDate } from '../planner';
import { fireFor } from '../state/fire';
import { buildingFor } from '../state/temple';
import { useApp } from '../state/store';
import { Big3Section } from '../ui/Big3';
import { FireMeter, FireSheet, FireWeek, InnerCheckCard } from '../ui/Focus';
import { PhotoCard } from '../ui/PhotoCard';
import { Temple3D } from '../ui/Temple3D';
import { Notices } from './Home';

/** After 9 PM, Home becomes the evening recap: the day's temple and fire, the night check, and the photo. */
export const EVENING_MIN = 21 * 60;

export function Evening({ onFull }: { onFull: () => void }) {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const b = useMemo(() => buildingFor(s, now.date, now), [s, now]);
  const fire = useMemo(() => fireFor(s, now), [s, now]);
  const [fireOpen, setFireOpen] = useState(false);
  const photo = s.photos.some((p) => p.date === now.date);
  return (
    <div className="stack lg" data-testid="evening">
      <div className="stack" style={{ gap: 2 }}>
        <p className="section-label">Tonight</p>
        <h1>{fmtDate(now.date)}</h1>
      </div>
      <Notices />
      <section className="card pad stack" style={{ justifyItems: 'center' }} aria-label="The day">
        <Temple3D b={b} fire={fire} theme={s.settings.theme} still />
        <FireMeter fire={fire} onOpen={() => setFireOpen(true)} />
        <p className="small muted" style={{ textAlign: 'center' }}>
          {fire.line}
        </p>
        <FireWeek days={fire.week} label="The fire this week" />
      </section>
      {!photo && (
        <div className="stack" style={{ gap: 6 }}>
          <p className="section-label">Today's photo is still open</p>
          <PhotoCard />
        </div>
      )}
      <Big3Section />
      <InnerCheckCard always />
      <button className="btn ghost" onClick={onFull}>
        Show the rest of Home
      </button>
      {fireOpen && <FireSheet fire={fire} onClose={() => setFireOpen(false)} />}
    </div>
  );
}
