import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function random(seed = 2026) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

// Shared, instanced geometry keeps tens of thousands of facade details inexpensive.
export class Architecture {
  constructor(scene) { this.scene = scene; this.batches = new Map(); this.materials = new Map(); this.customGeometries = new Map(); this.object = new THREE.Object3D(); }
  registerMaterial(name, material, glow = false) { this.materials.set(`${name}:${glow}`, material); }
  registerGeometry(name, geometry) { this.customGeometries.set(name, geometry); }
  material(color, glow = false) {
    const key = `${color}:${glow}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: .03, emissive: glow ? '#ffcd85' : '#000000', emissiveIntensity: 0 }));
    return this.materials.get(key);
  }
  add(kind, color, x, y, z, sx, sy, sz, rotation = 0, glow = false, pitch = 0) {
    const key = `${kind}:${color}:${glow}`;
    if (!this.batches.has(key)) this.batches.set(key, { kind, material: this.material(color, glow), transforms: [] });
    this.object.position.set(x, y, z); this.object.rotation.set(pitch, rotation, 0, 'YXZ'); this.object.scale.set(sx, sy, sz); this.object.updateMatrix();
    this.batches.get(key).transforms.push(this.object.matrix.clone());
  }
  box(c, x, y, z, w, h, d, r = 0, glow = false) { this.add('box', c, x,y,z,w,h,d,r,glow); }
  beam(c,p,q,w,h) {
    const dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z;
    this.add('box',c,(p.x+q.x)/2,(p.y+q.y)/2,(p.z+q.z)/2,w,h,Math.hypot(dx,dy,dz)+.015,Math.atan2(dx,dz),false,-Math.atan2(dy,Math.hypot(dx,dz)));
  }
  cylinder(c, x,y,z,w,h,d, r=0) { this.add('cylinder',c,x,y,z,w,h,d,r); }
  crown(c,x,y,z,w,h,d) { this.add('crown',c,x,y,z,w,h,d); }
  dome(c,x,y,z,w,h,d) { this.add('dome',c,x,y,z,w,h,d,Math.PI/8); }
  roof(c,x,y,z,w,h,d) { this.add('roof',c,x,y,z,w,h,d); }
  finish() {
    const roof = new THREE.CylinderGeometry(.28,.5,1,4); roof.rotateY(Math.PI/4); roof.scale(Math.SQRT2,1,Math.SQRT2);
    const geometries = { box: new THREE.BoxGeometry(1,1,1), cylinder: new THREE.CylinderGeometry(.5,.5,1,8), crown: new THREE.IcosahedronGeometry(.5,1), dome: new THREE.SphereGeometry(.5,8,6,0,Math.PI*2,0,Math.PI/2), roof };
    for (const batch of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(this.customGeometries.get(batch.kind) || geometries[batch.kind],batch.material,batch.transforms.length);
      batch.transforms.forEach((m,i)=>mesh.setMatrixAt(i,m)); mesh.castShadow=true; mesh.receiveShadow=true; mesh.computeBoundingSphere(); this.scene.add(mesh);
    }
    this.batches.clear();
  }
  setNight(amount) { for (const [key, mat] of this.materials) if (key.endsWith(':true')) mat.emissiveIntensity=amount; }
}

export function makeTrain(color, bullet=false, carCount=7) {
  const group = new THREE.Group();
  const parts = new Map();
  function box(c,x,y,z,w,h,d) {
    const geo = new THREE.BoxGeometry(w,h,d); geo.translate(x,y,z);
    if(!parts.has(c))parts.set(c,[]); parts.get(c).push(geo);
  }
  for(let n=0;n<carCount;n++) {
    const z=n*12.4;
    box('#dee5e4',0,2.1,z,3.8,3.3,11.8);
    box('#bcc7c7',0,3.9,z,3.6,.4,11.3);
    box('#313c40',0,.35,z,3.3,.7,10.4);
    for(const x of [-1.92,1.92]) {
      box(color,x,1.72,z,.06,.85,11.8);
      for(let k=-4;k<=4;k+=2)box('#24424c',x,2.85,z+k,.07,.85,1.45);
      for(const dz of [-3,3])box('#b6c4c4',x,2.2,z+dz,.08,2.3,.55);
    }
    if(!bullet) { box('#9ca9aa',0,4.3,z-2,2,.5,2); box('#9ca9aa',0,4.3,z+2,2,.5,2); }
  }
  for(const z of [-6,(carCount-1)*12.4+6]) {
    box('#24424c',0,2.8,z,3.2,1.05,.08);
    box('#fff2bc',-1.25,1.5,z, .45,.4,.13); box('#fff2bc',1.25,1.5,z,.45,.4,.13);
    if(bullet) {
      const nose=new THREE.SphereGeometry(1,12,8); nose.scale(1.88,1.6,4); nose.translate(0,1.9,z);
      parts.get('#dee5e4').push(nose);
    }
  }
  for(const [c,geos] of parts) {
    const mesh=new THREE.Mesh(mergeGeometries(geos),new THREE.MeshStandardMaterial({color:c,roughness:.6,emissive:c==='#fff2bc'?c:'#000',emissiveIntensity:.8}));
    mesh.castShadow=true;group.add(mesh);geos.forEach(g=>g.dispose());
  }
  return group;
}
