import { LINES, validateTimetable } from './timetable.mjs';

export async function loadMonth(month, signal, onProgress = () => {}) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('日付が不正です。');
  // Publish verified month snapshots so visitors need not fetch hundreds of
  // individual operating calendars before seeing any departures.
  try {
    const response = await fetch(`/data/months/${month}.json`, { signal });
    if (response.ok) {
      const snapshot = validateTimetable(await response.json());
      if (snapshot.month === month) return snapshot;
    }
  } catch (error) {
    if (signal?.aborted || error.name === 'AbortError') throw error;
  }
  async function request(path) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(path, { signal, cache: 'no-cache' });
        const result = await response.json();
        if (response.ok && result.ok) return result;
        const error = new Error(result.error || '時刻表の取得に失敗しました。');
        if (response.status >= 400 && response.status < 500) throw Object.assign(error, { permanent: true });
        throw error;
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError' || error.permanent || attempt === 2) throw error;
        await new Promise((resolve, reject) => {
          const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
          const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, 500 * (attempt + 1));
          signal?.addEventListener('abort', onAbort, { once: true });
        });
      }
    }
  }
  const data = { schemaVersion: 1, month, retrievedAt: new Date().toISOString(), source: 'https://timetables.jreast.co.jp/timetable/list1039.html', holidaySource: 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv', holidays: {}, lines: {} };
  onProgress('公式時刻表を取得しています…');
  // Probe first, so an unpublished month needs only one upstream request.
  const first = await request(`/api/station?month=${month}&line=chuo&day=weekday`);
  data.lines.chuo = { weekday: first.rows };
  const tasks = LINES.flatMap(line => ['weekday', 'holiday'].filter(day => !(line.id === 'chuo' && day === 'weekday')).map(day => ({ line, day })));
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (tasks.length) {
      const { line, day } = tasks.shift();
      const result = await request(`/api/station?month=${month}&line=${line.id}&day=${day}`);
      data.lines[line.id] ||= {};
      data.lines[line.id][day] = result.rows;
    }
  }));
  const rows = Object.values(data.lines).flatMap(line => Object.values(line).flat());
  const ids = [...new Set(rows.filter(row => row.conditional).map(row => row.id))].sort();
  const dates = {};
  for (let start = 0; start < ids.length; start += 20) {
    onProgress(`運転日を確認しています… ${start} / ${ids.length}`);
    const response = await request(`/api/calendars?month=${month}&ids=${encodeURIComponent(ids.slice(start, start + 20).join(','))}`);
    Object.assign(dates, response.dates);
  }
  for (const row of rows) if (row.conditional) row.dates = dates[row.id];
  data.holidays = (await request('/api/holidays')).holidays;
  if (!Object.keys(data.holidays).some(date => date.startsWith(month.slice(0, 4)))) throw new Error('対象年の祝日情報が未掲載です。');
  return validateTimetable(data);
}
