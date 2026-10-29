import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eventsForDay } from '../src/schedule.mjs';
import { parseDepartureLink, makeDepartureLink, resolveDepartureLink } from '../src/departure-link.mjs';
const data = JSON.parse(await readFile(new URL('../public/data/timetable.json', import.meta.url)));
const events = eventsForDay(data, Date.parse('2026-09-28T12:00:00+09:00'));
const chosen = events.find(e=>e.lineId==='shinkansen' && e.time >= '12:00');

test('departure links retain exact train time, selected view and fractional light without query leakage', () => {
  const choice = {at:chosen.at,lineId:chosen.lineId,angle:'side',light:1.25};
  const url = new URL(makeDepartureLink('https://train.lvnsk.jp/?private=ignored',choice));
  assert.equal(url.search,''); assert.equal(url.pathname,'/');
  assert.deepEqual(parseDepartureLink(url.hash),choice);
  assert.equal(resolveDepartureLink(data,choice).id,chosen.id);
});
test('malformed and out-of-range departure fragments are rejected', () => {
  for(const hash of ['', '#departure=2,1790564580000,shinkansen,side,1',
    '#departure=1,NaN,shinkansen,side,1', '#departure=1,1790564580000,missing,side,1',
    '#departure=1,1790564580000,shinkansen,orbit,1', '#departure=1,1790564580000,shinkansen,side,3',
    '#departure=1,1790564580000,shinkansen,side,', '#departure=1,1790564580000,shinkansen,side,1,extra']) {
    assert.equal(parseDepartureLink(hash),null,hash);
  }
});
test('a missing departure or unrecorded month never resolves to another train', () => {
  assert.equal(resolveDepartureLink(data,{...chosen,at:chosen.at+1000}),null);
  assert.equal(resolveDepartureLink(data,{...chosen,at:Date.parse('2026-10-28T12:00:00+09:00')}),null);
});
test('after-midnight link resolves the previous operating day including month boundary', () => {
  const late = eventsForDay(data,Date.parse('2026-10-01T00:05:00+09:00')).find(e=>e.at>=Date.parse('2026-10-01T00:00:00+09:00'));
  assert.ok(late);
  const choice={at:late.at,lineId:late.lineId,angle:'above',light:0};
  assert.equal(resolveDepartureLink(data,parseDepartureLink(new URL(makeDepartureLink('https://train.lvnsk.jp',choice)).hash)).id,late.id);
});

test('front departure link resolves the same timetable event with its selected light', () => {
  const choice={at:chosen.at,lineId:chosen.lineId,angle:'front',light:2};
  const parsed=parseDepartureLink(new URL(makeDepartureLink('https://train.lvnsk.jp',choice)).hash);
  assert.deepEqual(parsed,choice);assert.equal(resolveDepartureLink(data,parsed).id,chosen.id);
});
