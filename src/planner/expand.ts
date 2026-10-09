import { RANK } from './rules';
import { weekday } from './time';
import type { CodeRedLevel, EventDef, EventInstance, PlannerSettings } from './types';

function occursOn(def: EventDef, date: string, settings: Pick<PlannerSettings, 'practiceBlock'>): boolean {
  if (def.tentative) return false;
  if (def.skipDates?.includes(date)) return false;
  if (def.activeFrom && date < def.activeFrom) return false;
  if (def.activeTo && date > def.activeTo) return false;
  if (def.practiceBlock && def.practiceBlock !== settings.practiceBlock) return false;
  if (def.recurringWeekly) return def.weekday === weekday(date);
  if (!def.date) return false;
  return date >= def.date && date <= (def.endDate ?? def.date);
}

export function toInstance(def: EventDef): EventInstance {
  return {
    id: def.id,
    title: def.title,
    kind: def.kind,
    start: def.start,
    end: def.end,
    location: def.location,
    rankKey: def.rankKey,
    rank: RANK[def.rankKey],
    immovable: def.immovable,
    overridableByCodeRed: def.overridableByCodeRed,
    allDay: !!def.allDay,
    noWork: !!def.noWork,
    away: !!def.away,
  };
}

/** Weekly and one-time events that fall on date, sorted by start then id. */
export function expandEvents(defs: EventDef[], date: string, settings: Pick<PlannerSettings, 'practiceBlock'>): EventInstance[] {
  return defs
    .filter((d) => occursOn(d, date, settings))
    .map(toInstance)
    .sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
}

export const isFlexibleEvent = (e: EventInstance): boolean => e.rankKey === 'social' || e.rankKey === 'discipleship';
export const isSchoolEvent = (e: EventInstance): boolean => e.rankKey === 'school';
export const isPractice = (e: Pick<EventInstance, 'rankKey'>): boolean => e.rankKey === 'club_practice' || e.rankKey === 'flag_football';

/**
 * Code Red keeps immovable events, school items and events marked not overridable (church, Epic large group).
 * Standard Code Red also keeps practices; severe ("all in") pauses them.
 */
export function pausedByCodeRed(e: EventInstance, level: CodeRedLevel = 'standard'): boolean {
  if (e.immovable || isSchoolEvent(e) || !e.overridableByCodeRed) return false;
  if (level === 'standard' && isPractice(e)) return false;
  return true;
}

/** The one-time event that confirms a tentative weekly event (discipleship) on a date. */
export function confirmTentative(def: EventDef, date: string, start: number, end: number): EventDef {
  const { tentative: _t, weekday: _w, skipDates: _s, activeFrom: _f, activeTo: _to, ...rest } = def;
  return { ...rest, id: `${def.id}-${date}`, date, start, end, recurringWeekly: false };
}
