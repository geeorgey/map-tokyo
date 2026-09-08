import * as THREE from 'three';
import { random } from './geometry.js';

// The model is original geometry. Reference proportions: eaves ~17 m,
// roof ridge ~23 m, central block ~28 m, north/south domes ~35 m.
// It is a visual reconstruction, not a measured conservation model.
export function buildStation(a) {
  const rand=random(1914);
  const stone='#d0c9b5',lightStone='#dfd8c6',darkStone='#a9a898',copper='#555f5c',iron='#303c3d';
  const brick='station-brick',slate='station-slate',glass='station-glass';
  const materials=[],textures=[];
  function material(name,options,glow=false){const m=new THREE.MeshStandardMaterial(options);a.registerMaterial(name,m,glow);materials.push(m);return m;}
  function texture(draw,w=768,h=384){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d'),w,h);const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;textures.push(t);return t;}
  const brickMap=texture((ctx,w,h)=>{
    ctx.fillStyle='#b49a83';ctx.fillRect(0,0,w,h);
    for(let row=0;row<12;row++)for(let col=-1;col<12;col++){
      const x=col*64+(row%2)*32,y=row*32;
      const v=Math.floor(rand()*24);
      ctx.fillStyle=`rgb(${136+v},${61+Math.floor(v*.7)},${43+Math.floor(v*.6)})`;ctx.fillRect(x+1.8,y+1.8,60.4,28.4);
      ctx.fillStyle='rgba(244,195,143,.12)';ctx.fillRect(x+3,y+3,58,1);
      for(let j=0;j<18;j++){ctx.fillStyle=rand()>.5?'#ffffff0a':'#22170912';ctx.fillRect(x+3+rand()*55,y+3+rand()*25,1+rand()*3,1);}
    }
  });brickMap.colorSpace=THREE.SRGBColorSpace;
  const brickBump=texture((ctx,w,h)=>{
    ctx.fillStyle='#454545';ctx.fillRect(0,0,w,h);
    for(let row=0;row<12;row++)for(let col=-1;col<12;col++){ctx.fillStyle='#a0a0a0';ctx.fillRect(col*64+(row%2)*32+2,row*32+2,60,28);ctx.fillStyle='#bababa';ctx.fillRect(col*64+(row%2)*32+3,row*32+3,58,1);}
  });
  const slateMap=texture((ctx,w,h)=>{
    ctx.fillStyle='#242e30';ctx.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=32)for(let x=-32;x<w;x+=64){const v=48+Math.floor(rand()*15);ctx.fillStyle=`rgb(${v},${v+9},${v+10})`;ctx.fillRect(x+(y/32%2)*32+1,y+1,62,30);ctx.fillStyle='#b6c2be28';ctx.fillRect(x+(y/32%2)*32+2,y+29,60,1);}
  });slateMap.colorSpace=THREE.SRGBColorSpace;
  material(brick,{map:brickMap,bumpMap:brickBump,bumpScale:.075,roughness:.94});
  material(slate,{map:slateMap,bumpMap:slateMap,bumpScale:.04,roughness:.76});
  material(glass,{color:'#314b50',roughness:.26,metalness:.25,emissive:'#e6ad65',emissiveIntensity:0},true);
  const b=(...args)=>a.box(...args);
  const unit=new THREE.Vector3(0,1,0),tmp=new THREE.Object3D();
  function beam(color,p1,p2,width=.12){const mid=p1.clone().add(p2).multiplyScalar(.5);tmp.position.copy(mid);tmp.quaternion.setFromUnitVectors(unit,p2.clone().sub(p1).normalize());tmp.scale.set(width,p1.distanceTo(p2),width);tmp.updateMatrix();const key=`box:${color}:false`;if(!a.batches.has(key))a.batches.set(key,{kind:'box',material:a.material(color),transforms:[]});a.batches.get(key).transforms.push(tmp.matrix.clone());}
  // Box geometry with metre-scaled UVs; brick size stays constant on every wall.
  function wall(x,y,z,w,h,d,rotation=0){
    const key=`masonry-${w}-${h}-${d}`;
    if(!a.customGeometries.has(key)){
      const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,n=g.attributes.normal;
      for(let i=0;i<uv.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));const u=nx>.5?d:w,v=ny>.5?d:h;uv.setXY(i,uv.getX(i)*u/6,uv.getY(i)*v/3);}
      a.registerGeometry(key,g);
    }
    a.add(key,brick,x,y,z,1,1,1,rotation);
  }
  // Ring-based hip/mansard roof, with correct UVs and actual pitched surfaces.
  function roof(x,y,z,w,d,height,top=.35){
    const key=`mansard-${w}-${d}-${height}-${top}`;
    if(!a.customGeometries.has(key)){
      const rings=[[w,d,0],[w*.84,d-2.2,height*.67],[w*top,Math.max(d-5, d*.6),height]],pos=[],uv=[];
      const corners=([rw,rd,ry])=>[[-rw/2,ry,-rd/2],[rw/2,ry,-rd/2],[rw/2,ry,rd/2],[-rw/2,ry,rd/2]];
      const quad=(points)=>{const width=new THREE.Vector3(...points[0]).distanceTo(new THREE.Vector3(...points[1]))/4,height=new THREE.Vector3(...points[0]).distanceTo(new THREE.Vector3(...points[3]))/2;for(const i of [0,1,2,0,2,3]){pos.push(...points[i]);uv.push(...[[0,0],[width,0],[width,height],[0,height]][i]);}};
      for(let r=0;r<rings.length-1;r++){const lower=corners(rings[r]),upper=corners(rings[r+1]);for(let s=0;s<4;s++)quad([lower[(s+1)%4],lower[s],upper[s],upper[(s+1)%4]]);}
      const t=corners(rings[2]);quad([t[3],t[2],t[1],t[0]]);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();a.registerGeometry(key,g);
    }
    a.add(key,slate,x,y,z,1,1,1);
  }
  // A vertical facade uses local u along the building and n pointing outwards.
  function facade(x,z,angle=0){
    const normal=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),tangent=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));
    return {p:(u,v,n=0)=>new THREE.Vector3(x+tangent.x*u+normal.x*n,v,z+tangent.z*u+normal.z*n),box:(color,u,v,n,w,h,d,glow=false)=>{const p=new THREE.Vector3(x+tangent.x*u+normal.x*n,v,z+tangent.z*u+normal.z*n);b(color,p.x,p.y,p.z,w,h,d,Math.PI/2-angle,glow);},place:(kind,color,u,v,n,w,h,d,glow=false)=>{const p=new THREE.Vector3(x+tangent.x*u+normal.x*n,v,z+tangent.z*u+normal.z*n);a.add(kind,color,p.x,p.y,p.z,w,h,d,Math.PI/2-angle,glow);}};
  }
  // All arched heads are extruded, including their recess and wedge-shaped voussoirs.
  function archShape(inner=false){const s=new THREE.Shape(),r=.5,base=0;s.moveTo(-r,base);s.lineTo(-r,.5);s.absarc(0,.5,r,Math.PI,0,true);s.lineTo(r,base);s.closePath();if(inner){const hole=new THREE.Path();hole.moveTo(-.35,0);hole.lineTo(.35,0);hole.lineTo(.35,.5);hole.absarc(0,.5,.35,0,Math.PI,false);hole.lineTo(-.35,0);s.holes.push(hole);}return s;}
  const archGlass=new THREE.ExtrudeGeometry(archShape(),{depth:1,bevelEnabled:false,curveSegments:20});
  const archFrame=new THREE.ExtrudeGeometry(archShape(true),{depth:1,bevelEnabled:false,curveSegments:20});
  a.registerGeometry('arch-glass',archGlass);a.registerGeometry('arch-frame',archFrame);
  a.registerGeometry('circle',new THREE.CylinderGeometry(.5,.5,1,32).rotateX(Math.PI/2));
  const triangle=new THREE.Shape();triangle.moveTo(-.5,0);triangle.lineTo(.5,0);triangle.lineTo(0,.5);triangle.closePath();a.registerGeometry('pediment',new THREE.ExtrudeGeometry(triangle,{depth:1,bevelEnabled:false}));
  a.registerGeometry('cupola-roof',new THREE.LatheGeometry([[1.5,0],[1.46,.25],[1.14,1],[.72,2],[.12,3.2]].map(([r,y])=>new THREE.Vector2(r,y)),8));
  function window(f,u,y,width=1.8,height=3.05,arched=false){
    const outer=width+.42, bottom=y-height/2;
    f.box('#3b322b',u,y,.05,outer+.16,height+.28,.1);
    f.box(stone,u-width/2-.14,y,.23,.25,height+.2,.34);f.box(stone,u+width/2+.14,y,.23,.25,height+.2,.34);
    f.box(glass,u,y,.16,width,height,.07,true);
    if(arched){
      f.place('arch-glass',glass,u,bottom+height*.61,.16,width,height*.65,.1,true);
      f.place('arch-frame',lightStone,u,bottom+height*.59,.28,outer,height*.71,.24);
      f.box(lightStone,u,y+height*.52,.55,.42,.6,.38);
    }else{f.box(lightStone,u,y+height/2+.12,.38,outer+.1,.24,.5);f.box(stone,u,y+height/2+.4,.28,outer+.45,.14,.55);}
    f.box(lightStone,u,bottom-.14,.48,outer+.32,.23,.72);
    f.box(iron,u,y,.27,.075,height,.085);
    for(const offset of [-.6,.55])f.box('#76817c',u,y+offset,.28,width,.07,.07);
    // Recessed inner sash, distinct from heavy stone surrounds.
    for(const side of [-1,1])f.box('#727a70',u+side*(width/2-.08),y,.3,.09,height,.07);
    f.box('#6d7166',u,y-height/2+.09,.31,width,.1,.07);
  }
  function cornice(f,length,y){
    for(const [dy,depth,h] of [[-.3,.28,.28],[0,.55,.18],[.21,.8,.24],[.44,1,.12]])f.box(dy>0?lightStone:stone,0,y+dy,depth/2,length,h,depth);
    for(let u=-length/2+.5;u<length/2;u+=.8)f.box(stone,u,y-.46,.34,.33,.36,.45);
  }
  function pilaster(f,u,height=14.2){
    f.box(stone,u,height/2+2,.3,.72,height,.48);
    for(let y=2;y<height+2;y+=.85)f.box(lightStone,u,y,.49,.85,.25,.5);
    f.box(stone,u,2,.58,1.15,.8,.75);f.box(lightStone,u,height+1.75,.6,1.2,.5,.8);
  }
  function dormer(x,z,front=true){
    const f=facade(x,z,front?Math.PI:0);wall(x,20.4,z,2.8,2.2,2.5);
    f.place('circle',copper,0,20.9,1.55,2.3,2.3,.2);
    f.place('circle',glass,0,20.9,1.69,1.6,1.6,.09,true);
    f.box(stone,0,19.75,1.4,2.8,.3,1);
    f.box(copper,0,20.9,1.78,1.6,.1,.12);f.box(copper,0,20.9,1.78,.1,1.6,.12);
    roof(x,21.5,z,3.5,3.2,1.9,.1);
    b(copper,x,23.6,z,.15,.65,.15);
  }
  // Long three-storey wings.
  wall(-51,9.35,0,22,16.5,350);
  b(darkStone,-51,1.65,0,23.6,1.3,352);
  b(stone,-51,2.3,0,23.1,.3,351);
  roof(-51,17.75,0,25,353,5.15,.26);
  for(const face of [facade(-62,0,Math.PI),facade(-40,0,0)]){
    for(const y of [2.4,6.8,11.8,16.9]){face.box(stone,0,y,.22,350,.24,.3);face.box(lightStone,0,y+.19,.25,350,.1,.4);}
    cornice(face,352,17.2);
    for(let u=-171;u<=171;u+=3.8){
      if(Math.abs(u)<19||(Math.abs(u)>118&&Math.abs(u)<152))continue;
      for(const [y,h,arch]of [[4.4,2.65,true],[9.3,3.15,false],[14.2,2.9,false]])window(face,u,y,1.65,h,arch);
      if(Math.round((u+171)/3.8)%3===0)pilaster(face,u+1.9);
    }
    for(let u=-169;u<174;u+=15.2){face.box(copper,u,9.8,.7,.16,15.2,.18);face.box(copper,u+.3,2.5,.7,.7,.17,.17);}
  }
  for(let z=-164;z<170;z+=11.4)if(Math.abs(z)>23&&!(Math.abs(z)>113&&Math.abs(z)<156)){dormer(-60.5,z);dormer(-41.5,z,false);}
  for(let z=-164;z<170;z+=20){
    if(Math.abs(z)<23||(Math.abs(z)>116&&Math.abs(z)<154))continue;
    wall(-49,24,z,2.5,3,1.25);b(stone,-49,25.6,z,2.9,.32,1.65);b('#222a28',-49,25.8,z,2.2,.08,1);
  }
  b(copper,-51,23.02,0,1,.2,350);
  // Octagonal domes. The curved profile is bespoke rather than a half-sphere.
  const profile=[[16.7,0],[17,.55],[16.7,1.2],[16.1,2.2],[14.8,3.9],[12.8,5.6],[10,7.1],[6.6,8.25],[3,8.8],[1.8,9.1]];
  const domeGeo=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),64);domeGeo.rotateY(Math.PI/8);
  // Give the curved roof slate courses while retaining enough angular resolution for close-ups.
  for(let i=0;i<domeGeo.attributes.uv.count;i++){domeGeo.attributes.uv.setXY(i,domeGeo.attributes.uv.getX(i)*22,domeGeo.attributes.uv.getY(i)*3.6);}
  a.registerGeometry('station-dome',domeGeo);
  const octGeo=new THREE.CylinderGeometry(17,17,16.4,8);octGeo.rotateY(Math.PI/8);
  for(let i=0;i<octGeo.attributes.uv.count;i++)octGeo.attributes.uv.setXY(i,octGeo.attributes.uv.getX(i)*17.4,octGeo.attributes.uv.getY(i)*5.5);
  a.registerGeometry('octagonal-brick',octGeo);
  for(const z of [-135,135]){
    a.add('octagonal-brick',brick,-56.5,10.3,z,1,1,1);
    a.cylinder(darkStone,-56.5,1.65,z,36,1.3,36,Math.PI/8);
    for(const [y,h,r]of [[2.4,.35,34.3],[7,.3,34.2],[12,.3,34.2],[17.3,.6,35.2],[18.1,.35,35.8],[23,.65,35.6]])a.cylinder(stone,-56.5,y,z,r,h,r,Math.PI/8);
    a.cylinder(copper,-56.5,20.6,z,33.5,4.6,33.5,Math.PI/8);
    for(let k=0;k<8;k++){
      const angle=k*Math.PI/4,face=facade(-56.5+Math.cos(angle)*15.73,z+Math.sin(angle)*15.73,angle);
      for(const u of [-3.55,0,3.55]){
        window(face,u,4.5,1.7,2.9,true);window(face,u,9.7,1.9,3.55,true);window(face,u,14.75,1.75,2.95,false);
      }
      for(const u of [-5.8,5.8])pilaster(face,u,14.5);
      for(let u=-5.5;u<6;u+=1.1){face.box(lightStone,u,20.1,.14,.19,3,.3);face.box('#334345',u+.5,20.1,.04,.66,2.4,.1,true);}
      cornice(face,13.2,22.45);
    }
    a.add('station-dome',slate,-56.5,23.3,z,1,1,1);
    for(let k=0;k<8;k++){
      const angle=k*Math.PI/4+Math.PI/8;
      for(let p=0;p<profile.length-1;p++){const [r1,y1]=profile[p],[r2,y2]=profile[p+1];beam(copper,new THREE.Vector3(-56.5+Math.cos(angle)*(r1+.08),23.3+y1,z+Math.sin(angle)*(r1+.08)),new THREE.Vector3(-56.5+Math.cos(angle)*(r2+.08),23.3+y2,z+Math.sin(angle)*(r2+.08)),.18);}
      const face=facade(-56.5+Math.cos(angle)*14.5,z+Math.sin(angle)*14.5,angle);
      face.place('circle',copper,0,27.1,.25,2.5,3.05,.4);face.place('circle',glass,0,27.1,.52,1.6,2.05,.12,true);
      face.box(lightStone,0,25.8,.4,3,.27,.8);face.box(copper,0,27.1,.66,.1,2,.12);
    }
    a.cylinder(copper,-56.5,33.15,z,3.1,1.5,3.1);a.dome(copper,-56.5,33.9,z,3.7,2.1,3.7);a.cylinder('#919384',-56.5,35.35,z,.18,1.7,.18);
    // Projecting clock/arched gable over the north and south entrances.
    const front=facade(-74.7,z,Math.PI);
    wall(-73.1,13,z,3,21.5,9.7);
    front.place('arch-frame',stone,0,18.2,1.65,10.4,8.3,.6);
    front.place('arch-glass',brick,0,18.2,1.4,9.5,7.9,.2);
    front.place('circle',stone,0,22.3,2.2,3.1,3.1,.3);
    front.place('circle','#eee8d0',0,22.3,2.39,2.4,2.4,.08);
    clock(front,22.3,2.5,1.05);
    window(front,0,9.4,3.8,5.8,true);
    for(const u of [-3.75,3.75]){pilaster(front,u,15.6);window(front,u,14.1,1.65,3,false);}
    canopy(-77.5,z,13.2);
  }
  function clock(face,y,depth,r){
    for(let i=0;i<12;i++){const angle=i*Math.PI/6;const p1=face.p(Math.sin(angle)*r*.82,y+Math.cos(angle)*r*.82,depth),p2=face.p(Math.sin(angle)*r,y+Math.cos(angle)*r,depth);beam(iron,p1,p2,.07);}
    beam(iron,face.p(0,y,depth+.05),face.p(-r*.55,y+r*.35,depth+.05),.1);beam(iron,face.p(0,y,depth+.05),face.p(r*.15,y+r*.76,depth+.05),.07);
  }
  function canopy(x,z,length){
    b(copper,x,5.4,z,6.5,.18,length);b('#87918b',x,5.55,z,6.2,.14,length-.3);
    for(let u=-length/2;u<=length/2;u+=2.2){b(iron,x,5.75,z+u,6.5,.13,.09);b(iron,x-2.7,3.45,z+u,.16,4,.16);}
    for(const zz of [z-length/2,z+length/2])beam(iron,new THREE.Vector3(x-2.7,4.4,zz),new THREE.Vector3(x-1.4,5.35,zz),.11);
    b(stone,x,1.35,z,7,.55,length+1);
  }
  // Central Imperial entrance: raised end bays, rusticated piers and central arch.
  wall(-56,10.3,0,30,18.2,34);
  roof(-56,19.65,0,33,36,8.2,.32);
  const central=facade(-71,0,Math.PI);
  for(const y of [2.6,7.1,12.1,18.8])central.box(stone,0,y,.3,35,.4,.6);
  cornice(central,35,19.1);
  for(const u of [-14,-10,10,14]){window(central,u,4.6,2,3.3,true);window(central,u,10,2,3.6,true);window(central,u,15.8,2,3,false);}
  for(const u of [-16.5,-7,7,16.5])pilaster(central,u,16.5);
  central.box(darkStone,0,7.2,.08,9.5,10.6,.1);
  central.place('arch-glass',glass,0,2.1,.22,7.7,13.4,.1,true);
  central.place('arch-frame',lightStone,0,2.1,.35,9.6,14.5,.55);
  for(const u of [-2.6,-1.3,0,1.3,2.6])central.box(iron,u,6.2,.58,.14,8,.14);
  central.box(stone,0,2,.8,12,.5,2.5);
  central.place('pediment',stone,0,19.7,.75,15,9,.45);
  central.place('pediment',brick,0,20,.99,12.3,7.2,.18);
  central.place('circle',stone,0,22.2,1.23,3.1,3.1,.25);central.place('circle',glass,0,22.2,1.39,2.15,2.15,.1,true);
  central.box(stone,0,24.2,1.05,.65,1.3,.7);
  for(const z of [-11,11]){b('#adada0',-77,17.5,z,.13,14,.13);b('#ecebe2',-77,23,z+1.6,.04,2.4,3.2);const flag=facade(-77.05,z+1.6,Math.PI);flag.place('circle','#ad3435',0,23,.01,1.28,1.28,.035);}
  // Intermediate/end pavilions break up the long silhouette and carry small slate cupolas.
  for(const z of [-177,-99,-31,31,99,177]){
    const end=Math.abs(z)>170,w=end?25:26,d=end?15:10,x=end?-51:-52;
    wall(x,9.8,z,w,17.2,d);roof(x,18.5,z,w+2,d+2,5.3,.2);
    const f=facade(x-w/2,z,Math.PI);
    for(const u of [-d/2+1,d/2-1])pilaster(f,u,15.6);
    for(const u of end?[-4.4,0,4.4]:[-2,2])for(const y of [4.7,9.8,15])window(f,u,y,1.7,3,y<12);
    cornice(f,d+1,18.1);
    for(const u of [-d/2+1,d/2-1]){
      const p=f.p(u,21.8,0);a.cylinder(stone,p.x,23.1,p.z,2.4,3,2.4);
      for(let k=0;k<8;k++){
        const angle=k*Math.PI/4;
        const face=facade(p.x+Math.cos(angle)*1.13,p.z+Math.sin(angle)*1.13,angle);
        face.box(glass,0,23.1,.04,.6,1.7,.1,true);
      }
      a.add('cupola-roof',copper,p.x,24.6,p.z,1,1,1);a.cylinder(copper,p.x,28.35,p.z,.12,1.2,.12);
    }
  }
  // Fine station-specific details remain in shared instanced batches.
  for(let z=-175;z<=175;z+=8){b(iron,-63.1,1.7,z,1.6,.23,.8);b('#d5aa61',-63.5,2.3,z,.5,.45,.6,0,true);}
  return {textures,materialCount:materials.length};
}
