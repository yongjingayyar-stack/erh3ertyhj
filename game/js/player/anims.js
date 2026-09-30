// ============ player/anims.js — modular procedural combat animation library ============
// Each anim: { dur, loop?, onApply(rig,t,u), rootMotion?(u)->{f,s,y} }
// rig = knight bone refs. u = normalized time 0..1, t = seconds elapsed.
import { clamp, lerp, easeOutCubic, easeInQuad } from '../core/mathx.js';
const easeInOutCubic=x=>x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const easeInOutSine=x=>-(Math.cos(Math.PI*x)-1)/2;

const S=Math.sin, C=Math.cos, PI=Math.PI;
// smooth pulse helper: rises then falls over u with peak shape
const bell=(u,w=1)=>S(clamp(u,0,1)*PI)**w;

export const Anims = {};

// ---------- FULL-BODY POSE TRACKER ----------
// Every clip declares its motion as a COMPLETE body pose (torso twist/lean, hip
// height, both legs, both arms, head, weapon) through this tracker instead of
// touching bones ad hoc. Bones not mentioned in a keyframe stay at their
// previous value, and the hips Y is always written so clips can't fight over it.
let _pt=null, _pk={};
export function beginPose(rig){ _pt=rig; _pk={}; }
export function P(h){ // h = {hipsY, hipsRY, spineRX, spineRY, neckRX/Y, armR:{shx,shz,elx}, armL:{...}, legL:{hipx,knee}, legR:{...}, wRx,wRz}
  if(!_pt)return; const r=_pt, k=h;
  if(k.hipsY!==undefined) r.hips.position.y=k.hipsY;
  if(k.hipsRY!==undefined) r.hips.rotation.y=k.hipsRY;
  if(k.spineRX!==undefined||k.spineRY!==undefined||k.spineRZ!==undefined){
    r.spine.rotation.set(k.spineRX??r.spine.rotation.x, k.spineRY??r.spine.rotation.y, k.spineRZ??r.spine.rotation.z);
  }
  if(k.neckRX!==undefined||k.neckRY!==undefined) r.neck.rotation.set(k.neckRX??r.neck.rotation.x, k.neckRY??r.neck.rotation.y, 0);
  if(k.armR) r.armR.sh.rotation.set(k.armR.shx??r.armR.sh.rotation.x, r.armR.sh.rotation.y, k.armR.shz??r.armR.sh.rotation.z),
             k.armR.elx!==undefined&&(r.armR.el.rotation.x=k.armR.elx);
  if(k.armL) r.armL.sh.rotation.set(k.armL.shx??r.armL.sh.rotation.x, r.armL.sh.rotation.y, k.armL.shz??r.armL.sh.rotation.z),
             k.armL.elx!==undefined&&(r.armL.el.rotation.x=k.armL.elx);
  if(k.legL) (k.legL.hipx!==undefined&&(r.legL.hip.rotation.x=k.legL.hipx)), (k.legL.knee!==undefined&&(r.legL.knee.rotation.x=k.legL.knee));
  if(k.legR) (k.legR.hipx!==undefined&&(r.legR.hip.rotation.x=k.legR.hipx)), (k.legR.knee!==undefined&&(r.legR.knee.rotation.x=k.legR.knee));
  if(k.wRx!==undefined||k.wRz!==undefined) r.weapon.rotation.set(k.wRx??r.weapon.rotation.x, r.weapon.rotation.y, k.wRz??r.weapon.rotation.z);
}

// ---------- LOCOMOTION ----------
Anims.idle={dur:2.4,loop:true,onApply(rig,t){
  beginPose(rig);
  const b=S(t*2.1);
  P({hipsY:1.0+b*0.02, spineRX:0.04+b*0.02, neckRX:-b*0.03,
     armR:{shx:0.06-b*0.05, shz:-0.12, elx:-0.3}, armL:{shx:0.06+b*0.05, shz:0.12, elx:-0.25},
     legL:{hipx:0.02, knee:-0.05}, legR:{hipx:-0.02, knee:-0.05}, wRx:-0.2, wRz:0.1});
}};

