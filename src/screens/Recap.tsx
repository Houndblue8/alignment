import { ChevronLeft, ChevronRight, Images, Pencil, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDate } from '../planner';
import { monthFacts, monthName, prevMonth } from '../state/recap';
import { useApp } from '../state/store';

const nextMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

/** Monthly recap (Appendix E 2): photos, the record, the anchors, the best day, a letter, and the vision check. */
export function Recap() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const loadLetter = useApp((a) => a.monthLetter);
  const urlsFor = useApp((a) => a.photoUrls);
  const params = useParams();
  const month = params.month ?? now.date.slice(0, 7);
  const f = useMemo(() => monthFacts(s, month, now), [s, month, now]);
  const [letter, setLetter] = useState<{ text: string; source: 'coach' | 'plain' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const fitsKey = `alignment.visionFits.${month}`;
  const [fits, setFits] = useState(() => {
    try {
      return localStorage.getItem(fitsKey) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let live = true;
    setLetter(null);
    if (!f.days) return;
    void loadLetter(month).then((l) => live && setLetter(l));
    return () => {
      live = false;
    };
    // The letter follows the month; the facts inside are read when it is written.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, f.days, loadLetter]);

  useEffect(() => {
    void urlsFor(f.photos.map((p) => p.storagePath)).then(setUrls);
  }, [f.photos, urlsFor]);

  const again = async () => {
    setBusy(true);
    setLetter(await loadLetter(month, true));
    setBusy(false);
  };
  const firstSentence = s.vision.identity.split(/(?<=\.)\s/)[0] ?? s.vision.identity;

  return (
    <>
      <div className="screen-head">
        <Link className="icon-btn" aria-label="Previous month" to={`/recap/${prevMonth(month)}`}>
          <ChevronLeft size={20} />
        </Link>
        <h1>{monthName(month)}</h1>
        {nextMonth(month) <= now.date.slice(0, 7) ? (
          <Link className="icon-btn" aria-label="Next month" to={`/recap/${nextMonth(month)}`}>
            <ChevronRight size={20} />
          </Link>
        ) : (
          <span className="icon-btn" aria-hidden="true" />
        )}
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>
        Monthly recap{f.soFar ? ', so far' : ''}
      </p>

      {f.days === 0 ? (
        <section className="card pad">
          <p className="muted">
            Nothing counted this month{s.settings.statsFrom ? ` (stats start ${fmtDate(s.settings.statsFrom).replace(/^\w+, /, '')})` : ''}.
          </p>
        </section>
      ) : (
        <>
          {f.photos.length > 0 && (
            <section className="card stack" aria-label="Photo timeline">
              <div className="row between">
                <h2>Photos</h2>
                <Link to="/memory" className="small muted row" style={{ gap: 4 }}>
                  <Images size={14} aria-hidden="true" /> Memory
                </Link>
              </div>
              <div className="photo-strip">
                {f.photos.map((p) => (
                  <figure key={p.date} className="strip-item">
                    {urls[p.storagePath] ? <img src={urls[p.storagePath]} alt={p.caption || fmtDate(p.date)} /> : <span className="strip-empty" />}
                    <figcaption className="small muted">{fmtDate(p.date).replace(/^\w+, /, '')}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <div className="tiles report-tiles" aria-label="The month in numbers">
            <Tile n={`${f.series.won}-${f.series.lost}`} label="Series" />
            <Tile n={`${f.wins}/${f.days}`} label="Wins" />
            <Tile n={f.workouts} label="Workouts" />
            <Tile n={f.coldShower} label="Cold showers" />
            <Tile n={f.walk} label="Walks with God" />
            <Tile n={`${f.big3.done}/${f.big3.of}`} label="Big 3" />
          </div>

          {f.bestDay && (
            <section className="card row" aria-label="Best day">
              <span className="grow">
                <span className="small muted">Best day</span>
                <br />
                {fmtDate(f.bestDay.date)}
              </span>
              <span className="chip">{f.bestDay.big3} Big 3 done</span>
            </section>
          )}

          <section className="card stack report-accent" aria-label="Letter from your coach">
            <h2 className="small muted caps">From your coach</h2>
            {letter ? <p className="letter">{letter.text}</p> : <p className="muted">Writing your letter...</p>}
            <div className="row wrap">
              <button className="btn ghost" onClick={again} disabled={busy || !letter}>
                <RefreshCw size={16} aria-hidden="true" /> Write it again
              </button>
              {letter?.source === 'plain' && <span className="small muted">Plain version: the coach was not available.</span>}
            </div>
          </section>
        </>
      )}

      <section className="card stack" aria-label="Vision check">
        <h2 className="small muted caps">Does your vision still fit?</h2>
        <p>{firstSentence}</p>
        {fits ? (
          <p className="small muted">You said it still fits this month.</p>
        ) : (
          <div className="row wrap">
            <button
              className="btn primary"
              onClick={() => {
                setFits(true);
                try {
                  localStorage.setItem(fitsKey, '1');
                } catch {
                  // Only a convenience.
                }
              }}
            >
              Still fits
            </button>
            <Link to="/vision" className="btn">
              <Pencil size={16} aria-hidden="true" /> Edit my vision
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

function Tile({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="tile">
      <span className="num">{n}</span>
      <span className="small muted">{label}</span>
    </div>
  );
}
