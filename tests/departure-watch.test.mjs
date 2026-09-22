import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eventsForDay } from '../src/schedule.mjs';
import { nextDeparture } from '../src/departure-watch.mjs';

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
