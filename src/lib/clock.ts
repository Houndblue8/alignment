// The only place the app reads the real clock. Everything is America/Los_Angeles local time.
import { formatInTimeZone } from 'date-fns-tz';

export const TZ = 'America/Los_Angeles';

export interface Now {
  date: string;
  min: number;
}

/** Tests can freeze time with localStorage 'alignment.fakeNow' = 'YYYY-MM-DDTHH:mm'. */
export function nowLocal(): Now {
  let s: string | null = null;
  try {
    s = localStorage.getItem('alignment.fakeNow');
  } catch {
    s = null;
  }
  if (!s) s = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm");
  const [date, time] = s.split('T') as [string, string];
  const [h, m] = time.split(':').map(Number) as [number, number];
  return { date, min: h * 60 + m };
}
