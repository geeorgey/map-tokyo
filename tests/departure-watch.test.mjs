import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eventsForDay } from '../src/schedule.mjs';
import { nextDeparture, replayDeparture, rewindDeparture, departureProgress } from '../src/departure-watch.mjs';

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

test('short rewind stays in the watched departure and stops at its lead-in', () => {
  const event = {at:100000, lineId:'chuo'};
  assert.equal(rewindDeparture([event],event,112000),107000);
  assert.equal(rewindDeparture([event],event,97000),95000);
  assert.equal(rewindDeparture([event],event,95000),null);
  assert.equal(rewindDeparture([event],event,94000),null);
  assert.equal(rewindDeparture([],event,112000),null);
  assert.equal(rewindDeparture([event],{...event,lineId:'missing'},112000),null);
  assert.equal(rewindDeparture([event],event,NaN),null);
});
test('short rewind cannot cross the three-am service-day boundary', () => {
  const start=ts('2026-10-26T03:00:00'), event={at:start+3000,lineId:'chuo'};
  assert.equal(rewindDeparture([event],event,start+4000,start),start);
  assert.equal(rewindDeparture([event],event,start,start),null);
});
test('seeking a short rewind preserves pause and half-speed playback', async () => {
  const {SimulationClock}=await import('../src/clock.mjs');
  const c=new SimulationClock({wallNow:()=>112000,monotonicNow:()=>0});c.seek(112000);c.setSpeed(0.5);c.setPaused(true);
  const event={at:100000,lineId:'chuo'};
  c.seek(rewindDeparture([event],event,c.now()));
  assert.equal(c.now(),107000);assert.equal(c.speed,0.5);assert.equal(c.paused,true);
});

test('departure progress distinguishes the exact departure boundary without early zero', () => {
  const event={at:100000};
  assert.equal(departureProgress(event,95000),'発車まであと5秒');
  assert.equal(departureProgress(event,99999),'発車まであと1秒');
  assert.equal(departureProgress(event,100000),'発車から0秒');
  assert.equal(departureProgress(event,160999),'発車から1分00秒');
  assert.equal(departureProgress(null,100000),null);
  assert.equal(departureProgress(event,NaN),null);
});
test('progress uses paused/half-speed simulation time and follows rewind rather than wall time', async () => {
  const {SimulationClock}=await import('../src/clock.mjs');
  let mono=0;const c=new SimulationClock({wallNow:()=>95000,monotonicNow:()=>mono});
  const event={at:100000,lineId:'chuo'};c.seek(95000);c.setSpeed(0.5);mono=4000;
  assert.equal(departureProgress(event,c.now()),'発車まであと3秒');
  c.setPaused(true);mono=12000;
  assert.equal(departureProgress(event,c.now()),'発車まであと3秒');
  c.seek(rewindDeparture([event],event,c.now()));
  assert.equal(departureProgress(event,c.now()),'発車まであと5秒');
  assert.equal(c.paused,true);assert.equal(c.speed,0.5);
});
