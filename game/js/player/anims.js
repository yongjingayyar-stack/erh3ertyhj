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
// NOTE ON AXIS CONVENTIONS (validated against the parry clip):
//  - spine/arm "y" rotation is an axis-local value; because the rig faces +Z,
//    positive local-y actually twists the model-space orientation backwards.
//    The parry anim therefore uses SMALL y values (-0.35→0.5) and gets its
//    visible torso twist from armL.sh.rotation.x/z + elbow sweeps instead.
//  - So every attack below drives its body motion through:
//      * big eased shoulder/elbow arcs (armR.sh.x/z, armR.el.x)
//      * off-arm counterbalance swings (armL)
//      * hip height sinks/rises + knee loads (stance changes = weight shift)
//      * spine.rotation.x pitch (coil lean → lunge lean) and only small y twists
//      * neck/head follow-through
//  - Root motion stays modest (~0.2–0.4 m) so lunges read as steps, not slides.

const GUARD={shx:-0.25,shz:-0.15,elx:-0.9,wrx:-0.4,wrz:0.4}; // sword resting guard pose

Anims.light1={dur:0.42,onApply(rig,t,u){
  // diagonal overhead right-to-left cut, like a shield-bash: compact coil,
  // one fast eased release, smooth settle — no extreme torso twist values
  if(u<0.32){ const k=easeInOutCubic(u/0.32); // COIL: raise blade over shoulder, sink weight onto rear leg
    rig.armR.sh.rotation.x=lerp(GUARD.shx,0.85,k); rig.armR.sh.rotation.z=lerp(GUARD.shz,-0.75,k);
    rig.armR.el.rotation.x=lerp(GUARD.elx,-1.15,k);
    rig.weapon.rotation.set(lerp(GUARD.wrx,-0.55,k),0,lerp(GUARD.wrz,0.95,k));
    rig.spine.rotation.x=lerp(0.04,0.12,k); rig.spine.rotation.y=lerp(0,0.22,k);
    rig.hips.rotation.y=lerp(0,0.14,k);
    rig.hips.position.y=1.0-k*0.06;                              // slight crouch load
    rig.legR.hip.rotation.x=-k*0.22; rig.legR.knee.rotation.x=k*0.35; // rear leg takes the weight
    rig.legL.hip.rotation.x=k*0.1;
    rig.neck.rotation.x=lerp(0,-0.08,k);                         // chin tucks toward the blade
    rig.armL.sh.rotation.x=lerp(-0.3,-0.7,k);                    // off-arm comes up for balance
  } else if(u<0.5){ const k=easeOutCubic((u-0.32)/0.18); // STRIKE: fast single sweep through (parry's snap feel)
    rig.armR.sh.rotation.x=lerp(0.85,-1.05,k); rig.armR.sh.rotation.z=lerp(-0.75,0.5,k);
    rig.armR.el.rotation.x=lerp(-1.15,-0.15,k);                  // elbow straightens INTO the cut
    rig.weapon.rotation.set(lerp(-0.55,0.75,k),0,lerp(0.95,-0.55,k));
    rig.spine.rotation.x=lerp(0.12,0.3,k); rig.spine.rotation.y=lerp(0.22,-0.15,k);
    rig.hips.rotation.y=lerp(0.14,-0.12,k);
    rig.hips.position.y=lerp(0.94,1.02,k);                       // weight drives forward/up through impact
    rig.legR.hip.rotation.x=lerp(-0.22,0.3,k); rig.legR.knee.rotation.x=lerp(0.35,0.05,k); // rear leg pushes off
    rig.legL.hip.rotation.x=lerp(0.1,-0.15,k);                   // front leg reaches into a short step
    rig.neck.rotation.x=lerp(-0.08,0.12,k);                      // head follows the slash
    rig.armL.sh.rotation.x=lerp(-0.7,-0.15,k);                   // off-arm counter-swings back
  } else { const k=easeInOutCubic((u-0.5)/0.5); // SETTLE: flow back into guard
    rig.armR.sh.rotation.x=lerp(-1.05,GUARD.shx,k); rig.armR.sh.rotation.z=lerp(0.5,GUARD.shz,k);
    rig.armR.el.rotation.x=lerp(-0.15,GUARD.elx,k);
    rig.weapon.rotation.set(lerp(0.75,GUARD.wrx,k),0,lerp(-0.55,GUARD.wrz,k));
    rig.spine.rotation.x=lerp(0.3,0.04,k); rig.spine.rotation.y=lerp(-0.15,0,k);
    rig.hips.rotation.y=lerp(-0.12,0,k);
    rig.hips.position.y=lerp(1.02,1.0,k);
    rig.legR.hip.rotation.x=lerp(0.3,0,k); rig.legR.knee.rotation.x=lerp(0.05,0,k);
    rig.legL.hip.rotation.x=lerp(-0.15,0,k);
    rig.neck.rotation.x=lerp(0.12,0,k);
    rig.armL.sh.rotation.x=lerp(-0.15,-0.3,k);
  }
  rig.armL.sh.rotation.z=0.35; rig.armL.el.rotation.x=-1.0;
},hitAt:0.44, arc:{tilt:-0.4,roll:0.5,color:0xf0d27a}, rootMotion(u){return{f:bell(clamp((u-0.3)/0.38,0,1),1)*0.22,s:0,y:0};}};

