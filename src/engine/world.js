import * as THREE from 'three';
import { Architecture, random, makeTrain } from './geometry.js';
import { buildStation } from './station.js';
import { buildUrban, map } from './urban.js';
import { buildRailway } from './railway.js';
import { createShinkansen } from './shinkansen.js';
import { createServiceMotion } from './train-motion.js';

export function createWorld(scene){
  const a=new Architecture(scene),rand=random(2026);
  const urban=buildUrban(scene,a);
  const stationRoot=new THREE.Group();stationRoot.scale.z=.90;scene.add(stationRoot);
  const stationArchitecture=new Architecture(stationRoot);
  const station=buildStation(stationArchitecture);stationArchitecture.finish();
  const railway=buildRailway(a);a.finish();
  const colors=['#dc8e45','#32a7b7','#72a648','#dc8e45','#3778aa','#376bb0'];
  const trains=railway.routes.map((route,i)=>{
    if(route.profile?.gauge>1.4)return createShinkansen(route,scene);
    const carriage=makeTrain(colors[i],false,1),cars=[];
    carriage.scale.set(route.profile?.gauge>1.4?.87:.76,.82,1);
    for(let n=0;n<7;n++){const model=carriage.clone();scene.add(model);cars.push(model);}
    const direction=i%2?1:-1;
    const motion=createServiceMotion({total:route.total,stationDistance:route.stationDistance,length:cars.length*12.4,direction,phase:i/6,maxSpeed:18});
    return {cars,route,direction,motion};
  });
  const cars=[],carGeometry=new THREE.BoxGeometry(2,1.45,4),topGeometry=new THREE.BoxGeometry(1.75,.8,2.2);
  const eligible=urban.routes.filter(r=>!r.road.elevation&&r.total>130);
  for(let i=0;i<70&&eligible.length;i++){
    const route=eligible[i%eligible.length],model=new THREE.Group();
    const material=new THREE.MeshStandardMaterial({color:['#dddcd0','#adbdb3','#47585b','#d7bc6c','#6e949c'][i%5]});
    const body=new THREE.Mesh(carGeometry,material);body.position.y=1;body.castShadow=true;model.add(body);
    const top=new THREE.Mesh(topGeometry,new THREE.MeshStandardMaterial({color:'#375661'}));top.position.y=1.8;model.add(top);scene.add(model);
    cars.push({model,route,offset:rand()*route.total,direction:route.road.oneway?1:i%2?1:-1});
  }
  const labels=[{name:'東京駅',position:new THREE.Vector3(-51,40,0)},...urban.labels,{name:'皇居外苑',position:new THREE.Vector3(-655,18,125)}];
  return {architecture:a,stationArchitecture,station,urban,trains,cars,labels,mapStats:map.meta.counts,platformRoofs:railway.roofs};
}
