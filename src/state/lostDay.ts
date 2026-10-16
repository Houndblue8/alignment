// A Lost Day (Eli, Oct 16): the Big 3 is set aside and the rest of the day is turned toward God with one faith
// focus. Pure: the focus ideas to pick from.
import type { Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import { eventPillar } from './pillars';

const IDEAS = [
  'Pray and give Him what I am carrying',
  'Read a Psalm slowly and sit with it',
  'Serve someone tonight without being asked',
  'Reach out to someone and share what God is doing',
  'Worship: put on worship music and be still',
];

/** Faith events still ahead today come first ("Be intentional at Epic large group"), then quiet ways back to Him. */
export function focusIdeas(s: Snapshot, now: Now): string[] {
  const events = s.blocks
    .filter((b) => b.date === now.date && b.kind === 'event' && b.end > now.min && b.status !== 'skipped' && eventPillar(s, b) === 'faith')
    .sort((a, b) => a.start - b.start)
    .map((b) => `Be intentional at ${b.title}`);
  return [...new Set([...events, ...IDEAS])];
}
