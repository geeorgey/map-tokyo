import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {X} from 'lucide-react';
import {makeCar,bulletTypes} from './engine/train-model.js';

export default function TrainInspector({onClose}){
  const dialog=useRef(null),host=useRef(null),api=useRef(null),[type,setType]=useState('n700'),[angle,setAngle]=useState('nose'),[error,setError]=useState('');
  useEffect(()=>{const previous=document.activeElement;dialog.current.showModal();return()=>{previous?.isConnected&&previous.focus();};},[]);
  useEffect(()=>{
    const element=host.current;let renderer,controls,observer,raf,environment,room,pmrem;const scene=new THREE.Scene();
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;element.appendChild(renderer.domElement);
      scene.background=new THREE.Color('#DCE1E6');
      pmrem=new THREE.PMREMGenerator(renderer);room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.8;
      const camera=new THREE.PerspectiveCamera(35,1,.1,150);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=5;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.49;
      const car=makeCar(type,true).group;scene.add(car);
      const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:'#CAD0D6',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;scene.add(ground);
      const sun=new THREE.DirectionalLight('#FFFFFF',2.2);sun.position.set(-12,20,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:.5,far:70});sun.shadow.bias=-.00015;scene.add(sun);
      function setAngle(value){if(value==='side'){controls.target.set(0,1.8,0);camera.position.set(38,6,0);}else if(value==='front'){controls.target.set(0,1.7,8);camera.position.set(0,4,32);}else{controls.target.set(0,1.5,6.6);camera.position.set(11.8,6.4,21);}controls.update();}
      api.current={setAngle};setAngle(angle);
      observer=new ResizeObserver(()=>{const {width,height}=element.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();});observer.observe(element);
      function render(){controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(render);}render();
    }catch(e){console.error(e);setError('車両詳細を表示できませんでした。閉じて再度お試しください。');}
    return()=>{cancelAnimationFrame(raf);observer?.disconnect();controls?.dispose();api.current=null;const geos=new Set(),mats=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)mats.add(m);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());environment?.dispose();room?.dispose();pmrem?.dispose();renderer?.dispose();renderer?.domElement.remove();};
  },[type]);
  const spec=bulletTypes[type];
  function chooseAngle(value){setAngle(value);api.current?.setAngle(value);}
  return <dialog ref={dialog} className="train-dialog" onCancel={onClose} onClose={onClose} aria-labelledby="train-title">
    <header><div><p className="train-eyebrow">ROLLING STOCK / 車両詳細</p><h2 id="train-title">{spec.name} <span>先頭車</span></h2></div><button className="icon" autoFocus onClick={onClose} aria-label="車両詳細を閉じる"><X size={24}/></button></header>
    <div className="train-tools"><div role="group" aria-label="車両形式">{Object.entries(bulletTypes).map(([key,s])=><button key={key} aria-pressed={type===key} onClick={()=>setType(key)}>{s.name}</button>)}</div><div role="group" aria-label="車両の角度">{[['nose','先頭部'],['side','側面'],['front','正面']].map(([key,label])=><button key={key} aria-pressed={angle===key} onClick={()=>chooseAngle(key)}>{label}</button>)}</div></div>
    <div className="train-studio" ref={host} aria-label={`${spec.name}の3Dモデル。ドラッグで回転、スクロールで拡大。`}/>
    {error&&<p role="alert">{error}</p>}
    <div className="train-detail-caption"><span>ドラッグで回転 · スクロールで拡大</span><span>全長 {spec.endLength.toFixed(2)} m · 幅 {spec.width.toFixed(2)} m</span></div>
    <footer><p>{spec.description}</p><div className="train-palette">{[[type==='e7'?'アイボリーホワイト':'車体ホワイト',spec.body],[type==='e7'?'空色':'青帯',spec.blue],...(spec.copper?[['銅色',spec.copper]]:[])].map(([label,color])=><div key={label}><i style={{background:color}}/><span>{label}<code>{color}</code></span></div>)}</div><p className="train-color-note">表示用の近似色（sRGB）。公開資料から公式の塗料RGB / HEX指定は確認できていません。色票は設定値、3D車体は照明・反射を含む表示です。細部の曲面は資料を参考に再構成しています。 <a href={spec.source} target="_blank" rel="noreferrer">メーカー・鉄道会社の参考資料 ↗</a></p></footer>
  </dialog>;
}