Anims.walk={dur:0.9,loop:true,onApply(rig,t,u,speed=1){
  beginPose(rig);
  const w=t*(6.5*speed);
  P({hipsY:1.0+Math.abs(S(w))*0.06, spineRX:0.08, spineRY:S(w)*0.08,
     legL:{hipx:S(w)*0.55, knee:-Math.max(0,S(w+PI*0.4))*0.8-0.05},
     legR:{hipx:S(w+PI)*0.55, knee:-Math.max(0,S(w+PI+PI*0.4))*0.8-0.05},
     armR:{shx:S(w)*0.4, shz:-0.1, elx:-0.5}, armL:{shx:S(w+PI)*0.4, shz:0.1, elx:-0.35},
     wRx:-0.3, wRz:0.15});
  rig.hips.rotation.z=S(w)*0.05;
}};

Anims.run={dur:0.66,loop:true,onApply(rig,t,u,speed=1){
  beginPose(rig);
  const w=t*(9*speed);
  P({hipsY:1.0+Math.abs(S(w))*0.1, spineRX:0.22, spineRY:S(w)*0.14,
     legL:{hipx:S(w)*0.9, knee:-Math.max(0,S(w+PI*0.35))*1.3-0.1},
     legR:{hipx:S(w+PI)*0.9, knee:-Math.max(0,S(w+PI+PI*0.35))*1.3-0.1},
     armR:{shx:S(w)*0.75, shz:-0.15, elx:-0.9}, armL:{shx:S(w+PI)*0.75, shz:0.15, elx:-0.7},
     wRx:-0.5, wRz:0.35});
  rig.hips.rotation.z=S(w)*0.08;
}};

Anims.crouch={dur:1,loop:true,onApply(rig,t){
  beginPose(rig);
  const b=S(t*2.4)*0.02;
  P({hipsY:0.62+b, spineRX:0.5, neckRX:-0.4,
     armR:{shx:-0.2, elx:-1.4}, armL:{shx:-0.4, elx:-1.2},
     legL:{hipx:-1.1, knee:1.5}, legR:{hipx:-1.1, knee:1.5}, wRx:-1.2, wRz:0.2});
}};

Anims.jump={dur:1,loop:true,onApply(rig,t,u,vy=0){
  beginPose(rig);
  const rise=clamp(vy/8,-1,1);
  if(rise>0){ // ascending: tucked
    P({hipsY:1.0, spineRX:-0.1,
       legL:{hipx:-0.7, knee:1.2}, legR:{hipx:-0.4, knee:0.9},
       armR:{shx:-1.2}, armL:{shx:-1.4}});
  } else { // falling: spread for landing
    P({hipsY:1.0, spineRX:0.15,
       legL:{hipx:0.5, knee:0.4}, legR:{hipx:0.3, knee:0.6},
       armR:{shx:-2.0, elx:-0.4}, armL:{shx:-2.2, elx:-0.3}, wRx:-0.8, wRz:0.6});
  }
}};

Anims.land={dur:0.28,onApply(rig,t,u){
  beginPose(rig);
  const c=S(u*PI); // squat absorb then stand
  P({hipsY:1.0-c*0.3, spineRX:c*0.6,
     legL:{hipx:-c*0.9, knee:c*1.4}, legR:{hipx:-c*0.9, knee:c*1.4},
     armR:{shx:c*0.4}, armL:{shx:c*0.5}, wRx:-0.4, wRz:0.2});
}};

Anims.dash={dur:0.34,onApply(rig,t,u){
  beginPose(rig);
  // horizontal lunge, blade trailing, body low & twisted
  const e=easeOutCubic(clamp(u*1.6,0,1));
  P({hipsY:1.0-bell(u,1)*0.18, hipsRY:0.3*(1-e), spineRX:0.7*e, spineRY:lerp(-0.5,0,easeInOutSine(clamp(u/0.55,0,1))),
     armR:{shx:lerp(-2.4,-0.4,e), shz:lerp(0.6,0.1,e), elx:lerp(0.4,-0.2,e)},
     armL:{shx:lerp(0.6,-1.6,e), elx:-0.8},
     legL:{hipx:lerp(0.9,-0.3,e), knee:lerp(0.9,0.3,e)},
     legR:{hipx:lerp(-0.6,0.7,e), knee:lerp(1.2,0.4,e)},
     wRx:lerp(1.2,-0.3,e), wRz:0.5});
} ,rootMotion(u){ const v=bell(u,0.75); return {f:v*1.0,s:0,y:0}; } };

