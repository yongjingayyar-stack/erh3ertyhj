// ============ player/player.js — controller: state machine, combat logic, RPG data ============
import * as THREE from 'three';
import { Anims, animHitCheck } from './anims.js';
import { buildKnight } from './model.js';
import { clamp, lerp, smoothstep, angleWrap, approachAngle, rand, dist2, easeOutCubic } from '../core/mathx.js';
import { GameState, FXBus } from '../core/state.js';

const GRAV=-26;
const COMBO_WINDOW=0.42;   // seconds after hit-frame to chain next light
const LIGHTS=['light1','light2','light3','light4','light5'];

export class Player {
  constructor(scene,input,world,fx,camera,hud){
    this.input=input; this.world=world; this.fx=fx; this.camera=camera; this.hud=hud;
    this.rig=buildKnight(); scene.add(this.rig.root);
    this.position=new THREE.Vector3(8,0,8);
    this.velY=0; this.grounded=true; this.jumpLift=0;
    this.facing=Math.PI;                 // yaw of body
    this.moveSpeed=5.2; this.sprintMul=1.75;
    this.state='idle';                   // idle|walk|run|crouch|air|dash|land|attack|block|parry|ult|hit|dead
    this.anim=null; this.animT=0; this.animName='idle';
    this.comboIndex=0; this.chainQueued=false; this.combatActive=false; this.lastAttackEnd=-99; this._lastReal=0; this._lastAnimReal=0;
    this.attackHasHit=false;
    this.dashTimer=0; this.dashCooldown=0; this.dashDir=new THREE.Vector3(0,0,-1);
    this.invuln=false; this.perfectWindow=0;
    this.blocking=false; this.parryT=-1;
    this.rollTilt=0;
    this.ultActive=false;
    this.stamina=100; this.staminaMax=100;
    this.curse=0; this.curseMax=100;
    this.level=1; this.xp=0; this.xpNext=this.xpForLevel(1);
    this.stats={str:10,agi:8,def:6,curseAffinity:5};
    this.baseHp=100;
    this.hp=this.baseHp+this.stats.def*4;
    this.maxHp=this.hp;
    this.equipment={weapon:'Rusted Cursed Blade',armor:'Worn Chainmail',trinket:null};
    this.inventory=[];
    this.skillsUnlocked={};
    this.sprinting=false;
    this.crouching=false;
    this.trailPts=[];                     // sword tip trail buffer
    this.deathT=0;
    this.hitstopOnCrit=true;
    this.lastLandT=0;
  }

  get effectiveAttack(){ return (this.stats.str + this.level*2 + (this.gearBonus('atk')||0)); }
  gearBonus(k){
    try{ return this.hud.game.items.equipStatsKey(k); }catch(e){ return 0; }
  }

  xpForLevel(l){ return Math.round(40*Math.pow(l,1.45)); }

  addXP(v){
    this.xp+=v;
    while(this.xp>=this.xpNext){
      this.xp-=this.xpNext; this.level++;
      this.xpNext=this.xpForLevel(this.level);
      this.baseHp+=6; this.stats.str+=2; this.stats.agi+=1; this.stats.def+=1;
      this.maxHp=this.baseHp+this.stats.def*4; this.hp=this.maxHp;
      this.staminaMax+=5; this.stamina=this.staminaMax;
      this.hud.levelUp(this.level);
      this.fx.curseBurst(this.position.clone().add(new THREE.Vector3(0,1.2,0)),30,1.4);
      this.fx.ring(this.position,{color:0xffce54,radius:5,time:.7});
      FXBus.shake(.4);
    }
  }

  addCurse(v){ const aff=1+(this.gearBonus('curseGain')||0); this.curse=clamp(this.curse+v*aff,0,this.curseMax); if(this.curse>=this.curseMax) this.hud.ultReady(true); }

  // ---------- animation plumbing ----------
  playAnim(name,{force=false}={}){
    const a=Anims[name]; if(!a) return;
    this.animName=name; this.anim=a; this.animT=0; this.attackHasHit=false; this.chainQueued=false;
    if(a.heavy||a.ult||name.startsWith('light')) this.combatActive=true;
  }

