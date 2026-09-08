import React, { useEffect, useRef, useState } from 'react';
import { Camera, Pause, Play, X, Info } from 'lucide-react';
import { Viewer, views } from './engine/viewer.js';
import TrainInspector from './TrainInspector.jsx';

export default function App() {
  const host=useRef(null),viewer=useRef(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[period,setPeriod]=useState('day'),[view,setView]=useState(0),[paused,setPaused]=useState(false),[speed,setSpeed]=useState(1),[orbit,setOrbit]=useState(false),[labels,setLabels]=useState(false),[frame,setFrame]=useState({labels:[],heading:0,fps:0}),[toast,setToast]=useState(''),[info,setInfo]=useState(false);
  const toastTimer=useRef(null);
  const [inspector,setInspector]=useState(false),[following,setFollowing]=useState(false),[daylightCycle,setDaylightCycle]=useState(false);
  const [captureImage,setCaptureImage]=useState(null),[hideRoofs,setHideRoofs]=useState(false);
  useEffect(()=>{if(viewer.current)viewer.current.world.platformRoofs.visible=!hideRoofs;},[hideRoofs,ready]);
  useEffect(()=>{
    let cancelled=false;
    const id=requestAnimationFrame(()=>{
      if(cancelled)return;
      try{ viewer.current=new Viewer(host.current,f=>{if(f.error)setError(f.error);else setFrame(f);});setReady(true); }
      catch(e){console.error(e);setError('3D描画を開始できませんでした。WebGLが使えるブラウザで開いてください。');}
    });
    return()=>{cancelled=true;cancelAnimationFrame(id);viewer.current?.dispose();clearTimeout(toastTimer.current);};
  },[]);
  useEffect(()=>{if(viewer.current)viewer.current.paused=paused||inspector;},[paused,inspector,ready]);
  useEffect(()=>{if(viewer.current)viewer.current.speed=speed;},[speed,ready]);
  useEffect(()=>{if(viewer.current)viewer.current.controls.autoRotate=orbit;},[orbit,ready]);
  useEffect(()=>{if(viewer.current)viewer.current.labelsVisible=labels;},[labels,ready]);
  useEffect(()=>{
    const handler=e=>{
      if(e.target.closest('dialog'))return;
      if(e.key==='Escape'){setInfo(false);setCaptureImage(null);return;}
      if(e.target.matches('button,input,a'))return;
      if(e.code==='Space'){e.preventDefault();setPaused(p=>!p);}
      if(e.key==='0'){viewer.current?.setView(0);setView(0);setOrbit(false);setFollowing(false);}
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[]);
  useEffect(()=>{
    if(!info&&!captureImage)return;
    const previous=document.activeElement;
    const trap=e=>{
      if(e.key!=='Tab')return;
      const items=document.querySelectorAll('.about button,.about a');
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };
    window.addEventListener('keydown',trap);
    return()=>{window.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus();};
  },[info,captureImage]);
  function chooseView(i){setFollowing(false);if(i===4)setHideRoofs(true);setView(i);setOrbit(false);viewer.current?.setView(i);}
  function toggleFollow(){
    if(following){viewer.current?.setFollow(false);setFollowing(false);return;}
    if(viewer.current?.setFollow(true)){setFollowing(true);setView(-1);setOrbit(false);setHideRoofs(true);}
  }
  function choosePeriod(key){setDaylightCycle(false);setPeriod(key);viewer.current?.setPeriod(key);}
  function toggleDaylight(){const next=!daylightCycle;setPeriod(null);setDaylightCycle(next);viewer.current?.setDaylightCycle(next);}
  function notify(text){setToast(text);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3000);}
  async function capture(){try{setCaptureImage(await viewer.current?.capture());}catch{notify('書き出しできませんでした。もう一度お試しください。');}}
  return <main className={`app ${frame.period||period}`}>
    <div ref={host} className="viewport"/>
    <div className="top-shade"/>
    <header className="identity"><h1>東京鉄道景</h1><p>TOKYO RAILWAY DIORAMA</p><div>東京駅・丸の内</div></header>
    <div className="top-controls">
      <div className="daylight-controls"><div className="period glass" role="group" aria-label="時間帯">{[['day','昼'],['evening','夕'],['night','夜']].map(([key,label])=><button key={key} aria-pressed={!daylightCycle&&period===key} onClick={()=>choosePeriod(key)}>{label}</button>)}</div>
        <button className="daylight-cycle glass" disabled={!ready} aria-pressed={daylightCycle} onClick={toggleDaylight} title="約90秒で昼・夕・夜を巡ります。もう一度押すと、その光で止まります。">
          <span>{daylightCycle?'光の移ろいを止める':'光の移ろい'}</span><small>{daylightCycle?frame.daylightCaption:'昼・夕・夜を自動で'}</small>
          {daylightCycle&&<i aria-hidden="true" style={{transform:`scaleX(${frame.daylightProgress||0})`}}/>}
        </button></div>
      <button className="capture glass icon" onClick={capture} disabled={!ready} title="風景をPNGで保存" aria-label="風景をPNGで保存"><Camera size={23}/></button>
    </div>
    <a className="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    <div className="scene-labels" aria-hidden={!labels}>{frame.labels.filter(l=>l.visible).map(l=><span key={l.name} style={{left:l.x,top:l.y}}>{l.name}</span>)}</div>
    <nav className="viewpoints glass" aria-label="視点を選択"><div className="panel-title">VIEWPOINT</div>{views.map((v,i)=><button key={v.name} aria-pressed={view===i} onClick={()=>chooseView(i)}><span className="view-num">0{i+1}</span>{v.name}</button>)}<button className="follow-train" disabled={!ready} aria-pressed={following} onClick={toggleFollow}>{following?'N700系を追従中 — 解除':'新幹線を追う'}</button><button className="roof-toggle" aria-pressed={hideRoofs} onClick={()=>setHideRoofs(v=>!v)}>ホーム屋根を隠す</button><button className="inspect-train" onClick={()=>setInspector(true)}>新幹線の車両詳細 ↗</button></nav>
    <div className="playback glass" role="toolbar" aria-label="描画コントロール">
      <button className="icon play" onClick={()=>setPaused(p=>!p)} aria-label={paused?'列車の走行を再開':'列車の走行を一時停止'} title="列車の再生・停止（Space）">{paused?<Play size={21} fill="currentColor"/>:<Pause size={22} fill="currentColor"/>}</button>
      <button className="speed" onClick={()=>setSpeed(s=>s===1?2:s===2?4:.5===s?1:.5)} title="走行速度を変更" aria-label={`走行速度 ${speed}倍`}>{speed}<span>×</span></button>
      <i/>
      <button aria-pressed={orbit} onClick={()=>setOrbit(o=>!o)}>自動旋回</button>
      <i/>
      <button aria-pressed={labels} onClick={()=>setLabels(l=>!l)}>ラベル</button>
    </div>
    <aside className="orientation"><button className="compass" title="東京駅全景に戻す（0）" aria-label="東京駅全景に戻す" onClick={()=>chooseView(0)}><span className="north">N</span><svg viewBox="0 0 80 80" style={{transform:`rotate(${-frame.heading}deg)`}}><circle cx="40" cy="40" r="32"/><path d="M40 4v8M40 68v8M4 40h8M68 40h8M14 14l5 5M61 61l5 5M14 66l5-5M61 19l5-5"/><path className="needle" d="M40 17L46 45L40 41L34 45Z"/><path className="needle-back" d="M40 63L46 45L40 41L34 45Z"/></svg></button><p>ドラッグで回転 / スクロールで拡大</p><div className="footnote"><span>右ドラッグで移動</span><button onClick={()=>setInfo(true)} aria-label="このジオラマについて" title="操作方法とモデルについて"><Info size={15}/></button></div></aside>
    {!ready&&!error&&<div className="loading"><span className="loader"/><p>東京の街を組み立てています</p></div>}
    {error&&<div className="error" role="alert"><p>{error}</p><button onClick={()=>location.reload()}>再読み込み</button></div>}
    {toast&&<div className="toast glass" role="status">{toast}</div>}
    {captureImage&&<div className="modal-backdrop" onClick={()=>setCaptureImage(null)}><section className="about capture-preview glass" role="dialog" aria-modal="true" aria-labelledby="capture-title" onClick={e=>e.stopPropagation()}><button className="close icon" autoFocus onClick={()=>setCaptureImage(null)} aria-label="閉じる"><X size={22}/></button><h2 id="capture-title">この風景を持ち帰る</h2><img src={captureImage.url} alt="書き出した東京駅周辺の風景"/><a className="download-button" href={captureImage.url} download={captureImage.filename}>PNGをダウンロード</a><p className="capture-hint">画像を右クリックして保存することもできます。</p></section></div>}
    {inspector&&<TrainInspector onClose={()=>setInspector(false)}/>}
    {info&&<div className="modal-backdrop" onClick={()=>setInfo(false)}><section className="about glass" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={e=>e.stopPropagation()}><button className="close icon" autoFocus onClick={()=>setInfo(false)} aria-label="閉じる"><X size={22}/></button><h2 id="about-title">鉄道のある街を、眺める。</h2><p>東京駅とその周辺を、小さな立体の街にしました。経営や建設の操作はありません。好きな角度から、電車が行き交う風景を楽しんでください。</p><dl><dt>回転</dt><dd>左ドラッグ / 指1本でドラッグ</dd><dt>移動</dt><dd>右ドラッグ / 指2本でドラッグ</dd><dt>拡大・縮小</dt><dd>スクロール / ピンチ</dd><dt>光の移ろい</dt><dd>約90秒で昼・夕・夜を巡回。再度押すとその光で停止</dd><dt>列車の追従</dt><dd>「新幹線を追う」で開始・解除</dd><dt>列車の停止・再開</dt><dd>Spaceキー</dd><dt>全景に戻る</dt><dd>0キー / コンパス</dd></dl><p className="model-note">道路・建物の輪郭・水辺はOpenStreetMapの地図データを使用しています。未登録の建物高や道路幅、上部の形状は推定です。ホーム輪郭は地図に基づき、屋根・柱はその輪郭に合わせて生成しています。中央線の高低差は概算です。駅舎の細部・列車の運行は簡略化しており、最新の現況を完全に再現するものではありません。</p><a href="https://www.tokyostationcity.com/learning/station_building/" target="_blank" rel="noreferrer">駅舎の参考：Tokyo Station City ↗</a><br/><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">地図データ：OpenStreetMap / ODbL ↗</a><div className="render-info">WebGL · Three.js <span>{frame.fps} fps</span></div></section></div>}
  </main>;
}