// ---------- LIGHT COMBO (5-hit string) ----------
// Motion philosophy (mirrors the parry clip): every strike is a WHOLE-BODY move —
// weight loads onto one leg, hip height sinks/rises, torso coils and unwinds,
// off-arm counterbalances, head follows through. No arm-only flapping.
const GUARD={shx:-0.25,shz:-0.15,elx:-0.9,wrx:-0.4,wrz:0.4}; // sword resting guard pose

Anims.light1={dur:0.42,onApply(rig,t,u){
  beginPose(rig);
  // diagonal overhead right-to-left cut: coil → release → settle
  if(u<0.32){ const k=easeInOutCubic(u/0.32); // COIL: raise blade over shoulder, sink weight onto rear leg
    P({hipsY:1.0-k*0.06, hipsRY:k*0.14, spineRX:lerp(0.04,0.12,k), spineRY:k*0.22, neckRX:-k*0.08,
       armR:{shx:lerp(GUARD.shx,0.85,k), shz:lerp(GUARD.shz,-0.75,k), elx:lerp(GUARD.elx,-1.15,k)},
       armL:{shx:lerp(-0.3,-0.7,k), shz:0.35, elx:-1.0},
       legR:{hipx:-k*0.22, knee:k*0.35}, legL:{hipx:k*0.1},
       wRx:lerp(GUARD.wrx,-0.55,k), wRz:lerp(GUARD.wrz,0.95,k)});
  } else if(u<0.5){ const k=easeOutCubic((u-0.32)/0.18); // STRIKE: fast single sweep through
    P({hipsY:lerp(0.94,1.02,k), hipsRY:lerp(0.14,-0.12,k), spineRX:lerp(0.12,0.3,k), spineRY:lerp(0.22,-0.15,k), neckRX:lerp(-0.08,0.12,k),
       armR:{shx:lerp(0.85,-1.05,k), shz:lerp(-0.75,0.5,k), elx:lerp(-1.15,-0.15,k)},
       armL:{shx:lerp(-0.7,-0.15,k), shz:0.35, elx:-1.0},
       legR:{hipx:lerp(-0.22,0.3,k), knee:lerp(0.35,0.05,k)}, legL:{hipx:lerp(0.1,-0.15,k)},
       wRx:lerp(-0.55,0.75,k), wRz:lerp(0.95,-0.55,k)});
  } else { const k=easeInOutCubic((u-0.5)/0.5); // SETTLE: flow back into guard
    P({hipsY:lerp(1.02,1.0,k), hipsRY:lerp(-0.12,0,k), spineRX:lerp(0.3,0.04,k), spineRY:lerp(-0.15,0,k), neckRX:lerp(0.12,0,k),
       armR:{shx:lerp(-1.05,GUARD.shx,k), shz:lerp(0.5,GUARD.shz,k), elx:lerp(-0.15,GUARD.elx,k)},
       armL:{shx:lerp(-0.15,-0.3,k), shz:0.35, elx:-1.0},
       legR:{hipx:lerp(0.3,0,k), knee:lerp(0.05,0,k)}, legL:{hipx:lerp(-0.15,0,k)},
       wRx:lerp(0.75,GUARD.wrx,k), wRz:lerp(-0.55,GUARD.wrz,k)});
  }
},hitAt:0.44, arc:{tilt:-0.4,roll:0.5,color:0xf0d27a}, rootMotion(u){return{f:bell(clamp((u-0.3)/0.38,0,1),1)*0.22,s:0,y:0};}};

