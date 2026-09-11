import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {ScheduledDiorama} from '../src/diorama.mjs';
import {Daylight} from '../src/engine/daylight.js';

test('scheduled rendering uses the selected clock while scenic lighting runs independently',()=>{
  const departure=Date.parse('2026-09-06T06:00:00+09:00');
  let selectedTime=departure-1000;
  const car=new Group();
  const engine=Object.create(ScheduledDiorama.prototype);
  Object.assign(engine,{
    disposed:false,lastTime:0,clock:{now:()=>selectedTime},time:0,
    world:{trains:[{cars:[car],route:{points:[new Vector3(0,0,0),new Vector3(0,0,1000)],lengths:[0,1000]}}],cars:[],labels:[]},
    lanes:[[{id:'departure',at:departure}]],envelopes:[{stop:200,start:0,end:900,direction:1,dwell:60,arrival:90,departure:90}],
    daylight:new Daylight(),applyDaylight(){this.period=this.daylight.period;},
    walkCamera:{active:false},
    controls:{target:new Vector3(),update(){},getAzimuthalAngle:()=>0},camera:{position:new Vector3(0,1000,0)},
    renderer:{render(){}},scene:{},shadowRadius:850,frameCount:0,measureTime:0,uiTick:0,onFrame(){},
  });
  const previous=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=()=>0;
  try{
    engine.daylight.setRunning(true);
    engine.animate(1000);const stopped=car.position.clone(),light=engine.daylight.phase;
    engine.animate(2000);
    assert.equal(engine.activeTrains[0].status,'停車中');
    assert.ok(car.position.equals(stopped));assert.ok(engine.daylight.phase>light);
    selectedTime=departure+30000;engine.animate(3000);
    assert.equal(engine.activeTrains[0].status,'発車');assert.ok(car.position.z>stopped.z);
    assert.equal(engine.activeTrains[0].event.id,'departure');
    engine.daylight.setRunning(false);const frozen=engine.daylight.phase;
    selectedTime=departure+40000;engine.animate(4000);assert.equal(engine.daylight.phase,frozen);
  }finally{if(previous)globalThis.requestAnimationFrame=previous;else delete globalThis.requestAnimationFrame;}
});
