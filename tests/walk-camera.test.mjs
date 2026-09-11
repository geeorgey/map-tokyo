import test from 'node:test';
import assert from 'node:assert/strict';
import { walkStep, createWalkBoundary, WALK_START } from '../src/engine/walk-camera.js';
import map from '../src/data/tokyo-map.json' with { type:'json' };

test('walking follows facing direction without orbiting and normalizes diagonals',()=>{
  const a=walkStep([0,2.2,0],-Math.PI/2,1,0,.1);
  assert.ok(a[0]>1.29 && Math.abs(a[2])<1e-10);
  const b=walkStep([0,2.2,0],0,1,1,.1);
  assert.ok(Math.abs(Math.hypot(b[0],b[2])-1.3)<1e-10);
});
test('walking substeps stop at obstacles, slide along them, and clamp large deltas',()=>{
  const p=walkStep([0,2.2,0],0,1,1,20,(x,z)=>x<.5);
  assert.ok(p[0]<.5 && p[2]<-.8);
  assert.equal(p[1],2.2);
  assert.deepEqual(walkStep([0,2.2,0],0,1,0,-1),[0,2.2,0]);
});
test('the actual city allows the starting plaza and blocks station, tracks and map edge',()=>{
  const allowed=createWalkBoundary(map);
  assert.equal(allowed(WALK_START[0],WALK_START[2]),true);
  assert.equal(allowed(-65,0),false);
  assert.equal(allowed(80,0),false);
  assert.equal(allowed(-740,0),false);

});

test('footprints block walls but leave courtyards and elevated buildings passable',()=>{
  const shape=[{outer:[[-400,-100],[-380,-100],[-380,-80],[-400,-80]],holes:[[[-395,-95],[-385,-95],[-385,-85],[-395,-85]]]}];
  const allowed=createWalkBoundary({buildings:[{base:0,shape}],surfaces:{water:[]}});
  assert.equal(allowed(-399,-90),false);
  assert.equal(allowed(-390,-90),true);
  const elevated=createWalkBoundary({buildings:[{base:10,shape}],surfaces:{water:[]}});
  assert.equal(elevated(-399,-90),true);
});