Anims.light2={dur:0.40,onApply(rig,t,u){
  beginPose(rig);
  // horizontal backhand→forehand sweep: shoulder-pivot twist
  if(u<0.3){ const k=easeInOutCubic(u/0.3); // WIND: blade pulled out wide to the left, torso coils
    P({hipsY:1.0-k*0.04, hipsRY:-k*0.16, spineRX:lerp(0.04,0.1,k), spineRY:-k*0.25, neckRY:-k*0.12,
       armR:{shx:lerp(GUARD.shx,0.35,k), shz:lerp(GUARD.shz,1.0,k), elx:lerp(GUARD.elx,-0.55,k)},
       armL:{shx:lerp(-0.3,-0.8,k), elx:-0.9},
       legL:{hipx:-k*0.18, knee:k*0.3}, legR:{hipx:0},
       wRx:lerp(GUARD.wrx,0.15,k), wRz:lerp(GUARD.wrz,1.35,k)});
  } else if(u<0.5){ const k=easeOutCubic((u-0.3)/0.2); // SWEEP: fast pivot across the body
    P({hipsY:lerp(0.96,1.02,k), hipsRY:lerp(-0.16,0.2,k), spineRX:lerp(0.1,0.22,k), spineRY:lerp(-0.25,0.3,k), neckRY:lerp(-0.12,0.15,k),
       armR:{shx:lerp(0.35,-0.5,k), shz:lerp(1.0,-0.7,k), elx:lerp(-0.55,-0.2,k)},
       armL:{shx:lerp(-0.8,-0.05,k), elx:-0.9},
       legL:{hipx:lerp(-0.18,0.25,k), knee:lerp(0.3,0.05,k)}, legR:{hipx:k*0.15},
       wRx:lerp(0.15,0.5,k), wRz:lerp(1.35,-0.9,k)});
  } else { const k=easeInOutCubic((u-0.5)/0.5); // RECOVER
    P({hipsY:lerp(1.02,1.0,k), hipsRY:lerp(0.2,0,k), spineRX:lerp(0.22,0.04,k), spineRY:lerp(0.3,0,k), neckRY:lerp(0.15,0,k),
       armR:{shx:lerp(-0.5,GUARD.shx,k), shz:lerp(-0.7,GUARD.shz,k), elx:lerp(-0.2,GUARD.elx,k)},
       armL:{shx:lerp(-0.05,-0.3,k), elx:-0.9},
       legL:{hipx:lerp(0.25,0,k), knee:lerp(0.05,0,k)}, legR:{hipx:lerp(0.15,0,k)},
       wRx:lerp(0.5,GUARD.wrx,k), wRz:lerp(-0.9,GUARD.wrz,k)});
  }
},hitAt:0.42, arc:{tilt:1.4,roll:-0.3,color:0xf0d27a}, rootMotion(u){return{f:bell(clamp((u-0.24)/0.4,0,1),1)*0.24,s:0,y:0};}};

Anims.light3={dur:0.46,onApply(rig,t,u){
  beginPose(rig);
  // rising uppercut launcher: deep sink, whole body extends up
  if(u<0.34){ const k=easeInOutCubic(u/0.34); // SINK: compress into a half-crouch, blade drops behind hip
    P({hipsY:1.0-k*0.22, spineRX:lerp(0.04,0.35,k), neckRX:k*0.15,
       armR:{shx:lerp(GUARD.shx,1.05,k), elx:lerp(GUARD.elx,-1.5,k)},
       armL:{shx:lerp(-0.3,-0.9,k)},
       legL:{hipx:-k*0.4, knee:k*0.6}, legR:{hipx:-k*0.35, knee:k*0.55},
       wRx:lerp(GUARD.wrx,1.3,k), wRz:lerp(GUARD.wrz,0.5,k)});
  } else if(u<0.55){ const k=easeOutCubic((u-0.34)/0.21); // LAUNCH: legs snap straight, hips rise, blade rockets up
    P({hipsY:lerp(0.78,1.22,k), spineRX:lerp(0.35,-0.25,k), neckRX:lerp(0.15,-0.25,k),
       armR:{shx:lerp(1.05,-2.0,k), elx:lerp(-1.5,-0.2,k)},
       armL:{shx:lerp(-0.9,-1.7,k)},
       legL:{hipx:lerp(-0.4,0.2,k), knee:lerp(0.6,0.05,k)}, legR:{hipx:lerp(-0.35,0.25,k), knee:lerp(0.55,0.05,k)},
       wRx:lerp(1.3,-1.1,k), wRz:lerp(0.5,0.15,k)});
  } else { const k=easeInOutCubic((u-0.55)/0.45); // DROP BACK into guard
    P({hipsY:lerp(1.22,1.0,k), spineRX:lerp(-0.25,0.04,k), neckRX:lerp(-0.25,0,k),
       armR:{shx:lerp(-2.0,GUARD.shx,k), elx:lerp(-0.2,GUARD.elx,k)},
       armL:{shx:lerp(-1.7,-0.3,k)},
       legL:{hipx:lerp(0.2,0,k), knee:lerp(0.05,0,k)}, legR:{hipx:lerp(0.25,0,k), knee:lerp(0.05,0,k)},
       wRx:lerp(-1.1,GUARD.wrx,k), wRz:lerp(0.15,GUARD.wrz,k)});
  }
},hitAt:0.45, arc:{tilt:-1.9,roll:0.2,color:0xffe9b0,lift:true}, rootMotion(u){return{f:bell(clamp((u-0.3)/0.32,0,1),1)*0.2,s:0,y:0};}};

