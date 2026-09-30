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

// ---------- LOCOMOTION ----------
Anims.idle={dur:2.4,loop:true,onApply(rig,t){
  const b=S(t*2.1);
  rig.hips.position.y=1.0+b*0.02;
  rig.spine.rotation.x=0.04+b*0.02;
  rig.armL.sh.rotation.x=0.06+b*0.05; rig.armL.sh.rotation.z=0.12;
  rig.armR.sh.rotation.x=0.06-b*0.05; rig.armR.sh.rotation.z=-0.12;
  rig.armL.el.rotation.x=-0.25; rig.armR.el.rotation.x=-0.3;
  rig.weapon.rotation.set(-0.2,0,0.1);
  rig.neck.rotation.x=-b*0.03;
  rig.legL.hip.rotation.x=0.02; rig.legR.hip.rotation.x=-0.02;
  rig.legL.knee.rotation.x=-0.05; rig.legR.knee.rotation.x=-0.05;
}};

Anims.walk={dur:0.9,loop:true,onApply(rig,t,u,speed=1){
  const w=t*(6.5*speed);
  rig.legL.hip.rotation.x=S(w)*0.55; rig.legR.hip.rotation.x=S(w+PI)*0.55;
  rig.legL.knee.rotation.x=-Math.max(0,S(w+PI*0.4))*0.8-0.05;
  rig.legR.knee.rotation.x=-Math.max(0,S(w+PI+PI*0.4))*0.8-0.05;
  rig.hips.position.y=1.0+Math.abs(S(w))*0.06;
  rig.hips.rotation.z=S(w)*0.05;
  rig.spine.rotation.x=0.08;
  rig.armL.sh.rotation.x=S(w+PI)*0.4; rig.armR.sh.rotation.x=S(w)*0.4;
  rig.armL.sh.rotation.z=0.1; rig.armR.sh.rotation.z=-0.1;
  rig.armL.el.rotation.x=-0.35; rig.armR.el.rotation.x=-0.5;
  rig.weapon.rotation.set(-0.3,0,0.15);
  rig.spine.rotation.y=S(w)*0.08;
}};

Anims.run={dur:0.66,loop:true,onApply(rig,t,u,speed=1){
  const w=t*(9*speed);
  rig.legL.hip.rotation.x=S(w)*0.9; rig.legR.hip.rotation.x=S(w+PI)*0.9;
  rig.legL.knee.rotation.x=-Math.max(0,S(w+PI*0.35))*1.3-0.1;
  rig.legR.knee.rotation.x=-Math.max(0,S(w+PI+PI*0.35))*1.3-0.1;
  rig.hips.position.y=1.0+Math.abs(S(w))*0.1;
  rig.hips.rotation.z=S(w)*0.08;
  rig.spine.rotation.x=0.22;
  rig.spine.rotation.y=S(w)*0.14;
  // arms pump; sword held low diagonal (ready sprint carry)
  rig.armL.sh.rotation.x=S(w+PI)*0.75; rig.armR.sh.rotation.x=S(w)*0.75;
  rig.armL.sh.rotation.z=0.15; rig.armR.sh.rotation.z=-0.15;
  rig.armL.el.rotation.x=-0.7; rig.armR.el.rotation.x=-0.9;
  rig.weapon.rotation.set(-0.5,0,0.35);
  // cape streamed back handled in player via velocity
}};

Anims.crouch={dur:1,loop:true,onApply(rig,t){
  const b=S(t*2.4)*0.02;
  rig.hips.position.y=0.62+b;
  rig.spine.rotation.x=0.5;
  rig.legL.hip.rotation.x=-1.1; rig.legR.hip.rotation.x=-1.1;
  rig.legL.knee.rotation.x=1.5; rig.legR.knee.rotation.x=1.5;
  rig.armL.sh.rotation.x=-0.4; rig.armR.sh.rotation.x=-0.2;
  rig.armL.el.rotation.x=-1.2; rig.armR.el.rotation.x=-1.4;
  rig.weapon.rotation.set(-1.2,0,0.2);
  rig.neck.rotation.x=-0.4;
}};

