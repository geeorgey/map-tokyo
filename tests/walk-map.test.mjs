import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPose } from '../src/walk-map.mjs';

test('north dome is above the central station and walking east points right', () => {
  const center = mapPose({x:-115,z:35,yaw:-Math.PI/2});
  const north = mapPose({x:-115,z:-150,yaw:0});
  assert.ok(north.y < center.y);
  assert.equal(center.angle,90);
  assert.equal(center.x,54);
  assert.equal(center.outside,false);
});
test('leaving the schematic clamps the marker and explicitly reports outside', () => {
  assert.deepEqual(mapPose({x:705,z:-835,yaw:0}),{x:192,y:8,angle:-0,outside:true});
});