Anims.light4={dur:0.38,onApply(rig,t,u){
  beginPose(rig);
  // cross-slash figure-8: arms trace the 8, body rocks side-to-side, rises onto ball of foot
  const k=easeInOutSine(clamp(u/0.62,0,1));
  const a=k*PI*2;
  P({hipsY:1.0+bell(u,2)*0.1, hipsRY:-0.25+S(a)*0.2, spineRY:S(a)*0.25, spineRZ:S(a)*0.12, neckRY:S(a)*0.15,
     armR:{shx:-0.2+S(a)*1.1, shz:C(a)*0.85-0.15, elx:-0.6-S(a)*0.3},
     armL:{shx:-0.3, shz:0.5+S(a)*0.35, elx:-0.8},
     legL:{hipx:0.35*bell(clamp((u-0.25)/0.5,0,1),1), knee:-0.45*bell(clamp((u-0.25)/0.5,0,1),1)},
     legR:{hipx:-0.12*bell(u,1)},
     wRx:C(a)*0.9-0.3, wRz:S(a)*0.8});
},hitAt:0.35, arc:{tilt:0.9,roll:1.2,color:0xf0d27a}, rootMotion(u){return{f:bell(clamp((u-0.15)/0.55,0,1),1)*0.22,s:0,y:0};}};

Anims.light5={dur:0.72,onApply(rig,t,u){
  beginPose(rig);
  // finisher: two-handed overhead slam — RISE then CRASH
  if(u<0.4){ const k=easeInOutCubic(u/0.4); // RAISE: blade overhead, back arches, heels lighten
    P({hipsY:1.0+k*0.12, spineRX:lerp(0.04,-0.4,k), neckRX:-k*0.2,
       armR:{shx:lerp(GUARD.shx,-2.6,k), shz:lerp(GUARD.shz,-0.3,k), elx:lerp(GUARD.elx,-0.35,k)},
       armL:{shx:lerp(-0.3,-2.4,k), elx:lerp(-0.8,-0.5,k)},
       legR:{hipx:-k*0.15, knee:k*0.25},
       wRx:lerp(GUARD.wrx,-2.6,k), wRz:0.15});
  } else if(u<0.58){ const k=easeOutCubic((u-0.4)/0.18); // SLAM: everything crashes down together
    P({hipsY:lerp(1.12,0.88,k), spineRX:lerp(-0.4,0.5,k), neckRX:lerp(-0.2,0.25,k),
       armR:{shx:lerp(-2.6,-1.15,k), elx:lerp(-0.35,-0.1,k)},
       armL:{shx:lerp(-2.4,-1.2,k)},
       legL:{hipx:k*0.35, knee:k*0.55}, legR:{hipx:lerp(-0.15,0.2,k), knee:lerp(0.25,0.7,k)},
       wRx:lerp(-2.6,-1.0,k), wRz:0.1});
  } else { const k=easeInOutCubic((u-0.58)/0.42); // RISE out of the impact pose back to guard
    P({hipsY:lerp(0.88,1.0,k), spineRX:lerp(0.5,0.04,k), neckRX:lerp(0.25,0,k),
       armR:{shx:lerp(-1.15,GUARD.shx,k), elx:lerp(-0.1,GUARD.elx,k)},
       armL:{shx:lerp(-1.2,-0.3,k), elx:lerp(-0.5,-0.8,k)},
       legL:{hipx:lerp(0.35,0,k), knee:lerp(0.55,0,k)}, legR:{hipx:lerp(0.2,0,k), knee:lerp(0.7,0,k)},
       wRx:lerp(-1.0,GUARD.wrx,k), wRz:GUARD.wrz});
  }
},hitAt:0.5, arc:{tilt:0.05,roll:0,color:0xfff2a8,big:true}, rootMotion(u){return{f:bell(clamp((u-0.32)/0.36,0,1),1)*0.35,s:0,y:0};}};

