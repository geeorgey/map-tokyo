import React, { useState, useRef, useEffect, useMemo } from 'react';
import WalkControls from './WalkControls.jsx';
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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('day');
  const [daylightCycle, setDaylightCycle] = useState(false);
  const [view, setView] = useState(0);
  const [labels, setLabels] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [roofHidden, setRoofHidden] = useState(false);
  const [follow, setFollow] = useState(false);
  const [walking, setWalking] = useState(false);
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
  const [toast, setToast] = useState('');
  const [viewsOpen, setViewsOpen] = useState(false);
  const context = serviceContext(now, data);
  const requestedMonth = context.date.slice(0, 7);
  const events = useMemo(() => data ? eventsForDay(data, now) : [], [data, context.date]);
  const upcoming = events.filter(event => event.at > now).slice(0, 3);
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
        engine.current.onWalkMove = () => trackFeature('walk_move');
        setReady(true);
        // A read-only diagnostic snapshot for local/browser regression checks.
        window.railwayDiagnostics = () => ({ now: clock.now(), live: clock.live, speed: clock.speed, paused: clock.paused, camera: { mode: engine.current?.walkCamera.active ? 'walk' : 'orbit', position: engine.current?.camera.position.toArray(), quaternion: engine.current?.camera.quaternion.toArray() }, trains: engine.current?.world.trains.map((train, lane) => ({ lane, state: train.currentState, position: train.cars[0].position.toArray(), visible: train.cars[0].visible })) });
      } catch (error) { console.error(error); setError('3D描画を開始できませんでした。WebGLが使えるブラウザで開いてください。'); }
    });
    return () => { cancelAnimationFrame(raf); engine.current?.dispose(); clearTimeout(toastTimer.current); delete window.railwayDiagnostics; };
  }, []);
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

  useEffect(() => { engine.current?.walkCamera.setSuspended(Boolean(dialog || capture)); }, [dialog, capture, ready]);

  function startWalk() {
    engine.current?.setWalk(true);setWalking(true);setFollow(false);setRotate(false);setView(-1);setViewsOpen(false);
    engine.current?.renderer.domElement.focus({preventScroll:true});trackFeature('walk_start');
  }
  function walkHome() {engine.current?.walkCamera.home();engine.current?.renderer.domElement.focus({preventScroll:true});trackFeature('walk_home');}
  function selectPeriod(value) { setPeriod(value); setDaylightCycle(false); engine.current?.setPeriod(value); }
  function toggleDaylight() { const next = !daylightCycle; setPeriod(null); setDaylightCycle(next); engine.current?.setDaylightCycle(next); }
  function selectView(index) { engine.current?.setView(index); setWalking(false); setView(index); setRotate(false); setFollow(false); if (index === 4) setRoofHidden(true); }
  function seek(event) { clock.seek(event.at - 30000); clock.setPaused(false); refresh(); setRoofHidden(true); }
  function followTrain() {
    if(walking){engine.current?.setWalk(false);setWalking(false);}
    if (follow) { engine.current?.setFollow(false); setFollow(false); return; }
    if (engine.current?.setFollow(true)) { setFollow(true); setView(-1); setRotate(false); setRoofHidden(true); }
    else notify('現在、N700系は画面内にいません。時刻表から次の発車へ移動できます。');
  }
  function openUpdates() { trackFeature('updates_open'); setDialog('updates'); }
  function tryUpdate(action, id) {
    trackFeature('updates_try', { release_id: id, feature: action });
    if (action === 'timetable') { setDialog('timetable'); return; }
    setDialog(null);
    if (action === 'walk') startWalk();
    if (action === 'daylight' && !daylightCycle) toggleDaylight();
    if (action === 'train') setDialog('train');
  }
  async function saveScene() { try { setCapture(await engine.current.capture()); } catch { notify('画像を保存できませんでした。もう一度お試しください。'); } }

  return <main className={`app ${frame.period || period} ${walking ? 'is-walking' : ''} ${menusHidden ? 'menus-hidden' : ''}`}>
    <div ref={viewport} className="viewport" />
    <div className="top-shade" />
    <button className="menu-visibility glass" aria-expanded={!menusHidden} onClick={() => { engine.current?.walkCamera.clear(); setMenusHidden(value => !value); }}>{menusHidden ? 'メニューを表示' : 'メニューを隠す'}</button>
    <header className="identity"><h1>東京鉄道景</h1><p>TOKYO RAILWAY DIORAMA</p><div>東京駅・丸の内</div></header>
    <div className="top-controls"><div className="daylight-controls"><div className="period glass" role="group" aria-label="時間帯">{[['day', '昼'], ['evening', '夕'], ['night', '夜']].map(([value, label]) => <button key={value} aria-pressed={!daylightCycle && period === value} onClick={() => selectPeriod(value)}>{label}</button>)}</div><button className="daylight-cycle glass" disabled={!ready} aria-pressed={daylightCycle} onClick={toggleDaylight} title="約90秒で昼・夕・夜を巡ります。もう一度押すと、その光で止まります。"><span>{daylightCycle ? '光の移ろいを止める' : '光の移ろい'}</span><small>{daylightCycle ? frame.daylightCaption : '昼・夕・夜を自動で'}</small>{daylightCycle && <i aria-hidden="true" style={{transform:`scaleX(${frame.daylightProgress || 0})`}}/>}</button></div><button className="capture glass icon" onClick={saveScene} disabled={!ready} aria-label="風景をPNGで保存" title="風景をPNGで保存">↧</button></div>
    <nav className="updates-menu glass" aria-label="サイトメニュー"><button className="walk-entry" disabled={!ready} aria-pressed={walking} onClick={() => walking ? selectView(0) : startWalk()}>{walking ? '上から眺める' : '自由に歩く'} <span>↗</span></button><button onClick={openUpdates} aria-haspopup="dialog">更新履歴 <span>↗</span></button></nav>
    {walking && <WalkControls controller={() => engine.current?.walkCamera} onHome={walkHome} onExit={() => selectView(0)} />}
    <aside className="time-stack">
      <ClockPanel now={now} onChange={refresh} data={data} context={context} />
      <section className="departure-panel glass" aria-label="次の発車">
        <header><span>次の発車 <small>東京駅</small></span><button disabled={!data} onClick={() => setDialog('timetable')}>時刻表 ↗</button></header>
        {downloadProgress ? <p className="empty-state" role="status">{downloadProgress}</p> : dataError ? <p className="data-warning" role="alert">{dataError}<button onClick={() => setAttempt(value => value + 1)}>再試行</button></p> : !data ? <p className="empty-state">時刻表を読み込み中…</p> : !context.supported ? <p className="data-warning">{data.month.replace('-', '年')}月の時刻表を収録しています。<br />この日付の列車は表示しません。</p> : upcoming.length ? <ol>{upcoming.map(event => <li key={event.id}><button onClick={() => seek(event)} title="この発車の30秒前へ"><time>{event.time}</time><i style={{ background: event.color }} /><span><strong>{event.lineName}</strong><small>{event.type} · {event.destination}</small></span><span className="jump-arrow">↗</span></button></li>)}</ol> : <p className="empty-state">本日の収録列車は発車を終えました。<br /><button onClick={() => { clock.seek(context.midnight + 86400000 + 5 * 3600000); refresh(); }}>翌朝5時へ ↗</button></p>}
        <footer>時刻表による再現 · 実際の遅延は未反映</footer>
      </section>
    </aside>
    <div className="scene-labels" aria-hidden={!labels}>{frame.labels.filter(label => label.visible).map(label => <span key={label.name} style={{ left: label.x, top: label.y }}>{label.name}</span>)}</div>
    <nav className={`viewpoints glass ${viewsOpen ? 'expanded' : ''}`} aria-label="視点を選択"><button className="views-disclosure" aria-expanded={viewsOpen} onClick={() => setViewsOpen(value => !value)}>視点・車両 <span>{viewsOpen ? '−' : '+'}</span></button><div className="view-options"><div className="panel-title">VIEWPOINT</div>{VIEWPOINTS.map((item, index) => <button key={item.name} aria-pressed={view === index} onClick={() => selectView(index)}><span className="view-num">0{index + 1}</span>{item.name}</button>)}<button className="follow-train" disabled={!ready} aria-pressed={follow} onClick={followTrain}>{follow ? 'N700系の追従を解除' : '新幹線を追う'}</button><button className="roof-toggle" aria-pressed={roofHidden} onClick={() => setRoofHidden(value => !value)}>ホーム屋根を隠す</button><button className="inspect-train" onClick={() => setDialog('train')}>新幹線の車両詳細 ↗</button></div></nav>
    <div className="playback glass" role="toolbar" aria-label="描画コントロール"><button className="icon play" onClick={() => { clock.setPaused(!clock.paused); refresh(); }} aria-label={clock.paused ? '列車と時計を再開' : '列車と時計を一時停止'}>{clock.paused ? '▶' : 'Ⅱ'}</button><button className="speed" onClick={() => { clock.setSpeed(SPEEDS[(SPEEDS.indexOf(clock.speed) + 1) % SPEEDS.length]); refresh(); }} aria-label={`時計速度 ${clock.speed}倍。クリックで変更`}>{clock.speed}<span>×</span></button><i /><button disabled={walking} aria-pressed={rotate} onClick={() => setRotate(value => !value)}>自動旋回</button><i /><button aria-pressed={labels} onClick={() => setLabels(value => !value)}>ラベル</button></div>
    <aside className="orientation"><button className="compass" title="東京駅全景に戻す（0）" aria-label="東京駅全景に戻す" onClick={() => selectView(0)}><span className="north">N</span><svg viewBox="0 0 80 80" style={{ transform: `rotate(${-frame.heading}deg)` }}><circle cx="40" cy="40" r="32" /><path className="needle" d="M40 17L46 45L40 41L34 45Z" /><path className="needle-back" d="M40 63L46 45L40 41L34 45Z" /></svg></button><p>ドラッグで回転 / スクロールで拡大</p><div className="footnote"><span>右ドラッグで移動</span><button onClick={() => setDialog('about')} aria-label="このジオラマについて">ⓘ</button></div></aside>
    <a className="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    {!ready && !error && <div className="loading"><span className="loader" /><p>東京の街を組み立てています</p></div>}
    {error && <div className="error" role="alert"><p>{error}</p><button onClick={() => location.reload()}>再読み込み</button></div>}
    {toast && <div className="toast glass" role="status">{toast}</div>}
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
    {dialog === 'about' && <Modal title="鉄道のある街を、眺める。" onClose={() => setDialog(null)}><p>東京駅とその周辺を、小さな立体の街にしました。好きな角度から、電車が行き交う風景を楽しんでください。</p><dl><dt>自由散策</dt><dd>「自由に歩く」から開始。WASD・矢印キー、または画面の方向ボタンで移動。ドラッグで見回せます。</dd><dt>回転</dt><dd>左ドラッグ / 指1本</dd><dt>移動</dt><dd>右ドラッグ / 指2本</dd><dt>拡大・縮小</dt><dd>スクロール / ピンチ</dd><dt>時計の停止・再開</dt><dd>Spaceキー</dd><dt>現在の日時に戻る</dt><dd>「現在時刻に戻る」</dd><dt>全景に戻る</dt><dd>0キー / コンパス</dd></dl><p>昼・夕・夜は風景の見た目を切り替えます。時計とは独立しているので、好きな景色で時刻表の運行を眺められます。「光の移ろい」は約90秒で昼・夕・夜を巡り、再度押すとその光で止まります。</p><p className="data-note">東京駅の7路線・方向を6本の代表線路で表示しています。発車時刻と運行日にはJR東日本掲載時刻表を使用。番線・車両形式・入線と停車時間は簡略化し、同じ線路の列車が重なる場合は発車直後を優先します。遅延・運休・実際の列車位置には対応していません。</p><p className="data-note">地図データはOpenStreetMap。未登録の建物高や道路幅、駅舎の細部、中央線の高低差などは推定です。</p><p className="source-links"><a href="https://www.tokyostationcity.com/learning/station_building/" target="_blank" rel="noreferrer">駅舎の参考：Tokyo Station City ↗</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">地図データ：OpenStreetMap / ODbL ↗</a></p><div className="render-info">WebGL · Three.js <span>{frame.fps} fps</span></div></Modal>}
    {capture && <Modal title="この風景を持ち帰る" onClose={() => setCapture(null)} wide><img className="captured-scene" src={capture.url} alt="書き出した東京駅周辺の風景" /><a className="download-button" href={capture.url} download={capture.filename}>PNGをダウンロード</a></Modal>}
  </main>;
}
