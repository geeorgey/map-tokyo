import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eventsForDay } from '../src/schedule.mjs';
import { nextDeparture, replayDeparture } from '../src/departure-watch.mjs';

const data = JSON.parse(await readFile(new URL('../public/data/timetable.json', import.meta.url)));
const ts = value => Date.parse(value + '+09:00');

test('watching from five seconds before departure advances to a later train on another click', () => {
  const now = ts('2026-09-22T06:00:01');
  const events = eventsForDay(data, now);
  const first = nextDeparture(events, now);
  const second = nextDeparture(events, first.at - 5000, first.at);
  assert.ok(first.at > now);
  assert.ok(second.at > first.at);
  assert.equal(nextDeparture(events, events.at(-1).at), null);
});
test('late night respects the previous service day and does not invent next-month data', () => {
  for (const value of ['2026-09-22T00:05:00', '2026-09-22T02:59:30', '2026-10-02T12:00:00']) {
    const now = ts(value), events = eventsForDay(data, now);
    const next = nextDeparture(events, now);
    if (value.includes('00:05')) assert.ok(next && next.at > now);
    else assert.equal(next, null);
  }
});

test('line selection skips other lines without inventing unavailable departures', () => {
  const now = ts('2026-09-25T12:00:01');
  const events = eventsForDay(data, now);
  for (const lineId of ['chuo','keihin','yamanote','tokaido','hokuriku','joetsu','shinkansen']) {
    const expected = events.find(event => event.at > now && event.lineId === lineId);
    const first = nextDeparture(events, now, undefined, lineId);
    assert.deepEqual(first, expected);
    const second = nextDeparture(events, first.at - 5000, first.at, lineId);
    assert.equal(second.lineId, lineId);
    assert.ok(second.at > first.at);
    const final = events.filter(event => event.lineId === lineId).at(-1);
    assert.equal(nextDeparture(events, final.at, undefined, lineId), null);
  }
  assert.equal(nextDeparture(events, now, undefined, 'not-a-line'), null);
  assert.deepEqual(nextDeparture(events, now, undefined, 'all'), nextDeparture(events, now));
  assert.equal(nextDeparture([], now, undefined, 'shinkansen'), null);
});

test('replay resolves the exact watched line and time only in the current dataset', () => {
  const now = ts('2026-09-26T12:00:00');
  const events = eventsForDay(data, now);
  const watched = nextDeparture(events, now, undefined, 'shinkansen');
  assert.equal(replayDeparture(events, watched), watched);
  const simultaneous = events.find(event => event.at === watched.at && event.lineId !== watched.lineId);
  if (simultaneous) assert.notEqual(replayDeparture(events, watched).lineId, simultaneous.lineId);
  assert.equal(replayDeparture(eventsForDay(data, ts('2026-09-27T12:00:00')), watched), null);
  assert.equal(replayDeparture([], watched), null);
  assert.equal(replayDeparture(events, null), null);
  assert.equal(replayDeparture(events, {...watched, lineId:'missing'}), null);
  assert.ok(nextDeparture(events, watched.at-5000, watched.at, watched.lineId).at > watched.at);
});
