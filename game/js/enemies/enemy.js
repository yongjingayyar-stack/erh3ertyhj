// ============ enemies/enemy.js — cursed foes: AI, attacks with telegraphs, death/loot ============
import * as THREE from 'three';
import { clamp, lerp, rand, dist2, approachAngle, angleWrap } from '../core/mathx.js';
import { GameState, FXBus } from '../core/state.js';

const TYPES={
  hollow:{ name:'Hollow Knight', hp:60, dmg:12, speed:3.4, atkRange:2.4, windup:0.85, recover:0.7, xp:22, color:0x4c5560, scale:1, desc:'A rusted soul bound to broken mail. Slashes telegraph long; punish after the swing.'},
  wretch:{name:'Curse Wretch',   hp:38, dmg:9,  speed:5.2, atkRange:1.8, windup:0.5,  recover:0.5, xp:18, color:0x7a3fbf, scale:0.85,desc:'Frenzied husk dripping purple miasma. Fast, fragile, swarms in numbers.'},
  brute:{ name:'Grave Brute',    hp:150,dmg:26, speed:2.4, atkRange:3.2, windup:1.3,  recover:1.1, xp:55, color:0x6e4b2f, scale:1.5, desc:'Hill-troll grafted with tombstone armor. Ground pound cannot be blocked — dodge it.'},
  caster:{name:'Hexmancer',      hp:55, dmg:16, speed:2.2, atkRange:16,  windup:1.2,  recover:0.9, xp:40, color:0x9a2fd4, scale:1,   desc:'Weaves curse bolts from afar. Close the gap or parry the bolt at impact.'},
  boss:{  name:'THE GRAVE WARDEN',hp:900,dmg:34, speed:3.0, atkRange:4.2, windup:1.0, recover:0.9, xp:500,color:0x8e1c1c, scale:2.2, desc:'Warden of the cursed field. Three phases of sword, slam and hex barrage.'},
};
export {TYPES};

