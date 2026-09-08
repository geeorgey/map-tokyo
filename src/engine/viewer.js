import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorld } from './world.js';
import { samplePolyline } from './urban.js';
import { updateShinkansen } from './shinkansen.js';
import { sampleServiceMotion } from './train-motion.js';
import { FollowCamera } from './follow-camera.js';
import { Daylight, periods } from './daylight.js';

export const views = [
  {name:'東京駅全景',position:[-545,785,475],target:[-10,15,0]},
  {name:'丸の内駅舎',position:[-173,74,52],target:[-61,13,45]},
  {name:'ホームと列車',position:[85,145,-310],target:[55,10,-60]},
  {name:'街を見渡す',position:[-870,1020,1040],target:[-20,15,0]},
  {name:'新幹線',position:[105,365,-335],target:[110,7,-10]},
];


export class Viewer {
  constructor(host, onFrame) {
    this.host=host;this.onFrame=onFrame;this.disposed=false;this.paused=false;this.speed=1;this.time=0;this.labelsVisible=false;this.frameCount=0;this.lastTime=performance.now();this.measureTime=this.lastTime;
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(periods.day.sky);
    this.scene.fog=new THREE.Fog(periods.day.fog,1000,2500);
    this.camera=new THREE.PerspectiveCamera(42,1,1,4000);
    this.camera.position.fromArray(views[0].position);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.domElement.setAttribute('aria-label','東京駅周辺の3Dジオラマ。ドラッグで回転、右ドラッグで移動、スクロールで拡大。');
    this.renderer.domElement.tabIndex=0;
    host.appendChild(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.target.fromArray(views[0].target);this.controls.enableDamping=true;this.controls.dampingFactor=.065;this.controls.minDistance=20;this.controls.maxDistance=1800;
    this.controls.maxPolarAngle=Math.PI*.46;this.controls.minPolarAngle=.1;this.controls.autoRotateSpeed=.32;this.controls.zoomSpeed=.8;this.controls.panSpeed=.7;
    this.followCamera=new FollowCamera(this.camera,this.controls);
    this.controls.addEventListener('start',()=>{this.transition=null;this.followCamera.interruptTransition();});
    this.ambient=new THREE.HemisphereLight('#d8e8ef','#817f66',2.1);this.scene.add(this.ambient);
    this.sun=new THREE.DirectionalLight('#fff1d6',3.1);this.sun.position.set(-350,600,330);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-780,right:780,top:850,bottom:-850,near:1,far:1900});
    this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.7;this.scene.add(this.sun);
    this.world=createWorld(this.scene);
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(20000,20000),new THREE.MeshStandardMaterial({color:'#a9bab8',roughness:1}));
    this.ground.rotation.x=-Math.PI/2;this.ground.position.y=-15;this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    this.projector=new THREE.Vector3();this.fps=0;this.daylight=new Daylight();this.period='day';this.applyDaylight();
    this.animate=this.animate.bind(this);this.animation=requestAnimationFrame(this.animate);
    this.lost=e=>{e.preventDefault();this.onFrame({error:'描画が中断されました。ページを再読み込みしてください。'});};
    this.renderer.domElement.addEventListener('webglcontextlost',this.lost);
  }
  resize() {const {clientWidth:w,clientHeight:h}=this.host;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.fov=THREE.MathUtils.clamp(42*.77/(w/h),42,64);this.camera.updateProjectionMatrix();}
  setFollow(enabled) {
    this.followTrain=null;this.followCamera.stop();
    if(!enabled)return false;
    const train=this.world.trains.find(t=>t.kind==='shinkansen'&&t.type==='n700');
    if(!train)return false;
    train.initialPhase=Math.max(0,train.travel-18)-this.time;
    updateShinkansen(train,this.time);
    this.followTrain=train;this.transition=null;this.controls.autoRotate=false;
    this.followCamera.start(train.cars[0].position,performance.now(),matchMedia('(prefers-reduced-motion: reduce)').matches);
    return true;
  }
  setView(index) {
    this.setFollow(false);
    if(views[index].name==='新幹線')for(const train of this.world.trains){
      if(train.kind==='shinkansen')train.initialPhase=train.travel+(train.type==='n700'?-5:2)-this.time;
    }
    const v=views[index];
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.camera.position.fromArray(v.position);this.controls.target.fromArray(v.target);this.transition=null;return;}
    this.transition={start:performance.now(),from:this.camera.position.clone(),to:new THREE.Vector3(...v.position),targetFrom:this.controls.target.clone(),targetTo:new THREE.Vector3(...v.target)};
  }
  setPeriod(period) {
    this.daylight.select(period,matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.applyDaylight();
  }
  setDaylightCycle(enabled){this.daylight.setRunning(enabled);}
  applyDaylight(){
    const p=this.daylight.value;this.period=this.daylight.period;
    this.scene.background.copy(p.sky);this.scene.fog.color.copy(p.fog);this.sun.color.copy(p.sun);
    this.sun.intensity=p.sunPower;this.sun.position.copy(p.position);this.ambient.intensity=p.ambient;
    this.renderer.toneMappingExposure=p.exposure;this.ground.material.color.copy(p.ground);
    this.world.architecture.setNight(p.glow);this.world.stationArchitecture.setNight(p.glow);this.world.urban.setNight(p.glow);
  }
  animate(now) {
    if(this.disposed)return;
    const dt=Math.min((now-this.lastTime)/1000,.1);this.lastTime=now;
    if(!this.paused)this.time+=dt*this.speed;
    if(this.daylight.update(dt))this.applyDaylight();
    for(const train of this.world.trains){
      if(train.kind==='shinkansen'){
        updateShinkansen(train,this.time);
        // Keep the tracked train visible during its short offstage turnaround wait.
        if(train===this.followTrain)for(const car of train.cars)car.visible=true;
        continue;
      }
      const {route,direction}=train;
      const motion=sampleServiceMotion(train.motion,this.time);
      train.cars.forEach((car,n)=>{
        car.visible=motion.visible;
        const d=motion.center+((train.cars.length-1)/2-n)*12.4*direction;
        // Orient the rigid carriage between its bogies, avoiding a snap at polyline vertices.
        const rear=samplePolyline(route.points,route.lengths,d-4).position;
        const front=samplePolyline(route.points,route.lengths,d+4).position;
        const tangent=front.clone().sub(rear).normalize();
        car.position.copy(rear).add(front).multiplyScalar(.5);car.rotation.set(-Math.atan2(tangent.y*direction,Math.hypot(tangent.x,tangent.z)),Math.atan2(tangent.x*direction,tangent.z*direction),0,'YXZ');
      });
    }
    for(const car of this.world.cars){
      const {route,direction}=car;const d=(this.time*8+car.offset)%route.total;
      const {position,tangent}=samplePolyline(route.points,route.lengths,direction===1?d:route.total-d);
      const lane=route.road.oneway?0:Math.min(2,route.road.width*.2)*direction;
      position.x-=tangent.z*lane;position.z+=tangent.x*lane;
      car.model.position.copy(position);car.model.rotation.y=Math.atan2(tangent.x*direction,tangent.z*direction);
    }
    if(this.followTrain)this.followCamera.update(this.followTrain.cars[0].position,now);
    if(this.transition) {
      const t=Math.min((now-this.transition.start)/1250,1),s=t*t*(3-2*t);
      this.camera.position.lerpVectors(this.transition.from,this.transition.to,s);this.controls.target.lerpVectors(this.transition.targetFrom,this.transition.targetTo,s);
      if(t===1)this.transition=null;
    }
    this.controls.update(dt);
    this.controls.target.clamp(new THREE.Vector3(-730,0,-840),new THREE.Vector3(710,240,850));
    // Allocate shadow resolution to station detail when the viewer moves close.
    const shadowRadius=this.camera.position.distanceTo(this.controls.target)<360?270:850;
    if(this.shadowRadius!==shadowRadius){
      this.shadowRadius=shadowRadius;
      Object.assign(this.sun.shadow.camera,{left:-shadowRadius,right:shadowRadius,top:shadowRadius,bottom:-shadowRadius});
      this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.normalBias=shadowRadius<400?.12:.7;
    }
    this.renderer.render(this.scene,this.camera);
    this.frameCount++;
    if(now-this.measureTime>600){this.fps=Math.round(this.frameCount*1000/(now-this.measureTime));this.measureTime=now;this.frameCount=0;}
    if(this.frameCount%3===0) {
      const labels=this.labelsVisible?this.world.labels.map(l=>{
        this.projector.copy(l.position).project(this.camera);
        return {name:l.name,x:(this.projector.x*.5+.5)*this.host.clientWidth,y:(-.5*this.projector.y+.5)*this.host.clientHeight,visible:Math.abs(this.projector.x)<.94&&Math.abs(this.projector.y)<.94&&this.projector.z<1};
      }):[];
      this.onFrame({labels,heading:this.controls.getAzimuthalAngle()*180/Math.PI,fps:this.fps,period:this.daylight.period,daylightCaption:this.daylight.caption,daylightProgress:this.daylight.phase/3});
    }
    this.animation=requestAnimationFrame(this.animate);
  }
  async capture() {
    this.renderer.render(this.scene,this.camera);
    const canvas=document.createElement('canvas');canvas.width=this.renderer.domElement.width;canvas.height=this.renderer.domElement.height;const ctx=canvas.getContext('2d');ctx.drawImage(this.renderer.domElement,0,0);const fontSize=Math.max(12,Math.round(canvas.width/100));ctx.font=`${fontSize}px sans-serif`;const text='© OpenStreetMap contributors · openstreetmap.org/copyright';const width=ctx.measureText(text).width;ctx.fillStyle='rgba(244,247,238,.85)';ctx.fillRect(canvas.width-width-24,canvas.height-fontSize-20,width+16,fontSize+12);ctx.fillStyle='#34443c';ctx.fillText(text,canvas.width-width-16,canvas.height-12);
    return {url:canvas.toDataURL('image/png'),filename:`tokyo-railway-${this.period}-${Date.now()}.png`};
  }
  dispose() {
    this.disposed=true;cancelAnimationFrame(this.animation);this.observer.disconnect();this.controls.dispose();
    const geometries=new Set(),materials=new Set();
    this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.world.station.textures.forEach(t=>t.dispose());this.world.urban.textures.forEach(t=>t.dispose());this.renderer.domElement.removeEventListener('webglcontextlost',this.lost);this.renderer.dispose();this.renderer.domElement.remove();
  }
}
