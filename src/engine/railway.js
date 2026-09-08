import * as THREE from 'three';
import { map } from './urban.js';
import { buildPlatforms, platformData } from './platforms.js';
import { railPoints } from './rail-layout.js';
import { buildCatenary } from './catenary.js';

export function buildRailway(a){
  const b=(...args)=>a.box(...args),graph=new Map(),crossings=[];
  const key=(p)=>p.map(v=>Math.round(v*100)).join(',');
  function node(p){const k=key(p);if(!graph.has(k))graph.set(k,{p:[p[0],p[2]],position:new THREE.Vector3(...p),neighbors:new Set()});return k;}
  for(const rail of map.rails){
    const profile=platformData.tracks[String(rail.id)],points=railPoints(rail.points,profile);let sleeperDistance=0;
    for(let i=1;i<points.length;i++){
      const p=new THREE.Vector3(...points[i-1]),q=new THREE.Vector3(...points[i]),length=p.distanceTo(q);if(length<.08)continue;
      const pk=node(points[i-1]),qk=node(points[i]);graph.get(pk).neighbors.add(qk);graph.get(qk).neighbors.add(pk);
      const tangent=q.clone().sub(p).normalize(),planar=Math.hypot(tangent.x,tangent.z),dx=tangent.x/planar,dz=tangent.z/planar;
      a.beam('#868780',p.clone().add(new THREE.Vector3(0,-.68,0)),q.clone().add(new THREE.Vector3(0,-.68,0)),3.35,.55);
      for(const side of [-1,1]){
        const offset=new THREE.Vector3(side*dz*(profile?.gauge||1.067)/2,-.1,-side*dx*(profile?.gauge||1.067)/2);
        a.beam('#b6beb7',p.clone().add(offset),q.clone().add(offset),.075,.2);
      }
      for(let d=sleeperDistance;d<length;d+=.72){
        const pos=p.clone().addScaledVector(tangent,d);b('#59625c',pos.x,pos.y-.29,pos.z,2.4,.16,.22,Math.atan2(dx,dz));
      }
      sleeperDistance=(sleeperDistance-length)%.72;if(sleeperDistance<0)sleeperDistance+=.72;
      if(p.z<=0&&q.z>0||q.z<=0&&p.z>0){const x0=p.x+(q.x-p.x)*(-p.z)/(q.z-p.z);crossings.push({x:x0,pk,qk,profile});}
    }
  }
  const station=buildPlatforms(a);
  const catenary=buildCatenary(a,map.rails,platformData.tracks);
  function extend(first,previous,direction,seen){
    const path=[];let current=first,prev=previous;
    for(let steps=0;steps<1600;steps++){
      const n=graph.get(current);path.push(n.position.clone());seen.add(current);
      const before=graph.get(prev).p,tx=n.p[0]-before[0],tz=n.p[1]-before[1],tl=Math.hypot(tx,tz)||1;
      const candidates=[...n.neighbors].filter(k=>!seen.has(k)&&k!==prev).map(k=>{
        const p=graph.get(k).p,dx=p[0]-n.p[0],dz=p[1]-n.p[1],dl=Math.hypot(dx,dz)||1;
        return {k,score:(dx*tx+dz*tz)/(dl*tl)*10+direction*dz/dl*3};
      }).sort((a,b)=>b.score-a.score);
      if(!candidates.length)break;prev=current;current=candidates[0].k;
    }return path;
  }
  const routes=[];
  for(const desired of [-31,-14,4,23,63,143]){
    const crossing=[...crossings].sort((a,b)=>Math.abs(a.x-desired)-Math.abs(b.x-desired))[0];if(!crossing)continue;
    let {pk,qk}=crossing;if(graph.get(pk).p[1]>graph.get(qk).p[1])[pk,qk]=[qk,pk];
    const north=extend(pk,qk,-1,new Set([qk])),south=extend(qk,pk,1,new Set([pk]));
    const points=[...north.reverse(),...south];
    const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+points[i].distanceTo(points[i-1]));
    const platform=station.platforms.find(p=>p.ref.split(';').includes(crossing.profile?.ref?.split(' ')[0]));
    const stopZ=platform?platform.centerline[Math.floor(platform.centerline.length/2)][1]:0;
    const stationIndex=points.reduce((best,p,i)=>Math.abs(p.z-stopZ)<Math.abs(points[best].z-stopZ)?i:best,0);
    if(lengths.at(-1)>200)routes.push({points,lengths,total:lengths.at(-1),stationDistance:lengths[stationIndex],profile:crossing.profile});
  }
  return {routes,roofs:station.roofs,catenary};
}
