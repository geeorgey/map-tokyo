// Analytic acceleration / cruise / braking; independent of frame rate.
function makeLeg(distance,maxSpeed,acceleration){
  const ramp=Math.min(maxSpeed/acceleration,Math.sqrt(Math.max(0,distance)/acceleration));
  const peak=ramp*acceleration,cruise=peak>0?Math.max(0,(distance-acceleration*ramp*ramp)/peak):0;
  return {distance,ramp,peak,cruise,duration:2*ramp+cruise,acceleration};
}
function sampleLeg(leg,t){
  t=Math.max(0,Math.min(t,leg.duration));
  if(t<leg.ramp)return {distance:.5*leg.acceleration*t*t,speed:leg.acceleration*t};
  if(t<leg.ramp+leg.cruise)return {distance:.5*leg.acceleration*leg.ramp**2+leg.peak*(t-leg.ramp),speed:leg.peak};
  const remaining=leg.duration-t;return {distance:leg.distance-.5*leg.acceleration*remaining**2,speed:leg.acceleration*remaining};
}
export function createServiceMotion({total,stationDistance,length,direction=1,maxSpeed=18,acceleration=.65,dwell=12,phase=0}){
  const margin=length/2+1;
  if(total<=2*margin||maxSpeed<=0||acceleration<=0||![-1,1].includes(direction))throw new Error('Invalid service motion envelope');
  const stop=Math.max(margin,Math.min(total-margin,stationDistance)),start=direction===1?margin:total-margin,end=direction===1?total-margin:margin;
  const arrival=makeLeg(Math.abs(stop-start),maxSpeed,acceleration),departure=makeLeg(Math.abs(end-stop),maxSpeed,acceleration);
  const cycle=arrival.duration+dwell+departure.duration+5;
  return {start,stop,end,direction,arrival,departure,dwell,cycle,offset:phase*cycle};
}
export function sampleServiceMotion(plan,time){
  const phase=((time+plan.offset)%plan.cycle+plan.cycle)%plan.cycle;
  if(phase<plan.arrival.duration){const state=sampleLeg(plan.arrival,phase);return {center:plan.start+plan.direction*state.distance,speed:state.speed,status:'入線',visible:true};}
  if(phase<plan.arrival.duration+plan.dwell)return {center:plan.stop,speed:0,status:'停車中',visible:true};
  if(phase<plan.arrival.duration+plan.dwell+plan.departure.duration){const state=sampleLeg(plan.departure,phase-plan.arrival.duration-plan.dwell);return {center:plan.stop+plan.direction*state.distance,speed:state.speed,status:'発車',visible:true};}
  return {center:plan.end,speed:0,status:'待機',visible:false};
}