  // ---------- main update ----------
  update(dt, enemies){
    const inp=this.input;
    if(this.state==='dead'){ this.updateAnim(dt); this.deathT+=dt; return; }

    // timers (real-time so they still tick during hit-stop/slow-mo)
    const rdt=Math.min(0.05,GameState.realTime-(this._lastReal||GameState.realTime));
    this._lastReal=GameState.realTime;
    this.dashCooldown=Math.max(0,this.dashCooldown-rdt);
    this.perfectWindow=Math.max(0,this.perfectWindow-rdt);
    if(this.parryT>=0){ this.parryT=this.animT; if(this.parryT>Anims.parry.dur)this.parryT=-1; }

    // stamina regen
    const regen=(this.blocking||this.state==='attack'||this.state==='dash')?4:16;
    this.stamina=clamp(this.stamina+regen*dt,0,this.staminaMax);

    // ---- read inputs ----
    const fwd=inp.isDown('ShiftLeft'); // sprint
    let mx=0,mz=0;
    if(inp.isDown('KeyW'))mz+=1; if(inp.isDown('KeyS'))mz-=1;
    if(inp.isDown('KeyA'))mx-=1; if(inp.isDown('KeyD'))mx+=1;
    const moving=(mx!==0||mz!==0);
    this.crouching=inp.isDown('ControlLeft')&&this.grounded&&this.state!=='attack'&&this.state!=='dash';

    // camera-relative movement vector
    const camYaw=this.camera.yaw;
    let wishX=0,wishZ=0;
    if(moving){
      // forward on XZ relative to camera
      const fx=-Math.sin(camYaw), fz=-Math.cos(camYaw);
      const rx=Math.cos(camYaw)*-1*-1, rz=Math.sin(camYaw)*-1; // right vector
      // simpler & robust: right = (cos(yaw), sin(yaw)) rotated
      const rgtX=-fz, rgtZ=fx;
      wishX=fx*mz+rgtX*mx; wishZ=fz*mz+rgtZ*mx;
      const l=Math.hypot(wishX,wishZ)||1; wishX/=l; wishZ/=l;
    }

    const busyCombat=this.state==='attack'||this.state==='ult'||this.state==='parry'||this.state==='hit';
    const canMove=!busyCombat;

    // ---- actions ----
    // lock-on toggle
    if(inp.justPressed('ShiftRight')&&!this._lockWasHeld) this.hud.game.toggleLock();
    this._lockWasHeld=inp.isDown('ShiftRight');

    // DASH / PERFECT DODGE (Q) — direction from WASD held at press time
    if(inp.justPressed('KeyQ')&&this.dashCooldown<=0&&this.stamina>=20&&!this.crouching&&this.state!=='ult'){
      let dx=wishX,dz=wishZ;
      if(dx===0&&dz===0){ // no WASD held → backstep dash opposite facing
        dx=-Math.sin(this.facing); dz=-Math.cos(this.facing);
      }
      this.dashDir.set(dx,0,dz).normalize();
      this.state='dash'; this.playAnim('dash');
      this.dashTimer=Anims.dash.dur; this.dashCooldown=0.75;
      this.invuln=true; this.perfectWindow=0.30;   // ~first 3 frames of dodge = perfect window
      this.stamina-=20;
      this.facing=Math.atan2(this.dashDir.x,this.dashDir.z);
      this.camera.kick(0,rand(-.06,.06),8);
      FXBus.shake(.12);
      this.fx.dust(this.position.clone(),10);
      this.fx.ring(this.position,{color:0xa44df0,radius:1.6,time:.35});
    }

    // JUMP / DOUBLE JUMP
    if(inp.justPressed('Space')&&this.state!=='ult'&&!this.crouching){
      if(this.grounded&&this.state!=='dash'){
        this.velY=10.5; this.grounded=false; this.state='air'; this.playAnim('jump');
        this.fx.dust(this.position.clone(),6);
      } else if(!this.grounded&&this.jumpsLeft>0){
        this.jumpsLeft--; this.velY=9.2;
        this.playAnim('jump');
        this.fx.ring(this.position.clone().setY(this.position.y+0.6),{color:0xcfd8ff,radius:1.4,time:.3});
        this.fx.burst(this.position.clone().add(new THREE.Vector3(0,.4,0)),{count:10,color:0xcfd8ff,speed:4,grav:8,life:.4});
      }
    }
    if(this.grounded) this.jumpsLeft=1;

    // ULTIMATE (E)
    if(inp.justPressed('KeyE')&&this.curse>=this.curseMax&&this.state!=='ult'&&!busyCombat){
      this.state='ult'; this.playAnim('ult');
      this.curse=0; this.ultActive=true; this.invuln=true;
      this._ultWaveDone=false;
      this.hud.ultReady(false);
      document.getElementById('curse-vignette').style.opacity=1;
      FXBus.slowmo(1.0,0.3);
      FXBus.shake(.5);
      this.camera.kick(.12,0,16);
      // gather curse particles
      for(let i=0;i<5;i++) setTimeout(()=>{
        if(this.state==='ult') this.fx.curseBurst(this.position.clone().add(new THREE.Vector3(rand(-1,1),rand(0,2),rand(-1,1))),14,1.6);
      },i*120);
    }

    // PARRY/BLOCK (RMB): tap = active parry, hold = guard block
    if(inp.justPressed('MOUSE2')&&this.grounded&&!busyCombat&&this.state!=='dash'){
      this.blocking=false;
      this.state='parry'; this.parryT=0; this.playAnim('parry');
    } else if(inp.right&&this.grounded&&!busyCombat&&this.state!=='dash'&&this.stamina>5){
      if(!this.blocking){ this.blocking=true; this.state='block'; this.animName='blockIdle'; this.anim=Anims.blockIdle; }
    }
    if(!inp.right&&this.blocking){ this.blocking=false; if(this.state==='block') this.state='idle'; }

    // ATTACKS
    if(inp.justPressed('MOUSE0')&&this.state!=='ult'&&this.state!=='dash'&&this.state!=='hit'){
      if(this.state==='attack'&&this.animName.startsWith('light')){
        if(this.animT/this.anim.dur>this.anim.hitAt-COMBO_WINDOW){ this.chainQueued=true; }
      } else if(!busyCombat){
        this.blocking=false;
        this.startLight();
      }
    }
    if(inp.justPressed('KeyR')&&this.state!=='ult'&&this.stamina>=30&&this.state!=='dash'){
      this.blocking=false; this.stamina-=30;
      this.state='attack'; this.playAnim('heavy');
      this.camera.kick(-.08,0,6);
    }

    // MENU handled by main loop (M) — pause check upstream

    // ---- movement integration ----
    let speedTarget=0;
    this.sprinting=moving&&fwd&&!this.crouching&&this.stamina>1&&this.state!=='attack';
    if(this.sprinting) this.stamina=clamp(this.stamina-14*dt,0,this.staminaMax);
    if(canMove&&moving){
      speedTarget=this.moveSpeed*(this.sprinting?this.sprintMul:this.crouching?0.45:1);
      // face movement direction (snap-y but smoothed)
      const wantFace=Math.atan2(wishX,wishZ);
      this.facing=approachAngle(this.facing,wantFace,dt*16);
      // roll tilt into strafes/dashes for flair
      const sideDot=Math.sin(angleWrap(wantFace-camYaw));
      // lean INTO the turn (matches camera roll sign convention)
      this.rollTilt=lerp(this.rollTilt,sideDot*(this.sprinting?0.06:0.03),dt*6);
    } else {
      this.rollTilt=lerp(this.rollTilt,0,dt*6);
    }

    // root motion from attacks/dashes overrides locomotion push
    let rmF=0,rmS=0;
    if((this.state==='attack'||this.state==='dash'||this.state==='ult')&&this.anim&&this.anim.rootMotion){
      const u=this.animT/this.anim.dur;
      const rm=this.anim.rootMotion(u);
      rmF=(rm.f||0)*(this.state==='dash'?16:10);
      if(this.anim.heavy) rmF*=1.4;
    }

    let vx=wishX*speedTarget+Math.sin(this.facing)*rmF;
    let vz=wishZ*speedTarget+Math.cos(this.facing)*rmF;
    if(this.state==='dash'){ // full control off during dash burst
      const u=this.animT/this.anim.dur; const mag=easeOutCubic(Math.min(1,u*2))*17*(1-u*u*0.4);
      vx=this.dashDir.x*mag; vz=this.dashDir.z*mag;
      // ghost trail
      this.trailGhost();
    }
    this.lastVx=vx; this.lastVz=vz;

    // gravity & ground
    if(!this.grounded){ this.velY+=GRAV*dt; }
    let nx=this.position.x+vx*dt, nz=this.position.z+vz*dt;
    [nx,nz]=this.world.collideMove(this.position.x,this.position.z,nx,nz,0.45);
    this.position.x=nx; this.position.z=nz;
    this.position.y+=this.velY*dt;
    const gh=this.world.groundHeightAt(this.position.x,this.position.z);
    if(this.position.y<=gh){
      if(!this.grounded){ // landing
        this.onLand(this.velY,gh);
      }
      this.position.y=gh; this.velY=0; this.grounded=true;
    } else this.grounded=false;
    this.jumpLift=this.position.y-gh;

    // ---- non-looping state transitions ----
    if(this.state==='dash'){ this.dashTimer-=dt; if(this.dashTimer<=0){this.state=this.grounded?'idle':'air'; this.invuln=false;} }
    if(this.state==='hit'&&this.animT>this.anim.dur) this.state='idle';
    if(this.state==='attack'||this.state==='parry'){
      if(this.animT>this.anim.dur){
        if(this.chainQueued&&this.animName.startsWith('light')&&this.animName!=='light5'){ this.startLight(); }
        else { this.state=this.grounded?'idle':'air'; this.combatActive=false; this.lastAttackEnd=GameState.time; }
      } else if(this.chainQueued && this.animT/this.anim.dur>this.anim.hitAt){
        this.startLight(); // buffered combo step
      }
    }
    if(this.state==='ult'){
      const uu=this.animT/this.anim.dur;
      if(!this._ultWaveDone&&uu>=Anims.ult.hitAt){ this._ultWaveDone=true; this.ultWave(enemies); }
      if(uu>=1){
        this.state='idle'; this.ultActive=false; this.invuln=false;
        document.getElementById('curse-vignette').style.opacity=0;
      }
    }

    // locomotion state selection (visual only)
    if(!busyCombat&&this.state!=='dash'&&this.state!=='ult'&&this.state!=='block'){
      if(!this.grounded) { if(this.state!=='air'&&this.state!=='land')this.state='air'; }
      else if(this.state==='land'&&this.animT<this.anim.dur){/* hold land */}
      else if(this.crouching) this.state='crouch';
      else if(moving) this.state=this.sprinting?'run':'walk';
      else this.state='idle';
    }

    // ---- attack hit resolution ----
    if((this.state==='attack'||this.state==='ult')&&this.anim){
      const u=this.animT/this.anim.dur;
      if(!this.attackHasHit&&animHitCheck(this.anim,u)){
        this.attackHasHit=true;
        if(this.anim.ult){ this.ultWave(enemies); }
        else this.resolveAttackHit(enemies);
      }
      // slash arc visual at strike moment
      if(!this._arcShown&&u>=this.anim.hitAt-0.08){
        this._arcShown=true;
        const arc=this.anim.arc||{tilt:0,roll:0,color:0xf0d27a};
        const o=this.position.clone().add(new THREE.Vector3(Math.sin(this.facing)*0.8,1.4,Math.cos(this.facing)*0.8));
        this.fx.slashArc(o,this.facing,arc.tilt,{color:arc.color,scale:arc.big?3.2:2.3,roll:arc.roll,time:arc.big?.3:.2});
        if(arc.big) FXBus.shake(.25);
      }
      if(u<0.05) this._arcShown=false;
    }

    this.updateAnim(dt);
    this.updateTrail(dt,enemies);
  }

