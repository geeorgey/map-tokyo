import test from 'node:test';
import assert from 'node:assert/strict';
import { STATION_BOOKMARK_KEY, readStationBookmarks, saveStationBookmark, deleteStationBookmark } from '../src/station-bookmarks.mjs';
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
test('station bookmarks persist exact place/light across reads and delete only the chosen scene', () => {
  const storage = memory();
  saveStationBookmark(storage, '#station=1,north,1.234');
  saveStationBookmark(storage, '#station=1,south,2');
  assert.deepEqual(readStationBookmarks(storage), ['#station=1,south,2', '#station=1,north,1.234']);
  assert.deepEqual(deleteStationBookmark(storage, '#station=1,south,2'), ['#station=1,north,1.234']);
});
test('duplicate and full lists cannot overwrite existing station favorites', () => {
  const storage = memory();
  for (let i = 0; i < 5; i++) saveStationBookmark(storage, `#station=1,north,${i / 5}`);
  const before = storage.getItem(STATION_BOOKMARK_KEY);
  assert.throws(() => saveStationBookmark(storage, '#station=1,north,0'), /保存済み/);
  assert.throws(() => saveStationBookmark(storage, '#station=1,south,2'), /5件/);
  assert.equal(storage.getItem(STATION_BOOKMARK_KEY), before);
});
test('corrupt/invalid storage and write denial never claim successful persistence', () => {
  const storage = memory(); storage.setItem(STATION_BOOKMARK_KEY, '{broken');
  assert.throws(() => saveStationBookmark(storage, '#station=1,north,1'));
  assert.equal(storage.getItem(STATION_BOOKMARK_KEY), '{broken');
  storage.setItem(STATION_BOOKMARK_KEY, '["#station=1,inside,2"]');
  assert.throws(() => readStationBookmarks(storage));
  assert.throws(() => saveStationBookmark(memory(), '#station=1,north,3'));
  assert.throws(() => saveStationBookmark({ getItem: () => null, setItem: () => { throw Error('blocked'); } }, '#station=1,north,1'), /blocked/);
});
