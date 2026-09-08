import * as THREE from 'three';
import { railPoints } from './rail-layout.js';

// Schematic equipment positioned from the map tracks; not a survey of actual poles.
export const CONTACT_HEIGHT=5.0;
const SPAN=47,ORIGIN=-770;
export function catenaryLayout(rails,profiles){
  const paths=rails.map(rail=>({id:rail.id,points:railPoints(rail.points,profiles[String(rail.id)])}));
  const portals=[];
  for(let z=ORIGIN;z<830;z+=SPAN){
    const crossings=[];
    for(const path of paths)for(let i=1;i<path.points.length;i++){
      const p=path.points[i-1],q=path.points[i];
      if(!(p[2]<=z&&q[2]>z||q[2]<=z&&p[2]>z))continue;
      const t=(z-p[2])/(q[2]-p[2]);const point=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,z];
      if(!crossings.some(c=>Math.hypot(c[0]-point[0],c[1]-point[1])<.2))crossings.push(point);
    }
    crossings.sort((a,b)=>a[0]-b[0]);
    const groups=[];
    for(const p of crossings){const group=groups.at(-1),previous=group?.at(-1);
      if(!group||Math.abs(p[1]-previous[1])>1||p[0]-previous[0]>15||(p[0]-group[0][0]>45&&p[0]-previous[0]>=4.8))groups.push([p]);else group.push(p);
    }
    for(const group of groups){
      const left=group[0][0]-2.7,right=group.at(-1)[0]+2.7;
      // No column is placed within the train envelope, even on a neighboring track.
      if(crossings.some(p=>Math.abs(p[0]-left)<2.05||Math.abs(p[0]-right)<2.05))continue;
      const base=Math.min(...group.map(p=>p[1]))-.7,top=Math.max(...group.map(p=>p[1]))+7.1;
      portals.push({z,left,right,base,top,tracks:group,crossings});
    }
  }
  return {paths,portals};
}
export function buildCatenary(a,rails,profiles){
  const layout=catenaryLayout(rails,profiles),contact=[],messenger=[],droppers=[];
  const append=(list,p,q)=>list.push(...p,...q);
  const supportY=p=>p[1]+CONTACT_HEIGHT+1.10-.34*4*((p[2]-ORIGIN)/SPAN-Math.floor((p[2]-ORIGIN)/SPAN))*(1-((p[2]-ORIGIN)/SPAN-Math.floor((p[2]-ORIGIN)/SPAN)));
  const seen=new Set();
  for(const {points} of layout.paths){
    for(let i=1;i<points.length;i++){
      const p=points[i-1],q=points[i];
      append(contact,[p[0],p[1]+CONTACT_HEIGHT,p[2]],[q[0],q[1]+CONTACT_HEIGHT,q[2]]);
      append(messenger,[p[0],supportY(p),p[2]],[q[0],supportY(q),q[2]]);
      // Droppers follow the same elevation profile as the contact wire.
      const key=p.map(v=>Math.round(v*4)).join(',');if(!seen.has(key)){seen.add(key);append(droppers,[p[0],p[1]+CONTACT_HEIGHT,p[2]],[p[0],supportY(p),p[2]]);}
    }
  }
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  for(const {z,left,right,base,top,tracks} of layout.portals){
    for(const x of [left,right]){
      a.box('#9DA69F',x,base+.22,z,.85,.44,.85);
      a.box('#697A77',x,(base+top)/2,z,.25,top-base,.25);
      a.beam('#83928B',v(x,top-1.65,z),v(x+(x===left?1.6:-1.6),top,z),.11,.11);
    }
    a.beam('#7C8C86',v(left,top,z),v(right,top,z),.16,.16);
    a.beam('#7C8C86',v(left,top+.65,z),v(right,top+.65,z),.13,.13);
    const bays=Math.ceil((right-left)/3.5);
    for(let i=0;i<bays;i++){const x0=left+(right-left)*i/bays,x1=left+(right-left)*(i+1)/bays;
      a.beam('#95A098',v(x0,top+(i%2?.65:0),z),v(x1,top+(i%2?0:.65),z),.07,.07);
    }
    for(const [x,y] of tracks){
      a.box('#7E8B85',x,(top+y+CONTACT_HEIGHT+1.10)/2,z,.06,top-y-CONTACT_HEIGHT-1.10,.06);
      for(let j=0;j<3;j++)a.cylinder('#BAC0AE',x,top-.3-j*.12,z,.23,.07,.23);
      a.beam('#8B9890',v(x-.5,y+CONTACT_HEIGHT+.5,z),v(x,y+CONTACT_HEIGHT,z),.04,.04);
    }
  }
  const group=new THREE.Group();group.name='架線・吊架線';
  for(const [name,positions,color,opacity] of [['トロリ線',contact,'#615D50',.68],['吊架線',messenger,'#6C766B',.58],['ハンガー',droppers,'#737B70',.5]]){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));lines.name=name;group.add(lines);
  }
  a.scene.add(group);return {group,layout};
}