  startLight(){
    // advance combo index with wrap; reset if too long since last
    const now=GameState.time;
    if(now-this.lastAttackEnd>1.1) this.comboIndex=0;
    const name=LIGHTS[Math.min(this.comboIndex,LIGHTS.length-1)];
    this.state='attack'; this.playAnim(name);
    this.comboIndex=(this.comboIndex+1)%LIGHTS.length;
    this.lastAttackEnd=now;
    this.camera.kick(rand(-.03,.03),rand(-.04,.04),4);
    this.invuln=this.invuln||false;
  }

  onLand(impactVel,gh){
    const hard=impactVel<-12;
    this.state='land'; this.playAnim('land');
    this.fx.dust(this.position.clone(),hard?14:6);
    if(hard){FXBus.shake(clamp(-impactVel*0.02,0,.3)); this.camera.kick(clamp(impactVel*0.008,-.1,0));}
  }

  // ---------- damage dealing ----------
  resolveAttackHit(enemies){
    const heavy=!!this.anim.heavy, ult=!!this.anim.ult;
    const range=ult?14:(heavy?4.2:2.9);
    const arcCos=ult?-1:Math.cos(ult?Math.PI:(heavy?0.9:0.75)); // ult = 360°
    const px=this.position.x,pz=this.position.z;
    const fx=Math.sin(this.facing),fz=Math.cos(this.facing);
    let anyHit=false;
    for(const e of enemies){
      if(e.dead||e.dying) continue;
      const dx=e.position.x-px,dz=e.position.z-pz;
      const d=Math.hypot(dx,dz);
      if(d>range+(e.radius||0.6)) continue;
      if(!ult){
        const dot=(dx*fx+dz*fz)/(d||1);
        if(dot<arcCos) continue;
      }
      // hit!
      anyHit=true;
      const base=(heavy?34:12)+this.effectiveAttack*(ult?6:(heavy?1.6:1));
      const crit=Math.random()<(0.12+this.stats.agi*0.008+(this.skillsUnlocked.critEye?0.15:0));
      let dmg=base*(crit?2:1)*rand(0.92,1.08);
      e.takeDamage(dmg,{fromPlayer:true,crit,knockback:heavy?6:1.6,kayaw:this.facing,lift:!!(this.anim.arc&&this.anim.arc.lift)||(heavy&&Math.random()<0.4)});
      if(crit&&this.skillsUnlocked.bloodDrinker){ this.hp=Math.min(this.maxHp,this.hp+dmg*0.08); }
      this.addCurse(ult?0:(crit?9:5));
      GameState.stats.damageDealt+=dmg;
      // impact FX at enemy chest
      const hitPos=e.position.clone().add(new THREE.Vector3(0,1.3,0));
      this.fx.blood(hitPos);
      this.fx.spawnDamageNumber(hitPos,dmg,crit?'#ffd27a':'#ffe9b0');
      if(crit){
        this.hud.feedback('CRITICAL!','crit');
        FXBus.hitstop(0.07,0.05); this.camera.kick(.06,rand(-.05,.05),6);
      }
      FXBus.shake(heavy?0.35:0.16);
      if(heavy||ult)this.camera.kick(heavy?-.1:-.15,0,heavy?8:14);
    }
    if(anyHit){
      this.hud.registerHit();
      if(ult){ /* ult handled in ultWave */ }
    } else if(this.anim.hitAt){
      // whoosh miss sound-ish feedback: tiny dust
    }
  }