Anims.light2={dur:0.40,onApply(rig,t,u){
  // horizontal backhand→forehand sweep: shoulder-pivot twist (like parry's gate slam)
  if(u<0.3){ const k=easeInOutCubic(u/0.3); // WIND: blade pulled out wide to the left, torso coils slightly
    rig.armR.sh.rotation.x=lerp(GUARD.shx,0.35,k); rig.armR.sh.rotation.z=lerp(GUARD.shz,1.0,k);
    rig.armR.el.rotation.x=lerp(GUARD.elx,-0.55,k);
    rig.weapon.rotation.set(lerp(GUARD.wrx,0.15,k),0,lerp(GUARD.wrz,1.35,k));
    rig.spine.rotation.y=lerp(0,-0.25,k); rig.spine.rotation.x=lerp(0.04,0.1,k);
    rig.hips.rotation.y=lerp(0,-0.16,k);                         // same sign family as parry's -0.2 pre-twist
    rig.hips.position.y=1.0-k*0.04;
    rig.legL.hip.rotation.x=-k*0.18; rig.legL.knee.rotation.x=k*0.3; // load front leg
    rig.neck.rotation.y=lerp(0,-0.12,k);
    rig.armL.sh.rotation.x=lerp(-0.3,-0.8,k);                   // off-arm guards across chest
  } else if(u<0.5){ const k=easeOutCubic((u-0.3)/0.2); // SWEEP: fast pivot across the body, shoulders lead
    rig.armR.sh.rotation.x=lerp(0.35,-0.5,k); rig.armR.sh.rotation.z=lerp(1.0,-0.7,k);
    rig.armR.el.rotation.x=lerp(-0.55,-0.2,k);
    rig.weapon.rotation.set(lerp(0.15,0.5,k),0,lerp(1.35,-0.9,k));
    rig.spine.rotation.y=lerp(-0.25,0.3,k); rig.spine.rotation.x=lerp(0.1,0.22,k); // chest opens through the cut
    rig.hips.rotation.y=lerp(-0.16,0.2,k);
    rig.hips.position.y=lerp(0.96,1.02,k);
    rig.legL.hip.rotation.x=lerp(-0.18,0.25,k); rig.legL.knee.rotation.x=lerp(0.3,0.05,k); // push off front leg
    rig.legR.hip.rotation.x=k*0.15;                              // rear toe drags into the pivot
    rig.neck.rotation.y=lerp(-0.12,0.15,k);                     // eyes track across the arc
    rig.armL.sh.rotation.x=lerp(-0.8,-0.05,k);                  // off-arm whips back for counterbalance
  } else { const k=easeInOutCubic((u-0.5)/0.5); // RECOVER
    rig.armR.sh.rotation.x=lerp(-0.5,GUARD.shx,k); rig.armR.sh.rotation.z=lerp(-0.7,GUARD.shz,k);
    rig.armR.el.rotation.x=lerp(-0.2,GUARD.elx,k);
    rig.weapon.rotation.set(lerp(0.5,GUARD.wrx,k),0,lerp(-0.9,GUARD.wrz,k));
    rig.spine.rotation.y=lerp(0.3,0,k); rig.spine.rotation.x=lerp(0.22,0.04,k);
    rig.hips.rotation.y=lerp(0.2,0,k);
    rig.hips.position.y=lerp(1.02,1.0,k);
    rig.legL.hip.rotation.x=lerp(0.25,0,k); rig.legL.knee.rotation.x=lerp(0.05,0,k);
    rig.legR.hip.rotation.x=lerp(0.15,0,k);
    rig.neck.rotation.y=lerp(0.15,0,k);
    rig.armL.sh.rotation.x=lerp(-0.05,-0.3,k);
  }
  rig.armL.el.rotation.x=-0.9;
},hitAt:0.42, arc:{tilt:1.4,roll:-0.3,color:0xf0d27a}, rootMotion(u){return{f:bell(clamp((u-0.24)/0.4,0,1),1)*0.24,s:0,y:0};}};

