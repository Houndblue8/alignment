import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmtTime, fromHHMM } from '../lib/format';
import { addDays, expandEvents, weekStart, weekday } from '../planner';
import { anchorStreaks, dayOf, nextBlock, quoteFor, seasonRecord, todayProgress, weekResults } from '../state/planning';
import { useApp } from '../state/store';
import { Big3Section } from '../ui/Big3';
import { Ring } from '../ui/Ring';
import { SeriesBar, WeekCircles } from '../ui/Series';

export function Home() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const navigate = useNavigate();
  const [whyOpen, setWhyOpen] = useState(false);
  const rec = dayOf(s, now.date);
  const progress = todayProgress(s, now.date);
  const next = nextBlock(s, now);
  const results = weekResults(s, now.date);
  const season = seasonRecord(s, now.date);
  const streaks = anchorStreaks(s, now.date);
  const quote = quoteFor(s, now.date);
  const bed = rec.plan.bedtime;
  const firstLine = s.vision.identity.split(/(?<=\.)\s/)[0] ?? s.vision.identity;

  return (
    <>
      <IsaacPrompt />
      <CodeRedHint />

      <section className="card pad stack lg" style={{ justifyItems: 'center' }}>
        <Ring value={progress.done} max={progress.total} label={`${progress.done} of ${progress.total} done today`}>
          <span className="big">
            {progress.done}/{progress.total}
          </span>
          <span className="small muted">today</span>
        </Ring>
        {next ? (
          <button className="btn primary block" onClick={() => navigate(`/today#${encodeURIComponent(next.id)}`)}>
            Next: {next.title} <span className="small">{fmtTime(next.start)}</span>
          </button>
        ) : (
          <Link className="btn primary block" to="/today">
            Open today
          </Link>
        )}
        {bed && (
          <p className="small muted" data-testid="bedtime">
            Tonight: bed by {fmtTime(bed.bedMin)}, wake at {fmtTime(bed.wakeMin)}
          </p>
        )}
      </section>

      <Big3Section />

      <section className="card stack" aria-label="This week">
        <div className="row between">
          <h2>Series</h2>
          <Link to="/week" className="small muted">
            Week <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
          </Link>
        </div>
        <WeekCircles start={weekStart(now.date)} results={results} today={now.date} />
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

      <section className="card stack">
        <p className={whyOpen ? '' : 'clamp2'}>{firstLine}</p>
        {whyOpen && (
          <>
            <p className="muted">{s.vision.whyShort}</p>
            <Link to="/vision" className="small">
              Vision and contract
            </Link>
          </>
        )}
        <button className="btn ghost" style={{ justifySelf: 'start', paddingLeft: 0 }} aria-expanded={whyOpen} onClick={() => setWhyOpen(!whyOpen)}>
          {whyOpen ? 'Show less' : 'Read my why'}
        </button>
      </section>

      {quote && (
        <section className="card">
          <p className="small">{quote.text}</p>
        </section>
      )}
    </>
  );
}

/** Thursday (and Friday morning if unanswered): is discipleship with Isaac happening Friday? (D7) */
function IsaacPrompt() {
  const s = useApp((a) => a.s)!;
  const date = useApp((a) => a.now.date);
  const answer = useApp((a) => a.answerIsaac);
  const [time, setTime] = useState('10:00');
  const wd = weekday(date);
  const def = s.events.find((e) => e.tentative);
  if (!def || (wd !== 4 && wd !== 5)) return null;
  const thursday = wd === 4 ? date : addDays(date, -1);
  if (s.days[thursday]?.isaacAnswer || (wd === 5 && s.days[date]?.isaacAnswer)) return null;
  return (
    <section className="card stack" aria-label={def.title}>
      <p>{def.title} {wd === 4 ? 'tomorrow' : 'today'}?</p>
      <div className="row wrap">
        <input className="field" style={{ width: 130 }} type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Start time" />
        <button className="btn primary" onClick={() => answer(true, fromHHMM(time) ?? 600)}>
          Yes, at {fmtTime(fromHHMM(time) ?? 600)}
        </button>
        <button className="btn" onClick={() => answer(false)}>
          Not this week
        </button>
      </div>
    </section>
  );
}

/** Suggests Code Red "all in" when an exam is 2 days away (D6). Eli decides. */
function CodeRedHint() {
  const s = useApp((a) => a.s)!;
  const date = useApp((a) => a.now.date);
  const setCodeRed = useApp((a) => a.setCodeRed);
  const [hidden, setHidden] = useState(false);
  if (hidden || (s.settings.codeRed && s.settings.codeRedLevel === 'severe')) return null;
  const exam = [0, 1, 2].flatMap((k) => expandEvents(s.events, addDays(date, k), s.settings)).find((e) => e.kind === 'exam');
  if (!exam) return null;
  return (
    <section className="banner warn stack" role="note">
      <p>
        {exam.title} is within 2 days. Switch Code Red to all in? Practices pause too.
      </p>
      <div className="row">
        <button className="btn primary" onClick={() => setCodeRed(true, 'severe')}>
          All in
        </button>
        <button className="btn" onClick={() => setHidden(true)}>
          Not now
        </button>
      </div>
    </section>
  );
}