Anims.jump={dur:1,loop:true,onApply(rig,t,u,vy=0){
  const rise=clamp(vy/8,-1,1);
  rig.hips.position.y=1.0;
  if(rise>0){ // ascending: tucked
    rig.legL.hip.rotation.x=-0.7; rig.legR.hip.rotation.x=-0.4;
    rig.legL.knee.rotation.x=1.2; rig.legR.knee.rotation.x=0.9;
    rig.armL.sh.rotation.x=-1.4; rig.armR.sh.rotation.x=-1.2;
    rig.spine.rotation.x=-0.1;
  } else { // falling: spread for landing
    rig.legL.hip.rotation.x=0.5; rig.legR.hip.rotation.x=0.3;
    rig.legL.knee.rotation.x=0.4; rig.legR.knee.rotation.x=0.6;
    rig.armL.sh.rotation.x=-2.2; rig.armR.sh.rotation.x=-2.0;
    rig.armL.el.rotation.x=-0.3; rig.armR.el.rotation.x=-0.4;
    rig.weapon.rotation.set(-0.8,0,0.6);
    rig.spine.rotation.x=0.15;
  }
}};

Anims.land={dur:0.28,onApply(rig,t,u){
  const c=S(u*PI); // squat absorb then stand
  rig.hips.position.y=1.0-c*0.3;
  rig.spine.rotation.x=c*0.6;
  rig.legL.hip.rotation.x=-c*0.9; rig.legR.hip.rotation.x=-c*0.9;
  rig.legL.knee.rotation.x=c*1.4; rig.legR.knee.rotation.x=c*1.4;
  rig.armL.sh.rotation.x=c*0.5; rig.armR.sh.rotation.x=c*0.4;
  rig.weapon.rotation.set(-0.4,0,0.2);
}};

Anims.dash={dur:0.34,onApply(rig,t,u){
  // horizontal lunge, blade trailing, body low & twisted
  const e=easeOutCubic(clamp(u*1.6,0,1));
  rig.hips.position.y=1.0-bell(u,1)*0.18;
  rig.spine.rotation.x=0.7*e;
  rig.spine.rotation.y=lerp(-0.5,0,easeInOutSine(clamp(u/0.55,0,1)));
  rig.hips.rotation.y=0.3*(1-e);
  // trail arm forward, sword arm dragged behind
  rig.armR.sh.rotation.x=lerp(-2.4,-0.4,e); rig.armR.sh.rotation.z=lerp(0.6,0.1,e);
  rig.armR.el.rotation.x=lerp(0.4,-0.2,e);
  rig.weapon.rotation.set(lerp(1.2,-0.3,e),0,0.5);
  rig.armL.sh.rotation.x=lerp(0.6,-1.6,e); rig.armL.el.rotation.x=-0.8;
  // legs stream behind
  rig.legL.hip.rotation.x=lerp(0.9,-0.3,e); rig.legL.knee.rotation.x=lerp(0.9,0.3,e);
  rig.legR.hip.rotation.x=lerp(-0.6,0.7,e); rig.legR.knee.rotation.x=lerp(1.2,0.4,e);
} ,rootMotion(u){ const v=bell(u,0.75); return {f:v*1.0,s:0,y:0}; } };

// ---------- LIGHT COMBO (5-hit string) ----------
function slashWindup(setup){return (rig)=>{setup(rig);}}

