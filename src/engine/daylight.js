import { Color, Vector3 } from 'three';

export const periods={
  day:{sky:'#b8ccd1',fog:'#b8ccd1',sun:'#fff1d6',sunPower:2.5,ambient:1.3,exposure:.95,position:[-350,600,330],glow:0},
  evening:{sky:'#c9b6ad',fog:'#d1b8a1',sun:'#ffad6f',sunPower:3.6,ambient:1.15,exposure:1.05,position:[-500,155,-180],glow:.65},
  night:{sky:'#182c3e',fog:'#253f51',sun:'#98b6da',sunPower:.65,ambient:.8,exposure:1.1,position:[-180,500,200],glow:2.2},
};

export const periodKeys=['day','evening','night'];
export const periodLabels=['昼','夕','夜'];
const wrap=value=>((value%3)+3)%3;
const smooth=value=>value*value*(3-2*value);
const keys=periodKeys.map(key=>{
  const p=periods[key];
  return {...p,sky:new Color(p.sky),fog:new Color(p.fog),sun:new Color(p.sun),ground:new Color(key==='night'?'#283f46':'#a9bab8'),position:new Vector3(...p.position)};
});

// A scenic 90-second loop, independent of train speed and the real-world clock.
export class Daylight {
  constructor(){
    this.phase=0;this.running=false;this.transition=null;
    this.value={sky:new Color(),fog:new Color(),sun:new Color(),ground:new Color(),position:new Vector3()};
    this.sample();
  }
  select(key,immediate=false){
    const index=periodKeys.indexOf(key);
    if(index<0)return;
    this.running=false;
    const delta=wrap(index-this.phase+1.5)-1.5;
    this.transition=immediate?null:{from:this.phase,to:this.phase+delta,elapsed:0};
    if(immediate){this.phase=index;this.sample();}
  }
  setRunning(running){this.running=running;this.transition=null;}
  update(dt){
    if(this.transition){
      const tr=this.transition;tr.elapsed+=dt;
      const t=Math.min(tr.elapsed/1.8,1);
      this.phase=wrap(tr.from+(tr.to-tr.from)*smooth(t));
      if(t===1)this.transition=null;
    }else if(this.running){this.phase=wrap(this.phase+dt/30);}
    else return false;
    this.sample();return true;
  }
  sample(){
    const index=Math.floor(this.phase),t=smooth(this.phase-index),a=keys[index],b=keys[(index+1)%3],v=this.value;
    for(const key of ['sky','fog','sun','ground'])v[key].copy(a[key]).lerp(b[key],t);
    v.position.copy(a.position).lerp(b.position,t);
    for(const key of ['sunPower','ambient','exposure','glow'])v[key]=a[key]+(b[key]-a[key])*t;
    return v;
  }
  get period(){return periodKeys[Math.round(this.phase)%3];}
  get caption(){const i=Math.floor(this.phase);return `${periodLabels[i]} → ${periodLabels[(i+1)%3]}`;}
}
