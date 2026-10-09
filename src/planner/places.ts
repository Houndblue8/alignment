import { RULES } from './rules';
import type { Place, WorkType } from './types';

/**
 * Drive minutes between two places. Every place knows its time from home and from campus,
 * so the trip between two places is the shorter of going via home or via campus distances.
 * Unknown places use the default travel time.
 */
export function travel(places: Place[], a: string, b: string): number {
  if (a === b) return 0;
  const pa = places.find((p) => p.id === a);
  const pb = places.find((p) => p.id === b);
  if (!pa || !pb) return RULES.defaultTravelMin;
  return Math.min(pa.minutesFromHome + pb.minutesFromHome, pa.minutesFromCampus + pb.minutesFromCampus);
}

export function placeName(places: Place[], id: string): string {
  return places.find((p) => p.id === id)?.name ?? id;
}

/** True for places that are on campus (zero minutes from campus). */
export function onCampus(places: Place[], id: string): boolean {
  const p = places.find((x) => x.id === id);
  return !!p && p.minutesFromCampus === 0;
}

/**
 * The one work place for the day. On campus days it is the closest place to campus that is good for
 * the work (the library). Otherwise the closest place to home that is good for that kind of work.
 */
export function workPlace(places: Place[], type: WorkType, campusDay: boolean): string {
  const fits = places.filter((p) => p.goodFor.includes(campusDay ? 'deep' : type));
  const key = (p: Place) => (campusDay ? p.minutesFromCampus : p.minutesFromHome);
  const best = [...fits].sort((x, y) => key(x) - key(y) || x.id.localeCompare(y.id))[0];
  return best?.id ?? 'library';
}
