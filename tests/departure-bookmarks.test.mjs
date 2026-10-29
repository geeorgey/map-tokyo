import test from 'node:test';
import assert from 'node:assert/strict';
import { DEPARTURE_BOOKMARK_KEY as KEY, readDepartureBookmarks as read, saveDepartureBookmark as save, deleteDepartureBookmark as remove } from '../src/departure-bookmarks.mjs';
const hash = '#departure=1,1790737380000,shinkansen,side,1';
function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) }; }
test('saved departure preserves date, line, angle and light across fresh reads; deletion only removes chosen entry', () => {
  const s=storage(); save(s,hash); save(s,hash.replace('side','above'));
  assert.deepEqual(read(s),[hash.replace('side','above'),hash]);
  assert.deepEqual(remove(s,hash),[hash.replace('side','above')]);
  assert.deepEqual(read(s),[hash.replace('side','above')]);
});
test('duplicate and full-list saves never overwrite a favorite', () => {
  const s=storage(); for(let i=0;i<5;i++) save(s,hash.replace('1790737380000',String(1790737380000+i*60000)));
  const before=s.getItem(KEY); assert.throws(()=>save(s,hash),/保存済み/);
  assert.throws(()=>save(s,hash.replace('side','above')),/5件/); assert.equal(s.getItem(KEY),before);
});
test('corrupt storage remains untouched; invalid external hashes are never playable', () => {
  const s=storage(); s.setItem(KEY,JSON.stringify(['javascript:alert(1)','#departure=1,NaN,shinkansen,side,1',hash,hash]));
  assert.deepEqual(read(s),[hash]); assert.throws(()=>save(s,'#departure=1,1790737380000,unknown,side,1'));
  s.setItem(KEY,'broken'); assert.throws(()=>save(s,hash)); assert.equal(s.getItem(KEY),'broken');
});
test('storage errors propagate instead of reporting successful persistence', () => {
  const s={getItem:()=>null,setItem:()=>{throw new Error('quota');}};
  assert.throws(()=>save(s,hash),/quota/); assert.throws(()=>remove(s,hash),/quota/);
});

test('front viewpoint survives link validation and bookmark reload alongside older views', () => {
  const s=storage(), front=hash.replace('side','front');save(s,hash);save(s,front);
  assert.deepEqual(read(s),[front,hash]);
});
