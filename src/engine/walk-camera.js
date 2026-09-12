import { Euler, Vector3 } from 'three';

export const WALK_START = [-115, 2.2, 35];
const EYE_HEIGHT = 2.2;
const SPEED = 13;
const KEY_ACTIONS = { KeyW:'forward', ArrowUp:'forward', KeyS:'back', ArrowDown:'back', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function insideRing(ring, x, z) {
  let inside = false;
  for (let i=0,j=ring.length-1; i<ring.length; j=i++) {
    const [ax,az]=ring[i], [bx,bz]=ring[j];
    if ((az>z)!==(bz>z) && x<(bx-ax)*(z-az)/(bz-az)+ax) inside=!inside;
  }
  return inside;
}

// Ground-level obstacles use the same footprints as the rendered city.
// Station and railway limits are conservative: indoor exploration comes later.
export function createWalkBoundary(map) {
  const polygons = map.buildings.filter(b => (b.base || 0) < EYE_HEIGHT).flatMap(b => b.shape);
  polygons.push(...map.surfaces.water);
  const obstacles = polygons.map(p => ({ ...p,
    minX:Math.min(...p.outer.map(v=>v[0]))-1, maxX:Math.max(...p.outer.map(v=>v[0]))+1,
    minZ:Math.min(...p.outer.map(v=>v[1]))-1, maxZ:Math.max(...p.outer.map(v=>v[1]))+1,
  }));
  return (x,z) => {
    if (x < -725 || x > 705 || z < -835 || z > 845) return false;
    if (x > -83 && x < 185 && Math.abs(z) < 225) return false;
    for(const [tx,tz,scale] of map.trees || []) if(Math.hypot(x-tx,z-tz)<.6*scale+1)return false;
    for (const p of obstacles) {
      if (x<p.minX || x>p.maxX || z<p.minZ || z>p.maxZ) continue;
      for (const [dx,dz] of [[0,0],[.8,0],[-.8,0],[0,.8],[0,-.8]]) {
        if (insideRing(p.outer,x+dx,z+dz) && !(p.holes||[]).some(r=>insideRing(r,x+dx,z+dz))) return false;
      }
    }
    return true;
  };
}

export function walkStep(position, yaw, forward, side, seconds, canEnter = () => true) {
  const length = Math.max(1, Math.hypot(forward,side));
  const distance = SPEED * clamp(seconds,0,.1) / length;
  const dx = (-Math.sin(yaw)*forward + Math.cos(yaw)*side)*distance;
  const dz = (-Math.cos(yaw)*forward - Math.sin(yaw)*side)*distance;
  // Short substeps keep low-frame-rate input from crossing narrow walls.
  const steps = Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
  const next = [...position];
  for(let i=0;i<steps;i++) {
    if(canEnter(next[0]+dx/steps,next[2])) next[0]+=dx/steps;
    if(canEnter(next[0],next[2]+dz/steps)) next[2]+=dz/steps;
  }
  next[1]=EYE_HEIGHT;
  return next;
}

export class WalkCamera {
  constructor(camera, canvas, canEnter, onMove = () => {}) {
    this.camera=camera; this.canvas=canvas; this.canEnter=canEnter; this.onMove=onMove;
    this.active=false; this.suspended=false; this.keys=new Set(); this.actions=new Set();
    this.euler=new Euler(0,0,0,'YXZ'); this.direction=new Vector3();
    this.down=e=>{
      if(!this.active || this.suspended || e.button!==0 || this.pointer) return;
      e.preventDefault(); canvas.focus({preventScroll:true});
      this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId);
    };
    this.move=e=>{
      if(!this.active || this.suspended || this.pointer?.id!==e.pointerId) return;
      this.yaw-=(e.clientX-this.pointer.x)*.004;
      this.pitch=clamp(this.pitch-(e.clientY-this.pointer.y)*.003,-1.1,1.1);
      this.pointer.x=e.clientX; this.pointer.y=e.clientY; this.orient();
    };
    this.up=e=>{if(this.pointer?.id===e.pointerId)this.pointer=null;};
    this.keyDown=e=>{
      if(!this.active || this.suspended || !KEY_ACTIONS[e.code] || e.altKey || e.metaKey || e.ctrlKey || e.target.closest('input,textarea,select,button,a,dialog,[contenteditable]'))return;
      e.preventDefault(); this.keys.add(e.code);
    };
    this.keyUp=e=>this.keys.delete(e.code);
    this.clear=()=>{this.keys.clear();this.actions.clear();this.pointer=null;};
    this.visibility=()=>{if(document.hidden)this.clear();};
    canvas.addEventListener('pointerdown',this.down);
    canvas.addEventListener('pointermove',this.move);
    canvas.addEventListener('pointerup',this.up);
    canvas.addEventListener('pointercancel',this.up);
    canvas.addEventListener('lostpointercapture',this.up);
    window.addEventListener('keydown',this.keyDown);
    window.addEventListener('keyup',this.keyUp);
    window.addEventListener('blur',this.clear);
    document.addEventListener('visibilitychange',this.visibility);
  }
  start() {this.active=true;this.moved=false;this.home();}
  home() {this.clear();this.spotId=null;this.camera.position.fromArray(WALK_START);this.yaw=-Math.PI/2;this.pitch=.09;this.orient();}
  visit(position,target) {
    if(!this.active || !position.every(Number.isFinite) || !target.every(Number.isFinite) || !this.canEnter(position[0],position[2]))return false;
    this.clear();this.camera.position.set(position[0],EYE_HEIGHT,position[2]);
    const dx=target[0]-position[0],dz=target[2]-position[2];
    this.yaw=Math.atan2(-dx,-dz);this.pitch=clamp(Math.atan2(target[1]-EYE_HEIGHT,Math.hypot(dx,dz)),-1.1,1.1);
    this.moved=false;this.orient();return true;
  }
  stop() {this.active=false;this.clear();}
  setSuspended(value) {this.suspended=value;if(value)this.clear();}
  setAction(action, pressed) {if(pressed && this.active && !this.suspended)this.actions.add(action);else this.actions.delete(action);}
  orient() {this.euler.set(this.pitch,this.yaw,0,'YXZ');this.camera.quaternion.setFromEuler(this.euler);}
  update(delta) {
    if(!this.active || this.suspended)return;
    const pressed=new Set([...this.actions,...[...this.keys].map(key=>KEY_ACTIONS[key])]);
    const forward=Number(pressed.has('forward'))-Number(pressed.has('back'));
    const side=Number(pressed.has('right'))-Number(pressed.has('left'));
    if(forward || side) {
      const previous=this.camera.position.toArray();
      this.camera.position.fromArray(walkStep(previous,this.yaw,forward,side,delta,this.canEnter));
      if(!this.moved && this.camera.position.distanceToSquared(new Vector3(...previous))>.0001){this.moved=true;this.onMove();}
    }
    this.orient();
  }
  dispose() {
    this.stop();
    for(const [name,handler] of [['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.up],['lostpointercapture',this.up]])this.canvas.removeEventListener(name,handler);
    window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.clear);document.removeEventListener('visibilitychange',this.visibility);
  }
}
