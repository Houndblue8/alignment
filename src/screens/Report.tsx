import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDays, fmtDate, weekStart } from '../planner';
import { weekClosed, type Rate, type StoredReport } from '../state/report';
import { useApp } from '../state/store';

const short = (date: string) => fmtDate(date).replace(/^\w+, /, '');

/** The latest week whose report is open: this week once Sunday closes, else last week. */
export function latestClosedWeek(s: Parameters<typeof weekClosed>[0], now: { date: string; min: number }): string {
  const thisWeek = weekStart(now.date);
  return weekClosed(s, thisWeek, now) ? thisWeek : addDays(thisWeek, -7);
}

export function Report() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const load = useApp((a) => a.scoutingReport);
  const params = useParams();
  const start = params.start ? weekStart(params.start) : latestClosedWeek(s, now);
  const closed = weekClosed(s, start, now);
  const [data, setData] = useState<StoredReport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    if (!closed) return;
    setBusy(true);
    void load(start).then((r) => {
      if (!live) return;
      setData(r);
      setBusy(false);
    });
    return () => {
      live = false;
    };
  }, [start, closed, load]);

  const again = async () => {
    setBusy(true);
    setData(await load(start, true));
    setBusy(false);
  };

  const f = data?.facts;
  const prev = addDays(start, -7);
  const next = addDays(start, 7);
  const nextOpen = next <= weekStart(now.date);

  return (
    <>
      <div className="screen-head">
        <Link className="icon-btn" aria-label="Previous week's report" to={`/report/${prev}`}>
          <ChevronLeft size={20} />
        </Link>
        <h1>Scouting report</h1>
        {nextOpen ? (
          <Link className="icon-btn" aria-label="Next week's report" to={`/report/${next}`}>
            <ChevronRight size={20} />
          </Link>
        ) : (
          <span className="icon-btn" aria-hidden="true" />
        )}
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>
        Week of {short(start)} to {short(addDays(start, 6))}
      </p>

      {!closed ? (
        <section className="card pad">
          <p className="muted">This week closes Sunday at wind-down. The report opens then.</p>
        </section>
      ) : !data ? (
        <section className="card pad" aria-busy="true">
          <p className="muted">Reviewing the film...</p>
        </section>
      ) : (
        <>
          <section className="card stack" aria-label="Series">
            <div className="row between">
              <h2>{f!.won ? `Series won: ${f!.label}` : 'Series lost'}</h2>
              <span className="num">{f!.points} pts</span>
            </div>
            <p className="small muted">
              {f!.wins} wins, {f!.halves} half wins, {f!.losses} losses
              {f!.bestDay ? `. Best day: ${fmtDate(f!.bestDay).split(',')[0]}` : ''}
            </p>
          </section>

          <div className="tiles report-tiles">
            <Stat label="Cold shower" r={f!.coldShower} />
            <Stat label="Walk" r={f!.walk} />
            <Stat label="Big 3" r={f!.big3} />
            <Stat label="Workouts" r={f!.workouts} />
            <Stat label="SHS floor" r={f!.shsFloor} />
            <Stat label="Photos" r={f!.photos} />
          </div>

          <ReportLine title="What held" text={data.report.held} />
          <ReportLine title="Where you slipped" text={data.report.slipped} />
          <ReportLine title="One adjustment" text={data.report.adjustment} accent />
          <ReportLine title="Tied to your vision" text={data.report.vision} />

          <div className="row wrap">
            <button className="btn ghost" onClick={again} disabled={busy}>
              <RefreshCw size={16} aria-hidden="true" /> Write it again
            </button>
            {data.source === 'draft' && <span className="small muted">Plain version: the coach was not available.</span>}
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, r }: { label: string; r: Rate }) {
  return (
    <div className="tile">
      <span className="num">{r.of ? `${r.done}/${r.of}` : 'None'}</span>
      <span className="small muted">{label}</span>
    </div>
  );
}

function ReportLine({ title, text, accent }: { title: string; text: string; accent?: boolean }) {
  return (
    <section className={`card stack ${accent ? 'report-accent' : ''}`} aria-label={title}>
      <h2 className="small muted caps">{title}</h2>
      <p>{text}</p>
    </section>
  );
}

/** Home: the report is in (Sunday after close-out, and all Monday). */
export function ScoutingCard({ start }: { start: string }) {
  return (
    <Link to={`/report/${start}`} className="card row scouting-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <ClipboardList size={22} aria-hidden="true" />
      <span className="grow">
        <strong>Scouting report is in</strong>
        <span className="small muted" style={{ display: 'block' }}>
          Week of {short(start)}: what held, where you slipped, one adjustment
        </span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}
