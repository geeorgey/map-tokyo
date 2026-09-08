import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {FollowCamera} from '../src/engine/follow-camera.js';
function setup(){const camera=new PerspectiveCamera();camera.position.set(0,100,200);const controls={target:new Vector3()};return {camera,controls,follow:new FollowCamera(camera,controls)};}
function near(a,b){assert(a.distanceTo(b)<1e-8);}
test('tracking preserves manually changed orbit, zoom and pan offsets',()=>{
 const {camera,controls,follow}=setup(),anchor=new Vector3(50,4.45,60);follow.start(anchor,0,true);
 camera.position.add(new Vector3(13,4,-22));controls.target.add(new Vector3(3,1,2));
 const cameraOffset=camera.position.clone().sub(anchor),targetOffset=controls.target.clone().sub(anchor);
 for(let i=1;i<200;i++){const p=new Vector3(50+Math.sin(i/20)*10,4.45+i*.01,60+i);follow.update(p,i*16);near(camera.position.clone().sub(p),cameraOffset);near(controls.target.clone().sub(p),targetOffset);}
});
test('entry transition follows a moving train and has no end jump',()=>{
 const {camera,controls,follow}=setup();follow.start(new Vector3(0,4,0),0);
 follow.update(new Vector3(0,4,10),1100);near(controls.target,new Vector3(0,5.8,10));
 const offset=camera.position.clone().sub(controls.target);follow.update(new Vector3(0,4,11),1116);near(camera.position.clone().sub(controls.target),offset);
});
test('pause and stop leave the camera stationary; user input can interrupt easing',()=>{
 const {camera,controls,follow}=setup(),p=new Vector3(0,4,0);follow.start(p,0);follow.update(p,400);follow.interruptTransition();
 const before=camera.position.clone(),target=controls.target.clone();follow.update(p,500);near(camera.position,before);near(controls.target,target);
 follow.stop();follow.update(new Vector3(40,4,200),1000);near(camera.position,before);near(controls.target,target);
});
