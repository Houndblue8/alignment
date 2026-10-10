// First-run data, read from the seed/ files (never written into app logic).
import contractJson from '../../seed/contract.json';
import eventsJson from '../../seed/events.json';
import placesJson from '../../seed/places.json';
import quotesJson from '../../seed/quotes.json';
import settingsJson from '../../seed/settings.json';
import visionJson from '../../seed/vision.json';
import type { EventDef, Place } from '../planner';
import type { Contract, Quote, Settings, Snapshot, Vision } from './model';

export function seedSnapshot(): Snapshot {
  const settings: Settings = {
    theme: settingsJson.theme,
    outreachCount: settingsJson.outreachCount,
    wakeTargetMin: settingsJson.wakeTargetMin,
    sleepHours: settingsJson.sleepHours,
    latestWakeMin: settingsJson.latestWakeMin,
    practiceBlock: settingsJson.practiceBlock as 'A' | 'B',
    codeRed: settingsJson.codeRed,
    codeRedLevel: 'standard',
    graduationDate: settingsJson.graduationDate,
    lastOpenDate: null,
    notifyMorning: true,
    notifyEvening: true,
    notifyBedtime: true,
    notifyBlocks: false,
    notifyPhoto: true,
    photoReminderMin: 720,
  };
  const contract: Contract = { ...contractJson, locked: false, signedName: null, signedAt: null, graduationDate: null };
  return {
    settings,
    vision: visionJson as Vision,
    contract,
    places: placesJson as unknown as Place[],
    events: eventsJson as unknown as EventDef[],
    tasks: [],
    days: {},
    blocks: [],
    quotes: quotesJson as Quote[],
    photos: [],
  };
}