function buildBody(type){
  const t=TYPES[type]; const s=t.scale;
  const grp=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:t.color,roughness:.8,metalness:.2});
  const eyeMat=new THREE.MeshBasicMaterial({color:type==='boss'?0xff3020:0xa44df0});
  const mk=(geo,m)=>{const x=new THREE.Mesh(geo,m||mat);x.castShadow=true;return x;};
  const bodyMat=mat.clone();
  const body=mk(new THREE.BoxGeometry(0.8*s,1.1*s,0.55*s),bodyMat); body.position.y=1.15*s; grp.add(body);
  const head=mk(new THREE.BoxGeometry(0.5*s,0.5*s,0.5*s),bodyMat); head.position.y=1.95*s; grp.add(head);
  const eyeL=mk(new THREE.BoxGeometry(0.1*s,0.06*s,0.05*s),eyeMat); eyeL.position.set(-0.12*s,1.98*s,0.26*s); grp.add(eyeL);
  const eyeR=eyeL.clone(); eyeR.position.x=0.12*s; grp.add(eyeR);
  const armL=new THREE.Group(); armL.position.set(-0.55*s,1.65*s,0); grp.add(armL);
  const armLMesh=mk(new THREE.BoxGeometry(0.22*s,0.9*s,0.22*s),bodyMat); armLMesh.position.y=-0.45*s; armL.add(armLMesh);
  const armR=new THREE.Group(); armR.position.set(0.55*s,1.65*s,0); grp.add(armR);
  const armRMesh=mk(new THREE.BoxGeometry(0.22*s,0.9*s,0.22*s),bodyMat); armRMesh.position.y=-0.45*s; armR.add(armRMesh);
  const legGeo=new THREE.BoxGeometry(0.24*s,0.7*s,0.24*s); legGeo.translate(0,-0.35*s,0);
  const legL=new THREE.Mesh(legGeo,mat.clone()); legL.position.set(-0.2*s,0.7*s,0); grp.add(legL);
  const legR=new THREE.Mesh(legGeo.clone(),mat.clone()); legR.position.set(0.2*s,0.7*s,0); grp.add(legR);
  // weapon per type
  if(type==='hollow'||type==='boss'){
    const sword=mk(new THREE.BoxGeometry(0.1*s,1.6*s,0.05*s),new THREE.MeshStandardMaterial({color:0x9aa0a8,metalness:.9,roughness:.3}));
    sword.position.set(0,-0.9*s,0.15*s); sword.rotation.z=-0.4; armR.add(sword); armR.userData.sword=sword;
  }
  if(type==='brute'){
    const fist=mk(new THREE.BoxGeometry(0.5*s,0.5*s,0.5*s),new THREE.MeshStandardMaterial({color:0x555a60,roughness:1}));
    fist.position.set(0,-0.95*s,0.15*s); armR.add(fist); armR.userData.fist=fist;
  }
  if(type==='caster'){
    const staff=mk(new THREE.CylinderGeometry(0.05*s,0.05*s,2.2*s,6),new THREE.MeshStandardMaterial({color:0x2b1d12}));
    staff.position.set(0.7*s,1.2*s,0); grp.add(staff);
    const orb=mk(new THREE.SphereGeometry(0.18*s,8,8),new THREE.MeshBasicMaterial({color:0xc77dff}));
    orb.position.set(0.7*s,2.35*s,0); grp.add(orb); staff.userData.orb=orb;
  }
  if(type==='wretch'){
    armL.children[0].geometry=new THREE.BoxGeometry(0.2*s,1.15*s,0.2*s); armL.children[0].position.y=-0.55*s;
    armR.children[0].geometry=armL.children[0].geometry.clone(); armR.children[0].position.y=-0.55*s;
  }
  if(type==='boss'){
    // horned helm + shoulder slabs
    const horn=mk(new THREE.ConeGeometry(0.12*s,0.7*s,6),new THREE.MeshStandardMaterial({color:0xd8cdb4}));
    horn.position.set(-0.25*s,2.35*s,0); horn.rotation.z=0.5; grp.add(horn);
    const horn2=horn.clone(); horn2.position.x=0.25*s; horn2.rotation.z=-0.5; grp.add(horn2);
    const slabL=mk(new THREE.BoxGeometry(0.6*s,0.35*s,0.7*s),new THREE.MeshStandardMaterial({color:0x3c3840}));
    slabL.position.set(-0.75*s,1.6*s,0); grp.add(slabL);
    const slabR=slabL.clone(); slabR.position.x=0.75*s; grp.add(slabR);
  }
  grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  return {grp,body,head,armL,armR,legL,legR,eyeMat,bodyMat};
}

export class Enemy {
  constructor(scene,type,x,z,fx,world,playerRef,hud){
    this.scene=scene; this.type=type; this.def=TYPES[type];
    this.fx=fx; this.world=world; this.player=playerRef; this.hud=hud;
    this.parts=buildBody(type);
    scene.add(this.parts.grp);
    this.radius=0.55*this.def.scale;
    this.position=new THREE.Vector3(x,world.groundHeightAt(x,z),z);
    this.hpMax=this.def.hp*(1+ (hud?.game?.waveNum?Math.min(0.6,(hud.game.waveNum-1)*0.12):0));
    this.hp=this.hpMax;
    this.state='idle';        // idle|chase|windup|strike|recover|hurt|stagger|dead
    this.t=0; this.facing=rand(0,6.28);
    this.attackCd=rand(0.5,2);
    this.dying=false; this.dead=false; this.deathT=0;
    this.vy=0; this.airborne=false;
    this.stunT=0;
    this.hitFlashT=0;
    this.bolt=null;
    this.phase=1;             // boss
    this.aggro=false;
  }

  get isBoss(){return this.type==='boss'}

  stagger(t){ this.state='stagger'; this.stunT=t; this.t=0; }
  onParried(){ this.stagger(1.6); this.fx.curseBurst(this.position.clone(),10,1); }

