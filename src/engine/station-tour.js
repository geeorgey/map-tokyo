export const TOUR_STOPS = [
  { view:1, title:'赤レンガの丸の内駅舎', caption:'南北に続く駅舎と、正面の広場。' },
  { view:2, title:'ホームを行き交う列車', caption:'発車は選んだ日時の時刻表に合わせて。' },
  { view:3, title:'東京駅を囲む街並み', caption:'ここからは、気になる方向へ自由に。' },
];
export const TOUR_STOP_SECONDS = 8;

// Camera-only tour: it must never seek, pause or otherwise change the train clock.
export class StationTour {
  constructor(onStep, onChange = () => {}) {
    this.onStep=onStep;this.onChange=onChange;this.active=false;this.elapsed=0;this.step=0;
  }
  get snapshot(){return {active:this.active,step:this.step,elapsed:this.elapsed,total:TOUR_STOPS.length*TOUR_STOP_SECONDS};}
  start(){
    if(this.active)return;
    this.active=true;this.elapsed=0;this.step=0;
    this.onStep(TOUR_STOPS[0].view);this.onChange({...this.snapshot,reason:'start'});
  }
  stop(reason='manual'){
    if(!this.active)return;
    this.active=false;this.onChange({...this.snapshot,reason});
  }
  update(seconds){
    if(!this.active || !Number.isFinite(seconds) || seconds<=0)return;
    this.elapsed=Math.min(this.snapshot.total,this.elapsed+Math.min(seconds,.1));
    if(this.elapsed>=this.snapshot.total-1e-8){this.elapsed=this.snapshot.total;this.stop('complete');return;}
    const step=Math.min(TOUR_STOPS.length-1,Math.floor((this.elapsed+1e-8)/TOUR_STOP_SECONDS));
    if(step!==this.step){this.step=step;this.onStep(TOUR_STOPS[step].view);this.onChange({...this.snapshot,reason:'step'});}
  }
}
