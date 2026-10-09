import { Check, MapPin, MoreVertical, Pin, RefreshCw, SkipForward } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { journeyLabel } from '../data/model';
import { fmtTime, fromHHMM, journeyStyle, kindJourney, shortDuration, toHHMM } from '../lib/format';
import type { Block } from '../planner';
import { dayOf } from '../state/planning';
import { useApp } from '../state/store';
import { AnchorButton } from '../ui/AnchorButton';
import { Big3Section } from '../ui/Big3';
import { Sheet } from '../ui/Sheet';

export function Today() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const busy = useApp((a) => a.busy);
  const replan = useApp((a) => a.replan);
  const setAnchor = useApp((a) => a.setAnchor);
  const rec = dayOf(s, now.date);
  const blocks = s.blocks.filter((b) => b.date === now.date).sort((a, b) => a.start - b.start || a.end - b.end);
  const [sheet, setSheet] = useState<null | 'wake' | 'lost' | 'codeRed'>(null);
  const [menu, setMenu] = useState(false);
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'center' });
  }, [hash]);

  const mode = rec.lostDay ? 'Lost Day' : s.settings.codeRed ? (s.settings.codeRedLevel === 'severe' ? 'Code Red: all in' : 'Code Red') : null;

  return (
    <>
      <div className="screen-head" style={{ position: 'relative' }}>
        <h1>Today</h1>
        <button className="icon-btn" aria-label="Day options" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <MoreVertical size={20} />
        </button>
        {menu && (
          <div className="menu" role="menu" onClick={() => setMenu(false)}>
            <button role="menuitem" onClick={() => setSheet('wake')}>
              Edit wake time
            </button>
            <button role="menuitem" onClick={() => setSheet('lost')}>
              {rec.lostDay ? 'End Lost Day' : 'Start Lost Day'}
            </button>
            <button role="menuitem" onClick={() => setSheet('codeRed')}>
              Code Red
            </button>
          </div>
        )}
      </div>

      {mode && <p className="banner warn">{mode} is on.</p>}

      <div className="anchors">
        <AnchorButton kind="coldShower" done={rec.coldShower.done} onToggle={(d) => setAnchor('coldShower', d)} />
        <AnchorButton kind="walk" done={rec.walk.done} onToggle={(d) => setAnchor('walk', d)} />
      </div>

      <Big3Section />

      {rec.plan.warnings.map((w) => (
        <p key={w} className="banner warn small">
          {w}
        </p>
      ))}
      {rec.plan.notes.length > 0 && (
        <details className="collapse card">
          <summary>
            <span className="small muted">Notes ({rec.plan.notes.length})</span>
          </summary>
          <ul className="small stack" style={{ margin: 0, paddingLeft: 18 }}>
            {rec.plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}

      <section aria-label="Schedule" className="timeline" data-testid="timeline">
        {blocks.length === 0 && <p className="muted">No plan yet. Tap Replan to build it.</p>}
        {blocks.map((b) => (
          <BlockRow key={b.id} b={b} nowMin={now.min} />
        ))}
      </section>

      {rec.plan.belowTheLine.length > 0 && (
        <details className="collapse card">
          <summary>
            <span>Below the line</span>
            <span className="chip">{rec.plan.belowTheLine.length}</span>
          </summary>
          <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
            {rec.plan.belowTheLine.map((b) => (
              <li key={b.taskId} className="small">
                {b.title} <span className="muted">({shortDuration(b.minutes)}). {b.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {rec.plan.bedtime && (
        <p className="small muted" style={{ textAlign: 'center' }}>
          Tonight: bed by {fmtTime(rec.plan.bedtime.bedMin)}, wake at {fmtTime(rec.plan.bedtime.wakeMin)}
        </p>
      )}

      <div className="sticky-bottom">
        <button className="btn primary block" onClick={replan} disabled={busy} aria-busy={busy}>
          <RefreshCw size={18} aria-hidden="true" className={busy ? 'spin' : ''} />
          {busy ? 'Replanning' : 'Replan'}
        </button>
      </div>

      {sheet === 'wake' && <WakeSheet onClose={() => setSheet(null)} />}
      {sheet === 'lost' && <LostDaySheet onClose={() => setSheet(null)} />}
      {sheet === 'codeRed' && <CodeRedSheet onClose={() => setSheet(null)} />}
    </>
  );
}

function BlockRow({ b, nowMin }: { b: Block; nowMin: number }) {
  const s = useApp((a) => a.s)!;
  const setStatus = useApp((a) => a.setBlockStatus);
  const togglePin = useApp((a) => a.togglePin);
  const [open, setOpen] = useState(false);
  const place = s.places.find((p) => p.id === b.placeId);
  const task = b.taskId ? s.tasks.find((t) => t.id === b.taskId) : undefined;
  const journey = task?.journey ?? kindJourney(b.kind);
  const isNow = b.start <= nowMin && nowMin < b.end;

  if (b.kind === 'travel') {
    return (
      <div className="tl-row" id={b.id}>
        <span className="tl-time">{fmtTime(b.start)}</span>
        <div className="tl-card travel small muted">
          {b.title}, {shortDuration(b.end - b.start)}
        </div>
      </div>
    );
  }

  return (
    <div className="tl-row" id={b.id}>
      <span className="tl-time">{fmtTime(b.start)}</span>
      <div className="stack">
        <button
          className={`tl-card ${b.status === 'done' ? 'done' : ''} ${isNow ? 'now' : ''}`}
          style={journeyStyle(journey)}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          data-testid="block"
        >
          <span className="row">
            <span className="title grow clip">{b.title}</span>
            {b.pinned && <Pin size={14} aria-label="Pinned" />}
            {b.status === 'done' && <Check size={16} aria-label="Done" />}
          </span>
          <span className="row wrap">
            {place && (
              <span className="chip outline">
                <MapPin size={12} aria-hidden="true" />
                {place.name}
              </span>
            )}
            {b.kind === 'bed' ? (
              <span className="chip">End of the day</span>
            ) : (
              <span className="chip">{shortDuration(b.end - b.start)}</span>
            )}
          </span>
        </button>
        {open && (
          <div className="card stack">
            {journey && <span className="small muted">{journeyLabel(journey)}</span>}
            {b.howto && b.howto.length > 0 && (
              <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {b.howto.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ol>
            )}
            <span className="small muted">
              {fmtTime(b.start)} to {fmtTime(b.end)}
            </span>
            <div className="row wrap">
              <button className="btn" onClick={() => setStatus(b.id, b.status === 'done' ? 'planned' : 'done')}>
                <Check size={16} aria-hidden="true" /> {b.status === 'done' ? 'Not done' : 'Done'}
              </button>
              <button className="btn" onClick={() => setStatus(b.id, b.status === 'skipped' ? 'planned' : 'skipped')}>
                <SkipForward size={16} aria-hidden="true" /> {b.status === 'skipped' ? 'Unskip' : 'Skip'}
              </button>
              <button className="btn" aria-pressed={b.pinned} onClick={() => togglePin(b.id)}>
                <Pin size={16} aria-hidden="true" /> {b.pinned ? 'Unpin' : 'Pin'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WakeSheet({ onClose }: { onClose: () => void }) {
  const s = useApp((a) => a.s)!;
  const date = useApp((a) => a.now.date);
  const editWake = useApp((a) => a.editWake);
  const [v, setV] = useState(toHHMM(dayOf(s, date).wakeMin ?? s.settings.wakeTargetMin));
  return (
    <Sheet title="Edit wake time" onClose={onClose}>
      <input className="time-input" type="time" step={300} value={v} onChange={(e) => setV(e.target.value)} aria-label="Wake time" />
      <button
        className="btn primary block"
        onClick={async () => {
          const m = fromHHMM(v);
          if (m !== null) await editWake(m);
          onClose();
        }}
      >
        Save and replan
      </button>
    </Sheet>
  );
}

function LostDaySheet({ onClose }: { onClose: () => void }) {
  const s = useApp((a) => a.s)!;
  const date = useApp((a) => a.now.date);
  const start = useApp((a) => a.startLostDay);
  const end = useApp((a) => a.endLostDay);
  const [reason, setReason] = useState('');
  const on = dayOf(s, date).lostDay;
  return (
    <Sheet title={on ? 'End Lost Day' : 'Start Lost Day'} onClose={onClose}>
      {on ? (
        <>
          <p className="muted">Go back to the full plan from now.</p>
          <button
            className="btn primary block"
            onClick={async () => {
              await end();
              onClose();
            }}
          >
            End Lost Day
          </button>
        </>
      ) : (
        <>
          <p className="muted">The rest of today is cut to what is possible. Two salvage wins make it a Half win.</p>
          <label className="label">
            One line: what happened?
            <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} />
          </label>
          <button
            className="btn primary block"
            disabled={!reason.trim()}
            onClick={async () => {
              await start(reason);
              onClose();
            }}
          >
            Start Lost Day
          </button>
        </>
      )}
    </Sheet>
  );
}

function CodeRedSheet({ onClose }: { onClose: () => void }) {
  const settings = useApp((a) => a.s!.settings);
  const setCodeRed = useApp((a) => a.setCodeRed);
  const choose = async (on: boolean, level?: 'standard' | 'severe') => {
    await setCodeRed(on, level);
    onClose();
  };
  const current = settings.codeRed ? settings.codeRedLevel : 'off';
  return (
    <Sheet title="Code Red" onClose={onClose}>
      <p className="muted small">School and immovable events first. Church and Epic large group stay. Stays on until you switch it off.</p>
      <button className="btn block" aria-pressed={current === 'standard'} onClick={() => choose(true, 'standard')}>
        Code Red (practices stay)
      </button>
      <button className="btn block" aria-pressed={current === 'severe'} onClick={() => choose(true, 'severe')}>
        Code Red: all in (practices pause)
      </button>
      <button className="btn block" aria-pressed={current === 'off'} onClick={() => choose(false)}>
        Off
      </button>
    </Sheet>
  );
}
