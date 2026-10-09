import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fromHHMM, toHHMM } from '../lib/format';
import { useApp } from '../state/store';

const CHIPS: [string, number][] = [
  ['6:30', 390],
  ['7:00', 420],
  ['7:30', 450],
  ['8:00', 480],
];

export function CheckIn() {
  const now = useApp((a) => a.now);
  const checkIn = useApp((a) => a.checkIn);
  const busy = useApp((a) => a.busy);
  const navigate = useNavigate();
  const nowRounded = Math.floor(now.min / 5) * 5;
  const [wake, setWake] = useState<number | null>(nowRounded);
  const [cold, setCold] = useState(false);
  const [walk, setWalk] = useState(false);

  return (
    <main className="fullscreen">
      <div className="stack">
        <p className="small muted">Morning check-in</p>
        <h1 className="big">What time did you wake up?</h1>
        {now.min >= 14 * 60 && <p className="muted">The rest of the day will be built from now.</p>}
      </div>

      <label>
        <span className="sr-only">Wake time</span>
        <input className="time-input" type="time" step={300} value={wake === null ? '' : toHHMM(wake)} onChange={(e) => setWake(fromHHMM(e.target.value))} />
      </label>
      <div className="row wrap" role="group" aria-label="Quick wake times">
        {CHIPS.map(([label, min]) => (
          <button key={label} type="button" className="chip" aria-pressed={wake === min} onClick={() => setWake(min)}>
            {label}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={wake === nowRounded} onClick={() => setWake(nowRounded)}>
          Just now
        </button>
      </div>

      <div className="anchors">
        <button type="button" className="anchor" aria-pressed={cold} onClick={() => setCold(!cold)}>
          <span>Cold shower</span>
          <span className="small">{cold ? 'Done' : 'Not yet'}</span>
        </button>
        <button type="button" className="anchor" aria-pressed={walk} onClick={() => setWalk(!walk)}>
          <span>Walk with God</span>
          <span className="small">{walk ? 'Done' : 'Not yet'}</span>
        </button>
      </div>

      <button
        className="btn primary block"
        disabled={wake === null || busy}
        onClick={async () => {
          if (wake === null) return;
          await checkIn({ wakeMin: wake, coldShowerDone: cold, walkDone: walk });
          navigate('/', { replace: true });
        }}
      >
        {busy ? 'Building' : 'Build my day'}
      </button>
    </main>
  );
}
