import { RANK } from './rules';
import { weekday } from './time';
import type { EventDef, EventInstance, PlannerSettings } from './types';

function occursOn(def: EventDef, date: string, settings: Pick<PlannerSettings, 'practiceBlock'>): boolean {
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
