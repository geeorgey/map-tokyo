import test from 'node:test';
import assert from 'node:assert/strict';
import {StationTour,TOUR_STOPS} from '../src/engine/station-tour.js';

test('an explicit tour visits all three scenes and completes once at 24 seconds',()=>{
  const views=[],changes=[];const tour=new StationTour(view=>views.push(view),state=>changes.push(state));
  tour.update(.1);assert.equal(views.length,0);
  tour.start();tour.start();assert.deepEqual(views,[TOUR_STOPS[0].view]);
  for(let i=0;i<80;i++)tour.update(.1);assert.equal(tour.step,1);
  for(let i=0;i<80;i++)tour.update(.1);assert.equal(tour.step,2);
  for(let i=0;i<80;i++)tour.update(.1);
  assert.deepEqual(views,TOUR_STOPS.map(stop=>stop.view));assert.equal(tour.active,false);assert.equal(tour.elapsed,24);
  tour.update(100);assert.equal(changes.filter(s=>s.reason==='complete').length,1);
});
test('manual, dialog and hidden interruptions stop without jumping or silently restarting',()=>{
  for(const reason of ['manual','button','dialog','hidden','blur','walk','follow','mode','view']){
    const views=[],changes=[];const tour=new StationTour(view=>views.push(view),state=>changes.push(state));
    tour.start();for(let i=0;i<95;i++)tour.update(.1);
    const before=[...views];tour.stop(reason);tour.stop(reason);
    for(let i=0;i<300;i++)tour.update(.1);
    assert.deepEqual(views,before);assert.equal(changes.at(-1).reason,reason);
    assert.equal(changes.filter(s=>s.reason===reason).length,1);assert.equal(tour.active,false);
    tour.start();assert.equal(tour.step,0);assert.equal(tour.elapsed,0);
  }
});
test('a delayed frame cannot skip scenes and invalid deltas do not advance the tour',()=>{
  const tour=new StationTour(()=>{});tour.start();
  for(const delta of [NaN,Infinity,-1,0])tour.update(delta);
  assert.equal(tour.elapsed,0);tour.update(3600);assert.equal(tour.elapsed,.1);assert.equal(tour.step,0);
});
