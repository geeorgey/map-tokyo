import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eventsForDay, trainState } from '../src/schedule.mjs';
import { LINES, parseOperatingDates, parseStation, validateTimetable } from '../src/timetable.mjs';

const data = validateTimetable(JSON.parse(await readFile(new URL('../public/data/timetable.json', import.meta.url))));
const ts = s => Date.parse(s + '+09:00');

test('imported timetable covers all lines, includes confirmed conditional dates, and excludes inactive days', () => {
  assert.equal(data.month, '2026-09');
  for (const day of ['2026-09-06', '2026-09-07', '2026-09-21']) {
    const events = eventsForDay(data, ts(`${day}T12:00:00`));
    assert.equal(new Set(events.map(event => event.lineId)).size, LINES.length);
    for (const event of events) if (event.conditional) assert.ok(event.dates.includes(day));
    const nozomi = events.find(event => event.source.endsWith('/005/008031.html'));
    assert.equal(nozomi.at, ts(`${day}T06:00:00`));
  }
  const weekday = eventsForDay(data, ts('2026-09-07T12:00:00'));
  const holiday = eventsForDay(data, ts('2026-09-06T12:00:00'));
  assert.notEqual(weekday.filter(e => e.lineId === 'yamanote').length, holiday.filter(e => e.lineId === 'yamanote').length);
  assert.deepEqual(eventsForDay(data, ts('2026-10-02T12:00:00')), []);
});

test('late-night departure is dated after midnight but uses previous weekday service', () => {
  const events = eventsForDay(data, ts('2026-09-05T00:20:00'));
  const last = events.find(e => e.lineId === 'yamanote' && e.time === '00:46');
  assert.ok(last);
  assert.equal(last.at, ts('2026-09-05T00:46:00'));
});

test('train is stationary before its actual departure, moves afterwards, and disappears overnight', () => {
  const at = ts('2026-09-06T06:00:00');
  const events = [{ at, id: 'nozomi-1' }];
  const envelope = { stop: 200, start: 1000, end: 1000, direction: 1, dwell: 60, arrival: 90, departure: 90 };
  assert.equal(trainState(events, at - 1000, envelope).center, 200);
  assert.equal(trainState(events, at, envelope).center, 200);
  assert.equal(trainState(events, at, envelope).status, '発車');
  const moving = trainState(events, at + 30000, envelope);
  assert.ok(moving.center > 200 && moving.center < 1000);
  assert.equal(trainState(events, at + 91000, envelope).visible, false);
  assert.equal(trainState(events, at - 4 * 3600000, envelope).visible, false);
  assert.equal(trainState(events, at - 90000, envelope).status, '入線');
  const jumped = trainState([{ at }, { at: at + 180000 }], at + 180000, envelope);
  assert.equal(jumped.status, '発車');
  assert.equal(jumped.center, 200);
});

test('malformed source and missing operating calendar fail closed', () => {
  assert.throws(() => parseStation('<html>upstream error</html>', 'https://timetables.jreast.co.jp/', '2026-09'));
  assert.throws(() => parseOperatingDates('<table></table>', '2026-09'));
  assert.deepEqual(parseOperatingDates('<table class="calendar-month"><caption>2026年9月</caption><tr><td class="ok"><span>6</span></td><td class="no"><span>7</span></td></tr></table>', '2026-09'), ['2026-09-06']);
  const broken = structuredClone(data);
  const conditional = broken.lines.shinkansen.holiday.find(row => row.conditional);
  delete conditional.dates;
  assert.throws(() => validateTimetable(broken));
});