Anims.light1={dur:0.42,onApply(rig,t,u){
  // diagonal overhead right-to-left (eased keys — no linear snap-throughs)
  if(u<0.35){ const k=easeInOutCubic(u/0.35); // wind up high right
    rig.spine.rotation.y=lerp(0,0.6,k); rig.spine.rotation.x=lerp(0,-0.2,k);
    rig.armR.sh.rotation.x=lerp(0.2,1.45,k); rig.armR.sh.rotation.z=lerp(-0.1,-0.8,k);
    rig.armR.el.rotation.x=lerp(-0.3,-1.35,k);
    rig.weapon.rotation.set(-0.6,0,0.9);
    rig.hips.rotation.y=lerp(0,0.3,k);
  } else if(u<0.55){ const k=easeInQuad((u-0.35)/0.2); // accelerate down across
    rig.spine.rotation.y=lerp(0.6,-0.7,k); rig.spine.rotation.x=lerp(-0.2,0.15,k);
    rig.armR.sh.rotation.x=lerp(1.45,-0.8,k); rig.armR.sh.rotation.z=lerp(-0.8,0.45,k);
    rig.armR.el.rotation.x=lerp(-1.35,-0.15,k);
    rig.weapon.rotation.set(lerp(-0.6,0.9,k),0,lerp(0.9,-0.5,k));
    rig.hips.rotation.y=lerp(0.3,-0.45,k);
    rig.legR.hip.rotation.x=0.3*k; rig.legR.knee.rotation.x=-0.3*k;
  } else { const k=easeOutCubic((u-0.55)/0.45); // settle smoothly back to guard
    rig.spine.rotation.y=lerp(-0.7,0.15,k); rig.spine.rotation.x=lerp(0.15,0.05,k);
    rig.armR.sh.rotation.x=lerp(-0.9,-0.2,k); rig.armR.sh.rotation.z=lerp(0.5,-0.15,k);
    rig.armR.el.rotation.x=lerp(-0.1,-0.8,k);
    rig.weapon.rotation.set(0.9,-0.2,lerp(-0.5,0.2,k));
    rig.hips.rotation.y=lerp(-0.45,-0.15,k);
  }
  rig.armL.sh.rotation.x=-0.3; rig.armL.sh.rotation.z=0.35; rig.armL.el.rotation.x=-1.0; // shield guard side
},hitAt:0.44, arc:{tilt:-0.4,roll:0.5,color:0xf0d27a}, rootMotion(u){return{f:bell(clamp((u-0.38)/0.34,0,1),1)*0.22,s:0,y:0};}};

Anims.light2={dur:0.40,onApply(rig,t,u){
  // horizontal left sweep (reverse of 1)
  if(u<0.32){ const k=easeInOutCubic(u/0.32);
    rig.spine.rotation.y=lerp(0.15,-0.7,k);
    rig.armR.sh.rotation.x=lerp(-0.2,0.4,k); rig.armR.sh.rotation.z=lerp(-0.15,0.9,k);
    rig.armR.el.rotation.x=lerp(-0.8,-0.4,k);
    rig.weapon.rotation.set(0.2,0,lerp(0.2,1.2,k));
    rig.hips.rotation.y=lerp(-0.15,-0.45,k);
  } else if(u<0.52){ const k=easeInQuad((u-0.32)/0.2);
    rig.spine.rotation.y=lerp(-0.7,0.8,k);
    rig.armR.sh.rotation.x=lerp(0.4,-0.2,k); rig.armR.sh.rotation.z=lerp(0.9,-0.55,k);
    rig.armR.el.rotation.x=lerp(-0.4,-0.2,k);
    rig.weapon.rotation.set(lerp(0.2,0.6,k),0,lerp(1.2,-0.7,k));
    rig.hips.rotation.y=lerp(-0.45,0.55,k);
    rig.legL.hip.rotation.x=0.35*k;
  } else { const k=easeOutCubic((u-0.52)/0.48);
    rig.spine.rotation.y=lerp(0.8,-0.2,k);
    rig.armR.sh.rotation.x=lerp(-0.2,-0.5,k); rig.armR.sh.rotation.z=lerp(-0.55,-0.1,k);
    rig.weapon.rotation.set(lerp(0.6,-0.4,k),0,lerp(-0.7,0.3,k));
    rig.hips.rotation.y=lerp(0.55,-0.3,k);
  }
  rig.armL.sh.rotation.x=-0.4; rig.armL.el.rotation.x=-0.9;
},hitAt:0.42, arc:{tilt:1.4,roll:-0.3,color:0xf0d27a}, rootMotion(u){return{f:bell(clamp((u-0.3)/0.36,0,1),1)*0.25,s:0,y:0};}};

