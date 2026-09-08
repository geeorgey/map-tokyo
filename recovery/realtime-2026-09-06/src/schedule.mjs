import { LINES } from './timetable.mjs';
import { serviceContext } from './clock.mjs';

export function eventsForDay(data, timestamp) {
  const context = serviceContext(timestamp, data);
  if (!context.supported) return [];
  const events = [];
  for (const line of LINES) {
    const seen = new Set();
    for (const row of data.lines[line.id][context.dayType]) {
      if (row.conditional && !row.dates.includes(context.date)) continue;
      const id = `${line.id}:${row.id}:${row.seconds}`;
      if (seen.has(id)) continue;
      seen.add(id);
      events.push({ ...row, id, lineId: line.id, lineName: line.name, lane: line.lane, color: line.color, at: context.midnight + row.seconds * 1000 });
    }
  }
  return events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export function upperBound(events, time) {
  let low = 0, high = events.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (events[mid].at <= time) low = mid + 1;
    else high = mid;
  }
  return low;
}

const smooth = value => value * value * (3 - 2 * value);

// Only departure times are supplied by the station timetable. The path,
// approach duration and dwell are a clearly labelled visual approximation.
// One train is shown per representative track, prioritising the latest departure.
export function trainState(events, timestamp, envelope) {
  if (!events.length) return { visible: false, center: envelope.stop, direction: envelope.direction, status: '待機', event: null };
  const index = upperBound(events, timestamp);
  const departed = events[index - 1];
  if (departed) {
    const elapsed = (timestamp - departed.at) / 1000;
    if (elapsed < envelope.departure) return {
      visible: true, event: departed, status: '発車', direction: envelope.direction,
      center: envelope.stop + (envelope.end - envelope.stop) * smooth(elapsed / envelope.departure),
    };
  }
  const next = events[index];
  if (next) {
    const until = (next.at - timestamp) / 1000;
    if (until <= envelope.dwell) return { visible: true, event: next, status: '停車中', center: envelope.stop, direction: envelope.direction };
    if (until <= envelope.dwell + envelope.arrival) {
      const progress = 1 - (until - envelope.dwell) / envelope.arrival;
      return { visible: true, event: next, status: '入線', direction: Math.sign(envelope.stop - envelope.start), center: envelope.start + (envelope.stop - envelope.start) * smooth(progress) };
    }
  }
  return { visible: false, center: envelope.stop, direction: envelope.direction, status: '待機', event: null };
}

export function createEnvelope(train, lane) {
  const terminal = lane === 0 || train.kind === 'shinkansen';
  const length = train.totalLength || train.cars.length * 12.4;
  const margin = length / 2 + 2;
  const stop = train.route.stationDistance;
  const direction = lane === 0 || lane === 1 || lane === 4 ? -1 : 1;
  const end = direction === 1 ? train.route.total - margin : margin;
  const start = terminal ? end : direction === 1 ? margin : train.route.total - margin;
  const speed = train.kind === 'shinkansen' ? 15 : 18;
  return { stop, start, end, direction, terminal, arrival: Math.max(25, Math.abs(stop - start) / speed * 1.6), departure: Math.max(25, Math.abs(end - stop) / speed * 1.6), dwell: terminal ? 60 : 35 };
}
