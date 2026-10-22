// Events have already been filtered by service day and confirmed operating dates.
// Give every available route one chance, rather than weighting busy lines more.
export function drawDeparture(events, now, previous = null, random = Math.random) {
  if (!Number.isFinite(now)) return null;
  const after = Math.max(now, previous?.at ?? -Infinity);
  const nextByLine = new Map();
  for (const event of events) {
    if (!Number.isFinite(event.at) || event.at <= after) continue;
    if (!nextByLine.has(event.lineId) || event.at < nextByLine.get(event.lineId).at) nextByLine.set(event.lineId, event);
  }
  let choices = [...nextByLine.values()];
  if (choices.length > 1 && previous) choices = choices.filter(event => event.lineId !== previous.lineId);
  if (!choices.length) return null;
  const value = random();
  const index = Math.floor((Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0) * choices.length);
  return choices[index];
}