  takeDamage(dmg,opt={}){
    if(this.dead)return;
    this.hp-=dmg;
    this.hitFlashT=0.12;
    // knockback
    if(opt.knockback&&!this.isBoss){
      const yaw=opt.kayaw??0;
      const nx=this.position.x+Math.sin(yaw)*opt.knockback*0.25;
      const nz=this.position.z+Math.cos(yaw)*opt.knockback*0.25;
      [this.position.x,this.position.z]=this.world.collideMove(this.position.x,this.position.z,nx,nz,this.radius);
    }
    if(opt.lift&&!this.isBoss&&!this.airborne){ this.vy=7; this.airborne=true; }
    if(opt.stun) this.stagger(opt.stun);
    if(this.hp<=0){ this.die(); return; }
    if(!opt.crit&&this.state!=='windup'&&this.state!=='strike'&&Math.random()<0.35){
      this.state='hurt'; this.t=0;
    }
    this.aggro=true;
  }

  die(){
    this.dead=true; this.dying=true; this.deathT=0; this.state='dead';
    GameState.stats.kills++;
    this.fx.blood(this.position.clone().add(new THREE.Vector3(0,1,0)));
    this.fx.curseBurst(this.position.clone().add(new THREE.Vector3(0,1,0)),14,1);
    this.hud.feedback(this.isBoss?'WARDEN SLAIN':'SLAIN!','kill');
    this.hud.game.onEnemyKilled(this);
    if(this.hud.game.camera.lockTarget===this) this.hud.game.toggleLock(true);
  }

  update(dt, player, enemies){
    const p=this.parts.grp;
    // hit flash
    if(this.hitFlashT>0){ this.hitFlashT-=dt;
      p.traverse(o=>{if(o.isMesh&&o.material.emissive&&!o.material.isMeshBasicMaterial)o.material.emissive.setHex(0x881515)});
    } else p.traverse(o=>{if(o.isMesh&&o.material.emissive&&!o.material.isMeshBasicMaterial)o.material.emissive.setHex(0x000000)});

    if(this.dying){
      this.deathT+=dt;
      const k=clamp(this.deathT/0.9,0,1);
      p.rotation.x=-k*1.4;
      p.position.copy(this.position).add(new THREE.Vector3(0,-k*0.4,0));
      p.scale.setScalar(lerp(1,0.85,k));
      if(k>=1){ this.scene.remove(p); this.removed=true; }
      return;
    }

    // physics vertical
    const gh=this.world.groundHeightAt(this.position.x,this.position.z);
    if(this.airborne||this.position.y>gh){
      this.vy-=26*dt; this.position.y+=this.vy*dt;
      if(this.position.y<=gh){this.position.y=gh;this.vy=0;this.airborne=false;}
    } else this.position.y=gh;

    const pp=player.position;
    const d=dist2(this.position.x,this.position.z,pp.x,pp.z);
    const toP=Math.atan2(pp.x-this.position.x,pp.z-this.position.z);
    this.t+=dt;
    this.attackCd-=dt;
    if(this.stunT>0)this.stunT-=dt;

    // ---- state machine ----
    switch(this.state){
      case 'idle':
        if(d<28){this.state='chase'}
        break;
      case 'chase':{
        if(player.state==='dead'){this.state='idle';break;}
        this.facing=approachAngle(this.facing,toP,dt*5);
        const sp=this.def.speed*(this.isBoss?(this.phase===3?1.35:1):1);
        if(d>this.def.atkRange*0.8&&this.type!=='caster'){
          let nx=this.position.x+Math.sin(this.facing)*sp*dt;
          let nz=this.position.z+Math.cos(this.facing)*sp*dt;
          // simple separation from other enemies
          for(const e of enemies){ if(e===this||e.dead)continue;
            const dx=this.position.x-e.position.x, dz=this.position.z-e.position.z;
            const dd=Math.hypot(dx,dz);
            if(dd<this.radius+e.radius+0.3&&dd>0.01){nx+=dx/dd*0.5*dt*6;nz+=dz/dd*0.5*dt*6;}
          }
          [this.position.x,this.position.z]=this.world.collideMove(this.position.x,this.position.z,nx,nz,this.radius);
        }
        if(this.type==='caster' && d<10){ // keep distance
          this.position.x-=Math.sin(this.facing)*this.def.speed*dt;
          this.position.z-=Math.cos(this.facing)*this.def.speed*dt;
        }
        if(d<this.def.atkRange&&(this.attackCd<=0||this.type==='caster'&&d<16&&this.attackCd<=0)){
          this.state='windup'; this.t=0;
          this.telegraph();
        }
        break;
      }
      case 'windup':{
        const wu=this.def.windup*(this.isBoss&&this.phase===3?0.7:1);
        this.facing=approachAngle(this.facing,toP,dt*3);
        if(this.t>=wu){ this.state='strike'; this.t=0; this.doStrike(player); }
        break;
      }
      case 'strike':
        if(this.t>=0.18){ this.state='recover'; this.t=0; }
        break;
      case 'recover':{
        const rc=this.def.recover*(this.isBoss&&this.phase===2?0.8:1);
        if(this.t>=rc){ this.state='chase'; this.attackCd=rand(0.3,this.isBoss?0.9:1.6); }
        break;
      }
      case 'hurt':
        if(this.t>=0.3){this.state='chase'}
        break;
      case 'stagger':
        if(this.stunT<=0){this.state='chase';this.attackCd=0.6}
        break;
    }

    // boss phase transitions
    if(this.isBoss){
      const frac=this.hp/this.hpMax;
      if(frac<0.66&&this.phase===1){this.phase=2;this.bossPhaseShift();}
      if(frac<0.33&&this.phase===2){this.phase=3;this.bossPhaseShift();}
    }

    // ---- apply pose ----
    p.position.copy(this.position);
    p.rotation.set(0,this.facing,0);
    this.pose(dt);
  }

