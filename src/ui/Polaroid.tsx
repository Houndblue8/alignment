import { fmtDate } from '../planner';

/** A developed shot as a polaroid: the white card, the photo, and the line and date written underneath. */
export function Polaroid({ src, date, caption, small = false, testId }: { src: string; date: string; caption: string; small?: boolean; testId?: string }) {
  return (
    <figure className={`polaroid ${small ? 'small' : ''}`} data-testid={testId}>
      <div className="polaroid-photo">{src ? <img src={src} alt={caption || fmtDate(date)} /> : <span className="strip-empty" />}</div>
      <figcaption>
        {!small && caption && <span className="polaroid-caption">{caption}</span>}
        <span className="polaroid-date">{fmtDate(date).replace(/^\w+, /, '')}</span>
      </figcaption>
    </figure>
  );
}