Anims.light3={dur:0.46,onApply(rig,t,u){
  // rising uppercut launcher
  if(u<0.34){ const k=easeInOutCubic(u/0.34); // sink low
    rig.hips.position.y=1.0-k*0.25;
    rig.spine.rotation.x=lerp(0.05,0.45,k); rig.spine.rotation.y=lerp(-0.2,-0.6,k);
    rig.armR.sh.rotation.x=lerp(-0.5,0.85,k); rig.armR.el.rotation.x=lerp(-0.2,-1.5,k);
    rig.weapon.rotation.set(lerp(-0.4,1.9,k),0,0.4);
    rig.legL.hip.rotation.x=-k*0.5; rig.legL.knee.rotation.x=k*0.7;
    rig.legR.hip.rotation.x=-k*0.4; rig.legR.knee.rotation.x=k*0.6;
  } else if(u<0.55){ const k=easeInQuad((u-0.34)/0.21); // explode upward
    rig.hips.position.y=lerp(0.75,1.22,k);
    rig.spine.rotation.x=lerp(0.45,-0.45,k); rig.spine.rotation.y=lerp(-0.6,0.35,k);
    rig.armR.sh.rotation.x=lerp(0.85,-2.4,k); rig.armR.el.rotation.x=lerp(-1.5,-0.15,k);
    rig.weapon.rotation.set(lerp(1.9,-1.1,k),0,lerp(0.4,0.1,k));
    rig.legL.hip.rotation.x=lerp(-0.5,0.4,k); rig.legL.knee.rotation.x=lerp(0.7,0.2,k);
    rig.legR.hip.rotation.x=lerp(-0.4,0.5,k);
  } else { const k=easeOutCubic((u-0.55)/0.45);
    rig.hips.position.y=lerp(1.22,1.0,k);
    rig.spine.rotation.x=lerp(-0.45,0.1,k); rig.spine.rotation.y=lerp(0.35,0,k);
    rig.armR.sh.rotation.x=lerp(-2.4,-0.2,k); rig.armR.el.rotation.x=lerp(-0.15,-0.7,k);
    rig.weapon.rotation.set(lerp(-1.2,-0.3,k),0,0.2);
    rig.legL.hip.rotation.x=lerp(0.4,0,k); rig.legL.knee.rotation.x=lerp(0.2,0,k);
    rig.legR.hip.rotation.x=lerp(0.5,0,k);
  }
  rig.armL.sh.rotation.x=-0.6; rig.armL.el.rotation.x=-0.6;
},hitAt:0.45, arc:{tilt:-1.9,roll:0.2,color:0xffe9b0,lift:true}, rootMotion(u){return{f:bell(clamp((u-0.34)/0.3,0,1),1)*0.3,s:0,y:0};}};

Anims.light4={dur:0.38,onApply(rig,t,u){
  // quick figure-8 cross slash (eased full spin through hips)
  const k=easeInOutSine(clamp(u/0.62,0,1));
  rig.hips.rotation.y=-PI*k*0.85;      // pirouette carried by the hip chain
  rig.spine.rotation.y=0.35*S(k*PI*2);
  const a=k*PI*2;
  rig.armR.sh.rotation.x=-0.2+S(a)*1.2; rig.armR.sh.rotation.z=C(a)*0.9-0.4;
  rig.armR.el.rotation.x=-0.5;
  rig.weapon.rotation.set(C(a)*1.2-0.4,0,S(a)*0.9);
  rig.spine.rotation.x=0.15;
  rig.hips.position.y=1.0+bell(u,2)*0.1;
  rig.legL.hip.rotation.x=0.4*bell(clamp((u-0.3)/0.5,0,1),1);
  rig.armL.sh.rotation.z=0.6; rig.armL.el.rotation.x=-0.8;
},hitAt:0.35, arc:{tilt:0.9,roll:1.2,color:0xf0d27a}, rootMotion(u){return{f:bell(clamp((u-0.2)/0.5,0,1),1)*0.3,s:0,y:0};}};