  ultWave(enemies){
    // single cataclysmic AOE at the erupt frame
    this.fx.ring(this.position,{color:0xa44df0,radius:16,time:.8,yOffset:.1,widthMul:2});
    this.fx.ring(this.position,{color:0xe6b8ff,radius:11,time:.6});
    this.fx.curseBurst(this.position.clone().add(new THREE.Vector3(0,1,0)),60,2.4);
    FXBus.shake(1.0); FXBus.hitstop(.12,.05);
    this.camera.kick(.2,0,20);
    for(const e of enemies){
      if(e.dead||e.dying)continue;
      const d=dist2(e.position.x,e.position.z,this.position.x,this.position.z);
      if(d<15){
        const dmg=Math.max(140,e.hp*0.7);
        e.takeDamage(dmg,{fromPlayer:true,crit:true,knockback:14,kayaw:Math.atan2(e.position.x-this.position.x,e.position.z-this.position.z),lift:true,stun:2});
        this.fx.spawnDamageNumber(e.position.clone().add(new THREE.Vector3(0,1.5,0)),dmg,'#e6b8ff');
        this.fx.curseBurst(e.position.clone(),20,1.5);
      }
    }
    this.hud.registerHit(8); // combo jump
    this.hud.feedback('CURSE RELEASED!','kill');
  }

