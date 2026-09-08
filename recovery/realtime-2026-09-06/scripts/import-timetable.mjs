import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { LINES, parseStation, parseOperatingDates, validateTimetable } from '../src/timetable.mjs';

const month = process.argv[2] || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' }).format(new Date());
if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('使い方: npm run timetable -- 2026-09');
const cacheDir = `${tmpdir()}/tokyo-railway-timetable-cache`;
await mkdir(cacheDir, { recursive: true });
const fresh = process.argv.includes('--fresh');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function load(url) {
  const cache = `${cacheDir}/${createHash('sha256').update(url).digest('hex')}`;
  if (!fresh) { try { return await readFile(cache, 'utf8'); } catch {} }
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const html = await response.text();
  await writeFile(cache, html);
  await delay(200);
  return html;
}
const data = { schemaVersion: 1, month, retrievedAt: new Date().toISOString(), source: 'https://timetables.jreast.co.jp/timetable/list1039.html', holidaySource: 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv', holidays: {}, lines: {} };
const holidayResponse = await fetch(data.holidaySource, { signal: AbortSignal.timeout(20000) });
if (!holidayResponse.ok) throw new Error('内閣府の祝日データを取得できません');
const holidayCsv = new TextDecoder('shift_jis').decode(await holidayResponse.arrayBuffer());
for (const row of holidayCsv.split(/\r?\n/)) {
  const match = row.match(/^(\d{4})\/(\d+)\/(\d+),(.+)$/);
  if (match) data.holidays[`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`] = match[4].trim();
}
if (!Object.keys(data.holidays).some(date => date.startsWith(month.slice(0, 4)))) throw new Error('対象年の祝日データがありません');
const conditional = new Map();
for (const line of LINES) {
  data.lines[line.id] = {};
  for (const [suffix, dayType] of [['0', 'weekday'], ['1', 'holiday']]) {
    const url = `https://timetables.jreast.co.jp/${month.slice(2).replace('-', '')}/timetable/tt1039/${line.page}${suffix}.html`;
    const rows = parseStation(await load(url), url, month);
    data.lines[line.id][dayType] = rows;
    for (const row of rows) if (row.conditional) conditional.set(row.source, true);
    console.log(`${line.name} ${dayType}: ${rows.length} 本`);
  }
}
console.log(`運転日限定列車 ${conditional.size} 件のカレンダーを確認します`);
const queue = [...conditional.keys()];
let done = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const url = queue.shift();
    conditional.set(url, parseOperatingDates(await load(url), month));
    if (++done % 25 === 0) console.log(`運行日確認 ${done}/${conditional.size}`);
  }
}));
for (const line of Object.values(data.lines)) for (const rows of Object.values(line)) for (const row of rows) {
  if (row.conditional) row.dates = conditional.get(row.source);
}
validateTimetable(data);
const dest = new URL('../public/data/timetable.json', import.meta.url);
await writeFile(new URL('../public/data/timetable.next.json', import.meta.url), JSON.stringify(data));
await rename(new URL('../public/data/timetable.next.json', import.meta.url), dest);
console.log(`保存完了: ${data.month} / ${data.retrievedAt}`);
