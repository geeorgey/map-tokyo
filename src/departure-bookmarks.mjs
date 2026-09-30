import { parseDepartureLink, makeDepartureLink } from './departure-link.mjs';
export const DEPARTURE_BOOKMARK_KEY = 'tokyo-railway-departure-bookmarks-v1';
export const DEPARTURE_BOOKMARK_LIMIT = 5;
function canonicalHash(hash) {
  if (typeof hash !== 'string') return null;
  const value = parseDepartureLink(hash);
  return value ? new URL(makeDepartureLink('https://train.lvnsk.jp', value)).hash : null;
}
export function readDepartureBookmarks(storage) {
  const raw = storage.getItem(DEPARTURE_BOOKMARK_KEY);
  if (raw === null) return [];
  const values = JSON.parse(raw);
  if (!Array.isArray(values)) throw new Error('発車のしおりを読み込めませんでした。');
  return [...new Set(values.map(canonicalHash).filter(Boolean))].slice(0, DEPARTURE_BOOKMARK_LIMIT);
}
export function saveDepartureBookmark(storage, hash) {
  const canonical = canonicalHash(hash);
  if (!canonical) throw new Error('保存する発車を確認してください。');
  const values = readDepartureBookmarks(storage);
  if (values.includes(canonical)) throw new Error('この発車・視点・光は保存済みです。');
  if (values.length >= DEPARTURE_BOOKMARK_LIMIT) throw new Error('発車のしおりは5件までです。不要なしおりを削除してから保存してください。');
  const next = [canonical, ...values];
  storage.setItem(DEPARTURE_BOOKMARK_KEY, JSON.stringify(next));
  return next;
}
export function deleteDepartureBookmark(storage, hash) {
  const next = readDepartureBookmarks(storage).filter(value => value !== hash);
  storage.setItem(DEPARTURE_BOOKMARK_KEY, JSON.stringify(next));
  return next;
}