  // ---------- taking damage ----------
  takeDamage(amount,srcDirYaw,attacker){
    if(this.state==='dead')return false;
    // invulnerable (dash iframe / ult cast)
    if(this.invuln){
      if(this.perfectWindow>0){
        this.hud.feedback('PERFECT DODGE!','perfect');
        GameState.stats.perfectDodges++;
        FXBus.slowmo(0.5,0.25); this.addCurse(15);
        this.fx.ring(this.position,{color:0x7affb4,radius:2.2,time:.4});
        this.perfectWindow=0;
      } else {
        this.hud.feedback('DODGE','dodge');
      }
      return false;
    }
    // parry window check
    if(this.state==='parry'&&this.parryT>=0){
      const u=this.animT/Anims.parry.dur;
      const w=Anims.parry.parryWindow;
      if(u>=w[0]&&u<=w[1]){
        this.hud.feedback('PARRY!','parry');
        GameState.stats.parries++;
        attacker?.onParried?.();
        this.fx.sparks(this.position.clone().add(new THREE.Vector3(Math.sin(this.facing),1.3,Math.cos(this.facing))),1.6);
        this.fx.ring(this.position,{color:0x7ad4ff,radius:2.6,time:.4});
        FXBus.hitstop(0.1,0.04); FXBus.shake(.5);
        this.camera.kick(.1,rand(-.1,.1),10);
        this.addCurse(12);
        attacker&&attacker.stagger&&attacker.stagger(1.4);
        return false;
      }
    }
    // block reduces
    let mult=1;
    if(this.blocking){ mult=0.3; this.stamina=clamp(this.stamina-amount*1.2,0,this.staminaMax);
      this.fx.sparks(this.position.clone().add(new THREE.Vector3(Math.sin(this.facing),1.2,Math.cos(this.facing))),0.7);
      this.hud.feedback('BLOCKED','parry');
      if(this.stamina<=0){ this.blocking=false; this.stunBreak(); }
    }
    const defMit=1-(this.stats.def*0.012)-((this.gearBonus('def')||0)*0.004);
    const dmg=Math.max(1,amount*mult*Math.max(0.35,defMit));
    this.hp=clamp(this.hp-dmg,0,this.maxHp);
    this.hud.damageFlash();
    FXBus.shake(clamp(dmg*0.012,0.1,0.5));
    this.fx.blood(this.position.clone().add(new THREE.Vector3(0,1.3,0)));
    this.fx.spawnDamageNumber(this.position.clone().add(new THREE.Vector3(0,1.8,0)),dmg,'#ff6a5e');
    if(this.hp<=0){ this.die(); return true; }
    if(!this.blocking&&dmg>10){ this.state='hit'; this.playAnim('hitReact'); this.invuln=true; setTimeout(()=>this.invuln=false,350); }
    return true;
  }