Anims.light3={dur:0.46,onApply(rig,t,u){
  // rising uppercut launcher — vertical move like the parry's lift: deep sink, whole body extends up
  if(u<0.34){ const k=easeInOutCubic(u/0.34); // SINK: compress into a half-crouch, blade drops behind hip
    rig.hips.position.y=1.0-k*0.22;                             // clear, readable squat
    rig.spine.rotation.x=lerp(0.04,0.35,k);                     // fold slightly over the load
    rig.armR.sh.rotation.x=lerp(GUARD.shx,1.05,k); rig.armR.el.rotation.x=lerp(GUARD.elx,-1.5,k); // arm hangs/cocks low
    rig.weapon.rotation.set(lerp(GUARD.wrx,1.3,k),0,lerp(GUARD.wrz,0.5,k)); // tip points back-down
    rig.legL.hip.rotation.x=-k*0.4; rig.legL.knee.rotation.x=k*0.6;   // both knees bend…
    rig.legR.hip.rotation.x=-k*0.35; rig.legR.knee.rotation.x=k*0.55; // …legs coil like a jump prep
    rig.neck.rotation.x=k*0.15;                                 // look down at the blade
    rig.armL.sh.rotation.x=lerp(-0.3,-0.9,k);                   // off-arm tucks low (compression)
  } else if(u<0.55){ const k=easeOutCubic((u-0.34)/0.21); // LAUNCH: legs snap straight, hips rise, blade rockets up
    rig.hips.position.y=lerp(0.78,1.22,k);                      // full extension (same range as parry-scale moves)
    rig.spine.rotation.x=lerp(0.35,-0.25,k);                    // torso un-flexes, chest lifts to sky
    rig.armR.sh.rotation.x=lerp(1.05,-2.0,k); rig.armR.el.rotation.x=lerp(-1.5,-0.2,k); // arm punches overhead
    rig.weapon.rotation.set(lerp(1.3,-1.1,k),0,lerp(0.5,0.15,k));
    rig.legL.hip.rotation.x=lerp(-0.4,0.2,k); rig.legL.knee.rotation.x=lerp(0.6,0.05,k); // legs straighten under
    rig.legR.hip.rotation.x=lerp(-0.35,0.25,k); rig.legR.knee.rotation.x=lerp(0.55,0.05,k);
    rig.neck.rotation.x=lerp(0.15,-0.25,k);                     // head tracks the blade upward
    rig.armL.sh.rotation.x=lerp(-0.9,-1.7,k);                   // off-arm flies up WITH the launch
  } else { const k=easeInOutCubic((u-0.55)/0.45); // DROP BACK into guard
    rig.hips.position.y=lerp(1.22,1.0,k);
    rig.spine.rotation.x=lerp(-0.25,0.04,k);
    rig.armR.sh.rotation.x=lerp(-2.0,GUARD.shx,k); rig.armR.el.rotation.x=lerp(-0.2,GUARD.elx,k);
    rig.weapon.rotation.set(lerp(-1.1,GUARD.wrx,k),0,lerp(0.15,GUARD.wrz,k));
    rig.legL.hip.rotation.x=lerp(0.2,0,k); rig.legL.knee.rotation.x=lerp(0.05,0,k);
    rig.legR.hip.rotation.x=lerp(0.25,0,k); rig.legR.knee.rotation.x=lerp(0.05,0,k);
    rig.neck.rotation.x=lerp(-0.25,0,k);
    rig.armL.sh.rotation.x=lerp(-1.7,-0.3,k);
  }
},hitAt:0.45, arc:{tilt:-1.9,roll:0.2,color:0xffe9b0,lift:true}, rootMotion(u){return{f:bell(clamp((u-0.3)/0.32,0,1),1)*0.2,s:0,y:0};}};

