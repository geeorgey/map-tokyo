import React, { useState, useRef, useEffect, useMemo } from 'react';
import { readBookmarks, addBookmark, removeBookmark } from './scene-bookmarks.mjs';
import { parseSceneLink, makeSceneLink } from './scene-link.mjs';
import { TOUR_STOPS } from './engine/station-tour.js';
import { createSceneDraw } from './scene-draw.mjs';
import { nextDeparture } from './departure-watch.mjs';
import FreeControls from './FreeControls.jsx';
import WalkControls from './WalkControls.jsx';
import WalkMap from './WalkMap.jsx';
import { readWalkResume, saveWalkResume } from './walk-resume.mjs';
import { WALK_SPOTS } from './data/walk-spots.js';
import TrainDialog from './TrainInspector.jsx';
import updates from './data/updates.json';
import { trackFeature } from './analytics.mjs';
import { views as VIEWPOINTS } from './engine/viewer.js';
import { ScheduledDiorama } from './diorama.mjs';
import { SimulationClock, SPEEDS, japanTime, parseJapanDateTime, serviceContext } from './clock.mjs';
import { LINES, validateTimetable } from './timetable.mjs';
import { eventsForDay } from './schedule.mjs';
import { loadMonth } from './load-timetable.mjs';


const clock = new SimulationClock();

function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const focus = document.activeElement;
    ref.current.showModal();
    return () => { if (focus?.isConnected) focus.focus(); };
  }, []);
  return <dialog ref={ref} className={`app-dialog ${wide ? 'wide' : ''}`} onCancel={onClose} onClose={onClose} aria-label={title}>
    <header><h2>{title}</h2><button className="icon" onClick={onClose} aria-label="閉じる" autoFocus>×</button></header>
    {children}
  </dialog>;
}