  stunBreak(){
    this.hud.feedback('GUARD BROKEN!','crit');
    this.state='hit'; this.playAnim('hitReact'); FXBus.shake(.4);
  }

  die(){
    this.state='dead'; this.playAnim('death');
    this.hud.game.onPlayerDeath();
    this.fx.blood(this.position.clone().add(new THREE.Vector3(0,1,0)));
  }

  respawn(){
    this.hp=this.maxHp; this.stamina=this.staminaMax; this.curse=0;
    this.position.set(8,this.world.groundHeightAt(8,8),8);
    this.state='idle'; this.playAnim('idle'); this.deathT=0;
  }

  // ---------- procedural animation mixer ----------
  updateAnim(dt){
    const rig=this.rig;
    // advance with REAL time during hit-stop so recovery still ticks; slow-mo stretches it
    const rawRT=Math.min(0.05,GameState.realTime-(this._lastAnimReal||GameState.realTime));
    this._lastAnimReal=GameState.realTime;
    // clamp the anim-clock delta to ONE rendered frame's worth — a stable clock
    // is what keeps combat poses from strobing/jittering
    const adv=clamp(GameState.timeScale>=1?rawRT:dt,0,0.034);
    this.animT+=adv;

    // capture the pose BEFORE any reset so we can crossfade out of it
    const prevPose=capturePose(rig);

    // reset pose each frame to neutral before applying (prevents bone drift)
    rig.hips.rotation.set(0,0,0); rig.spine.rotation.set(0,0,0);
    rig.head.rotation.set(0,0,0); rig.neck.rotation.set(0,0,0);
    for(const a of [rig.armL,rig.armR]){a.sh.rotation.set(0,0,0);a.el.rotation.set(0,0,0);}
    for(const l of [rig.legL,rig.legR]){l.hip.rotation.set(0,0,0);l.knee.rotation.set(0,0,0);}
    rig.weapon.rotation.set(0,0,0);
    rig.hips.position.y=1.0;

    // resolve which clip plays this frame
    let name=this.animName;
    const actionStates=['attack','dash','ult','parry','hit','land','dead'];
    if(!actionStates.includes(this.state)){
      if(this.state==='block') name='blockIdle';
      else if(this.state==='air') name='jump';
      else if(this.state==='crouch') name='crouch';
      else if(this.state==='run') name='run';
      else if(this.state==='walk') name='walk';
      else name='idle';
      this.anim=Anims[name]; this.animName=name;
      // locomotion clips share one continuous phase clock so their sine cycles
      // never restart/pop when switching idle↔walk↔run
      if(name==='idle'||name==='walk'||name==='run'){
        this._phase=(this._phase||0)+adv;
        this.anim.onApply(rig,this._phase,name==='walk'||name==='run'?(this.sprinting?1.25:0.8):undefined);
      } else if(name==='jump'){
        this.anim.onApply(rig,this.animT,this.velY);
      } else {
        this.anim.onApply(rig,this.animT);
      }
    } else {
      const a=this.anim;
      if(a&&a.onApply){
        const t=this.animT;
        if(name==='jump') a.onApply(rig,t,this.velY);
        else if(a.loop) a.onApply(rig,t);
        else a.onApply(rig,t,clamp(t/a.dur,0,1));
      }
    }

    // ease non-looping action keys toward the previous frame's pose: kills
    // single-frame spikes (the "tick disorder" look) while staying snappy
    const w=(this.anim&&!this.anim.loop)?0.35:0;
    blendPose(rig,prevPose,w);

    // crossfade ~0.12s whenever the active clip changes (incl. into/out of attacks)
    if(this._prevApplied!==undefined&&this._prevApplied!==name)this._fadeFrom=prevPose;
    this._prevApplied=name;
    if(this._fadeFrom){
      const kf=clamp((this._fadeT||0)+adv/0.12,0,1);
      blendPose(rig,this._fadeFrom,1-smoothstep(kf));
      if(kf>=1){this._fadeFrom=null;this._fadeT=0;} else this._fadeT=kf;
    }

    finishPose(this,rig,adv);
  }