Anims.light4={dur:0.38,onApply(rig,t,u){
  // cross-slash figure-8: arms trace the 8, body rocks side-to-side and rises onto the ball of the foot
  const k=easeInOutSine(clamp(u/0.62,0,1));
  const a=k*PI*2;                                               // one clean arm cycle
  rig.armR.sh.rotation.x=-0.2+S(a)*1.1;                         // moderate, continuous circles
  rig.armR.sh.rotation.z=C(a)*0.85-0.15;
  rig.armR.el.rotation.x=-0.6-S(a)*0.3;
  rig.weapon.rotation.set(C(a)*0.9-0.3,0,S(a)*0.8);
  rig.spine.rotation.y=S(a)*0.25;                               // gentle shoulder sway (parry-safe magnitude)
  rig.spine.rotation.z=S(a)*0.12;                               // lateral body rock through the cross
  rig.hips.rotation.y=-0.25+S(a)*0.2;                           // subtle hip sway, never a violent spin
  rig.hips.position.y=1.0+bell(u,2)*0.1;                        // rise onto the ball of the foot mid-turn
  rig.neck.rotation.y=S(a)*0.15;                                // head sways with the figure-8
  rig.legL.hip.rotation.x=0.35*bell(clamp((u-0.25)/0.5,0,1),1); // free heel lifts lightly
  rig.legL.knee.rotation.x=-0.45*bell(clamp((u-0.25)/0.5,0,1),1);
  rig.legR.hip.rotation.x=-0.12*bell(u,1);                      // pivot leg softens
  rig.armL.sh.rotation.z=0.5+S(a)*0.35; rig.armL.el.rotation.x=-0.8; // off-arm keeps small balance circle
  rig.armL.sh.rotation.x=-0.3;
},hitAt:0.35, arc:{tilt:0.9,roll:1.2,color:0xf0d27a}, rootMotion(u){return{f:bell(clamp((u-0.15)/0.55,0,1),1)*0.22,s:0,y:0};}};


