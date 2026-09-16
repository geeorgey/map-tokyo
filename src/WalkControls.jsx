import React from 'react';

const directions = [['forward','前へ','↑'],['left','左へ','←'],['back','後ろへ','↓'],['right','右へ','→']];

export default function WalkControls({ period, onLight, autoWalking, onAutoWalk, controller, onHome, onSpots, onShare, onBookmark, onExit }) {
  return <section className="walk-panel glass" aria-label="自由散策の操作">
    <div className="walk-heading"><div><span>STREET WALK</span><strong>東京駅を、歩こう。</strong></div><button onClick={onExit}>散策を終える</button></div>
    <p>景色をドラッグして見回す<br /><span>方向ボタンで移動 / 「自動」なら手を離しても前へ</span></p>
    <div className="walk-pad" role="group" aria-label="移動方向">
      {directions.map(([action,label,icon])=><button key={action} className={`walk-${action}`} aria-label={label}
        onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);const walk=controller();walk?.setAction(action,true);walk?.update(.1);}}
        onPointerUp={()=>controller()?.setAction(action,false)} onPointerCancel={()=>controller()?.setAction(action,false)} onLostPointerCapture={()=>controller()?.setAction(action,false)}
        onKeyDown={event=>{if(event.key===' ' || event.key==='Enter'){event.preventDefault();const walk=controller();walk?.setAction(action,true);if(!event.repeat)walk?.update(.1);}}}
        onKeyUp={()=>controller()?.setAction(action,false)} onBlur={()=>controller()?.setAction(action,false)}
        onClick={event=>{if(event.detail===0){const walk=controller();walk?.setAction(action,true);walk?.update(.1);walk?.setAction(action,false);}}}>{icon}</button>)}
      <button className="walk-auto" aria-label={autoWalking ? '自動歩行を止める' : '自動で歩く'} aria-pressed={autoWalking} onClick={onAutoWalk} title="前へ自動で歩きます。ドラッグで向きを変え、もう一度押すと止まります。"><span aria-hidden="true">{autoWalking ? '■' : '▶'}</span><small>{autoWalking ? '停止' : '自動'}</small></button>
    </div>
    <div className="walk-light" role="group" aria-label="散策の光">
      {[['day','昼'],['evening','夕'],['night','夜']].map(([value,label]) => <button key={value} aria-label={`散策の光を${label}に`} aria-pressed={period === value} onClick={() => onLight(value)}>{label}</button>)}
    </div>
    <button className="walk-home" onClick={onHome}>東京駅の正面へ戻る ↗</button>
    <button className="walk-spots" onClick={onSpots} aria-haspopup="dialog">ほかの見どころへ ↗</button>
    <div className="walk-keeps"><button className="walk-share" onClick={onShare} aria-label="景色のリンク ↗" aria-haspopup="dialog">リンク ↗</button><button className="walk-bookmark" onClick={onBookmark} aria-label="景色をしおりに保存" aria-haspopup="dialog">しおり ▱</button></div>
    <small>建物の外を散策できます。駅舎内は今後の更新で。</small>
  </section>;
}
