import React from 'react';

export default function FreeControls({controller}) {
  return <section className="free-pad glass" aria-label="空中の自由移動">
    <small>ドラッグで見回す</small>
    <div>{[['left','左へ平行移動','←'],['forward','画面の中心へ前進','↑'],['up','上昇','上'],['right','右へ平行移動','→'],['back','後退','↓'],['down','下降','下']].map(([action,label,icon])=><button key={action} aria-label={label}
      onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const camera=controller();camera?.setAction(action,true);camera?.update(.1);}}
      onPointerUp={()=>controller()?.setAction(action,false)} onPointerCancel={()=>controller()?.setAction(action,false)} onLostPointerCapture={()=>controller()?.setAction(action,false)}
      onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();const camera=controller();camera?.setAction(action,true);if(!e.repeat)camera?.update(.1);}}}
      onKeyUp={()=>controller()?.setAction(action,false)} onBlur={()=>controller()?.setAction(action,false)}
      onClick={e=>{if(e.detail===0){const camera=controller();camera?.setAction(action,true);camera?.update(.1);camera?.setAction(action,false);}}}>{icon}</button>)}</div>
  </section>;
}