  bossPhaseShift(){
    this.fx.ring(this.position,{color:0xff3020,radius:8,time:.8,yOffset:.1,widthMul:1.6});
    this.fx.curseBurst(this.position.clone().add(new THREE.Vector3(0,1.5,0)),40,2);
    FXBus.shake(.7); this.stagger(0.6);
    this.hud.feedback(this.phase===2?'PHASE II — FURY':'PHASE III — DESCENT','kill');
  }

  telegraph(){
    // glowing warning: eyes flare + ground marker ring toward player
    const dir=new THREE.Vector3(Math.sin(this.facing),0,Math.cos(this.facing));
    this.fx.ring(this.position.clone().addScaledVector(dir,this.def.atkRange*0.5),
      {color:this.type==='brute'?0xff5a30:0xffce54,radius:this.def.atkRange*0.7,time:this.def.windup+0.15,yOffset:0.05});
    if(this.isBoss){ FXBus.shake(0.12); }
  }

  doStrike(player){
    const d=dist2(this.position.x,this.position.z,player.position.x,player.position.z);
    if(this.type==='caster'){
      // spawn hex bolt projectile
      const boltGeo=new THREE.SphereGeometry(0.22,8,8);
      const boltMat=new THREE.MeshBasicMaterial({color:0xc77dff});
      const bolt=new THREE.Mesh(boltGeo,boltMat);
      bolt.position.copy(this.position).add(new THREE.Vector3(0,1.8,0));
      const dir=new THREE.Vector3(player.position.x-bolt.position.x,player.position.y+1.2-bolt.position.y,player.position.z-bolt.position.z).normalize();
      this.scene.add(bolt);
      this.bolt={mesh:bolt,vel:dir.multiplyScalar(14),life:3,owner:this};
      return;
    }
    const range=this.def.atkRange+(this.isBoss?1.5:0.5);
    if(d<range){
      const fx=Math.sin(this.facing),fz=Math.cos(this.facing);
      const dx=player.position.x-this.position.x,dz=player.position.z-this.position.z;
      const dot=(dx*fx+dz*fz)/(d||1);
      if(dot>0.55){
        let dmg=this.def.dmg*(this.isBoss?(1+(this.phase-1)*0.25):1)*(0.9+Math.random()*0.2);
        const unblockable=this.type==='brute';
        const wasBlocking=player.blocking;
        player.takeDamage(dmg,this.facing+Math.PI,this);
        if(unblockable&&wasBlocking){ player.stamina=Math.max(0,player.stamina-45); if(player.stamina<=0)player.stunBreak(); }
        // swing arc FX
        this.fx.slashArc(this.position.clone().add(new THREE.Vector3(fx*range*0.5,1.2,fz*range*0.5)),this.facing,rand(-.5,.5),
          {color:this.type==='brute'?0xff5a30:(this.isBoss?0xff3020:0xff8a30),scale:this.def.scale*2.4,time:.22});
        if(this.type==='brute')FXBus.shake(.3);
      }
    }
    if(this.isBoss&&this.phase>=2&&Math.random()<0.5){
      // boss slam adds shockwave ring that damages if grounded nearby
      this.fx.ring(this.position,{color:0xff5a30,radius:6,time:.5});
      if(dist2(this.position.x,this.position.z,player.position.x,player.position.z)<6&&player.grounded&&player.state!=='dash'){
        player.takeDamage(this.def.dmg*0.6,this.facing+Math.PI,null);
      }
    }
  }

