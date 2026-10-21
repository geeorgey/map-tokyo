import { LINES } from './timetable.mjs';
const KEY = 'tokyo-railway-preferred-line-v1';
const valid = id => LINES.some(line => line.id === id);
export function readPreferredLine(storage) {
  try {
    const value = JSON.parse(storage.getItem(KEY));
    return value?.version === 1 && valid(value.lineId) ? value.lineId : null;
  } catch { return null; }
}
export function savePreferredLine(storage, lineId) {
  if (!valid(lineId)) throw new Error('路線を選んでください。');
  storage.setItem(KEY, JSON.stringify({ version: 1, lineId }));
  return lineId;
}
export function clearPreferredLine(storage) { storage.removeItem(KEY); return null; }
