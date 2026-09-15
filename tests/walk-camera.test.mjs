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

test('all featured spots are outdoors, reachable and can lead into free walking',async()=>{
  const {WALK_SPOTS}=await import('../src/data/walk-spots.js');
  const allowed=createWalkBoundary(map);
  assert.equal(new Set(WALK_SPOTS.map(s=>s.id)).size,WALK_SPOTS.length);
  for(const spot of WALK_SPOTS){
    assert.ok(allowed(spot.position[0],spot.position[2]),spot.id);
    const yaw=Math.atan2(spot.position[0]-spot.target[0],spot.position[2]-spot.target[2]);
    const p=walkStep(spot.position,yaw,1,0,.1,allowed);
    assert.ok(Math.hypot(p[0]-spot.position[0],p[2]-spot.position[2])>.1,spot.id);
  }
});

test('visiting a spot clears held input, faces the target, and rejects blocked landings',async()=>{
  const {WalkCamera}=await import('../src/engine/walk-camera.js');
  const {PerspectiveCamera,Euler,Vector3}=await import('three');
  const walk=Object.create(WalkCamera.prototype);
  Object.assign(walk,{active:true,camera:new PerspectiveCamera(),euler:new Euler(0,0,0,'YXZ'),keys:new Set(['KeyW']),actions:new Set(['forward']),clear(){this.keys.clear();this.actions.clear();},canEnter:x=>x<0});
  assert.equal(walk.visit([-100,2.2,20],[-50,16,0]),true);
  assert.equal(walk.keys.size+walk.actions.size,0);
  assert.equal(walk.moved,false);
  const expected=new Vector3(50,13.8,-20).normalize();
  assert.ok(walk.camera.getWorldDirection(new Vector3()).dot(expected)>.999);
  const before=walk.camera.position.toArray();
  assert.equal(walk.visit([10,2.2,20],[50,10,0]),false);
  assert.deepEqual(walk.camera.position.toArray(),before);
});

async function autoWalkFixture(run) {
  const {WalkCamera}=await import('../src/engine/walk-camera.js');
  const {PerspectiveCamera}=await import('three');
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  const fakeWindow=new EventTarget(),fakeDocument=Object.assign(new EventTarget(),{hidden:false});
  globalThis.window=fakeWindow;globalThis.document=fakeDocument;
  const canvas=Object.assign(new EventTarget(),{focus(){},setPointerCapture(){}});
  const events=[];const walk=new WalkCamera(new PerspectiveCamera(),canvas,()=>true);
  walk.onAutoChange=(enabled,detail)=>events.push({enabled,...detail});
  try{await run(walk,events,fakeWindow,fakeDocument);}finally{walk.dispose();globalThis.window=previousWindow;globalThis.document=previousDocument;}
}

test('auto walk continues without held input, follows a changed view and stops explicitly',()=>autoWalkFixture((walk,events)=>{
  walk.setAutoMoving(true);assert.equal(walk.autoMoving,false);
  walk.start();walk.yaw=0;walk.actions.add('left');walk.setAutoMoving(true);
  const initial=walk.camera.position.toArray();
  for(let i=0;i<10;i++)walk.update(.1);
  assert.ok(Math.abs(walk.camera.position.z-(initial[2]-7.15))<1e-8);
  assert.equal(walk.camera.position.x,initial[0]);assert.equal(walk.actions.size,0);
  walk.yaw=Math.PI/2;walk.update(.1);assert.ok(walk.camera.position.x<initial[0]);
  walk.setAutoMoving(false);const stopped=walk.camera.position.toArray();walk.update(.1);
  assert.deepEqual(walk.camera.position.toArray(),stopped);
  assert.equal(events.at(-1).duration_seconds,1);assert.equal(events.length,2);
}));

test('auto walk stops at the first obstacle and does not restart or slide indefinitely',()=>autoWalkFixture((walk,events)=>{
  walk.start();walk.camera.position.set(0,2.2,0);walk.yaw=0;walk.canEnter=(x,z)=>z>-.5;
  walk.setAutoMoving(true);walk.update(.1);
  assert.ok(walk.camera.position.z>-.5);assert.equal(walk.autoMoving,false);
  assert.equal(events.at(-1).reason,'obstacle');const stopped=walk.camera.position.toArray();
  walk.update(.1);assert.deepEqual(walk.camera.position.toArray(),stopped);assert.equal(events.length,2);
}));

test('manual input, dialogs, background and window blur cancel auto walk without resuming',()=>autoWalkFixture((walk,events,win,doc)=>{
  walk.start();walk.setAutoMoving(true);walk.setAction('back',true);
  assert.equal(walk.autoMoving,false);assert.equal(events.at(-1).reason,'manual');
  walk.setAutoMoving(true);walk.keyDown({code:'KeyW',target:{closest:()=>null},preventDefault(){}});
  assert.equal(walk.autoMoving,false);assert.ok(walk.keys.has('KeyW'));
  walk.setAutoMoving(true);walk.setSuspended(true);walk.setAutoMoving(true);
  assert.equal(walk.autoMoving,false);walk.setSuspended(false);assert.equal(walk.autoMoving,false);
  walk.setAutoMoving(true);doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(walk.autoMoving,false);assert.equal(events.at(-1).reason,'hidden');
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(walk.autoMoving,false);
  walk.setAutoMoving(true);win.dispatchEvent(new Event('blur'));
  assert.equal(walk.autoMoving,false);assert.equal(events.at(-1).reason,'blur');
}));
