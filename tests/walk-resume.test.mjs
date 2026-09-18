import test from 'node:test';
import assert from 'node:assert/strict';
import { RESUME_KEY, readWalkResume, saveWalkResume } from '../src/walk-resume.mjs';
import { parseSceneLink } from '../src/scene-link.mjs';

const hash = '#scene=1,-115,-150,-1.5,0.1,1';
function storage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) };
}
test('a new visit can resume the most recent position, view and light without changing bookmarks', () => {
  const s = storage();
  s.setItem('tokyo-railway-scene-bookmarks-v1', 'untouched');
  assert.equal(readWalkResume(s), null);
  assert.equal(saveWalkResume(s, hash), true);
  const next = '#scene=1,-95,140,1.5,-0.2,2';
  saveWalkResume(s, next);
  assert.deepEqual(parseSceneLink(readWalkResume(s)), {x:-95,z:140,yaw:1.5,pitch:-0.2,light:2});
  assert.equal(s.getItem('tokyo-railway-scene-bookmarks-v1'), 'untouched');
});
test('invalid and newly blocked checkpoints cannot replace or resume a valid scene', () => {
  const s = storage();saveWalkResume(s,hash);
  assert.equal(saveWalkResume(s,'#scene=1,NaN,0,0,0,0'),false);
  assert.equal(readWalkResume(s),hash);
  assert.equal(readWalkResume(s,()=>false),null);
  s.setItem(RESUME_KEY,'invalid');assert.equal(readWalkResume(s),null);
});
test('disabled browser storage does not prevent walking or claim a checkpoint was saved', () => {
  const s={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
  assert.equal(readWalkResume(s),null);
  assert.equal(saveWalkResume(s,hash),false);
});