Anims.light5={dur:0.72,onApply(rig,t,u){
  // finisher: big overhead slam both-hands, ground shockwave
  if(u<0.4){ const k=easeInOutCubic(u/0.4); // raise high, arch back
    rig.hips.position.y=1.0+k*0.15;
    rig.spine.rotation.x=lerp(0.1,-0.6,k); rig.spine.rotation.y=lerp(0,0.3,k);
    rig.armR.sh.rotation.x=lerp(-0.2,2.8,k); rig.armR.sh.rotation.z=lerp(-0.1,-0.35,k);
    rig.armR.el.rotation.x=lerp(-0.7,-0.2,k);
    rig.armL.sh.rotation.x=lerp(-0.6,2.6,k); rig.armL.el.rotation.x=lerp(-0.8,-0.4,k);
    rig.weapon.rotation.set(lerp(-0.3,3.0,k),0,0.15);
    rig.legL.hip.rotation.x=-k*0.2; rig.legR.hip.rotation.x=-k*0.3; rig.legR.knee.rotation.x=k*0.5;
  } else if(u<0.58){ const k=easeInQuad((u-0.4)/0.18); // SLAM
    rig.hips.position.y=lerp(1.15,0.8,k);
    rig.spine.rotation.x=lerp(-0.6,0.75,k); rig.spine.rotation.y=lerp(0.3,-0.1,k);
    rig.armR.sh.rotation.x=lerp(2.8,-1.1,k); rig.armR.el.rotation.x=-0.15;
    rig.armL.sh.rotation.x=lerp(2.6,-1.2,k);
    rig.weapon.rotation.set(lerp(3.0,-1.4,k),0,0.1);
    rig.legL.hip.rotation.x=lerp(-0.2,0.5,k); rig.legL.knee.rotation.x=lerp(0,0.8,k);
    rig.legR.hip.rotation.x=lerp(-0.3,0.2,k); rig.legR.knee.rotation.x=lerp(0.5,1.0,k);
  } else { const k=easeOutCubic((u-0.58)/0.42); // settle
    rig.hips.position.y=lerp(0.8,1.0,k);
    rig.spine.rotation.x=lerp(0.75,0.05,k);
    rig.armR.sh.rotation.x=lerp(-1.1,-0.2,k); rig.armL.sh.rotation.x=lerp(-1.2,-0.4,k);
    rig.weapon.rotation.set(lerp(-1.4,-0.3,k),0,0.2);
    rig.legL.hip.rotation.x=lerp(0.5,0,k); rig.legL.knee.rotation.x=lerp(0.8,0,k);
    rig.legR.hip.rotation.x=lerp(0.2,0,k); rig.legR.knee.rotation.x=lerp(1.0,0,k);
  }
},hitAt:0.5, arc:{tilt:0.05,roll:0,color:0xfff2a8,big:true}, rootMotion(u){return{f:bell(clamp((u-0.36)/0.34,0,1),1)*0.45,s:0,y:0};}};

