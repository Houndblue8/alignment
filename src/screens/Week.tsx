import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDate, fmtTime, journeyStyle, kindJourney, shortDuration } from '../lib/format';
import { addDays, weekStart } from '../planner';
import { anchorStreaks, seasonRecord, weekResults } from '../state/planning';
import { useApp } from '../state/store';
import { SeriesBar } from '../ui/Series';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WORD = { win: 'Win', half: 'Half win', loss: 'Loss' } as const;

export function Week() {
  const s = useApp((a) => a.s)!;
  const today = useApp((a) => a.now.date);
  const [offset, setOffset] = useState(0);
  const start = addDays(weekStart(today), offset * 7);
  const results = weekResults(s, start);
  const season = seasonRecord(s, today);
  const streaks = anchorStreaks(s, today);

  return (
    <>
      <div className="screen-head">
        <button className="icon-btn" aria-label="Previous week" onClick={() => setOffset(offset - 1)}>
          <ChevronLeft size={20} />
        </button>
        <h1>{offset === 0 ? 'This week' : `Week of ${fmtDate(start).split(', ')[1]}`}</h1>
        <button className="icon-btn" aria-label="Next week" onClick={() => setOffset(offset + 1)}>
          <ChevronRight size={20} />
        </button>
      </div>

      <section className="card">
        <SeriesBar results={results} />
      </section>

      <div className="tiles">
        <div className="tile">
          <span className="num">
            {season.won}-{season.lost}
          </span>
          <span className="small muted">Season</span>
        </div>
        <div className="tile">
          <span className="num">{streaks.coldShower}</span>
          <span className="small muted">Cold shower streak</span>
        </div>
        <div className="tile">
          <span className="num">{streaks.walk}</span>
          <span className="small muted">Walk streak</span>
        </div>
      </div>

      <div className="stack" data-testid="week-days">
        {results.map((r, i) => {
          const date = addDays(start, i);
          const blocks = s.blocks.filter((b) => b.date === date && b.kind !== 'travel' && b.kind !== 'bed' && b.kind !== 'winddown');
          return (
            <Link
              key={date}
              to={`/week/${date}`}
              className="card row"
              style={{ textDecoration: 'none', color: 'inherit' }}
              aria-label={`${fmtDate(date)}${r ? `, ${WORD[r]}` : ''}, ${blocks.length} blocks`}
            >
              <span style={{ width: 40 }} className={date === today ? '' : 'muted'}>
                {DAY[i]}
              </span>
              <span className={`result ${r ?? ''} ${date === today ? 'today' : ''}`} aria-hidden="true">
                {r === 'win' ? 'W' : r === 'half' ? 'H' : r === 'loss' ? 'L' : ''}
              </span>
              <span className="bars grow" aria-hidden="true" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(10px, 1fr))', display: 'grid', gap: 3 }}>
                {blocks.slice(0, 24).map((b) => {
                  const t = b.taskId ? s.tasks.find((x) => x.id === b.taskId) : undefined;
                  return <span key={b.id} style={journeyStyle(t?.journey ?? kindJourney(b.kind))} />;
                })}
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </>
  );
}

export function DayDetail() {
  const { date = '' } = useParams();
  const s = useApp((a) => a.s)!;
  const blocks = s.blocks.filter((b) => b.date === date).sort((a, b) => a.start - b.start);
  const rec = s.days[date];
  return (
    <>
      <div className="screen-head">
        <Link to="/week" className="icon-btn" aria-label="Back to week">
          <ChevronLeft size={20} />
        </Link>
        <h1>{fmtDate(date)}</h1>
        <span style={{ width: 44 }} />
      </div>
      {rec?.plan.warnings.map((w) => (
        <p key={w} className="banner warn small">
          {w}
        </p>
      ))}
      <section className="timeline">
        {blocks.length === 0 && <p className="muted">Nothing planned for this day yet.</p>}
        {blocks.map((b) => {
          const t = b.taskId ? s.tasks.find((x) => x.id === b.taskId) : undefined;
          return (
            <div key={b.id} className="tl-row">
              <span className="tl-time">{fmtTime(b.start)}</span>
              <div className={`tl-card ${b.kind === 'travel' ? 'travel small muted' : ''} ${b.status === 'done' ? 'done' : ''}`} style={journeyStyle(t?.journey ?? kindJourney(b.kind))}>
                <span className="title clip">{b.title}</span>
                {b.kind !== 'travel' && b.kind !== 'bed' && <span className="small muted">{shortDuration(b.end - b.start)}</span>}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