  // sword tip trail (afterimage ribbon)
  trailGhost(){
    const p=this.rig.weapon.getWorldPosition(new THREE.Vector3());
    this.fx.burst(p,{count:3,color:0xa44df0,speed:0.5,grav:0,life:.3,size:.8,spark:true});
  }
  updateTrail(dt,enemies){
    // capture blade tip position; spawn wisps when swinging fast
    if(this.combatActive&&(this.state==='attack')){
      const tip=this.rig.tipRef||(this.rig.tipRef=this.findTip());
      if(tip){
        const wp=tip.getWorldPosition(new THREE.Vector3());
        const last=this.trailPts[this.trailPts.length-1];
        if(!last||wp.distanceTo(last)>0.12){
          this.trailPts.push(wp);
          if(this.trailPts.length>10)this.trailPts.shift();
          this.fx.burst(wp,{count:2,color:this.ultActive?0xe6b8ff:0xfff2a8,speed:.4,grav:0,life:.22,size:.6,spark:true});
        }
      }
    } else if(this.trailPts.length){ this.trailPts.shift(); }
  }
  findTip(){ let found=null; this.rig.root.traverse(o=>{if(o.geometry&&o.geometry.type==='ConeGeometry'&&o.parent&&o.parent===this.rig.weapon)found=o;}); return found; }