// ---------- HEAVY ----------
Anims.heavy={dur:0.86,onApply(rig,t,u){
  // slow menacing draw-back → devastating thrust-cleave hybrid
  if(u<0.5){ const k=easeInOutCubic(u/0.5);
    rig.hips.rotation.y=lerp(0,-0.85,k); rig.spine.rotation.y=lerp(0,-0.5,k); rig.spine.rotation.x=lerp(0,0.2,k);
    rig.armR.sh.rotation.x=lerp(0,0.6,k); rig.armR.sh.rotation.z=lerp(-0.1,-1.4,k);
    rig.armR.el.rotation.x=lerp(-0.3,-1.8,k);
    rig.weapon.rotation.set(lerp(-0.3,-0.2,k),0,lerp(0.2,2.4,k)); // blade drawn far back horizontal
    rig.hips.position.y=1.0-k*0.12;
    rig.legR.hip.rotation.x=-k*0.5; rig.legR.knee.rotation.x=k*0.8;
    rig.armL.sh.rotation.x=lerp(-0.3,-0.8,k); rig.armL.el.rotation.x=-1.0;
  } else if(u<0.62){ const k=easeInQuad((u-0.5)/0.12); // LUNGE-CLEAVE
    rig.hips.rotation.y=lerp(-0.85,0.95,k); rig.spine.rotation.y=lerp(-0.5,0.75,k); rig.spine.rotation.x=lerp(0.2,0.4,k);
    rig.armR.sh.rotation.x=lerp(0.6,-0.6,k); rig.armR.sh.rotation.z=lerp(-1.35,0.75,k);
    rig.armR.el.rotation.x=lerp(-1.8,-0.15,k);
    rig.weapon.rotation.set(lerp(-0.2,1.1,k),0,lerp(2.3,-0.9,k));
    rig.hips.position.y=lerp(0.88,1.05,k);
    rig.legR.hip.rotation.x=lerp(-0.5,0.7,k); rig.legR.knee.rotation.x=lerp(0.8,0.3,k);
  } else { const k=easeOutCubic((u-0.62)/0.38);
    rig.hips.rotation.y=lerp(0.95,0,k); rig.spine.rotation.y=lerp(0.75,0,k); rig.spine.rotation.x=lerp(0.4,0.05,k);
    rig.armR.sh.rotation.x=lerp(-0.6,-0.3,k); rig.armR.sh.rotation.z=lerp(0.8,-0.1,k);
    rig.weapon.rotation.set(lerp(1.1,-0.3,k),0,lerp(-1,0.2,k));
    rig.legR.hip.rotation.x=lerp(0.7,0,k); rig.legR.knee.rotation.x=lerp(0.3,0,k);
  }
},hitAt:0.56, arc:{tilt:0.3,roll:-0.8,color:0xff8a30,big:true}, heavy:true, rootMotion(u){return{f:bell(clamp((u-0.46)/0.3,0,1),1)*0.9,s:0,y:0};}};

// ---------- PARRY / BLOCK ----------
Anims.blockIdle={dur:1,loop:true,onApply(rig,t){
  const b=S(t*2.6)*0.03;
  rig.hips.position.y=0.95+b;
  rig.spine.rotation.x=0.18; rig.spine.rotation.y=-0.35;
  rig.armL.sh.rotation.x=-0.9; rig.armL.sh.rotation.z=0.7; rig.armL.el.rotation.x=-1.3; // shield raised front
  rig.armR.sh.rotation.x=-0.1; rig.armR.sh.rotation.z=-0.5; rig.armR.el.rotation.x=-1.5; // sword tucked behind shield
  rig.weapon.rotation.set(-0.6,0,1.0);
  rig.legL.hip.rotation.x=-0.25; rig.legL.knee.rotation.x=0.5;
  rig.legR.hip.rotation.x=0.3; rig.legR.knee.rotation.x=0.4;
  rig.hips.rotation.y=-0.2;
}};

Anims.parry={dur:0.4,onApply(rig,t,u){
  // sharp vertical shield bash/gate slam (fast ease-in, not a hard cut)
  const k=easeOutCubic(clamp(u/0.3,0,1));
  rig.spine.rotation.y=lerp(-0.35,0.5,k); rig.spine.rotation.x=0.1;
  rig.armL.sh.rotation.x=lerp(-0.9,-1.9,k); rig.armL.sh.rotation.z=lerp(0.7,0.2,k);
  rig.armL.el.rotation.x=lerp(-1.3,-0.3,k);
  rig.hips.rotation.y=lerp(-0.2,0.3,k);
  if(u>0.3){ const r=easeInOutCubic((u-0.3)/0.7);
    rig.spine.rotation.y=lerp(0.5,-0.3,r); rig.armL.sh.rotation.x=lerp(-1.9,-0.9,r);
    rig.armL.sh.rotation.z=lerp(0.2,0.7,r); rig.armL.el.rotation.x=lerp(-0.3,-1.3,r);
    rig.hips.rotation.y=lerp(0.3,-0.2,r);
  }
  rig.armR.sh.rotation.x=-0.2; rig.armR.el.rotation.x=-1.4; rig.weapon.rotation.set(-0.5,0,0.9);
},parryWindow:[0.05,0.3]};

