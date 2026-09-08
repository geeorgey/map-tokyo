import test from 'node:test';
import assert from 'node:assert/strict';
import {createServiceMotion,sampleServiceMotion} from '../src/engine/train-motion.js';
for(const direction of [-1,1])for(const total of [210,1200])test(`smooth bounded service, direction ${direction}, route ${total} m`,()=>{
 const length=86.8,plan=createServiceMotion({total,stationDistance:total*.43,length,direction,maxSpeed:18});
 let previous=null;const stages=new Set();
 for(let t=0;t<plan.cycle;t+=.02){const state=sampleServiceMotion(plan,t);stages.add(state.status);
  assert(state.center>=length/2&&state.center<=total-length/2);
  assert(state.speed>=0&&state.speed<=18+1e-8);
  if(previous&&state.visible&&previous.visible){assert((state.center-previous.center)*direction>=-1e-8);assert(Math.abs(state.speed-previous.speed)<=.65*.02+1e-7);}
  if(state.status==='停車中'){assert.equal(state.center,plan.stop);assert.equal(state.speed,0);}
  previous=state;
 }
 assert.equal(stages.size,4);
 for(const boundary of [plan.arrival.duration,plan.arrival.duration+plan.dwell]){
  const before=sampleServiceMotion(plan,boundary-1e-5),after=sampleServiceMotion(plan,boundary+1e-5);
  assert(Math.abs(before.center-after.center)<1e-7);assert(before.speed<1e-4&&after.speed<1e-4);
 }
 assert.deepEqual(sampleServiceMotion(plan,plan.cycle+4),sampleServiceMotion(plan,4));
});
test('short and invalid routes fail explicitly',()=>assert.throws(()=>createServiceMotion({total:80,stationDistance:40,length:86.8})));
