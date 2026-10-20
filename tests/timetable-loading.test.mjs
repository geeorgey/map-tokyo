import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadMonth } from '../src/load-timetable.mjs';
import worker from '../src/worker.mjs';
import { validateTimetable } from '../src/timetable.mjs';
import { eventsForDay } from '../src/schedule.mjs';
const snapshot = JSON.parse(await readFile(new URL('../public/data/months/2026-10.json', import.meta.url)));

test('October snapshot covers weekdays, holidays and conditional trains without upstream API requests', async t => {
  const paths = [];
  t.mock.method(globalThis, 'fetch', async path => { paths.push(path); return Response.json(snapshot); });
  const data = await loadMonth('2026-10');
  assert.deepEqual(paths, ['/data/months/2026-10.json']);
  validateTimetable(data);
  for (const day of ['2026-10-20', '2026-10-18', '2026-10-12']) {
    assert.ok(eventsForDay(data, Date.parse(`${day}T12:00:00+09:00`)).length > 1000);
  }
});

test('missing snapshot falls back to API and recovers a transient calendar failure', async t => {
  let calendarFailures = 0;
  t.mock.method(globalThis, 'fetch', async path => {
    if (path.startsWith('/data/')) return new Response('missing', {status:404});
    const url = new URL(path, 'https://test.invalid');
    if (url.pathname === '/api/station') return Response.json({ok:true, rows:snapshot.lines[url.searchParams.get('line')][url.searchParams.get('day')]});
    if (url.pathname === '/api/holidays') return Response.json({ok:true, holidays:snapshot.holidays});
    if (calendarFailures++ === 0) return Response.json({ok:false,error:'temporary'}, {status:503});
    const rows = Object.values(snapshot.lines).flatMap(line => Object.values(line).flat());
    return Response.json({ok:true,dates:Object.fromEntries(url.searchParams.get('ids').split(',').map(id => [id,rows.find(row=>row.id===id && row.conditional).dates]))});
  });
  assert.equal((await loadMonth('2026-10')).month, '2026-10');
  assert.ok(calendarFailures > 1);
});

test('aborted month fetch is not retried or replaced with an incorrect month', async t => {
  const controller = new AbortController(); controller.abort();
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => { count++; throw controller.signal.reason; });
  await assert.rejects(loadMonth('2026-10',controller.signal), {name:'AbortError'});
  assert.equal(count,1);
});

test('upstream outage returns a non-cacheable 503, allowing immediate recovery', async t => {
  let writes = 0;
  const previous = globalThis.caches;
  t.after(() => { if (previous === undefined) delete globalThis.caches; else globalThis.caches = previous; });
  globalThis.caches = {default:{match:async()=>undefined,put:async()=>{writes++;}}};
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('source timeout');});
  const response = await worker.fetch(new Request('https://test.invalid/api/station?month=2026-10&line=chuo&day=weekday'),{}, {waitUntil:()=>{throw Error('must not cache');}});
  assert.equal(response.status,503);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await response.json()).ok,false);
  assert.equal(writes,0);
});