// ---------- HEAVY ----------
Anims.heavy={dur:0.86,onApply(rig,t,u){
  beginPose(rig);
  // slow draw-back → committed cleave with a full stride-through lunge
  if(u<0.5){ const k=easeInOutCubic(u/0.5); // DRAW-BACK: sink onto rear leg, blade cocked back over shoulder
    P({hipsY:1.0-k*0.12, hipsRY:-k*0.2, spineRX:lerp(0.04,0.22,k), spineRY:-k*0.3, neckRY:-k*0.15,
       armR:{shx:lerp(GUARD.shx,0.6,k), shz:lerp(GUARD.shz,-0.9,k), elx:lerp(GUARD.elx,-1.3,k)},
       armL:{shx:lerp(-0.3,-0.85,k), elx:-1.0},
       legR:{hipx:-k*0.35, knee:k*0.6}, legL:{hipx:k*0.12},
       wRx:lerp(GUARD.wrx,-0.15,k), wRz:lerp(GUARD.wrz,1.5,k)});
  } else if(u<0.64){ const k=easeOutCubic((u-0.5)/0.14); // RELEASE: spring unloads — lunge through the cleave
    P({hipsY:lerp(0.88,1.06,k), hipsRY:lerp(-0.2,0.18,k), spineRX:lerp(0.22,0.35,k), spineRY:lerp(-0.3,0.25,k), neckRY:lerp(-0.15,0.2,k),
       armR:{shx:lerp(0.6,-1.0,k), shz:lerp(-0.9,0.55,k), elx:lerp(-1.3,-0.15,k)},
       armL:{shx:lerp(-0.85,0.35,k), elx:-1.0},
       legR:{hipx:lerp(-0.35,0.45,k), knee:lerp(0.6,0.1,k)}, legL:{hipx:lerp(0.12,-0.25,k)},
       wRx:lerp(-0.15,0.85,k), wRz:lerp(1.5,-0.8,k)});
  } else { const k=easeInOutCubic((u-0.64)/0.36); // FOLLOW-THROUGH settle
    P({hipsY:lerp(1.06,1.0,k), hipsRY:lerp(0.18,0,k), spineRX:lerp(0.35,0.04,k), spineRY:lerp(0.25,0,k), neckRY:lerp(0.2,0,k),
       armR:{shx:lerp(-1.0,GUARD.shx,k), shz:lerp(0.55,GUARD.shz,k), elx:lerp(-0.15,GUARD.elx,k)},
       armL:{shx:lerp(0.35,-0.3,k), elx:lerp(-1.0,-0.8,k)},
       legR:{hipx:lerp(0.45,0,k), knee:lerp(0.1,0,k)}, legL:{hipx:lerp(-0.25,0,k)},
       wRx:lerp(0.85,GUARD.wrx,k), wRz:lerp(-0.8,GUARD.wrz,k)});
  }
},hitAt:0.56, arc:{tilt:0.3,roll:-0.8,color:0xff8a30,big:true}, heavy:true, rootMotion(u){return{f:bell(clamp((u-0.42)/0.34,0,1),1)*0.5,s:0,y:0};}};

// ---------- PARRY / BLOCK ----------
Anims.blockIdle={dur:1,loop:true,onApply(rig,t){
  beginPose(rig);
  const b=S(t*2.6)*0.03;
  P({hipsY:0.95+b, hipsRY:-0.2, spineRX:0.18, spineRY:-0.35,
     armL:{shx:-0.9, shz:0.7, elx:-1.3},           // shield raised front
     armR:{shx:-0.1, shz:-0.5, elx:-1.5},          // sword tucked behind shield
     legL:{hipx:-0.25, knee:0.5}, legR:{hipx:0.3, knee:0.4},
     wRx:-0.6, wRz:1.0});
}};

Anims.parry={dur:0.4,onApply(rig,t,u){
  beginPose(rig);
  // sharp vertical shield bash/gate slam (fast ease-in, not a hard cut)
  const k=easeOutCubic(clamp(u/0.3,0,1));
  P({hipsY:lerp(0.95,0.9,k), hipsRY:lerp(-0.2,0.3,k), spineRX:0.1, spineRY:lerp(-0.35,0.5,k), neckRX:lerp(0,0.12,k),
     armL:{shx:lerp(-0.9,-1.9,k), shz:lerp(0.7,0.2,k), elx:lerp(-1.3,-0.3,k)},
     armR:{shx:-0.2, elx:-1.4},
     legL:{hipx:lerp(-0.25,-0.45,k), knee:lerp(0.5,0.75,k)},
     legR:{hipx:lerp(0.3,0.5,k), knee:lerp(0.4,0.65,k)},
     wRx:-0.5, wRz:0.9});
  if(u>0.3){ const r=easeInOutCubic((u-0.3)/0.7);
    P({hipsY:lerp(0.9,0.95,r), hipsRY:lerp(0.3,-0.2,r), spineRY:lerp(0.5,-0.3,r), neckRX:lerp(0.12,0,r),
       armL:{shx:lerp(-1.9,-0.9,r), shz:lerp(0.2,0.7,r), elx:lerp(-0.3,-1.3,r)},
       legL:{hipx:lerp(-0.45,-0.25,r), knee:lerp(0.75,0.5,r)},
       legR:{hipx:lerp(0.5,0.3,r), knee:lerp(0.65,0.4,r)}});
  }
},parryWindow:[0.05,0.3]};