  // brute strikes are unblockable ground-pounds

  pose(dt){
    const P=this.parts, S=Math.sin;
    const t=GameState.realTime;
    let bob=S(t*3+this.position.x)*0.04;
    const moving=this.state==='chase';
    const walkF=moving?t*9:0;
    // legs: stride via rotation about hip pivot (mesh offset so pivot sits at top of thigh)
    const stride=moving?S(walkF)*0.7:0, stride2=moving?S(walkF+Math.PI)*0.7:0;
    P.legL.rotation.x=stride; P.legR.rotation.x=stride2;
    // arms & attack poses
    let armRR=0, armLL=0, bodyRX=0;
    if(this.state==='windup'){
      const k=clamp(this.t/(this.def.windup),0,1);
      armRR=lerp(0,-2.4,k); bodyRX=lerp(0,-0.4,k);
      if(this.type==='brute')armRR=lerp(0,2.6,k); // raise overhead
    } else if(this.state==='strike'){
      const k=clamp(this.t/0.18,0,1);
      armRR=lerp(-2.4,0.6,k); bodyRX=lerp(-0.4,0.6,k);
      if(this.type==='brute')armRR=lerp(2.6,-1.2,k);
    } else if(this.state==='stagger'||this.state==='hurt'){
      bodyRX=0.5; armRR=0.4; armLL=0.4; bob+=0.1;
    } else if(moving){
      armRR=S(walkF+Math.PI)*0.5; armLL=S(walkF)*0.5;
    }
    P.armR.rotation.x=armRR; P.armL.rotation.x=armLL;
    P.body.rotation.x=bodyRX; P.head.rotation.x=bodyRX*0.6;
    P.body.position.y=1.15*this.def.scale+bob;
    P.head.position.y=1.95*this.def.scale+bob;
    // eyes flare during windup
    const flare=this.state==='windup'?1:0.35;
    P.eyeMat.color.setRGB(flare*(this.isBoss?1:0.6),flare*0.2,flare*(this.isBoss?0.1:1));
    // wretch twitch
    if(this.type==='wretch')P.grp.rotation.z=S(t*17)*0.03;
  }
}

export function updateBolts(dt,scene,enemies,player,fx,hud){
  for(const e of enemies){
    const b=e.bolt; if(!b)continue;
    b.life-=dt;
    b.mesh.position.addScaledVector(b.vel,dt);
    fx.burst(b.mesh.position,{count:1,color:0xc77dff,speed:.5,grav:0,life:.3,size:.7,spark:true});
    const dp=dist2(b.mesh.position.x,b.mesh.position.z,player.position.x,player.position.z);
    const dy=Math.abs(b.mesh.position.y-(player.position.y+1.2));
    if(dp<0.8&&dy<1.1){
      // can be dodged or "parried" (destroyed) if player mid-parry
      if(player.state==='parry'){
        fx.sparks(b.mesh.position,1.2); hud.feedback('PARRY!','parry'); GameState.stats.parries++;
        player.addCurse(10); FXBus.hitstop(.08,.05);
      } else {
        player.takeDamage(e.def.dmg,Math.atan2(b.vel.x,b.vel.z),null);
        fx.curseBurst(b.mesh.position,10,1);
      }
      scene.remove(b.mesh); e.bolt=null; continue;
    }
    if(b.life<=0||dp<0.4){ scene.remove(b.mesh); e.bolt=null; }
  }
}
