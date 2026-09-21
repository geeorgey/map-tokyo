import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, createSceneDraw } from '../src/scene-draw.mjs';

test('every six draws visits every scene exactly once', () => {
  for (const random of [() => 0, () => .5, () => .99999, Math.random]) {
    const draw = createSceneDraw(random);
    for (let cycle = 0; cycle < 20; cycle++) {
      const ids = Array.from({ length: 6 }, () => draw().id);
      assert.deepEqual([...ids].sort(), SCENES.map(s => s.id).sort());
    }
  }
});
test('refilling the bag never repeats the previous scene', () => {
  let counter = 0;
  const draw = createSceneDraw(() => (++counter % 7) / 7);
  let previous = draw();
  for (let i = 0; i < 120; i++) {
    const next = draw(); assert.notEqual(next.id, previous.id); previous = next;
  }
});