  // cape sway based on velocity & facing
  animateExtras(dt,vx,vz){}
}

// ---------- pose capture / blend helpers (crossfade support) ----------
const POSE_BONES=(rig)=>([
  ['hips',rig.hips],['spine',rig.spine],['head',rig.head],['neck',rig.neck],
  ['armLsh',rig.armL.sh],['arm lel',rig.armL.el],['armRsh',rig.armR.sh],['armRel',rig.armR.el],
  ['legLhip',rig.legL.hip],['legLknee',rig.legL.knee],['legRhip',rig.legR.hip],['legRknee',rig.legR.knee],
  ['weapon',rig.weapon]
]);
function capturePose(rig){
  const p={y:rig.hips.position.y};
  for(const [k,b] of POSE_BONES(rig)) p[k]=[b.rotation.x,b.rotation.y,b.rotation.z];
  return p;
}
function blendPose(rig,p,w){
  if(w<=0)return;
  rig.hips.position.y=lerp(rig.hips.position.y,p.y,w);
  for(const [k,b] of POSE_BONES(rig)){
    const q=p[k]; if(!q)continue;
    b.rotation.x=lerp(b.rotation.x,q[0],w);
    b.rotation.y=lerp(b.rotation.y,q[1],w);
    b.rotation.z=lerp(b.rotation.z,q[2],w);
  }
}
function speedArg(name,pl){ return name==='walk'||name==='run'?(pl.sprinting?1.25:0.8):(name==='jump'?pl.velY:undefined); }
function applyAnim(a,rig,t,name,ph,pl){
  if(!a||!a.onApply)return;
  if(name==='jump') a.onApply(rig,t,pl.velY);
  else if(name==='walk'||name==='run') a.onApply(rig,t,pl.sprinting?1.25:0.8);
  else if(a.loop) a.onApply(rig,t);
  else a.onApply(rig,t,clamp(t/a.dur,0,1));
}
function finishPose(pl,rig,adv){
  // apply world transform
  rig.root.position.copy(pl.position);
  rig.root.rotation.y=pl.facing;
  rig.root.rotation.z=0;
  // cape sway: lag behind motion (cheap spring on each segment)
  const spd=Math.hypot(pl.lastVx||0,pl.lastVz||0);
  for(let i=0;i<rig.capeMeshes.length;i++){
    const seg=rig.capeMeshes[i];
    const target=-0.15-spd*0.03-i*0.04+Math.sin(GameState.realTime*3+i)*0.05;
    seg.rotation.x=lerp(seg.rotation.x,target+(pl.blocking?0.4:0),adv*8);
  }
  // gem & blade glow scale with curse gauge / ult state
  const glow=pl.ultActive?1:(pl.curse/pl.curseMax);
  rig.gem.scale.setScalar(1+glow*0.6+Math.sin(GameState.realTime*6)*0.08*glow);
  rig.runeLine.material.color.setHex(pl.ultActive?0xe6b8ff:0xa44df0);
  rig.visor.material.color.setHex(pl.state==='dead'?0x331010:(pl.ultActive?0xc77dff:0xff5a3c));
}
