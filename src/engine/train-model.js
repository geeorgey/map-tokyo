import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONTACT_HEIGHT } from './catenary.js';

// sRGB display approximations, not unpublished railway paint specifications.
// Geometry dimensions: JR Central / Nippon Sharyo; E7 design: JR East / JR West joint release.
export const bulletTypes = {
  n700:{name:'N700系',count:16,endLength:27.35,width:3.36,body:'#F4F5F2',blue:'#154A85',copper:null,
    source:'https://www.n-sharyo.co.jp/business/tetsudo/pages/jrcn700.htm',description:'エアロ・ダブルウィングを参考にした、幅広く扁平な先頭形状。'},
  e7:{name:'E7系',count:12,endLength:26,width:3.38,body:'#EEECE5',blue:'#285F98',copper:'#B88770',
    source:'https://www.westjr.co.jp/press/article/items/120904_00_hokuriku.pdf',description:'ワンモーションラインを参考にした先頭形状。空色・アイボリーホワイト・銅色の塗り分け。'},
};
const clamp=THREE.MathUtils.clamp;
function interpolate(keys,z,column){
  let i=0;while(i<keys.length-2&&z>keys[i+1][0])i++;
  const a=keys[i],b=keys[i+1],t=clamp((z-a[0])/(b[0]-a[0]),0,1);
  const before=keys[Math.max(0,i-1)],after=keys[Math.min(keys.length-1,i+2)];
  const m0=(b[column]-before[column])/(b[0]-before[0]),m1=(after[column]-a[column])/(after[0]-a[0]);
  return (2*t**3-3*t*t+1)*a[column]+(t**3-2*t*t+t)*(b[0]-a[0])*m0+(-2*t**3+3*t*t)*b[column]+(t**3-t*t)*(b[0]-a[0])*m1;
}
export function makeCar(type,cab=false,pantograph=false){
  const spec=bulletTypes[type],group=new THREE.Group(),length=cab?spec.endLength:25,half=(length-.35)/2;
  // z / fraction of full width / roof height / underside height. Separate nose lofts.
  const keys=!cab?[[-half,1,3.6,.42],[half,1,3.6,.42]]:type==='n700'?
    [[-half,1,3.6,.42],[1,1,3.6,.42],[3,.98,3.48,.43],[5,.97,3.03,.42],[7,.93,2.43,.42],[9,.90,2.04,.42],[11,.83,1.82,.44],[12.35,.67,1.70,.53],[13.05,.43,1.52,.73],[half,.012,1.20,1.16]]:
    [[-half,1,3.6,.42],[2.5,1,3.6,.42],[4,.98,3.49,.43],[6,.96,2.96,.42],[8,.89,2.34,.43],[10,.77,1.82,.45],[11.65,.57,1.52,.56],[12.45,.32,1.33,.76],[half,.012,1.10,1.06]];
  function point(z,theta,offset=0){
    const w=clamp(interpolate(keys,z,1),0,1)*(spec.width/2-.009),top=Math.min(3.6,interpolate(keys,z,2)),bottom=interpolate(keys,z,3);
    const s=Math.sin(theta),c=Math.cos(theta),p=new THREE.Vector3(w*Math.sign(s)*Math.abs(s)**.55,(top+bottom)/2+(top-bottom)/2*Math.sign(c)*Math.abs(c)**.65,z);
    if(cab&&type==='n700'&&z>3&&z<11)p.y+=.16*Math.sin(Math.PI*(z-3)/8)**2*Math.sin(theta*2)**2*Math.max(0,Math.cos(theta));
    if(offset)p.add(new THREE.Vector3(Math.sin(theta),Math.cos(theta),0).multiplyScalar(offset));return p;
  }
  const batches=new Map();
  function add(color,g){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.deleteAttribute('uv');if(!batches.has(color))batches.set(color,[]);batches.get(color).push(g);}
  function box(c,x,y,z,w,h,d){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(c,g);}
  function meshPatch(color,fn,nu=12,nv=8){const pos=[],idx=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const p=fn(i/nu,j/nv);pos.push(p.x,p.y,p.z);}for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j;idx.push(a,a+nv+1,a+1,a+1,a+nv+1,a+nv+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();if(color?.isMaterial){const mesh=new THREE.Mesh(g,color);mesh.castShadow=true;group.add(mesh);}else add(color,g);}
  const angles=Array.from({length:65},(_,i)=>i*Math.PI*2/64);
  if(type==='e7')angles.push(1.0,1.10,Math.PI*2-1,Math.PI*2-1.10);
  angles.sort((a,b)=>a-b);
  const n=angles.length,rows=cab?100:16,pos=[],indices=[[],[],[]];
  for(let i=0;i<=rows;i++){const z=-half+2*half*i/rows;for(const theta of angles){const p=point(z,theta);pos.push(p.x,p.y,p.z);}}
  for(let i=0;i<rows;i++)for(let j=0;j<n-1;j++){
    const a=i*n+j,theta=(angles[j]+angles[j+1])/2,topAngle=Math.min(theta,Math.PI*2-theta);
    const material=type==='e7'?(topAngle<1?1:topAngle<1.1?2:0):0;
    indices[material].push(a,a+n,a+1,a+1,a+n,a+n+1);
  }
  // Rear bulkhead and closed tip; no additional length outside the coupling envelope.
  for(let j=1;j<n-2;j++){indices[0].push(0,j,j+1);const a=rows*n;indices[0].push(a,a+j+1,a+j);}
  const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));shell.setIndex(indices.flat());let start=0;indices.forEach((list,i)=>{if(list.length)shell.addGroup(start,list.length,i);start+=list.length;});shell.computeVertexNormals();
  const paint=c=>new THREE.MeshPhysicalMaterial({color:c,roughness:.32,metalness:0,clearcoat:.32,clearcoatRoughness:.25});
  const body=new THREE.Mesh(shell,[paint(spec.body),paint(spec.blue),paint(spec.copper||spec.body)]);body.castShadow=true;body.receiveShadow=true;group.add(body);
  function sidePoint(side,y,z,offset=.014){const top=interpolate(keys,z,2),bottom=interpolate(keys,z,3),v=clamp((y-(top+bottom)/2)/((top-bottom)/2),-.995,.995);const theta=Math.acos(Math.sign(v)*Math.abs(v)**(1/.65));return point(z,side*theta,.003+offset*.1);}
  function sidePanel(color,side,z,y,w,h,r=.09,offset=.022){
    // Tessellate onto the curved side wall. A single planar fan intersects the shell.
    meshPatch(color,(u,v)=>{
      const dy=(u-.5)*h,corner=Math.max(0,Math.abs(dy)-(h/2-r));
      const halfWidth=w/2-r+Math.sqrt(Math.max(0,r*r-corner*corner));
      return sidePoint(side,y+dy,z+(v-.5)*2*halfWidth,offset);
    },Math.max(3,Math.ceil(h/.065)),Math.max(3,Math.ceil(w/.12)));
  }

  for(const side of [-1,1]){
    // N700's blue wedges end at the cab door; E7's copper sweep continues around its nose.
    const end=cab?(type==='n700'?2.3:half-.12):half;
    for(const [color,y,h] of type==='n700'?[[spec.blue,1.83,.29],[spec.blue,1.64,.07]]:[[spec.copper,1.89,.17],[spec.blue,1.70,.07]]){
      meshPatch(color,(u,v)=>{const bandEnd=cab&&type==='e7'&&color===spec.blue?7.2:end;const z=THREE.MathUtils.lerp(-half,bandEnd,u),nose=cab&&type==='e7'?clamp((z-1.8)/(half-1.8),0,1):0;
        const center=THREE.MathUtils.lerp(y+h/2,1.02,nose*nose*(3-2*nose));const taper=cab&&type==='n700'?clamp((end-z)/2,0,1):cab&&type==='e7'&&color===spec.blue?clamp((bandEnd-z)/2,0,1):1;
        return sidePoint(side,center+(v-.5)*h*taper,z,.026);},80,1);
    }
    const windowEnd=cab?(type==='e7'?-.7:-1.9):half-2.6;
    for(let z=-half+3.3;z<windowEnd;z+=type==='n700'?1.04:1.04){
      sidePanel('#889494',side,z,2.54,.57,.76,.12,.018);sidePanel('#213845',side,z,2.54,.49,.67,.10,.031);
      sidePanel('#607A88',side,z,2.77,.38,.08,.025,.035);
    }
    const doorZ=cab?[-half+1.45,windowEnd+1.1]:[-half+1.45,half-1.45];
    for(const z of doorZ){
      sidePanel('#7C8587',side,z,1.95,.85,2.12,.11,.018);sidePanel(spec.body,side,z,1.95,.81,2.08,.10,.028);
      for(const [color,bandY,bandH] of type==='n700'?[[spec.blue,1.83,.29],[spec.blue,1.64,.07]]:[[spec.copper,1.89,.17],[spec.blue,1.70,.07]])sidePanel(color,side,z,bandY+bandH/2,.81,bandH,.008,.046);
      sidePanel('#233B49',side,z,2.55,.36,.73,.09,.042);sidePanel('#73818A',side,z-.26,1.78,.07,.23,.025,.043);
      sidePanel('#56616A',side,z, .83,.8,.045,.012,.04);
    }
    if(cab){const z=type==='n700'?1.2:2.0;
      sidePanel('#919A9E',side,z,2.05,.60,1.92,.06,.018);sidePanel(spec.body,side,z,2.05,.56,1.88,.055,.030);
      for(const [color,bandY,bandH] of type==='n700'?[[spec.blue,1.83,.29],[spec.blue,1.64,.07]]:[[spec.copper,1.89,.17],[spec.blue,1.70,.07]])sidePanel(color,side,z,bandY+bandH/2,.56,bandH*(type==='n700'?.55:1),.008,.05);
      sidePanel('#243A47',side,z,2.56,.24,.68,.055,.048);sidePanel('#73818A',side,z-.20,1.92,.04,.21,.015,.047);
    }
    sidePanel('#152B37',side,-half+2.75,3.12,.72,.19,.035,.03);
    // Sill, skirt access joints and subtle underfloor ventilation.
    const skirtEnd=cab?2:half-.4;
    for(let z=-half+.5;z<skirtEnd;z+=2.3){sidePanel('#929B9D',side,z,.68,.022,.40,.009,.023);}
    for(const z of [-6,-3,0])if(z<skirtEnd)for(let y=.65;y<1;y+=.09)sidePanel('#727D81',side,z,y,1.2,.025,.009,.022);
  }
  box('#333C43',0,.46,cab?-3:0,2.35,.45,cab?length-10:length-1);
  for(const z of [-8.5,8.5]){
    // Both bogies are present, including the one underneath the nose.
    box('#414A50',0,.48,z,2.05,.30,3.25);
    for(const dz of [-1.25,1.25])for(const side of [-1,1]){const g=new THREE.CylinderGeometry(.43,.43,.18,20);g.rotateZ(Math.PI/2);g.translate(side*.83,.43,z+dz);add('#30383F',g);const hub=new THREE.CylinderGeometry(.19,.19,.19,16);hub.rotateZ(Math.PI/2);hub.translate(side*.85,.43,z+dz);add('#80888A',hub);}
  }
  const rearEnds=cab?[-half]:[-half,half];
  for(const z of rearEnds){box('#4D565B',0,1.94,z,2.30,2.7,.12);box('#798389',0,1.94,z+Math.sign(z)*.08,1.12,2.0,.06);for(let i=0;i<4;i++)box('#333D43',0,2,z+Math.sign(z)*(.05+i*.035),1.5,2.2,.012);}
  if(cab){
    const z0=type==='n700'?2.5:2.7,z1=type==='n700'?5.4:6.25;
    function glass(color,inset,offset){meshPatch(color,(u,v)=>{const z=THREE.MathUtils.lerp(z0+inset,z1-inset,u),edge=Math.pow(Math.sin(Math.PI*(.06+.88*u)),.34)*(type==='n700'?.92:1.03);return point(z,(v-.5)*2*(edge-inset*.4),offset);},32,20);}
    glass('#18252D',0,.035);glass('#294A60',.16,.050);
    // Center mullion and paired wiper arms lie on the windshield rather than floating over it.
    meshPatch('#18252D',(u,v)=>point(THREE.MathUtils.lerp(z0+.12,z1-.12,u),(v-.5)*.028,.067),24,1);
    for(const side of [-1,1])meshPatch('#111F26',(u,v)=>point(z1-.45-u*.95,side*(.22+u*.17)+(v-.5)*.019,.071),12,1);
    const lampMaterial=new THREE.MeshStandardMaterial({color:'#FFF3D5',emissive:'#FFF3D5',emissiveIntensity:.7,roughness:.18});
    group.userData.lampMaterial=lampMaterial;
    for(const side of [-1,1]){
      const z=type==='n700'?10.6:9.4,theta=side*(type==='n700'?1.02:1.15),long=type==='n700'?.48:.92;
      function lens(color,center,extent,width,offset){meshPatch(color,(u,v)=>point(center+(u-.5)*2*extent,theta+(v-.5)*2*width*Math.sqrt(Math.max(0,1-(u*2-1)**2)),offset),20,6);}
      lens('#4A5966',z,long,.15,.035);
      for(const dz of type==='n700'?[-.18,.18]:[-.48,0,.48])lens(lampMaterial,z+dz,.135,.09,.049);
    }
    // Nose service hatch follows the surface; N700's dark chin is a separate painted surface.
    if(type==='n700')for(const side of [-1,1])meshPatch('#65717C',(u,v)=>point(THREE.MathUtils.lerp(7.8,half-.02,u),side*THREE.MathUtils.lerp(1.60,3.10,v),.018),32,10);
    for(const side of [-1,1])meshPatch('#A2A9AC',(u,v)=>point(THREE.MathUtils.lerp(half-2.1,half-.15,u),side*.60+(v-.5)*.009,.03),20,1);
  }
  if(pantograph){
    box('#A8B1B5',0,3.68,-2,2.15,.16,3.7);
    for(const side of [-1,1])box(spec.body,side*1.02,3.89,-2,.16,.5,3.9);
    function rod(a,b,r=.035){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start),g=new THREE.CylinderGeometry(r,r,dir.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));g.translate(...start.add(end).multiplyScalar(.5));add('#48545E',g);}
    rod([0,3.79,-3],[0,4.15,-1.9]);rod([0,4.15,-1.9],[0,CONTACT_HEIGHT-.04,-2.8]);box('#313C43',0,CONTACT_HEIGHT-.04,-2.8,1.7,.08,.17);
  }
  for(const [color,geos] of batches){const g=mergeGeometries(geos);const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:color==='#213845'?.18:.4,metalness:0,side:THREE.DoubleSide}));mesh.castShadow=true;group.add(mesh);geos.forEach(g=>g.dispose());}
  group.userData.type=type;group.userData.dimensions={length,width:spec.width};
  return {group,length};
}
