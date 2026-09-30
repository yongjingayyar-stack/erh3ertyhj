// exercise the REAL mixer (player.js updateAnim + finishPose) with a stubbed environment
import * as THREE from 'three';
import { GameState } from './js/core/state.js';

// minimal world/fx/camera/hud/input stubs
const noop=()=>{};
const stubFx=new Proxy({},{get:(t,k)=> k==='burst'||k==='ring'||k==='curseBurst'||k==='sparks'||k==='blood'||k==='slashArc'||k==='spawnDamageNumber' ? noop : ()=>({})});
const input={axisX:0,axisZ:0,down:{},pressed:{}};
const world={groundHeightAt:()=>0, collideMove:(ax,az,nx,nz)=>[nx,nz]};
const camera={kick:noop};
const hud={feedback:noop,registerHit:noop,damageFlash:noop,levelUp:noop,ultReady:noop,onPlayerDeath:noop};

const { Player } = await import('./js/player/player.js');
GameState.realTime=0; GameState.timeScale=1; GameState.time=0;
const scene=new THREE.Scene();
const P=new Player(scene,input,world,stubFx,camera,hud);

const rig=P.rig;
if(!rig.body){ console.log('FAIL: no body pivot in rig'); process.exit(1); }

function runClip(state,name,steps,dt=0.02){
  P.state=state; P.playAnim(name);
  let peakLean=0, peakHip=0, prev=null, maxJump=0, nan=false;
  for(let i=0;i<steps;i++){
    GameState.realTime+=dt; GameState.time+=dt;
    P.animT+=dt; P.updateAnim(dt);
    const lean=Math.abs(rig.body.rotation.x)+Math.abs(rig.body.rotation.z);
    peakLean=Math.max(peakLean,lean);
    peakHip=Math.max(peakHip,Math.abs(rig.hips.position.y-1));
    const v=rig.armR.sh.rotation.x+rig.spine.rotation.y;
    if(!isFinite(v)||!isFinite(lean)) nan=true;
    if(prev!==null) maxJump=Math.max(maxJump,Math.abs(v-prev));
    prev=v;
  }
  return {name,peakLean:+peakLean.toFixed(2),peakHip:+peakHip.toFixed(2),maxJump:+maxJump.toFixed(3),nan};
}
for(const [st,nm,stps] of [['attack','light1',22],['attack','light2',21],['attack','light3',24],['attack','light4',20],['attack','light5',37],['attack','heavy',44],['parry','parry',21],['ult','ult',121]]){
  console.log(JSON.stringify(runClip(st,nm,stps)));
}
// relax check: after attack, idle should settle body to ~0
P.state='idle'; P.playAnim('idle');
for(let i=0;i<80;i++){ GameState.realTime+=0.02; P.animT+=0.02; P.updateAnim(0.02); }
console.log('restLean=',(Math.abs(rig.body.rotation.x)+Math.abs(rig.body.rotation.z)).toFixed(4));
console.log('DONE OK');