Anims.light5={dur:0.72,onApply(rig,t,u){
  // finisher: two-handed overhead slam — RISE then CRASH, all within parry-scale magnitudes
  if(u<0.4){ const k=easeInOutCubic(u/0.4); // RAISE: blade overhead, back arches gently, heels lighten
    rig.hips.position.y=1.0+k*0.12;                             // tiptoe lift (modest)
    rig.spine.rotation.x=lerp(0.04,-0.4,k);                     // controlled lean back
    rig.armR.sh.rotation.x=lerp(GUARD.shx,-2.6,k);              // both arms lift the sword straight over head
    rig.armR.sh.rotation.z=lerp(GUARD.shz,-0.3,k);
    rig.armR.el.rotation.x=lerp(GUARD.elx,-0.35,k);
    rig.armL.sh.rotation.x=lerp(-0.3,-2.4,k);                   // off-arm joins overhead (two-handed grip)
    rig.armL.el.rotation.x=lerp(-0.8,-0.5,k);
    rig.weapon.rotation.set(lerp(GUARD.wrx,-2.6,k),0,0.15);
    rig.neck.rotation.x=lerp(0,-0.2,k);                         // gaze up at the raised blade
    rig.legR.hip.rotation.x=-k*0.15; rig.legR.knee.rotation.x=k*0.25; // slight rear-leg gather
  } else if(u<0.58){ const k=easeOutCubic((u-0.4)/0.18); // SLAM: everything crashes down together (parry's snap)
    rig.hips.position.y=lerp(1.12,0.88,k);                      // drop into the impact crouch
    rig.spine.rotation.x=lerp(-0.4,0.5,k);                      // torso folds over the blow
    rig.armR.sh.rotation.x=lerp(-2.6,-1.15,k);                  // arms drive blade through the floor line
    rig.armR.el.rotation.x=lerp(-0.35,-0.1,k);
    rig.armL.sh.rotation.x=lerp(-2.4,-1.2,k);
    rig.weapon.rotation.set(lerp(-2.6,-1.0,k),0,0.1);
    rig.neck.rotation.x=lerp(-0.2,0.25,k);                      // head snaps down with the strike
    rig.legL.hip.rotation.x=lerp(0,0.35,k); rig.legL.knee.rotation.x=lerp(0,0.55,k); // front knee takes the landing
    rig.legR.hip.rotation.x=lerp(-0.15,0.2,k); rig.legR.knee.rotation.x=lerp(0.25,0.7,k); // rear knee bends deep
  } else { const k=easeInOutCubic((u-0.58)/0.42); // RISE out of the impact pose back to guard
    rig.hips.position.y=lerp(0.88,1.0,k);
    rig.spine.rotation.x=lerp(0.5,0.04,k);
    rig.neck.rotation.x=lerp(0.25,0,k);
    rig.armR.sh.rotation.x=lerp(-1.15,GUARD.shx,k); rig.armR.el.rotation.x=lerp(-0.1,GUARD.elx,k);
    rig.armL.sh.rotation.x=lerp(-1.2,-0.3,k); rig.armL.el.rotation.x=lerp(-0.5,-0.8,k);
    rig.weapon.rotation.set(lerp(-1.0,GUARD.wrx,k),0,GUARD.wrz);
    rig.legL.hip.rotation.x=lerp(0.35,0,k); rig.legL.knee.rotation.x=lerp(0.55,0,k);
    rig.legR.hip.rotation.x=lerp(0.2,0,k); rig.legR.knee.rotation.x=lerp(0.7,0,k);
  }
},hitAt:0.5, arc:{tilt:0.05,roll:0,color:0xfff2a8,big:true}, rootMotion(u){return{f:bell(clamp((u-0.32)/0.36,0,1),1)*0.35,s:0,y:0};}};

