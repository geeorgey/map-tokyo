import { parseSceneLink } from './scene-link.mjs';
export const BOOKMARK_KEY='tokyo-railway-scene-bookmarks-v1';
export const BOOKMARK_LIMIT=5;
export function readBookmarks(storage) {
  const raw=storage.getItem(BOOKMARK_KEY);
  if(raw===null)return [];
  const values=JSON.parse(raw);
  if(!Array.isArray(values))throw new Error('保存したしおりを読み込めませんでした。');
  return values.filter(v=>v && typeof v.id==='string' && typeof v.name==='string' && v.name.trim() && v.name.length<=32 && typeof v.hash==='string' && parseSceneLink(v.hash)).slice(0,BOOKMARK_LIMIT);
}
export function addBookmark(storage, {id,name,hash}) {
  const cleaned=name.trim().slice(0,32);
  if(!cleaned || !parseSceneLink(hash))throw new Error('名前と保存する景色を確認してください。');
  const values=readBookmarks(storage);
  if(values.some(v=>v.hash===hash))throw new Error('この景色には、すでにしおりがあります。');
  if(values.length>=BOOKMARK_LIMIT)throw new Error('しおりは5件までです。不要なしおりを削除してから保存してください。');
  const next=[{id,name:cleaned,hash},...values];
  storage.setItem(BOOKMARK_KEY,JSON.stringify(next));
  return next;
}
export function removeBookmark(storage,id) {
  const next=readBookmarks(storage).filter(v=>v.id!==id);
  storage.setItem(BOOKMARK_KEY,JSON.stringify(next));
  return next;
}
