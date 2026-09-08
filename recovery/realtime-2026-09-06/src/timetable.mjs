export const LINES = [
  { id: 'chuo', name: '中央線快速', direction: '新宿・八王子方面', page: '103909', lane: 0, color: '#cd7738', terminal: true },
  { id: 'keihin', name: '京浜東北線', direction: '上野・赤羽方面', page: '103915', lane: 1, color: '#3196ae', directionSign: -1 },
  { id: 'yamanote', name: '山手線 外回り', direction: '品川・渋谷方面', page: '103911', lane: 2, color: '#679646', directionSign: 1 },
  { id: 'tokaido', name: '東海道線', direction: '品川・横浜方面', page: '103910', lane: 3, color: '#b37537', directionSign: 1 },
  { id: 'hokuriku', name: '北陸新幹線', direction: '長野・金沢・敦賀方面', page: '103906', lane: 4, color: '#337b9d', terminal: true },
  { id: 'joetsu', name: '上越新幹線', direction: '越後湯沢・新潟方面', page: '103905', lane: 4, color: '#337b9d', terminal: true },
  { id: 'shinkansen', name: '東海道・山陽新幹線', direction: '名古屋・新大阪方面', page: '103901', lane: 5, color: '#3e66a2', terminal: true },
];

export const plainText = value => value.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').trim();

export function parseStation(html, url, month) {
  const edition = month.slice(2).replace('-', '');
  if (!html.includes(`'${edition}'`) || !html.includes('東京駅')) throw new Error(`時刻表の掲載月・駅を確認できません: ${url}`);
  const legends = [...html.matchAll(/<dl>\s*<dt>(.*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)];
  const legend = title => Object.fromEntries([...((legends.find(m => m[1] === title)?.[2] || '').matchAll(/<span[^>]*>(.*?)<\/span>/g))].map(m => plainText(m[1]).split('=')));
  const types = legend('列車種別・列車名');
  const destinations = legend('行き先・経由');
  const records = [];
  for (const row of html.matchAll(/<tr id="time_(\d+)">([\s\S]*?)<\/tr>/g)) {
    const hour = Number(row[1]);
    for (const entry of row[2].matchAll(/<div class="timetable_time"([^>]*)>([\s\S]*?)<\/div>/g)) {
      const attrs = Object.fromEntries([...entry[1].matchAll(/data-([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
      const minute = Number(plainText(entry[2].match(/<span class="minute">([\s\S]*?)<\/a>/)?.[1] || '').match(/^\d{2}/)?.[0]);
      const href = entry[2].match(/<a href="([^"]+)"/)?.[1];
      if (!Number.isInteger(minute) || minute > 59 || hour > 26 || !href) throw new Error(`時刻の解析に失敗しました: ${url}`);
      const source = new URL(href, url).href;
      records.push({
        id: source.split('/train/')[1].replace('.html', ''),
        seconds: ((hour < 3 ? hour + 24 : hour) * 60 + minute) * 60,
        time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        type: types[attrs.train || '無印'] || attrs.train || '普通',
        destination: destinations[attrs.dest || '無印'] || attrs.dest || '',
        conditional: Boolean(attrs.misc || /class="sp"/.test(entry[2])),
        source,
      });
    }
  }
  if (records.length < 5) throw new Error(`時刻表が空または形式変更されています: ${url}`);
  return records.sort((a, b) => a.seconds - b.seconds);
}

export function parseOperatingDates(html, month) {
  const [year, mon] = month.split('-').map(Number);
  const calendar = [...html.matchAll(/<table[^>]*class="calendar-month"[^>]*>([\s\S]*?)<\/table>/g)]
    .find(m => m[1].includes(`<caption>${year}年${mon}月</caption>`));
  if (!calendar) throw new Error(`運行日カレンダーが見つかりません: ${month}`);
  return [...calendar[1].matchAll(/<td class="ok">([\s\S]*?)<\/td>/g)].map(m => {
    const day = Number(plainText(m[1]));
    if (!(day >= 1 && day <= 31)) throw new Error('運行日の解析に失敗しました');
    return `${month}-${String(day).padStart(2, '0')}`;
  });
}

export function validateTimetable(data) {
  if (data?.schemaVersion !== 1 || !/^\d{4}-\d{2}$/.test(data.month) || !data.holidays || !data.lines) throw new Error('時刻表データの形式が違います');
  for (const line of LINES) {
    for (const dayType of ['weekday', 'holiday']) {
      const rows = data.lines[line.id]?.[dayType];
      if (!Array.isArray(rows) || !rows.length) throw new Error(`${line.name}の時刻表がありません`);
      let previous = -1;
      for (const row of rows) {
        if (!Number.isInteger(row.seconds) || row.seconds < 3 * 3600 || row.seconds >= 27 * 3600 || row.seconds < previous) throw new Error('発車時刻の並びが不正です');
        if (!/^https:\/\/timetables\.jreast\.co\.jp\//.test(row.source)) throw new Error('出典URLが不正です');
        if (row.conditional && !Array.isArray(row.dates)) throw new Error('運転日限定列車の運行日がありません');
        previous = row.seconds;
      }
    }
  }
  return data;
}
