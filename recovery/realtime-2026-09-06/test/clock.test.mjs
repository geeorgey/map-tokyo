import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationClock, japanTime, parseJapanDateTime, serviceContext } from '../src/clock.mjs';

test('live time follows the wall clock after background time; simulations keep their own time', () => {
  let wall = Date.parse('2026-09-06T23:59:50+09:00'), monotonic = 0;
  const clock = new SimulationClock({ wallNow: () => wall, monotonicNow: () => monotonic });
  wall += 20000;
  assert.equal(japanTime(clock.now()).date, '2026-09-07');
  clock.setSpeed(60);
  const start = clock.now();
  monotonic += 1000;
  assert.equal(clock.now() - start, 60000);
  clock.setSpeed(300);
  monotonic += 2000;
  assert.equal(clock.now() - start, 660000);
  clock.setPaused(true);
  const frozen = clock.now();
  monotonic += 50000; wall += 50000;
  assert.equal(clock.now(), frozen);
  clock.setSpeed(30);
  assert.equal(clock.now(), frozen);
  clock.setPaused(false);
  monotonic += 1000;
  assert.equal(clock.now(), frozen + 30000);
  clock.sync();
  assert.equal(clock.now(), wall);
  assert.equal(clock.speed, 1);
  assert.equal(clock.paused, false);
  assert.equal(clock.live, true);
});

test('JST date and time parsing rejects normalization and is independent of machine timezone', () => {
  assert.equal(parseJapanDateTime('2026-09-06', '06:00'), Date.parse('2026-09-05T21:00:00Z'));
  for (const [date, time] of [['2026-02-30', '12:00'], ['2026-09-06', '24:00'], ['2026-09-06', '12:61'], ['', '12:00']]) assert.equal(parseJapanDateTime(date, time), null);
});

test('after midnight uses previous service day; holidays switch at operating-day boundary', () => {
  const data = { month: '2026-09', holidays: { '2026-09-21': '敬老の日', '2026-09-22': '休日', '2026-09-23': '秋分の日' } };
  const at = (value) => serviceContext(Date.parse(value + '+09:00'), data);
  assert.equal(at('2026-09-05T00:30:00').dayType, 'weekday');
  assert.equal(at('2026-09-05T00:30:00').date, '2026-09-04');
  assert.equal(at('2026-09-05T04:30:00').dayType, 'holiday');
  for (const day of ['21', '22', '23']) assert.equal(at(`2026-09-${day}T12:00:00`).dayType, 'holiday');
  assert.equal(at('2026-10-01T00:30:00').supported, true);
  assert.equal(at('2026-10-01T03:00:00').supported, false);
  assert.equal(at('2026-09-01T00:30:00').supported, false);
});
