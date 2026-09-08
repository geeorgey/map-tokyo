import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import data from '../data/tokyo-platforms.json';
import { shapeFromPolygon } from './urban.js';
export { data as platformData };

export function buildPlatforms(a) {
  const roofs=new THREE.Group();roofs.name='platform-roofs';a.scene.add(roofs);
  const roofMaterial=new THREE.MeshStandardMaterial({color:'#a2b5b0',roughness:.82});
  function solid(polygons,base,depth){
    const parts=polygons.map(p=>{
      const g=new THREE.ExtrudeGeometry(shapeFromPolygon(p),{depth,bevelEnabled:false,steps:1,curveSegments:1});
      g.rotateX(-Math.PI/2);g.translate(0,base,0);return g;
    });
    const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;
  }
  for(const p of data.platforms){
    const level=p.elevation,key=`platform-${p.id}`;
    a.registerGeometry(key,solid(p.shape,4.1+level,1.45));a.add(key,'#c3c5ba',0,0,0,1,1,1);
    const tactile=`tactile-${p.id}`;
    a.registerGeometry(tactile,solid(p.tactile,5.56+level,.025));a.add(tactile,'#d7be69',0,0,0,1,1,1);
    const canopy=new THREE.Mesh(solid(p.roof,9.35+level,.28),roofMaterial);
    canopy.castShadow=true;canopy.receiveShadow=true;roofs.add(canopy);
    // Columns and beams follow the curved centre of each individual platform.
    for(let i=2;i<p.centerline.length-2;i+=3){
      const [x,z]=p.centerline[i],prev=p.centerline[i-1],next=p.centerline[i+1];
      const angle=Math.atan2(next[0]-prev[0],next[1]-prev[1]);
      a.box('#859890',x,7.4+level,z,.28,3.8,.28,angle);
      a.box('#859890',x,9.1+level,z,3.1,.22,.26,angle);
      if(i%6===2)a.box('#dce5d9',x,8.87+level,z,.22,.12,2.3,angle,true);
    }
    // Raised Chuo platform is supported independently of the lower tracks.
    if(level)for(let i=3;i<p.centerline.length-3;i+=4){
      const [x,z]=p.centerline[i];a.box('#8f9c97',x,level/2+1.5,z,1.2,level+3,1.2);
    }
  }
  return {roofs,platforms:data.platforms};
}
