import { Euler, Vector3, MathUtils } from 'three';

const keys = { KeyW:'forward', ArrowUp:'forward', KeyS:'back', ArrowDown:'back', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right', KeyE:'up', KeyQ:'down' };

// All motion is relative to the camera, with no fixed city-centre pivot.
export class FreeCamera {
  constructor(camera, canvas, onMove = () => {}) {
    Object.assign(this, { camera, canvas, onMove, active:false, suspended:false });
    this.keys = new Set(); this.actions = new Set(); this.listeners = [];
    const listen = (target, name, handler, options) => { target.addEventListener(name, handler, options); this.listeners.push(() => target.removeEventListener(name, handler, options)); };
    listen(canvas, 'pointerdown', e => {
      if (!this.available || this.pointer) return;
      e.preventDefault(); canvas.focus({preventScroll:true});
      this.pointer = { id:e.pointerId, x:e.clientX, y:e.clientY, pan:e.button !== 0 };
      canvas.setPointerCapture(e.pointerId);
    });
    listen(canvas, 'pointermove', e => {
      if (!this.available || this.pointer?.id !== e.pointerId) return;
      const dx=e.clientX-this.pointer.x, dy=e.clientY-this.pointer.y;
      if (this.pointer.pan) this.translate(0, -dx*this.speed/300, dy*this.speed/300, true);
      else this.look(dx,dy);
      this.pointer.x=e.clientX; this.pointer.y=e.clientY;
    });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) listen(canvas,name,e=>{if(this.pointer?.id===e.pointerId)this.pointer=null;});
    listen(canvas,'contextmenu',e=>{if(this.active)e.preventDefault();});
    listen(canvas,'wheel',e=>{
      if(!this.available)return;
      e.preventDefault();
      const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);
      this.translate(-MathUtils.clamp(pixels,-240,240)*this.speed/200,0,0);
    },{passive:false});
    listen(window,'keydown',e=>{
      if(!this.available || (!keys[e.code] && !e.code.startsWith('Shift')) || e.altKey || e.metaKey || e.ctrlKey || e.target.closest('input,textarea,select,button,a,dialog,[contenteditable]'))return;
      e.preventDefault();this.keys.add(e.code);
    });
    listen(window,'keyup',e=>this.keys.delete(e.code));
    listen(window,'blur',()=>this.clear());
    listen(document,'visibilitychange',()=>{if(document.hidden)this.clear();});
  }
  get available(){return this.active && !this.suspended;}
  get speed(){return MathUtils.clamp(this.camera.position.y*.22,12,180);}
  clear(){this.keys.clear();this.actions.clear();this.pointer=null;}
  start(){this.clear();this.active=true;this.moved=false;}
  stop(){this.clear();this.active=false;}
  setSuspended(value){this.suspended=value;if(value)this.clear();}
  setAction(action,value){if(value && this.available)this.actions.add(action);else this.actions.delete(action);}
  markMove(){if(!this.moved){this.moved=true;this.onMove();}}
  look(dx,dy){
    const euler=new Euler().setFromQuaternion(this.camera.quaternion,'YXZ');
    euler.y-=dx*.004;euler.x=MathUtils.clamp(euler.x-dy*.003,-Math.PI/2+.02,Math.PI/2-.02);
    this.camera.quaternion.setFromEuler(euler);this.markMove();
  }
  translate(forward,side,up,screenUp=false){
    const direction=this.camera.getWorldDirection(new Vector3());
    const right=new Vector3(1,0,0).applyQuaternion(this.camera.quaternion);
    const vertical=screenUp?new Vector3(0,1,0).applyQuaternion(this.camera.quaternion):new Vector3(0,1,0);
    this.camera.position.addScaledVector(direction,forward).addScaledVector(right,side).addScaledVector(vertical,up);
    this.camera.position.clamp(new Vector3(-1800,2.2,-1800),new Vector3(1800,1600,1800));
    this.markMove();
  }
  update(delta){
    if(!this.available)return;
    const actions=new Set([...this.actions,...[...this.keys].map(key=>keys[key])]);
    const f=Number(actions.has('forward'))-Number(actions.has('back'));
    const s=Number(actions.has('right'))-Number(actions.has('left'));
    const u=Number(actions.has('up'))-Number(actions.has('down'));
    if(!f&&!s&&!u)return;
    const boost=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?3:1;
    const step=this.speed*boost*MathUtils.clamp(delta,0,.1)/Math.max(1,Math.hypot(f,s,u));
    this.translate(f*step,s*step,u*step);
  }
  dispose(){this.stop();this.listeners.forEach(remove=>remove());}
}