Anims.hitReact={dur:0.3,onApply(rig,t,u){
  const b=bell(u,1);
  rig.spine.rotation.x=-0.5*b; rig.spine.rotation.y=0.3*b;
  rig.hips.position.y=1.0-b*0.1;
  rig.armL.sh.rotation.x=0.5*b; rig.armR.sh.rotation.x=0.6*b;
  rig.head.rotation.x=0.4*b;
}};

Anims.death={dur:1.4,onApply(rig,t,u){
  const k=easeOutCubic(clamp(u*1.3,0,1));
  rig.hips.position.y=lerp(1.0,0.25,k);
  rig.spine.rotation.x=lerp(0,1.35,k);
  rig.head.rotation.x=0.5;
  rig.armL.sh.rotation.x=lerp(0,-2.2,k); rig.armR.sh.rotation.x=lerp(0,-1.6,k);
  rig.armL.sh.rotation.z=0.8; rig.armR.sh.rotation.z=-0.9;
  rig.legL.hip.rotation.x=lerp(0,-0.6,k); rig.legR.hip.rotation.x=lerp(0,0.4,k);
  rig.legL.knee.rotation.x=lerp(0,1.2,k);
  rig.weapon.rotation.set(0.4,0,1.4); // blade dropped planted
}};

// ---------- ULTIMATE: CURSE RELEASE ----------
Anims.ult={dur:2.4,onApply(rig,t,u){
  if(u<0.22){ const k=easeInOutCubic(u/0.22); // crouch channel, curse aura gathers
    rig.hips.position.y=lerp(1.0,0.7,k);
    rig.spine.rotation.x=lerp(0,0.8,k);
    rig.armR.sh.rotation.x=lerp(0,1.4,k); rig.armR.el.rotation.x=lerp(-0.3,-1.8,k);
    rig.armL.sh.rotation.x=lerp(0,1.2,k); rig.armL.el.rotation.x=lerp(-0.3,-1.6,k);
    rig.weapon.rotation.set(lerp(-0.3,2.2,k),0,0.3);
    rig.head.rotation.x=-0.5*k;
  } else if(u<0.32){ const k=easeInQuad((u-0.22)/0.1); // erupt upright
    rig.hips.position.y=lerp(0.7,1.35,k);
    rig.spine.rotation.x=lerp(0.8,-0.7,k);
    rig.armR.sh.rotation.x=lerp(1.4,-2.8,k); rig.armR.el.rotation.x=lerp(-1.8,-0.1,k);
    rig.armL.sh.rotation.x=lerp(1.2,-2.6,k);
    rig.weapon.rotation.set(lerp(2.2,-1.6,k),0,0.2);
  } else if(u<0.45){ const k=easeInQuad((u-0.32)/0.13); // cataclysmic downward wave
    rig.hips.position.y=lerp(1.35,0.75,k);
    rig.spine.rotation.x=lerp(-0.7,1.0,k);
    rig.armR.sh.rotation.x=lerp(-2.8,-0.4,k); rig.armR.sh.rotation.z=lerp(0,-0.6,k);
    rig.armL.sh.rotation.x=lerp(-2.6,-0.5,k);
    rig.weapon.rotation.set(lerp(-1.6,0.9,k),0,0.3);
  } else { const k=easeOutCubic((u-0.45)/0.55); // recovery glow-down
    rig.hips.position.y=lerp(0.75,1.0,k);
    rig.spine.rotation.x=lerp(1.0,0.05,k);
    rig.armR.sh.rotation.x=lerp(-0.4,-0.2,k); rig.armL.sh.rotation.x=lerp(-0.5,-0.3,k);
    rig.weapon.rotation.set(lerp(0.9,-0.3,k),0,0.2);
  }
  rig.legL.hip.rotation.x=-0.3; rig.legR.hip.rotation.x=-0.2;
  rig.legL.knee.rotation.x=0.6; rig.legR.knee.rotation.x=0.5;
},hitAt:0.38, ult:true}

// helper: does an anim currently have active hit frame?
export function animHitCheck(anim,u){
  if(!anim.hitAt) return false;
  return u>=anim.hitAt && u<=anim.hitAt+0.12;
}
