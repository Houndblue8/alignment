import { ChevronLeft, ChevronRight, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PhotoRow, Snapshot } from '../data/model';
import { addDays, diffDays, fmtDate } from '../planner';
import { useApp } from '../state/store';
import { Sheet } from '../ui/Sheet';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A past day that was lived in the app but has no photo: the missed ritual marker (no effect on the score). */
export function missedRitual(s: Snapshot, date: string, today: string): boolean {
  return date < today && !!s.days[date]?.checkinDone && !s.photos.some((p) => p.date === date);
}

/** The photo for "day N" counting from the first photo: that day, or the first one up to 3 days after. */
export function photoForDay(photos: PhotoRow[], first: string, n: number): PhotoRow | null {
  const target = addDays(first, n - 1);
  return photos.filter((p) => p.date >= target && diffDays(target, p.date) <= 3).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

export function Memory() {
  const s = useApp((a) => a.s)!;
  const today = useApp((a) => a.now.date);
  const urlsFor = useApp((a) => a.photoUrls);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<PhotoRow | null>(null);
  const photos = useMemo(() => [...s.photos].sort((a, b) => a.date.localeCompare(b.date)), [s.photos]);

  useEffect(() => {
    void urlsFor(photos.map((p) => p.storagePath)).then(setUrls);
  }, [photos, urlsFor]);

  const first = photos[0]?.date ?? null;
  const latest = photos[photos.length - 1] ?? null;
  const thenNow: { label: string; photo: PhotoRow | null; when: string | null }[] = first
    ? [
        { label: 'Day 1', photo: photos[0]!, when: null },
        { label: 'Day 30', photo: photoForDay(photos, first, 30), when: addDays(first, 29) },
        { label: 'Day 90', photo: photoForDay(photos, first, 90), when: addDays(first, 89) },
        { label: 'Latest', photo: latest, when: null },
      ]
    : [];

  const [y, m] = month.split('-').map(Number) as [number, number];
  const firstOfMonth = `${month}-01`;
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (by: number) => {
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <>
      <div className="screen-head">
        <h1>Memory</h1>
      </div>

      {photos.length === 0 ? (
        <section className="card pad">
          <p className="muted">No photos yet. Add today's photo on Home and this page starts filling in.</p>
        </section>
      ) : (
        <section className="card stack" aria-label="Then and now">
          <h2>Then and now</h2>
          <div className="then-now">
            {thenNow.map((t) => (
              <figure key={t.label} className="tn">
                {t.photo && urls[t.photo.storagePath] ? (
                  <button className="tn-img" onClick={() => setOpen(t.photo)} aria-label={`${t.label}: ${fmtDate(t.photo.date)}`}>
                    <img src={urls[t.photo.storagePath]} alt="" />
                  </button>
                ) : (
                  <span className="tn-img empty small muted">{t.when ? fmtDate(t.when).replace(/^\w+, /, '') : ''}</span>
                )}
                <figcaption className="small muted">{t.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="card stack" aria-label="Calendar">
        <div className="row between">
          <button className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft size={20} />
          </button>
          <h2>
            {MONTHS[m - 1]} {y}
          </h2>
          <button className="icon-btn" aria-label="Next month" onClick={() => shift(1)} disabled={month >= today.slice(0, 7)}>
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="cal" role="grid" aria-label={`${MONTHS[m - 1]} ${y}`}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="cal-head small muted" aria-hidden="true">
              {d}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = addDays(firstOfMonth, i);
            const p = photos.find((x) => x.date === date);
            const missed = missedRitual(s, date, today);
            return p ? (
              <button key={date} className="cal-day has-photo" onClick={() => setOpen(p)} aria-label={`${fmtDate(date)}${p.milestone ? ', milestone' : ''}`}>
                {urls[p.storagePath] && <img src={urls[p.storagePath]} alt="" />}
                {p.milestone && <Star size={12} className="cal-star" aria-hidden="true" />}
              </button>
            ) : (
              <span key={date} className={`cal-day ${date === today ? 'today' : ''}`} aria-label={`${fmtDate(date)}${missed ? ', missed photo' : ''}`}>
                <span className="small">{i + 1}</span>
                {missed && <span className="cal-missed" aria-hidden="true" />}
              </span>
            );
          })}
        </div>
        <p className="small muted row">
          <span className="cal-missed inline" aria-hidden="true" /> Missed photo (does not change the day's score)
        </p>
      </section>

      {open && <PhotoSheet photo={open} url={urls[open.storagePath] ?? ''} onClose={() => setOpen(null)} />}
    </>
  );
}

function PhotoSheet({ photo, url, onClose }: { photo: PhotoRow; url: string; onClose: () => void }) {
  const update = useApp((a) => a.updatePhoto);
  const remove = useApp((a) => a.removePhoto);
  const current = useApp((a) => a.s!.photos.find((p) => p.date === photo.date)) ?? photo;
  const [caption, setCaption] = useState(current.caption);
  return (
    <Sheet title={fmtDate(photo.date)} onClose={onClose}>
      {url && <img src={url} alt={current.caption || fmtDate(photo.date)} className="photo-full" />}
      <label className="label">
        Caption
        <input className="field" value={caption} maxLength={140} onChange={(e) => setCaption(e.target.value)} onBlur={() => caption !== current.caption && update(photo.date, { caption })} />
      </label>
      <label className="row between">
        <span>Milestone day</span>
        <input type="checkbox" className="switch" checked={current.milestone} onChange={(e) => update(photo.date, { milestone: e.target.checked })} />
      </label>
      <button
        className="btn danger"
        style={{ justifySelf: 'start' }}
        onClick={async () => {
          if (!window.confirm('Delete this photo? This cannot be undone.')) return;
          await remove(photo.date);
          onClose();
        }}
      >
        <Trash2 size={16} aria-hidden="true" /> Delete photo
      </button>
    </Sheet>
  );
}
