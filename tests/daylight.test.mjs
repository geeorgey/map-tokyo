import test from 'node:test';
import assert from 'node:assert/strict';
import {Daylight,periods} from '../src/engine/daylight.js';
import {Color} from 'three';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('a full loop passes through the original presets and joins without a jump',()=>{
  const d=new Daylight();d.setRunning(true);
  for(const key of ['evening','night','day']){
    d.update(30);assert.equal(d.period,key);
    near(d.value.glow,periods[key].glow);
    assert.ok(d.value.sky.equals(new Color(periods[key].sky)));
  }
  d.update(89.999);const before=d.value.sky.clone();d.update(.002);
  for(const channel of ['r','g','b'])assert.ok(Math.abs(before[channel]-d.value.sky[channel])<1e-6);
});

test('stopping freezes intermediate light and resuming continues from it',()=>{
  const d=new Daylight();d.setRunning(true);d.update(42);
  const phase=d.phase,sky=d.value.sky.clone(),glow=d.value.glow;
  d.setRunning(false);assert.equal(d.update(120),false);
  near(d.phase,phase);near(d.value.glow,glow);assert.ok(d.value.sky.equals(sky));
  d.setRunning(true);d.update(3);near(d.phase,phase+.1);
});

test('manual selection interrupts automatic light without snapping and reaches its preset',()=>{
  const d=new Daylight();d.setRunning(true);d.update(43);const sky=d.value.sky.clone();
  d.select('day');assert.equal(d.running,false);assert.ok(d.value.sky.equals(sky));
  d.update(.9);const halfway=d.value.sky.clone();d.select('night');assert.ok(d.value.sky.equals(halfway));
  d.update(1.8);assert.equal(d.period,'night');near(d.phase,2);near(d.value.glow,2.2);
});

test('reduced-motion selection is immediate and cycling always stays bounded',()=>{
  const d=new Daylight();d.select('night',true);near(d.phase,2);assert.equal(d.transition,null);
  d.setRunning(true);
  for(let i=0;i<2000;i++){
    d.update(.137);assert.ok(d.phase>=0&&d.phase<3);
    assert.ok(d.value.glow>=0&&d.value.glow<=2.2);
    assert.ok(d.value.position.y>=155&&d.value.position.y<=600);
  }
});
