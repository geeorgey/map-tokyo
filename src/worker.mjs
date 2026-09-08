import { LINES, parseStation, parseOperatingDates } from './timetable.mjs';

const json = (value, maxAge = 21600, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': `public, max-age=${maxAge}`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } });
const validMonth = month => /^20\d{2}-(0[1-9]|1[0-2])$/.test(month || '');

async function source(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('SOURCE_UNAVAILABLE');
  const html = await response.text();
  if (html.length > 1500000) throw new Error('SOURCE_TOO_LARGE');
  return html;
}

export async function serveApi(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return json({ ok: false, error: 'GET only' }, 0, 405);
  if (url.pathname === '/api/holidays') {
    const response = await fetch('https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('HOLIDAYS_UNAVAILABLE');
    const csv = new TextDecoder('shift_jis').decode(await response.arrayBuffer());
    const holidays = {};
    for (const row of csv.split(/\r?\n/)) {
      const match = row.match(/^(\d{4})\/(\d+)\/(\d+),(.+)$/);
      if (match) holidays[`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`] = match[4].trim();
    }
    if (Object.keys(holidays).length < 100) throw new Error('HOLIDAYS_INVALID');
    return json({ ok: true, holidays }, 86400);
  }
  const month = url.searchParams.get('month');
  if (!validMonth(month)) return json({ ok: false, error: '日付が不正です。' }, 0, 400);
  const edition = month.slice(2).replace('-', '');
  if (url.pathname === '/api/station') {
    const line = LINES.find(line => line.id === url.searchParams.get('line'));
    const dayType = url.searchParams.get('day');
    if (!line || !['weekday', 'holiday'].includes(dayType)) return json({ ok: false, error: '路線または曜日が不正です。' }, 0, 400);
    const sourceUrl = `https://timetables.jreast.co.jp/${edition}/timetable/tt1039/${line.page}${dayType === 'weekday' ? '0' : '1'}.html`;
    return json({ ok: true, month, lineId: line.id, dayType, rows: parseStation(await source(sourceUrl), sourceUrl, month) });
  }
  if (url.pathname === '/api/calendars') {
    const ids = url.searchParams.get('ids')?.split(',') || [];
    if (!ids.length || ids.length > 20 || ids.some(id => !/^\d{3}\/\d{6}$/.test(id))) return json({ ok: false, error: '列車IDが不正です。' }, 0, 400);
    const dates = {}, queue = [...new Set(ids)];
    // A request makes at most 20 upstream requests, with just 3 in flight.
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const id = queue.shift();
        dates[id] = parseOperatingDates(await source(`https://timetables.jreast.co.jp/${edition}/train/${id}.html`), month);
      }
    }));
    return json({ ok: true, month, dates });
  }
  return json({ ok: false, error: 'Not found' }, 0, 404);
}

export default {
  async fetch(request, env, ctx) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const cache = caches.default;
    const key = new Request(request.url, { method: 'GET' });
    if (request.method === 'GET') {
      const cached = await cache.match(key);
      if (cached) return cached;
    }
    let response;
    try { response = await serveApi(request); }
    catch { response = json({ ok: false, error: 'この月の公式時刻表を取得できませんでした。未掲載、または提供元が一時的に利用できません。' }, 300); }
    if (request.method === 'GET' && response.ok) ctx.waitUntil(cache.put(key, response.clone()));
    return response;
  },
};
