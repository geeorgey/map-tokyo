import { LINES } from './timetable.mjs';
import { eventsForDay } from './schedule.mjs';

// Only the selected timetable departure and presentation travel in the fragment.
export function parseDepartureLink(hash) {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('departure');
  if (!raw || raw.length > 120) return null;
  const [version, timestamp, lineId, angle, phase, ...extra] = raw.split(',');
  if (version !== '1' || extra.length || !/^\d{13}$/.test(timestamp || '') || !phase?.trim()) return null;
  const at = Number(timestamp), light = Number(phase);
  if (at < Date.parse('2020-01-01') || at >= Date.parse('2100-01-01') ||
      !LINES.some(line => line.id === lineId) || !['above', 'side'].includes(angle) ||
      !Number.isFinite(light) || light < 0 || light >= 3) return null;
  return { at, lineId, angle, light };
}

export function makeDepartureLink(origin, departure) {
  const hash = `departure=1,${departure.at},${departure.lineId},${departure.angle},${departure.light}`;
  if (!parseDepartureLink(hash)) return null;
  const url = new URL('/', origin);
  url.hash = hash;
  return url.href;
}

export function resolveDepartureLink(data, link) {
  return eventsForDay(data, link.at).find(event => event.at === link.at && event.lineId === link.lineId) || null;
}
