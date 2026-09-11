import React from 'react';

const directions = [['forward','前へ','↑'],['left','左へ','←'],['back','後ろへ','↓'],['right','右へ','→']];

export default function WalkControls({ controller, onHome, onExit }) {
  return <section className="walk-panel glass" aria-label="自由散策の操作">
    <div className="walk-heading"><div><span>STREET WALK</span><strong>東京駅を、歩こう。</strong></div><button onClick={onExit}>散策を終える</button></div>
    <p>景色をドラッグして見回す<br /><span>WASD・矢印キー / ボタンを押し続けて移動</span></p>
    <div className="walk-pad" role="group" aria-label="移動方向">
      {directions.map(([action,label,icon])=><button key={action} className={`walk-${action}`} aria-label={label}
        onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);const walk=controller();walk?.setAction(action,true);walk?.update(.1);}}
        onPointerUp={()=>controller()?.setAction(action,false)} onPointerCancel={()=>controller()?.setAction(action,false)} onLostPointerCapture={()=>controller()?.setAction(action,false)}
        onKeyDown={event=>{if(event.key===' ' || event.key==='Enter'){event.preventDefault();const walk=controller();walk?.setAction(action,true);if(!event.repeat)walk?.update(.1);}}}
        onKeyUp={()=>controller()?.setAction(action,false)} onBlur={()=>controller()?.setAction(action,false)}
        onClick={event=>{if(event.detail===0){const walk=controller();walk?.setAction(action,true);walk?.update(.1);walk?.setAction(action,false);}}}>{icon}</button>)}
      <span aria-hidden="true">歩く</span>
    </div>
    <button className="walk-home" onClick={onHome}>東京駅の正面へ戻る ↗</button>
    <small>建物の外を散策できます。駅舎内は今後の更新で。</small>
  </section>;
}
