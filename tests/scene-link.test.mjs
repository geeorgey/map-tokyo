import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSceneLink,makeSceneLink} from '../src/scene-link.mjs';
import {createWalkBoundary} from '../src/engine/walk-camera.js';
import map from '../src/data/tokyo-map.json' with {type:'json'};
const allowed=createWalkBoundary(map);
test('scene links preserve a valid walking pose and blended light without copying tracking data',()=>{
  const pose={x:-115.123456,z:35.123456,yaw:-Math.PI/2,pitch:.37,light:1.234};
  const url=new URL(makeSceneLink('https://train.lvnsk.jp/?utm_source=private',pose,allowed));
  assert.equal(url.search,'');assert.deepEqual(parseSceneLink(url.hash,allowed),pose);
});
test('scene links reject corrupt poses, buildings, tracks and unknown versions',()=>{
  for(const hash of ['','#scene=1,NaN,35,0,0,1','#scene=1,,35,0,0,1','#scene=2,-115,35,0,0,1','#scene=1,-65,0,0,0,1','#scene=1,10000,0,0,0,1','#scene=1,-115,35,9,0,1','#scene=1,-115,35,0,2,1','#scene=1,-115,35,0,0,3'])assert.equal(parseSceneLink(hash,allowed),null,hash);
});
test('multiple rotations normalize to a stable shareable direction',()=>{
  const link=makeSceneLink('https://train.lvnsk.jp',{x:-115,z:35,yaw:Math.PI*8+.4,pitch:0,light:0},allowed);
  assert.ok(Math.abs(parseSceneLink(new URL(link).hash,allowed).yaw-.4)<1e-12);
});