// ---------- HEAVY ----------
Anims.heavy={dur:0.86,onApply(rig,t,u){
  // slow draw-back → committed cleave. Motion built from a clear rear-leg stance
  // sink, a shoulder-level blade set, and a single powerful release — same
  // vocabulary as the parry, just bigger amplitude and slower windup.
  if(u<0.5){ const k=easeInOutCubic(u/0.5); // DRAW-BACK: sink onto rear leg, blade cocked back over shoulder
    rig.hips.position.y=1.0-k*0.12;                             // readable stance sink
    rig.spine.rotation.x=lerp(0.04,0.22,k);                     // lean back over the loaded leg
    rig.spine.rotation.y=lerp(0,-0.3,k);                        // small coil (parry-magnitude)
    rig.hips.rotation.y=lerp(0,-0.2,k);                          // matches parry's pre-twist scale
    rig.armR.sh.rotation.x=lerp(GUARD.shx,0.6,k);               // hand drops back…
    rig.armR.sh.rotation.z=lerp(GUARD.shz,-0.9,k);              // …blade tips back horizontally
    rig.armR.el.rotation.x=lerp(GUARD.elx,-1.3,k);
    rig.weapon.rotation.set(lerp(GUARD.wrx,-0.15,k),0,lerp(GUARD.wrz,1.5,k));
    rig.neck.rotation.y=lerp(0,-0.15,k);                        // glare toward target over the shoulder
    rig.legR.hip.rotation.x=-k*0.35; rig.legR.knee.rotation.x=k*0.6; // rear leg compresses (spring)
    rig.legL.hip.rotation.x=k*0.12;                             // front leg braces forward
    rig.armL.sh.rotation.x=lerp(-0.3,-0.85,k);                  // off-arm reaches forward (aim/scope)
    rig.armL.el.rotation.x=-1.0;
  } else if(u<0.64){ const k=easeOutCubic((u-0.5)/0.14); // RELEASE: spring unloads — lunge through the cleave
    rig.hips.position.y=lerp(0.88,1.06,k);                      // drive up through the strike
    rig.spine.rotation.x=lerp(0.22,0.35,k);                     // pitch forward into the lunge
    rig.spine.rotation.y=lerp(-0.3,0.25,k);                     // unwind the coil forward
    rig.hips.rotation.y=lerp(-0.2,0.18,k);
    rig.armR.sh.rotation.x=lerp(0.6,-1.0,k);                    // arm whips from behind-shoulder to full follow-through
    rig.armR.sh.rotation.z=lerp(-0.9,0.55,k);
    rig.armR.el.rotation.x=lerp(-1.3,-0.15,k);                  // elbow locks out at impact
    rig.weapon.rotation.set(lerp(-0.15,0.85,k),0,lerp(1.5,-0.8,k));
    rig.neck.rotation.y=lerp(-0.15,0.2,k);                      // head turns through the cut
    rig.legR.hip.rotation.x=lerp(-0.35,0.45,k); rig.legR.knee.rotation.x=lerp(0.6,0.1,k); // rear leg pushes fully
    rig.legL.hip.rotation.x=lerp(0.12,-0.25,k);                 // front leg strides out into the lunge
    rig.armL.sh.rotation.x=lerp(-0.85,0.35,k);                  // off-arm whips back (counterbalance)
  } else { const k=easeInOutCubic((u-0.64)/0.36); // FOLLOW-THROUGH settle
    rig.hips.position.y=lerp(1.06,1.0,k);
    rig.spine.rotation.x=lerp(0.35,0.04,k); rig.spine.rotation.y=lerp(0.25,0,k);
    rig.hips.rotation.y=lerp(0.18,0,k);
    rig.armR.sh.rotation.x=lerp(-1.0,GUARD.shx,k); rig.armR.sh.rotation.z=lerp(0.55,GUARD.shz,k);
    rig.armR.el.rotation.x=lerp(-0.15,GUARD.elx,k);
    rig.weapon.rotation.set(lerp(0.85,GUARD.wrx,k),0,lerp(-0.8,GUARD.wrz,k));
    rig.neck.rotation.y=lerp(0.2,0,k);
    rig.legR.hip.rotation.x=lerp(0.45,0,k); rig.legR.knee.rotation.x=lerp(0.1,0,k);
    rig.legL.hip.rotation.x=lerp(-0.25,0,k);
    rig.armL.sh.rotation.x=lerp(0.35,-0.3,k); rig.armL.el.rotation.x=lerp(-1.0,-0.8,k);
  }
},hitAt:0.56, arc:{tilt:0.3,roll:-0.8,color:0xff8a30,big:true}, heavy:true, rootMotion(u){return{f:bell(clamp((u-0.42)/0.34,0,1),1)*0.5,s:0,y:0};}};

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
  // stance work: weight drops onto the front leg as the shield punches out,
  // rear knee bends to absorb — this is what sells it as a FULL-BODY move
  rig.hips.position.y=lerp(0.95,0.9,k);
  rig.legL.hip.rotation.x=lerp(-0.25,-0.45,k); rig.legL.knee.rotation.x=lerp(0.5,0.75,k);
  rig.legR.hip.rotation.x=lerp(0.3,0.5,k);     rig.legR.knee.rotation.x=lerp(0.4,0.65,k);
  rig.neck.rotation.x=lerp(0,0.12,k);          // head leans into the bash
  if(u>0.3){ const r=easeInOutCubic((u-0.3)/0.7);
    rig.spine.rotation.y=lerp(0.5,-0.3,r); rig.armL.sh.rotation.x=lerp(-1.9,-0.9,r);
    rig.armL.sh.rotation.z=lerp(0.2,0.7,r); rig.armL.el.rotation.x=lerp(-0.3,-1.3,r);
    rig.hips.rotation.y=lerp(0.3,-0.2,r);
    rig.hips.position.y=lerp(0.9,0.95,r);
    rig.legL.hip.rotation.x=lerp(-0.45,-0.25,r); rig.legL.knee.rotation.x=lerp(0.75,0.5,r);
    rig.legR.hip.rotation.x=lerp(0.5,0.3,r);     rig.legR.knee.rotation.x=lerp(0.65,0.4,r);
    rig.neck.rotation.x=lerp(0.12,0,r);
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