function ClockPanel({ now, onChange, data, context }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const current = japanTime(now);
  function edit() {
    const current = japanTime(clock.now());
    setDate(current.date); setTime(current.time); setError(''); setEditing(value => !value);
  }
  function apply(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const value = parseJapanDateTime(values.get('date'), values.get('time'));
    if (value === null) { setError('有効な日付と時刻を入力してください。'); return; }
    clock.seek(value); setEditing(false); setError(''); onChange();
  }
  return <section className="clock-panel glass" aria-label="日本時間とシミュレーション時計">
    <div className="clock-meta"><span>東京 / JST</span><span className={`clock-mode ${clock.live ? 'is-live' : ''}`}>{clock.paused ? '一時停止' : clock.live ? '実時間' : 'シミュレーション'}</span></div>
    <button className="clock-date" onClick={edit} aria-expanded={editing} aria-controls="date-editor" title="日付と時刻を指定">{current.date.replaceAll('-', '.')} <span>（{current.day}）</span><span className="calendar-mark">▦</span></button>
    <time className="clock-time" dateTime={`${current.date}T${current.time}+09:00`} aria-label={`日本時間 ${current.time}`}>{current.time.slice(0, 5)}<span>:{current.time.slice(-2)}</span></time>
    <div className="clock-actions">
      <button className="clock-pause" onClick={() => { clock.setPaused(!clock.paused); onChange(); }} aria-label={clock.paused ? '時計を再開' : '時計を一時停止'} title="Spaceキーでも停止・再開">{clock.paused ? '▶' : 'Ⅱ'}</button>
      <label className="speed-picker">時計速度<select aria-label="時計の速度" value={clock.speed} onChange={event => { clock.setSpeed(Number(event.target.value)); onChange(); }}>{SPEEDS.map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></label>
      <button className="sync-clock" onClick={() => { clock.sync(); setEditing(false); onChange(); }} aria-pressed={clock.live}>現在時刻に戻る</button>
    </div>
    <button className="edit-time" onClick={edit} aria-expanded={editing} aria-controls="date-editor">日時を指定 <span>{editing ? '−' : '+'}</span></button>
    {editing && <form id="date-editor" className="date-editor" onSubmit={apply}>
      <label>日付<input name="date" aria-label="再現する日付" type="date" defaultValue={date} required /></label>
      <label>時刻（日本時間）<input name="time" aria-label="再現する時刻" type="time" step="1" defaultValue={time} required /></label>
      <button type="submit">この日時へ移動</button>
      {error && <p role="alert">{error}</p>}
      {data && <p>収録時刻表：{data.month.replace('-', '年')}月<br />午前3時より前は、前日のダイヤを使います。</p>}
    </form>}
    {data && <div className="day-type">{context.supported ? `${context.dayType === 'holiday' ? '土休日ダイヤ' : '平日ダイヤ'}${context.holiday ? ` · ${context.holiday}` : ''}` : 'この日付の時刻表は未収録'}{context.date !== current.date && <span> · {context.date.slice(5).replace('-', '/')}運行分</span>}</div>}
  </section>;
}

function TimetableDialog({ data, events, now, context, onClose, onSeek }) {
  const [line, setLine] = useState('yamanote');
  const [hour, setHour] = useState(String(japanTime(now).hour));
  const rows = events.filter(event => event.lineId === line && String(Number(event.time.split(':')[0])) === hour);
  return <Modal title="東京駅の時刻表" onClose={onClose} wide>
    <p className="timetable-heading">{context.date} · {context.dayType === 'holiday' ? '土休日' : '平日'} · JR東日本掲載時刻表</p>
    <div className="timetable-filters"><label>路線<select aria-label="時刻表の路線" value={line} onChange={event => setLine(event.target.value)}>{LINES.map(line => <option value={line.id} key={line.id}>{line.name}</option>)}</select></label><label>時間帯<select aria-label="時刻表の時間帯" value={hour} onChange={event => setHour(event.target.value)}>{Array.from({ length: 24 }, (_, index) => (index + 3) % 24).map(hour => <option value={hour} key={hour}>{hour}時台</option>)}</select></label></div>
    <div className="timetable-list"><table><thead><tr><th>発車</th><th>列車・行き先</th><th>再現</th></tr></thead><tbody>{rows.map(event => <tr key={event.id}><td><time>{event.time}</time></td><td><a href={event.source} target="_blank" rel="noreferrer">{event.type}　{event.destination} ↗</a>{event.conditional && <small>運転日確認済み</small>}</td><td><button onClick={() => { onSeek(event); onClose(); }} aria-label={`${event.time}発の30秒前へ`}>30秒前へ</button></td></tr>)}</tbody></table>{!rows.length && <p className="empty-state">{context.supported ? 'この時間帯に収録列車の発車はありません。' : 'この日付の時刻表は未収録です。'}</p>}</div>
    <p className="data-note">{data.month.replace('-', '年')}月号 · {japanTime(Date.parse(data.retrievedAt)).date}取得。運転日限定の列車は、選んだ日付の運行カレンダーで絞り込んでいます。</p>
    <p className="data-note">発車時刻に合わせた再現です。遅延・運休や実際の列車位置は反映していません。線路・番線は路線ごとの代表表示、入線・停車時間と車両形式は簡略化しています。同じ線路では発車直後の列車を優先して表示します。</p>
    <p className="source-links"><a href={data.source} target="_blank" rel="noreferrer">時刻表の出典：JR東日本 ↗</a><a href="https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html" target="_blank" rel="noreferrer">祝日：内閣府 ↗</a></p>
  </Modal>;
}

export default function App() {
  const viewport = useRef(null);
  const engine = useRef(null);
  const toastTimer = useRef(null);
  const sceneDraw = useRef(null);
  if (!sceneDraw.current) sceneDraw.current = createSceneDraw();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('day');
  const [daylightCycle, setDaylightCycle] = useState(false);
  const [view, setView] = useState(0);
  const [labels, setLabels] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [roofHidden, setRoofHidden] = useState(false);
  const [follow, setFollow] = useState(false);
  const [followName, setFollowName] = useState('N700系');
  const [tour, setTour] = useState(null);
  const [watchedDeparture, setWatchedDeparture] = useState(null);
  const [departureLine, setDepartureLine] = useState('all');
  const [freeMode, setFreeMode] = useState(true);
  const [walking, setWalking] = useState(false);
  const [walkMapOpen, setWalkMapOpen] = useState(false);
  const [resumeHash, setResumeHash] = useState('');
  const savedResumeHash = useRef('');
  const [menusHidden, setMenusHidden] = useState(() => window.matchMedia('(max-width:600px)').matches);
  const [frame, setFrame] = useState({ labels: [], heading: 0, fps: 0, activeTrains: [] });
  const [now, setNow] = useState(() => clock.now());
  const [data, setData] = useState(null);
  const [dataError, setDataError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState('');
  const monthCache = useRef(new Map());
  const [dialog, setDialog] = useState(null);
  const [capture, setCapture] = useState(null);
  const [autoWalking, setAutoWalking] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkHash, setBookmarkHash] = useState('');
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarkError, setBookmarkError] = useState('');
  const [bookmarkStatus, setBookmarkStatus] = useState('');
  const [sceneLink, setSceneLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [viewsOpen, setViewsOpen] = useState(false);
  const context = serviceContext(now, data);
  const requestedMonth = context.date.slice(0, 7);
  const events = useMemo(() => data ? eventsForDay(data, now) : [], [data, context.date]);
  const upcoming = events.filter(event => event.at > now).slice(0, 3);
  const watchedToday = watchedDeparture?.date === context.date ? watchedDeparture : null;
  const watchedCursor = watchedToday && (departureLine === 'all' || departureLine === watchedToday.lineId) ? watchedToday.at : undefined;
  const departureToWatch = nextDeparture(events, now, watchedCursor, departureLine);
  const refresh = () => setNow(clock.now());

  function notify(message) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4500); }
  useEffect(() => {
    const interval = setInterval(refresh, 100);
    const onVisibility = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setDataError('');
    fetch('/data/timetable.json', { signal: controller.signal, cache: 'no-cache' }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(validateTimetable).then(value => { monthCache.current.set(value.month, value); setData(value); }).catch(error => { if (error.name !== 'AbortError') setDataError('時刻表を読み込めませんでした。'); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (!data) return;
    setDataError('');
    setDownloadProgress('');
    const cached = monthCache.current.get(requestedMonth);
    if (cached) { setData(cached); return; }
    const controller = new AbortController();
    loadMonth(requestedMonth, controller.signal, message => { if (!controller.signal.aborted) setDownloadProgress(message); })
      .then(value => {
        if (controller.signal.aborted) return;
        monthCache.current.set(value.month, value);
        setData(value);
        setDownloadProgress('');
      }).catch(error => { if (!controller.signal.aborted) { setDataError(error.message); setDownloadProgress(''); } });
    return () => controller.abort();
  }, [requestedMonth, Boolean(data), attempt]);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        engine.current = new ScheduledDiorama(viewport.current, frame => frame.error ? setError(frame.error) : setFrame(frame), clock);
        engine.current.onTourChange = state => {
          setTour(state.active ? state : null);
          if(state.active){setView(TOUR_STOPS[state.step].view);if(state.step===1)setRoofHidden(true);}
          if(state.reason==='start')trackFeature('tour_start');
          else if(state.reason==='complete'){trackFeature('tour_complete');notify('ツアー完了。気になる方向へ、自由に動かしてみてください。');}
          else if(!state.active)trackFeature('tour_stop',{reason:state.reason,step:state.step+1,seconds:Math.round(state.elapsed)});
        };
        engine.current.onFreeMove = () => trackFeature('free_camera_move');
        engine.current.onWalkMove = () => trackFeature('walk_move', { spot_id: engine.current?.walkCamera.spotId || 'free' });
        engine.current.walkCamera.onAutoChange = (enabled, detail) => {
          setAutoWalking(enabled);trackFeature(enabled ? 'walk_auto_start' : 'walk_auto_stop',detail);
          if(detail.reason==='obstacle')notify('ここでひと休み。向きを変えると、また歩けます。');
        };
        setReady(true);
        // A read-only diagnostic snapshot for local/browser regression checks.
        window.railwayDiagnostics = () => ({ now: clock.now(), live: clock.live, speed: clock.speed, paused: clock.paused, camera: { mode: engine.current?.walkCamera.active ? 'walk' : engine.current?.freeCamera.active ? 'free' : 'orbit', position: engine.current?.camera.position.toArray(), quaternion: engine.current?.camera.quaternion.toArray() }, trains: engine.current?.world.trains.map((train, lane) => ({ lane, state: train.currentState, position: train.cars[0].position.toArray(), visible: train.cars[0].visible })) });
      } catch (error) { console.error(error); setError('3D描画を開始できませんでした。WebGLが使えるブラウザで開いてください。'); }
    });
    return () => { cancelAnimationFrame(raf); engine.current?.dispose(); clearTimeout(toastTimer.current); delete window.railwayDiagnostics; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const applyLink = () => {
    if (!window.location.hash.includes('scene=')) return;
    const walk = engine.current.walkCamera;
    const pose = parseSceneLink(window.location.hash, walk.canEnter);
    if (!pose) { notify('この景色のリンクは使えません。見どころから散策できます。'); return; }
    restoreScene(pose);
    trackFeature('scene_link_arrive');notify('リンクの景色に到着しました。そのまま歩けます。');
    };
    applyLink();window.addEventListener('hashchange',applyLink);
    return () => window.removeEventListener('hashchange',applyLink);
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    let hash = null;
    try { hash = readWalkResume(window.localStorage, engine.current.walkCamera.canEnter); } catch { /* Storage may be disabled. */ }
    savedResumeHash.current = hash || '';setResumeHash(hash || '');
    const interval = setInterval(rememberWalk, 1000);
    const onHidden = () => { if (document.hidden) rememberWalk(); };
    window.addEventListener('pagehide', rememberWalk);
    document.addEventListener('visibilitychange', onHidden);
    return () => { clearInterval(interval); window.removeEventListener('pagehide', rememberWalk); document.removeEventListener('visibilitychange', onHidden); };
  }, [ready]);
  useEffect(() => { engine.current?.setEvents(events); }, [events, ready]);
  useEffect(() => { if (engine.current) engine.current.controls.autoRotate = rotate; }, [rotate, ready]);
  useEffect(() => { if (engine.current) engine.current.labelsVisible = labels; }, [labels, ready]);
  useEffect(() => { if (engine.current) engine.current.world.platformRoofs.visible = !roofHidden; }, [roofHidden, ready]);
  useEffect(() => {
    const onKey = event => {
      if (event.target.closest('input,select,textarea,button,a,dialog,[contenteditable]')) return;
      if (event.code === 'Space') { event.preventDefault(); clock.setPaused(!clock.paused); refresh(); }
      if (event.key === '0') selectView(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { engine.current?.walkCamera.setSuspended(Boolean(dialog || capture));engine.current?.freeCamera.setSuspended(Boolean(dialog || capture)); }, [dialog, capture, ready]);

  useEffect(() => {
    if(!ready)return;
    const canvas=engine.current.renderer.domElement;
    const manual=()=>engine.current?.stopTour('manual');
    const keyboard=e=>{if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Digit0','Escape'].includes(e.code))manual();};
    const hidden=()=>{if(document.hidden)engine.current?.stopTour('hidden');};
    const blur=()=>engine.current?.stopTour('blur');
    canvas.addEventListener('pointerdown',manual,true);canvas.addEventListener('wheel',manual,true);
    window.addEventListener('keydown',keyboard,true);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
    return ()=>{canvas.removeEventListener('pointerdown',manual,true);canvas.removeEventListener('wheel',manual,true);window.removeEventListener('keydown',keyboard,true);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};
  },[ready]);
  useEffect(()=>{if(dialog||capture)engine.current?.stopTour('dialog');},[dialog,capture]);
  function drawScene() {
    const scene = sceneDraw.current();
    selectView(scene.view); selectPeriod(scene.period); setRoofHidden(scene.roofHidden);
    setViewsOpen(false); setDialog(null); setMenusHidden(true);
    trackFeature('scene_draw', { scene_id: scene.id });
    notify(`${scene.title}。ここから自由に見回せます。`);
  }
  function startTour() {
    rememberWalk();setWalking(false);setFollow(false);setRotate(false);setViewsOpen(false);setDialog(null);setMenusHidden(true);
    engine.current?.startTour();
  }
  function startWalk() {
    engine.current?.setWalk(true);setWalking(true);setFollow(false);setRotate(false);setView(-1);setViewsOpen(false);
    engine.current?.renderer.domElement.focus({preventScroll:true});trackFeature('walk_start');
  }
  function showWalkMap(open) {
    engine.current?.walkCamera.clear('map');setWalkMapOpen(open);if(open)setMenusHidden(true);
    trackFeature(open ? 'walk_map_open' : 'walk_map_close');
  }
  function walkHome() {engine.current?.walkCamera.home();engine.current?.renderer.domElement.focus({preventScroll:true});trackFeature('walk_home');}
  function openSpots() {trackFeature('spot_open');setDialog('spots');}
  function visitSpot(spot) {
    startWalk();
    if(!engine.current?.walkCamera.visit(spot.position,spot.target)){notify('この場所へ移動できませんでした。');return;}
    engine.current.walkCamera.spotId=spot.id;setDialog(null);setMenusHidden(true);trackFeature('spot_visit',{spot_id:spot.id});
    notify(spot.title);
  }
  function restoreScene(pose) {
    startWalk();const walk=engine.current.walkCamera;
    walk.camera.position.set(pose.x,2.2,pose.z);walk.yaw=pose.yaw;walk.pitch=pose.pitch;walk.orient();
    engine.current.daylight.setRunning(false);engine.current.daylight.phase=pose.light;engine.current.daylight.sample();engine.current.applyDaylight();
    setPeriod(Number.isInteger(pose.light) ? ['day','evening','night'][pose.light] : null);setDaylightCycle(false);setMenusHidden(true);setDialog(null);
  }
  function currentSceneLink() {
    const current=engine.current,walk=current?.walkCamera;
    return walk?.active ? makeSceneLink(window.location.origin,{x:walk.camera.position.x,z:walk.camera.position.z,yaw:walk.yaw,pitch:walk.pitch,light:current.daylight.phase},walk.canEnter) : null;
  }
  function rememberWalk() {
    const link = currentSceneLink();
    if (!link) return;
    const hash = new URL(link).hash;
    if (hash === savedResumeHash.current) return;
    try {
      if (saveWalkResume(window.localStorage, hash, engine.current.walkCamera.canEnter)) {
        savedResumeHash.current = hash;setResumeHash(hash);
      }
    } catch { /* Walking remains available without browser storage. */ }
  }
  function resumeWalk() {
    let hash = null;
    try { hash = readWalkResume(window.localStorage, engine.current.walkCamera.canEnter); } catch { /* Storage may be disabled. */ }
    const pose = hash && parseSceneLink(hash, engine.current.walkCamera.canEnter);
    if (!pose) {setResumeHash('');notify('再開できる記録がありません。見どころから散策できます。');return;}
    restoreScene(pose);trackFeature('walk_resume');notify('散策のつづきに戻りました。ここから、また歩けます。');
  }
  function openBookmarks(saveCurrent=false) {
    setBookmarkError('');setBookmarkStatus('');setBookmarkHash('');
    try {setBookmarks(readBookmarks(window.localStorage));} catch {setBookmarks([]);setBookmarkError('しおりを読み込めません。このブラウザの保存設定をご確認ください。');}
    if(saveCurrent){
      const link=currentSceneLink();
      if(link){setBookmarkHash(new URL(link).hash);setBookmarkName('お気に入りの東京駅');}
      else setBookmarkError('散策を始めてから、この景色を保存できます。');
    }
    trackFeature('bookmark_open');setDialog('bookmarks');
  }
  function saveBookmark(event) {
    event.preventDefault();setBookmarkError('');
    try {setBookmarks(addBookmark(window.localStorage,{id:crypto.randomUUID(),name:bookmarkName,hash:bookmarkHash}));setBookmarkHash('');setBookmarkStatus('このブラウザに保存しました。次回も「見どころへ」から開けます。');trackFeature('bookmark_save');}
    catch(error){setBookmarkError(error.name==='Error' ? error.message : '保存できませんでした。このブラウザの保存設定をご確認ください。');}
  }
  function deleteBookmark(id) {
    setBookmarkError('');
    try {setBookmarks(removeBookmark(window.localStorage,id));setBookmarkStatus('しおりを削除しました。');}
    catch {setBookmarkError('削除できませんでした。もう一度お試しください。');}
  }
  function visitBookmark(bookmark) {
    const pose=parseSceneLink(bookmark.hash,engine.current.walkCamera.canEnter);
    if(!pose){setBookmarkError('この景色へ移動できません。ほかのしおりをお試しください。');return;}
    restoreScene(pose);trackFeature('bookmark_visit');notify(`「${bookmark.name}」に戻りました。`);
  }
  function openSceneLink() {
    const current=engine.current,walk=current?.walkCamera;
    if(!walk?.active)return;
    const url=makeSceneLink(window.location.origin,{x:walk.camera.position.x,z:walk.camera.position.z,yaw:walk.yaw,pitch:walk.pitch,light:current.daylight.phase},walk.canEnter);
    if(!url){notify('この場所のリンクを作れませんでした。少し移動してお試しください。');return;}
    setSceneLink(url);setLinkCopied(false);setDialog('scene-link');trackFeature('scene_link_open');
  }
  async function copySceneLink() {
    try {await navigator.clipboard.writeText(sceneLink);setLinkCopied(true);trackFeature('scene_link_copy');}
    catch {setLinkCopied(false);notify('リンク欄を長押し、または選択してコピーしてください。');}
  }
  function selectCameraMode(enabled) { engine.current?.setFreeMode(enabled);setFreeMode(enabled);setFollow(false);setRotate(false);trackFeature('camera_mode_select',{mode:enabled?'free':'orbit'}); }
  function selectPeriod(value) { setPeriod(value); setDaylightCycle(false); engine.current?.setPeriod(value); }
  function selectWalkLight(value) {
    engine.current?.walkCamera.clear('lighting');
    selectPeriod(value);
    trackFeature('walk_light_select', { period: value });
  }
  function toggleDaylight() { const next = !daylightCycle; setPeriod(null); setDaylightCycle(next); engine.current?.setDaylightCycle(next); }
  function selectView(index) { rememberWalk();engine.current?.setView(index); setWalking(false); setView(index); setRotate(false); setFollow(false); if (index === 4) setRoofHidden(true); }
  function seek(event) { clock.seek(event.at - 30000); clock.setPaused(false); refresh(); setRoofHidden(true); }
  function watchDeparture() {
    const event = nextDeparture(events, clock.now(), watchedCursor, departureLine);
    if (!event) { notify('この運行日の残りの発車はありません。時刻表で日付を選べます。'); return; }
    selectView(2); setRoofHidden(true); setViewsOpen(false); setDialog(null); setMenusHidden(true);
    clock.seek(event.at - 5000); clock.setSpeed(1); clock.setPaused(false); refresh();
    setWatchedDeparture({ ...event, date: context.date });
    setFollow(Boolean(engine.current?.watchDeparture(event)));
    setFollowName(event.lineName); setView(-1);
    trackFeature('departure_watch', { line_id: event.lineId, selected_line: departureLine });
    notify(`${event.time} ${event.lineName}の発車5秒前へ。時計は1倍速です。`);
  }
  function returnFromDeparture() {
    engine.current?.setFollow(false); setFollow(false); clock.sync(); refresh(); setWatchedDeparture(null); trackFeature('departure_watch_return');
  }
  function followTrain() {
    if(walking){rememberWalk();engine.current?.setWalk(false);setWalking(false);}
    if (follow) { engine.current?.setFollow(false); setFollow(false); return; }
    if (engine.current?.setFollow(true)) { setFollow(true); setFollowName('N700系'); setView(-1); setRotate(false); setRoofHidden(true); }
    else notify('現在、N700系は画面内にいません。時刻表から次の発車へ移動できます。');
  }
  function openUpdates() { trackFeature('updates_open'); setDialog('updates'); }
  function tryUpdate(action, id) {
    trackFeature('updates_try', { release_id: id, feature: action });
    if (action === 'departure-line') { if(walking)selectView(0); engine.current?.stopTour('manual'); setDialog(null); setMenusHidden(true); requestAnimationFrame(()=>document.getElementById('departure-line')?.focus()); return; }
    if (action === 'next-departure') { watchDeparture(); return; }
    if (action === 'scene-draw') {drawScene();return;}
    if (action === 'station-tour') {startTour();return;}
    if (action === 'free-camera') {if(walking)selectView(0);selectCameraMode(true);setDialog(null);return;}
    if (action === 'walk-resume') {if(resumeHash)resumeWalk();else {startWalk();setDialog(null);setMenusHidden(true);notify('散策すると、このブラウザに位置・向き・光を自動で覚えます。');}return;}
    if (action === 'walk-map') {startWalk();setDialog(null);setMenusHidden(true);showWalkMap(true);return;}
    if (action === 'walk-light') {startWalk();setDialog(null);setMenusHidden(true);notify('パッドの「昼・夕・夜」で、同じ景色の光を比べられます。');return;}
    if (action === 'auto-walk') {startWalk();setDialog(null);setMenusHidden(true);notify('パッド右上の「自動」で前へ。ドラッグで見回せます。');return;}
    if (action === 'bookmarks') {startWalk();openBookmarks(true);return;}
    if (action === 'scene-link') {startWalk();setDialog(null);notify('好きな方向を向いて「景色のリンク」を押してください。');return;}
    if (action === 'spots') {openSpots();return;}
    if (action === 'timetable') { setDialog('timetable'); return; }
    setDialog(null);
    if (action === 'walk') startWalk();
    if (action === 'daylight' && !daylightCycle) toggleDaylight();
    if (action === 'train') setDialog('train');
  }
  async function saveScene() { try { setCapture(await engine.current.capture()); } catch { notify('画像を保存できませんでした。もう一度お試しください。'); } }

  return <main onPointerDownCapture={event=>{if(!event.target.closest('.tour-panel'))engine.current?.stopTour('manual');}} className={`app ${frame.period || period} ${walking ? 'is-walking' : ''} ${menusHidden ? 'menus-hidden' : ''}`}>
    <div ref={viewport} className="viewport" />
    <div className="top-shade" />
    <button className="menu-visibility glass" aria-expanded={!menusHidden} onClick={() => { engine.current?.walkCamera.clear('menu'); if(menusHidden && walkMapOpen)showWalkMap(false); setMenusHidden(value => !value); }}>{menusHidden ? 'メニューを表示' : 'メニューを隠す'}</button>
    {!walking && !tour && <button className="scene-draw glass" disabled={!ready} onClick={drawScene} title="6つの視点と光から一景へ。時計はそのまま。">景色くじ ◇</button>}
    {!walking && !tour && <button className="tour-entry glass" disabled={!ready} onClick={startTour}>24秒ツアー ▶</button>}
    {!walking && !tour && <section className="departure-watch glass" aria-label="発車を見に行く">
      <label className="departure-line" htmlFor="departure-line"><span>見たい路線</span><select id="departure-line" value={departureLine} onChange={event=>{setDepartureLine(event.target.value);trackFeature('departure_line_select',{line_id:event.target.value});}}><option value="all">すべての路線</option>{LINES.map(line=><option key={line.id} value={line.id}>{line.name}</option>)}</select></label>
      <div className="departure-actions"><div><small>{watchedToday ? `${watchedToday.time} ${watchedToday.lineName}を鑑賞` : '時計を発車5秒前へ · 1倍速'}</small><button disabled={!ready || !departureToWatch} onClick={watchDeparture}>{departureToWatch ? `${watchedToday ? '次の発車へ' : '発車を見に行く'} ▶ ${departureToWatch.time}` : 'この路線の残りの発車なし'}</button></div>
      {watchedToday && <button className="departure-return" onClick={returnFromDeparture}>現在時刻へ</button>}</div>
    </section>}
    {tour && <section className="tour-panel glass" aria-label="東京駅ツアー" aria-live="polite"><div><small>TOKYO STATION TOUR · {tour.step+1} / {TOUR_STOPS.length}</small><strong>{TOUR_STOPS[tour.step].title}</strong><p>{TOUR_STOPS[tour.step].caption}</p></div><button onClick={()=>engine.current?.stopTour('button')}>ここで止める</button></section>}
    {!walking && <button className="camera-mode glass" disabled={!ready} aria-label={freeMode?'カメラ操作を周回に切り替え':'カメラ操作を自由移動に切り替え'} onClick={()=>selectCameraMode(!freeMode)}>{freeMode?'自由移動':'周回操作'} ⇄</button>}
    {!walking && freeMode && !follow && <FreeControls controller={()=>engine.current?.freeCamera} />}
    {!walking && !tour && resumeHash && <button className="resume-shortcut glass" disabled={!ready} onClick={resumeWalk}>散策のつづき ↗</button>}
    {menusHidden && <button className="spots-shortcut glass" disabled={!ready} aria-haspopup="dialog" onClick={openSpots}>見どころへ ↗</button>}
    <header className="identity"><h1>東京鉄道景</h1><p>TOKYO RAILWAY DIORAMA</p><div>東京駅・丸の内</div></header>
    <div className="top-controls"><div className="daylight-controls"><div className="period glass" role="group" aria-label="時間帯">{[['day', '昼'], ['evening', '夕'], ['night', '夜']].map(([value, label]) => <button key={value} aria-pressed={!daylightCycle && period === value} onClick={() => selectPeriod(value)}>{label}</button>)}</div><button className="daylight-cycle glass" disabled={!ready} aria-pressed={daylightCycle} onClick={toggleDaylight} title="約90秒で昼・夕・夜を巡ります。もう一度押すと、その光で止まります。"><span>{daylightCycle ? '光の移ろいを止める' : '光の移ろい'}</span><small>{daylightCycle ? frame.daylightCaption : '昼・夕・夜を自動で'}</small>{daylightCycle && <i aria-hidden="true" style={{transform:`scaleX(${frame.daylightProgress || 0})`}}/>}</button></div><button className="capture glass icon" onClick={saveScene} disabled={!ready} aria-label="風景をPNGで保存" title="風景をPNGで保存">↧</button></div>
    <nav className="updates-menu glass" aria-label="サイトメニュー"><button className="walk-entry" disabled={!ready} aria-pressed={walking} onClick={() => walking ? selectView(0) : startWalk()}>{walking ? '上から眺める' : '自由に歩く'} <span>↗</span></button><button onClick={openUpdates} aria-haspopup="dialog">更新履歴 <span>↗</span></button></nav>
    {walking && walkMapOpen && <WalkMap pose={frame.walkPosition} />}
    {walking && <WalkControls mapOpen={walkMapOpen} onMap={() => showWalkMap(!walkMapOpen)} period={daylightCycle ? null : period} onLight={selectWalkLight} autoWalking={autoWalking} onAutoWalk={() => {const walk=engine.current?.walkCamera;walk?.setAutoMoving(!walk.autoMoving);}} controller={() => engine.current?.walkCamera} onHome={walkHome} onSpots={openSpots} onShare={openSceneLink} onBookmark={() => openBookmarks(true)} onExit={() => selectView(0)} />}
    <aside className="time-stack">
      <ClockPanel now={now} onChange={() => { setWatchedDeparture(null); refresh(); }} data={data} context={context} />
      <section className="departure-panel glass" aria-label="次の発車">
        <header><span>次の発車 <small>東京駅</small></span><button disabled={!data} onClick={() => setDialog('timetable')}>時刻表 ↗</button></header>
        {downloadProgress ? <p className="empty-state" role="status">{downloadProgress}</p> : dataError ? <p className="data-warning" role="alert">{dataError}<button onClick={() => setAttempt(value => value + 1)}>再試行</button></p> : !data ? <p className="empty-state">時刻表を読み込み中…</p> : !context.supported ? <p className="data-warning">{data.month.replace('-', '年')}月の時刻表を収録しています。<br />この日付の列車は表示しません。</p> : upcoming.length ? <ol>{upcoming.map(event => <li key={event.id}><button onClick={() => seek(event)} title="この発車の30秒前へ"><time>{event.time}</time><i style={{ background: event.color }} /><span><strong>{event.lineName}</strong><small>{event.type} · {event.destination}</small></span><span className="jump-arrow">↗</span></button></li>)}</ol> : <p className="empty-state">本日の収録列車は発車を終えました。<br /><button onClick={() => { clock.seek(context.midnight + 86400000 + 5 * 3600000); refresh(); }}>翌朝5時へ ↗</button></p>}
        <footer>時刻表による再現 · 実際の遅延は未反映</footer>
      </section>
    </aside>
    <div className="scene-labels" aria-hidden={!labels}>{frame.labels.filter(label => label.visible).map(label => <span key={label.name} style={{ left: label.x, top: label.y }}>{label.name}</span>)}</div>
    <nav className={`viewpoints glass ${viewsOpen ? 'expanded' : ''}`} aria-label="視点を選択"><button className="views-disclosure" aria-expanded={viewsOpen} onClick={() => setViewsOpen(value => !value)}>視点・車両 <span>{viewsOpen ? '−' : '+'}</span></button><div className="view-options"><div className="panel-title">VIEWPOINT</div><button className="spots-menu" disabled={!ready} aria-haspopup="dialog" onClick={openSpots}>散策の見どころ ↗</button>{VIEWPOINTS.map((item, index) => <button key={item.name} aria-pressed={view === index} onClick={() => selectView(index)}><span className="view-num">0{index + 1}</span>{item.name}</button>)}<button className="follow-train" disabled={!ready} aria-pressed={follow} onClick={followTrain}>{follow ? `${followName}の追従を解除` : '新幹線を追う'}</button><button className="roof-toggle" aria-pressed={roofHidden} onClick={() => setRoofHidden(value => !value)}>ホーム屋根を隠す</button><button className="inspect-train" onClick={() => setDialog('train')}>新幹線の車両詳細 ↗</button></div></nav>
    <div className="playback glass" role="toolbar" aria-label="描画コントロール"><button className="icon play" onClick={() => { clock.setPaused(!clock.paused); refresh(); }} aria-label={clock.paused ? '列車と時計を再開' : '列車と時計を一時停止'}>{clock.paused ? '▶' : 'Ⅱ'}</button><button className="speed" onClick={() => { clock.setSpeed(SPEEDS[(SPEEDS.indexOf(clock.speed) + 1) % SPEEDS.length]); refresh(); }} aria-label={`時計速度 ${clock.speed}倍。クリックで変更`}>{clock.speed}<span>×</span></button><i /><button disabled={walking || freeMode} aria-pressed={rotate} onClick={() => setRotate(value => !value)}>自動旋回</button><i /><button aria-pressed={labels} onClick={() => setLabels(value => !value)}>ラベル</button></div>
    <aside className="orientation"><button className="compass" title="東京駅全景に戻す（0）" aria-label="東京駅全景に戻す" onClick={() => selectView(0)}><span className="north">N</span><svg viewBox="0 0 80 80" style={{ transform: `rotate(${-frame.heading}deg)` }}><circle cx="40" cy="40" r="32" /><path className="needle" d="M40 17L46 45L40 41L34 45Z" /><path className="needle-back" d="M40 63L46 45L40 41L34 45Z" /></svg></button><p>{freeMode&&!follow?'ドラッグで見回す / スクロールで前後へ':'ドラッグで周回 / スクロールで拡大'}</p><div className="footnote"><span>{freeMode&&!follow?'W/S 前後 · A/D 左右 · Q/E 上下 · Shift 加速':'右ドラッグで移動'}</span><button onClick={() => setDialog('about')} aria-label="このジオラマについて">ⓘ</button></div></aside>
    <a className="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    {!ready && !error && <div className="loading"><span className="loader" /><p>東京の街を組み立てています</p></div>}
    {error && <div className="error" role="alert"><p>{error}</p><button onClick={() => location.reload()}>再読み込み</button></div>}
    {toast && <div className="toast glass" role="status">{toast}</div>}
    {dialog === 'bookmarks' && <Modal title="景色のしおり" onClose={() => setDialog(null)}>
      <p>好きな場所・向き・光に、また戻ってこられます。</p>
      {bookmarkHash && <form className="bookmark-form" onSubmit={saveBookmark}>
        <label>しおりの名前<input aria-label="しおりの名前" maxLength={32} required value={bookmarkName} onChange={event => setBookmarkName(event.target.value)} /></label>
        <button type="submit">この景色を保存</button>
      </form>}
      {bookmarkError && <p role="alert" className="bookmark-error">{bookmarkError}</p>}
      {bookmarkStatus && <p role="status">{bookmarkStatus}</p>}
      <div className="bookmark-list">{bookmarks.map(bookmark => <div key={bookmark.id}>
        <button className="bookmark-visit" onClick={() => visitBookmark(bookmark)}><span aria-hidden="true">▱</span><strong>{bookmark.name}</strong><span aria-hidden="true">↗</span></button>
        <button className="bookmark-delete" aria-label={`「${bookmark.name}」のしおりを削除`} onClick={() => deleteBookmark(bookmark.id)}>削除</button>
      </div>)}</div>
      {!bookmarks.length && <p className="data-note">まだしおりはありません。散策中の「しおり」から、好きな景色を保存できます。</p>}
      <p className="data-note">このブラウザだけに最大5件保存します。閲覧データを消すと、しおりも消えます。列車は開いたときの時計で動きます。</p>
    </Modal>}
    {dialog === 'scene-link' && <Modal title="この景色から、また歩こう。" onClose={() => setDialog(null)}>
      <p>散策の位置・向き・光を、リンクにしました。保存して戻ってきたり、この景色を誰かに見せたりできます。</p>
      <label className="scene-link-label">景色のリンク<input aria-label="景色のリンク" value={sceneLink} readOnly onFocus={event => event.target.select()} /></label>
      <button className="scene-link-copy" onClick={copySceneLink}>{linkCopied ? 'コピーしました ✓' : 'リンクをコピー'}</button>
      <p role="status" className="data-note">{linkCopied ? 'リンクを開くと、同じ場所と向きから散策できます。' : 'コピーできない場合は、リンク欄を選択してコピーできます。'}</p>
      <a className="scene-link-preview" href={sceneLink} target="_blank" rel="noreferrer">このリンクの景色を開く ↗</a>
      <p className="data-note">光はリンク作成時の状態。列車は開いたときの時刻表で動きます。</p>
    </Modal>}
    {dialog === 'spots' && <Modal title="どの景色から歩く？" onClose={() => setDialog(null)}>
      <p>気になる場所を選ぶと、地上の目線へ。着いた先から自由に歩けます。</p>
      {resumeHash && <button className="resume-entry" onClick={resumeWalk}><strong>散策のつづき ↗</strong><small>最後に歩いた場所・向き・光から再開</small></button>}
      <div className="spot-list">{WALK_SPOTS.map((spot,index)=><button key={spot.id} onClick={() => visitSpot(spot)}><span className="spot-number">0{index+1}</span><span><strong>{spot.title}</strong><small>{spot.caption}</small></span><span aria-hidden="true">↗</span></button>)}</div>
      <button className="bookmarks-entry" onClick={() => openBookmarks(false)}>景色のしおり ↗</button>
      <p className="data-note">今回は駅舎の外の3か所。駅の中は今後の更新で。</p>
      <p className="data-note">散策のつづきは、このブラウザに自動保存します。列車は再開時の時計で動きます。</p>
    </Modal>}
    {dialog === 'updates' && <Modal title="東京鉄道景の更新履歴" onClose={() => setDialog(null)} wide>
      <p className="updates-intro">街が少しずつ変わっていく。その日の新しい楽しみ方を、ここから。</p>
      <ol className="updates-list">{updates.map((update, index) => <li key={update.id}>
        <div className="update-meta"><time dateTime={update.date}>{update.date.replaceAll('-', '.')}</time>{index === 0 && <span>最新の更新</span>}</div>
        <h3>{update.title}</h3><p>{update.description}</p>
        <ul>{update.changes.map(change => <li key={change}>{change}</li>)}</ul>
        {update.action && <button className="update-try" disabled={!ready || (update.action === 'timetable' && !data)} onClick={() => tryUpdate(update.action, update.id)}>{update.actionLabel} <span>→</span></button>}
      </li>)}</ol>
    </Modal>}
    {dialog === 'train' && <TrainDialog onClose={() => setDialog(null)} />}
    {dialog === 'timetable' && data && <TimetableDialog data={data} events={events} now={now} context={context} onClose={() => setDialog(null)} onSeek={seek} />}
    {dialog === 'about' && <Modal title="鉄道のある街を、眺める。" onClose={() => setDialog(null)}><p>東京駅とその周辺を、小さな立体の街にしました。好きな角度から、電車が行き交う風景を楽しんでください。</p><dl><dt>自由散策</dt><dd>「自由に歩く」から開始。WASD・矢印キー、または画面の方向ボタンで移動。ドラッグで見回せます。</dd><dt>24秒ツアー</dt><dd>駅舎・ホーム・街並みを8秒ずつ案内します。「ここで止める」、画面のドラッグ、移動キーで終了。その景色から自由操作を続けられます。時計や光の設定は変わりません。</dd><dt>自由移動（通常操作）</dt><dd>左ドラッグでその場から見回し、スクロールで画面の中心に向かって前後へ。W/Sで前後、A/Dで左右、Qで下降・Eで上昇。Shiftで加速。右ドラッグで平行移動。スマートフォンは方向ボタンを使います。空中移動には建物との衝突判定はありません。</dd><dt>周回操作への切替</dt><dd>「自由移動 ⇄」で従来の周回操作に切り替えられます。</dd><dt>周回中の回転</dt><dd>左ドラッグ / 指1本</dd><dt>移動</dt><dd>右ドラッグ / 指2本</dd><dt>拡大・縮小</dt><dd>スクロール / ピンチ</dd><dt>時計の停止・再開</dt><dd>Spaceキー</dd><dt>現在の日時に戻る</dt><dd>「現在時刻に戻る」</dd><dt>全景に戻る</dt><dd>0キー / コンパス</dd></dl><p>昼・夕・夜は風景の見た目を切り替えます。時計とは独立しているので、好きな景色で時刻表の運行を眺められます。「光の移ろい」は約90秒で昼・夕・夜を巡り、再度押すとその光で止まります。</p><p className="data-note">東京駅の7路線・方向を6本の代表線路で表示しています。発車時刻と運行日にはJR東日本掲載時刻表を使用。番線・車両形式・入線と停車時間は簡略化し、同じ線路の列車が重なる場合は発車直後を優先します。遅延・運休・実際の列車位置には対応していません。</p><p className="data-note">地図データはOpenStreetMap。未登録の建物高や道路幅、駅舎の細部、中央線の高低差などは推定です。</p><p className="source-links"><a href="https://www.tokyostationcity.com/learning/station_building/" target="_blank" rel="noreferrer">駅舎の参考：Tokyo Station City ↗</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">地図データ：OpenStreetMap / ODbL ↗</a></p><div className="render-info">WebGL · Three.js <span>{frame.fps} fps</span></div></Modal>}
    {capture && <Modal title="この風景を持ち帰る" onClose={() => setCapture(null)} wide><img className="captured-scene" src={capture.url} alt="書き出した東京駅周辺の風景" /><a className="download-button" href={capture.url} download={capture.filename}>PNGをダウンロード</a></Modal>}
  </main>;
}
