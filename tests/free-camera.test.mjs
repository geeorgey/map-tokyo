import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { FreeCamera } from '../src/engine/free-camera.js';

function fixture(run) {
  const oldWindow=globalThis.window,oldDocument=globalThis.document;
  const win=globalThis.window=new EventTarget(),doc=globalThis.document=Object.assign(new EventTarget(),{hidden:false});
  const canvas=Object.assign(new EventTarget(),{focus(){},setPointerCapture(){},clientHeight:720});
  const camera=new PerspectiveCamera();camera.position.set(120,200,-80);camera.lookAt(400,80,120);
  const free=new FreeCamera(camera,canvas);free.start();
  const dispatch=(target,type,props={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,props);target.dispatchEvent(event);};
  try{run({free,camera,canvas,win,doc,dispatch});}finally{free.dispose();globalThis.window=oldWindow;globalThis.document=oldDocument;}
}
test('looking rotates in place; forward and strafe preserve the new orientation',()=>fixture(({free,camera})=>{
  const start=camera.position.clone();free.look(80,-30);assert.ok(camera.position.equals(start));
  const q=camera.quaternion.clone(),forward=camera.getWorldDirection(new Vector3());
  free.translate(20,0,0);assert.ok(camera.position.clone().sub(start).normalize().dot(forward)>.999999);
  const next=camera.position.clone();free.translate(0,15,0);
  const side=camera.position.clone().sub(next);assert.ok(Math.abs(side.dot(forward))<1e-9);assert.ok(Math.abs(side.length()-15)<1e-9);
  assert.ok(camera.quaternion.equals(q));
}));
test('wheel approaches the centre of the current view, without changing field of view',()=>fixture(({camera,canvas,dispatch})=>{
  const start=camera.position.clone(),direction=camera.getWorldDirection(new Vector3()),q=camera.quaternion.clone(),fov=camera.fov;
  dispatch(canvas,'wheel',{deltaY:-100,deltaMode:0});
  assert.ok(camera.position.clone().sub(start).normalize().dot(direction)>.999999);
  assert.ok(camera.quaternion.equals(q));assert.equal(camera.fov,fov);
}));
test('held movement stops on dialog suspension, blur, hidden page and mode switch',()=>fixture(({free,camera,win,doc,dispatch})=>{
  for(const stop of [()=>free.setSuspended(true),()=>dispatch(win,'blur'),()=>{doc.hidden=true;dispatch(doc,'visibilitychange');},()=>free.stop()]){
    free.setSuspended(false);free.start();free.setAction('forward',true);free.update(.1);
    stop();const p=camera.position.clone();free.update(.1);assert.ok(camera.position.equals(p));assert.equal(free.actions.size,0);
  }
}));
test('release and pointer cancellation stop dragging; inactive camera ignores the wheel',()=>fixture(({free,camera,canvas,dispatch})=>{
  dispatch(canvas,'pointerdown',{pointerId:1,clientX:10,clientY:10,button:0});
  dispatch(canvas,'pointermove',{pointerId:1,clientX:30,clientY:20});const q=camera.quaternion.clone();
  dispatch(canvas,'pointercancel',{pointerId:1});dispatch(canvas,'pointermove',{pointerId:1,clientX:90,clientY:60});assert.ok(camera.quaternion.equals(q));
  free.stop();const p=camera.position.clone();dispatch(canvas,'wheel',{deltaY:100,deltaMode:0});assert.ok(camera.position.equals(p));
}));
