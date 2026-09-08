import {Vector3} from 'three';

// Translate camera and orbit target together so user orbit/zoom/pan survives tracking.
export class FollowCamera {
  constructor(camera,controls){this.camera=camera;this.controls=controls;this.active=false;this.last=new Vector3();this.delta=new Vector3();}
  start(anchor,now=0,immediate=false){
    this.active=true;this.last.copy(anchor);
    const target=anchor.clone().add(new Vector3(0,1.8,0));
    const position=target.clone().add(new Vector3(-8,80,-24));
    this.transition=immediate?null:{start:now,from:this.camera.position.clone(),targetFrom:this.controls.target.clone(),position,target};
    if(immediate){this.camera.position.copy(position);this.controls.target.copy(target);}
  }
  update(anchor,now){
    if(!this.active)return;
    this.delta.copy(anchor).sub(this.last);this.last.copy(anchor);
    if(this.transition){
      const tr=this.transition;tr.position.add(this.delta);tr.target.add(this.delta);
      const t=Math.max(0,Math.min((now-tr.start)/1100,1)),s=t*t*(3-2*t);
      this.camera.position.lerpVectors(tr.from,tr.position,s);this.controls.target.lerpVectors(tr.targetFrom,tr.target,s);
      if(t===1)this.transition=null;
    }else{this.camera.position.add(this.delta);this.controls.target.add(this.delta);}
  }
  interruptTransition(){this.transition=null;}
  stop(){this.active=false;this.transition=null;}
}
