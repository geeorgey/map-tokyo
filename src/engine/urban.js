import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import map from '../data/tokyo-map.json' with { type: 'json' };
import { random } from './geometry.js';

export { map };
export function shapeFromPolygon(p) {
  const shape=new THREE.Shape(p.outer.map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const ring of p.holes||[])shape.holes.push(new THREE.Path(ring.map(([x,z])=>new THREE.Vector2(x,-z))));
  return shape;
}
function contains(p,x,z) {
  function ringInside(r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [ax,az]=r[i],[bx,bz]=r[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;}return inside;}
  return ringInside(p.outer)&&!(p.holes||[]).some(ringInside);
}

export function buildUrban(scene,a) {
  const textures=[],nightMaterials=[],batches=new Map(),rand=random(90210);
  const b=(...args)=>a.box(...args);
  const roofMaterial=new THREE.MeshStandardMaterial({color:'#b0b5ae',roughness:.9});
  const styles={glass:['#607e85','#a7b6b5','#3d5c66'],stone:['#b7b4a8','#e2ded0','#52676a'],concrete:['#a9b4b3','#d1d6cd','#49636d'],warm:['#b1a18b','#d9cbb4','#4d676d'],white:['#deddd0','#f0eee3','#50696d']};
  const facadeMaterials={};
  for(const [name,[wall,frame,glass]] of Object.entries(styles)){
    const colorCanvas=document.createElement('canvas'),emissiveCanvas=document.createElement('canvas');
    colorCanvas.width=emissiveCanvas.width=512;colorCanvas.height=emissiveCanvas.height=512;
    const c=colorCanvas.getContext('2d'),e=emissiveCanvas.getContext('2d');c.fillStyle=wall;c.fillRect(0,0,512,512);e.fillStyle='#000';e.fillRect(0,0,512,512);
    for(let row=0;row<8;row++)for(let col=0;col<8;col++){
      const x=col*64,y=row*64;const pad=name==='glass'?3:11;
      c.fillStyle=glass;c.fillRect(x+pad,y+9,64-pad*2,44);
      c.fillStyle=frame;c.fillRect(x,y,64,3);c.fillRect(x+31,y+9,2,44);
      c.fillStyle='#d8eef21b';c.fillRect(x+pad+2,y+11,56-pad*2,5);
      if(rand()<.37){e.fillStyle=['#e9d4a5','#b3c9cb','#d9c490'][Math.floor(rand()*3)];e.fillRect(x+pad,y+9,64-pad*2,44);}
    }
    const t=new THREE.CanvasTexture(colorCanvas),et=new THREE.CanvasTexture(emissiveCanvas);
    for(const texture of [t,et]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);}
    const mat=new THREE.MeshStandardMaterial({map:t,color:'#ffffff',emissiveMap:et,emissive:'#ffe8c6',emissiveIntensity:0,roughness:name==='glass'?.42:.85,metalness:name==='glass'?.18:.02});facadeMaterials[name]=mat;nightMaterials.push(mat);
  }
  function push(key,geometry,material){if(!batches.has(key))batches.set(key,{geometries:[],material});batches.get(key).geometries.push(geometry);}
  function surface(key,polygons,color,y,roughness=.95){
    const material=new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide});
    for(const polygon of polygons){const g=new THREE.ShapeGeometry(shapeFromPolygon(polygon));g.rotateX(-Math.PI/2);g.translate(0,y,0);push(key,g,material);}
  }
  b('#8d9b91',-10,-5,5,1460,10,1710);
  surface('ground',[{outer:[[-740,-850],[720,-850],[720,860],[-740,860],[-740,-850]]}],'#c0c2b7',.02);
  surface('green',map.surfaces.green,'#829467',.10);
  surface('sidewalks',map.surfaces.sidewalks,'#d0d0c3',.18);
  surface('pedestrian',map.surfaces.pedestrian,'#d5d2c4',.22);
  surface('water',map.surfaces.water,'#527e82',.12,.3);
  surface('roads',map.surfaces.roads,'#626e71',.20);
  // Low embankments follow actual moat boundaries, including corners and bridges.
  for(const p of map.surfaces.water)for(const ring of [p.outer,...p.holes])for(let i=1;i<ring.length;i++){
    const [x,z]=ring[i-1],[xx,zz]=ring[i],length=Math.hypot(xx-x,zz-z);if(length<.1)continue;
    b('#8d9a8c',(x+xx)/2,.85,(z+zz)/2,.95,1.5,length,Math.atan2(xx-x,zz-z));
  }
  const uv={
    generateTopUV(g,v,ia,ib,ic){return [ia,ib,ic].map(i=>new THREE.Vector2(v[i*3]/28.8,v[i*3+1]/28.8));},
    generateSideWallUV(g,v,ia,ib,ic,id){const len=Math.hypot(v[ib*3]-v[ia*3],v[ib*3+1]-v[ia*3+1])/28.8;return [new THREE.Vector2(0,v[ia*3+2]/28.8),new THREE.Vector2(len,v[ib*3+2]/28.8),new THREE.Vector2(len,v[ic*3+2]/28.8),new THREE.Vector2(0,v[id*3+2]/28.8)];}
  };
  function volume(record,polygons,height,base=0){
    if(height<=base)return;
    for(const polygon of polygons){
      const g=new THREE.ExtrudeGeometry(shapeFromPolygon(polygon),{depth:height-base,bevelEnabled:false,steps:1,curveSegments:1,UVGenerator:uv});
      g.rotateX(-Math.PI/2);g.translate(0,.30+base,0);
      // Split roof and facade once at build time, then merge across all city buildings.
      for(const group of g.groups){
        const sub=new THREE.BufferGeometry();for(const name of ['position','normal','uv']){const attr=g.getAttribute(name);sub.setAttribute(name,new THREE.BufferAttribute(attr.array.slice(group.start*attr.itemSize,(group.start+group.count)*attr.itemSize),attr.itemSize));}
        if(group.materialIndex===0)push('roof',sub,roofMaterial);else push(`buildings-${record.style}`,sub,facadeMaterials[record.style]);
      }g.dispose();
      // Thin roof parapets trace each real footprint; courtyards remain open.
      if(height>12)for(const ring of [polygon.outer,...(polygon.holes||[])])for(let i=1;i<ring.length;i++){
        const [x,z]=ring[i-1],[xx,zz]=ring[i],len=Math.hypot(xx-x,zz-z);if(len<1)continue;
        b('#c6cbc2',(x+xx)/2,height+.65,(z+zz)/2,.25,.7,len,Math.atan2(xx-x,zz-z));
      }
      if(height>20){const xs=polygon.outer.map(p=>p[0]),zs=polygon.outer.map(p=>p[1]);for(let i=0;i<5;i++){
        const x=Math.min(...xs)+rand()*(Math.max(...xs)-Math.min(...xs)),z=Math.min(...zs)+rand()*(Math.max(...zs)-Math.min(...zs));
        if(contains(polygon,x,z)&&contains(polygon,x+4,z+4)&&contains(polygon,x-4,z-4))b('#929f9b',x,height+1.6,z,4+rand()*3,2.6,4+rand()*4);
      }}
    }
  }
  for(const building of map.buildings){
    volume(building,building.shape,building.podium||building.height,building.base);
    if(building.upper)volume(building,building.upper,building.height,building.podium);
  }
  // Road furniture is oriented by each actual segment, including diagonal streets.
  const routes=[];
  for(const road of map.roads){
    const points=road.points.map(([x,z])=>new THREE.Vector3(x,.3+road.elevation,z));
    const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+points[i].distanceTo(points[i-1]));
    const total=lengths.at(-1);
    if(road.elevation){
      for(let i=1;i<points.length;i++){const p=points[i-1],q=points[i],len=p.distanceTo(q),r=Math.atan2(q.x-p.x,q.z-p.z);b('#7c8686',(p.x+q.x)/2,road.elevation,(p.z+q.z)/2,road.width,.9,len,r);}
      for(let d=20;d<total;d+=35){const {position:p}=samplePolyline(points,lengths,d);b('#a7ada4',p.x,road.elevation/2,p.z,2.5,road.elevation,3);}
    }
    if(total>95&&road.kind!=='service')routes.push({points,lengths,total,road});
    if(road.width>7&&total>15)for(let d=6;d<total-3;d+=10){
      const {position:p,tangent:t}=samplePolyline(points,lengths,d);const r=Math.atan2(t.x,t.z);
      if(!road.oneway)b('#d3d5c7',p.x,p.y+.08,p.z,.16,.04,4,r);
      if(road.width>15)for(const side of [-1,1])b('#b7c2bb',p.x+side*t.z*3.2,p.y+.07,p.z-side*t.x*3.2,.13,.04,3.5,r);
    }
  }
  for(const line of map.crossings){
    const points=line.map(([x,z])=>new THREE.Vector3(x,.29,z)),lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+points[i].distanceTo(points[i-1]));
    for(let d=.4;d<lengths.at(-1);d+=1.25){const {position:p,tangent:t}=samplePolyline(points,lengths,d);b('#e1e0d3',p.x,p.y,p.z,3,.045,.62,Math.atan2(t.x,t.z));}
  }
  for(const [x,z,s] of map.trees){
    a.cylinder('#756d57',x,2*s,z,.6*s,4*s,.6*s);a.crown(['#536f51','#648152','#758957','#426653'][Math.floor(rand()*4)],x,5.9*s,z,5.8*s,7.5*s,5.8*s);
  }
  for(const {geometries,material} of batches.values()){
    if(!geometries.length)continue;const merged=mergeGeometries(geometries);const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);geometries.forEach(g=>g.dispose());
  }
  const labelNames=['丸ビル','新丸の内ビルディング','JPタワー','東京国際フォーラム','東京ミッドタウン八重洲','グラントウキョウノースタワー'];
  const labels=map.buildings.filter(b=>labelNames.some(n=>b.name===n||b.name.includes(n))).map(b=>({name:b.name==='新丸の内ビルディング'?'新丸ビル':b.name==='JPタワー'?'JPタワー / KITTE':b.name,position:new THREE.Vector3(b.center[0],(b.name==='JPタワー'?200:b.height)+8,b.center[1])}));
  return {textures,labels,routes,setNight:amount=>nightMaterials.forEach(m=>m.emissiveIntensity=amount*.6)};
}

export function samplePolyline(points,lengths,distance){
  const d=THREE.MathUtils.clamp(distance,0,lengths.at(-1));let i=1;while(i<lengths.length-1&&lengths[i]<d)i++;
  const p=points[i-1],q=points[i],span=lengths[i]-lengths[i-1]||1;
  return {position:new THREE.Vector3().lerpVectors(p,q,(d-lengths[i-1])/span),tangent:new THREE.Vector3().subVectors(q,p).normalize()};
}