Anims.hitReact={dur:0.3,onApply(rig,t,u){
  beginPose(rig);
  const b=bell(u,1);
  P({hipsY:1.0-b*0.1, spineRX:-0.5*b, spineRY:0.3*b,
     armR:{shx:0.6*b}, armL:{shx:0.5*b}});
  rig.head.rotation.x=0.4*b;
}};

Anims.death={dur:1.4,onApply(rig,t,u){
  beginPose(rig);
  const k=easeOutCubic(clamp(u*1.3,0,1));
  P({hipsY:lerp(1.0,0.25,k), spineRX:lerp(0,1.35,k),
     armR:{shx:lerp(0,-1.6,k), shz:-0.9}, armL:{shx:lerp(0,-2.2,k), shz:0.8},
     legL:{hipx:lerp(0,-0.6,k), knee:lerp(0,1.2,k)}, legR:{hipx:lerp(0,0.4,k)},
     wRx:0.4, wRz:1.4});
  rig.head.rotation.x=0.5;
}};

// ---------- ULTIMATE: CURSE RELEASE ----------
Anims.ult={dur:2.4,onApply(rig,t,u){
  beginPose(rig);
  if(u<0.22){ const k=easeInOutCubic(u/0.22); // crouch channel, curse aura gathers
    P({hipsY:lerp(1.0,0.7,k), spineRX:lerp(0,0.8,k),
       armR:{shx:lerp(0,1.4,k), elx:lerp(-0.3,-1.8,k)},
       armL:{shx:lerp(0,1.2,k), elx:lerp(-0.3,-1.6,k)},
       legL:{hipx:-0.3, knee:0.6}, legR:{hipx:-0.2, knee:0.5},
       wRx:lerp(-0.3,2.2,k), wRz:0.3});
    rig.head.rotation.x=-0.5*k;
  } else if(u<0.32){ const k=easeInQuad((u-0.22)/0.1); // erupt upright
    P({hipsY:lerp(0.7,1.35,k), spineRX:lerp(0.8,-0.7,k),
       armR:{shx:lerp(1.4,-2.8,k), elx:lerp(-1.8,-0.1,k)},
       armL:{shx:lerp(1.2,-2.6,k)},
       legL:{hipx:-0.3, knee:0.6}, legR:{hipx:-0.2, knee:0.5},
       wRx:lerp(2.2,-1.6,k), wRz:0.2});
  } else if(u<0.45){ const k=easeInQuad((u-0.32)/0.13); // cataclysmic downward wave
    P({hipsY:lerp(1.35,0.75,k), spineRX:lerp(-0.7,1.0,k),
       armR:{shx:lerp(-2.8,-0.4,k), shz:-0.6},
       armL:{shx:lerp(-2.6,-0.5,k)},
       legL:{hipx:-0.3, knee:0.6}, legR:{hipx:-0.2, knee:0.5},
       wRx:lerp(-1.6,0.9,k), wRz:0.3});
  } else { const k=easeOutCubic((u-0.45)/0.55); // recovery glow-down
    P({hipsY:lerp(0.75,1.0,k), spineRX:lerp(1.0,0.05,k),
       armR:{shx:lerp(-0.4,-0.2,k)}, armL:{shx:lerp(-0.5,-0.3,k)},
       legL:{hipx:-0.3, knee:0.6}, legR:{hipx:-0.2, knee:0.5},
       wRx:lerp(0.9,-0.3,k), wRz:0.2});
  }
},hitAt:0.38, ult:true}

// helper: does an anim currently have active hit frame?
export function animHitCheck(anim,u){
  if(!anim.hitAt) return false;
  return u>=anim.hitAt && u<=anim.hitAt+0.12;
}
