import * as THREE from 'three';
import { samplePolyline } from './urban.js';
import { bulletTypes, makeCar } from './train-model.js';
export { bulletTypes } from './train-model.js';

export function createShinkansen(route,scene){
  const type=Number.parseInt(route.profile.ref,10)<20?'n700':'e7',spec=bulletTypes[type];
  const cars=[],lengths=[];
  const middle=makeCar(type),panto=makeCar(type,false,true);
  for(let i=0;i<spec.count;i++){
    const end=i===0||i===spec.count-1;
    const part=end?makeCar(type,true):((type==='n700'?[4,11]:[2,6]).includes(i)?panto:middle);
    const body=end?part.group:part.group.clone(),car=new THREE.Group();
    if(i===0)body.rotation.y=Math.PI;
    car.add(body);car.userData.lampMaterial=end?body.userData.lampMaterial:null;
    car.userData.end=i===0?-1:i===spec.count-1?1:0;
    car.userData.length=part.length;scene.add(car);cars.push(car);lengths.push(part.length);
  }
  const totalLength=lengths.reduce((a,b)=>a+b,0);let cursor=-totalLength/2;
  const offsets=lengths.map(length=>{const d=cursor+length/2;cursor+=length;return d;});
  const stop=route.stationDistance;
  const approach=type==='n700'?route.total-totalLength/2-20:totalLength/2+20;
  if(Math.min(stop,route.total-stop)<totalLength/2)throw new Error(`${spec.name}: consist does not fit its terminal route`);
  const travel=Math.max(20,Math.abs(stop-approach)/15),dwell=20,cycle=2*travel+dwell+5;
  return {kind:'shinkansen',type,name:spec.name,cars,route,offsets,totalLength,approach,stop,travel,dwell,cycle,initialPhase:type==='n700'?travel+2:travel*.78};
}

export function bulletMotion(train,time){
  const phase=(time+train.initialPhase)%train.cycle,arrival=phase<train.travel,stopped=phase>=train.travel&&phase<train.travel+train.dwell,leaving=phase>=train.travel+train.dwell&&phase<2*train.travel+train.dwell;
  const progress=arrival?phase/train.travel:leaving?(phase-train.travel-train.dwell)/train.travel:stopped?1:0;
  const smooth=progress*progress*(3-2*progress);
  const center=arrival?THREE.MathUtils.lerp(train.approach,train.stop,smooth):leaving?THREE.MathUtils.lerp(train.stop,train.approach,smooth):stopped?train.stop:train.approach;
  const direction=Math.sign(train.stop-train.approach)*(leaving?-1:1);
  return {center,direction,visible:arrival||stopped||leaving,status:arrival?'入線':stopped?'停車中':'発車'};
}

export function updateShinkansen(train,time){
  const motion=bulletMotion(train,time);
  train.cars.forEach((car,i)=>{
    car.visible=motion.visible;
    const d=motion.center+train.offsets[i],rear=samplePolyline(train.route.points,train.route.lengths,d-8.5).position,front=samplePolyline(train.route.points,train.route.lengths,d+8.5).position;
    const tangent=front.clone().sub(rear).normalize();car.position.copy(rear).add(front).multiplyScalar(.5);car.rotation.set(-Math.atan2(tangent.y,Math.hypot(tangent.x,tangent.z)),Math.atan2(tangent.x,tangent.z),0,'YXZ');
    if(car.userData.lampMaterial){const c=car.userData.end===motion.direction?'#fff0bd':'#e64b45';car.userData.lampMaterial.color.set(c);car.userData.lampMaterial.emissive.set(c);}
  });
}
