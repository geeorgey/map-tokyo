import test from 'node:test';
import assert from 'node:assert/strict';
import {drawDeparture} from '../src/departure-draw.mjs';
const events=[{lineId:'a',at:100},{lineId:'a',at:110},{lineId:'b',at:120},{lineId:'c',at:130}];
test('one next departure per route gives every route one chance',()=>{
 assert.equal(drawDeparture(events,90,null,()=>0),events[0]);
 assert.equal(drawDeparture(events,90,null,()=>.4),events[2]);
 assert.equal(drawDeparture(events,90,null,()=>.9),events[3]);
});
test('never replay a watched or elapsed departure, and prefer another available route',()=>{
 assert.equal(drawDeparture(events,95,events[0],()=>0),events[2]);
 assert.equal(drawDeparture(events,125,events[0],()=>0),events[3]);
 assert.equal(drawDeparture(events.slice(0,2),95,events[0],()=>0),events[1]);
 assert.equal(drawDeparture(events,130),null);
 assert.equal(drawDeparture([],0),null);
 assert.equal(drawDeparture(events,NaN),null);
});
test('does not change input or invent events, and handles random source boundaries',()=>{
 const copy=structuredClone(events);
 for(const rng of [-1,1,NaN,Infinity]) assert.ok(events.includes(drawDeparture(events,90,null,()=>rng)));
 assert.deepEqual(events,copy);
 assert.equal(drawDeparture([...events].reverse(),90,null,()=>.99),events[0]);
});
