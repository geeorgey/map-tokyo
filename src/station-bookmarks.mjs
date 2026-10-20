import { parseStationLink, makeStationLink } from './station-link.mjs';
export const STATION_BOOKMARK_KEY = 'tokyo-railway-station-bookmarks-v1';
const canonical = hash => {
  const pose = typeof hash === 'string' && parseStationLink(hash);
  return pose ? new URL(makeStationLink('https://train.lvnsk.jp', pose.id, pose.light)).hash : null;
};
export function readStationBookmarks(storage) {
  const raw = storage.getItem(STATION_BOOKMARK_KEY);
  if (raw === null) return [];
  const values = JSON.parse(raw);
  if (!Array.isArray(values) || values.length > 5 || values.some(value => !canonical(value))) throw new Error('近景のしおりを読み込めませんでした。保存データは変更していません。');
  return [...new Set(values.map(canonical))];
}
export function saveStationBookmark(storage, hash) {
  const value = canonical(hash);
  if (!value) throw new Error('保存する近景を確認してください。');
  const values = readStationBookmarks(storage);
  if (values.includes(value)) throw new Error('この場所と光は保存済みです。');
  if (values.length >= 5) throw new Error('近景のしおりは5件までです。不要なしおりを削除してから保存してください。');
  const next = [value, ...values];
  storage.setItem(STATION_BOOKMARK_KEY, JSON.stringify(next));
  return next;
}
export function deleteStationBookmark(storage, hash) {
  const next = readStationBookmarks(storage).filter(value => value !== hash);
  storage.setItem(STATION_BOOKMARK_KEY, JSON.stringify(next));
  return next;
}
