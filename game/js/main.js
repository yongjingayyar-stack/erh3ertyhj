// ============ main.js — game bootstrap, loop, wave director, lock-on ============
import * as THREE from 'three';
import { GameState, initInput, FXBus } from './core/state.js';
import { World } from './core/world.js';
import { CombatCamera } from './core/camera.js';
import { FXSystem } from './fx/effects.js';
import { Player } from './player/player.js';
import { Enemy, TYPES, updateBolts } from './enemies/enemy.js';
import { HUD } from './ui/hud.js';
import { Menu, ItemManager, LootSystem } from './ui/menu.js';
import { dist2, rand } from './core/mathx.js';

const canvas=document.getElementById('c');

export class Game{
  constructor(){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.15;

    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,400);
    this.input=initInput(canvas);
    this.world=new World(this.scene);
    this.fx=new FXSystem(this.scene);
    this.camCtl=new CombatCamera(this.camera,canvas);
    this.hud=new HUD(this);
    this.menu=new Menu(this);
    this.items=new ItemManager(this);
    this.player=new Player(this.scene,this.input,this.world,this.fx,this.camCtl,this.hud);
    this.player.position.y=this.world.groundHeightAt(8,8);
    this.enemies=[];
    this.lootPiles=[];
    this.waveNum=0;
    this.bestiarySeen={};
    this.spawnQueue=[]; this.spawnTimer=0;
    this.bossSpawned=false;
    this.lockKeyHeld=false;
    this.lastTime=performance.now();

    // starter kit
    this.player.equipment.weapon='sword_rusted';
    this.player.equipment.armor='armor_chain';
    this.items.recalcDerived();
    this.player.hp=this.player.maxHp;

    addEventListener('resize',()=>{
      this.camera.aspect=innerWidth/innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth,innerHeight);
    });

    document.getElementById('btn-start').onclick=()=>this.start();
    document.getElementById('btn-respawn').onclick=()=>this.respawn();
    document.getElementById('btn-again').onclick=()=>location.reload();

    this.nextWave();
    this.loop=this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  start(){
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    GameState.started=true;
    canvas.requestPointerLock();
    this.hud.toast('⚔ The cursed field hungers for a champion…');
  }

  // ---------- wave director ----------
  nextWave(){
    this.waveNum++;
    const n=this.waveNum;
    if(n>=5&&!this.bossSpawned){
      this.bossSpawned=true;
      this.hud.wave('THE WARDEN AWAKENS','Gravekeeper of the Blighted Choir');
      this.queueSpawns([['boss',1]]);
      return;
    }
    if(this.bossSpawned&&this.enemies.length===0&&this.spawnQueue.length===0){
      this.victory(); return;
    }
    const comps=[
      [['hollow',2],['wretch',2]],
      [['hollow',3],['wretch',3],['caster',1]],
      [['brute',1],['hollow',3],['wretch',2]],
      [['caster',2],['brute',1],['wretch',5],['hollow',2]],
    ][Math.min(n-1,3)];
    this.hud.wave(`HORDE ${['I','II','III','IV'][Math.min(n-1,3)]}`,'The cursed ones approach…');
    this.queueSpawns(comps);
  }

  queueSpawns(list){
    for(const [type,count] of list){
      for(let i=0;i<count;i++) this.spawnQueue.push(type);
    }
    // shuffle
    for(let i=this.spawnQueue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.spawnQueue[i],this.spawnQueue[j]]=[this.spawnQueue[j],this.spawnQueue[i]];}
  }

  spawnEnemy(type){
    const a=rand(0,Math.PI*2), d=rand(38,70);
    let x=Math.cos(a)*d, z=Math.sin(a)*d;
    if(type==='boss'){ x=0; z=-30; }
    const e=new Enemy(this.scene,type,x,z,this.fx,this.world,this.player,this.hud);
    this.enemies.push(e);
    this.bestiarySeen[type]=true;
    if(type==='boss')this.hud.toast('☠ <b>THE GRAVE WARDEN</b> strides forth','epic');
    this.fx.curseBurst(e.position.clone().add(new THREE.Vector3(0,.5,0)),12,1);
  }

  onEnemyKilled(e){
    this.player.addXP(Math.round(e.def.xp*(1+(e.isBoss?0:0))));
    this.player.addCurse(e.isBoss?100:rand(10,18)*(1+(this.player.skillsUnlocked.critEye?0.1:0)));
    // loot pile at corpse
    const g=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),
      new THREE.MeshStandardMaterial({color:0xffce54,emissive:0x9a6b00,metalness:.8,roughness:.3}));
    g.position.copy(e.position).add(new THREE.Vector3(0,.4,0));
    g.userData.item=LootSystem.roll();
    if(e.isBoss)g.userData.item='trink_wardenheart';
    this.scene.add(g);
    this.lootPiles.push({mesh:g,t:0});
    this.fx.ring(e.position,{color:0xffce54,radius:2,time:.5});
    // wave completion check
    setTimeout(()=>{
      if(this.spawnQueue.length===0&&this.enemies.filter(x=>!x.dead).length===0&&!this.gameOver){
        if(!this.bossSpawned)this.nextWave();
        else this.victory();
      }
    },1200);
  }

  toggleLock(forceOff){
    if(forceOff||this.camCtl.lockTarget){
      this.camCtl.lockTarget=null; return;
    }
    let best=null,bd=40;
    for(const e of this.enemies){
      if(e.dead)continue;
      const d=dist2(e.position.x,e.position.z,this.player.position.x,this.player.position.z);
      if(d<bd){bd=d;best=e;}
    }
    this.camCtl.lockTarget=best;
    if(best)this.fx.ring(best.position,{color:0x7ad4ff,radius:1.2,time:.3});
  }

  onPlayerDeath(){
    this.gameOver=true;
    document.getElementById('death-screen').classList.remove('hidden');
    document.exitPointerLock?.();
  }

  respawn(){
    document.getElementById('death-screen').classList.add('hidden');
    this.gameOver=false;
    this.player.respawn();
    canvas.requestPointerLock();
    this.hud.toast('The curse refuses to release you… yet.');
  }

  victory(){
    if(this.won)return; this.won=true;
    GameState.won=true;
    const s=GameState.stats;
    document.getElementById('win-stats').textContent=
      `Level ${this.player.level} · ${s.kills} slain · ${s.parries} parries · ${s.perfectDodges} perfect dodges\nMax combo ${s.maxCombo} · ${Math.round(s.damageDealt)} damage dealt`;
    document.getElementById('win-screen').classList.remove('hidden');
    document.exitPointerLock?.();
  }

  // ---------- main loop ----------
  loop(now){
    requestAnimationFrame(this.loop);
    let dtReal=Math.min(0.05,(now-this.lastTime)/1000);
    this.lastTime=now;
    GameState.realTime+=dtReal;
    FXBus.update(dtReal);

    const M=this.input.justPressed('KeyM');
    if(M&&GameState.started&&!this.gameOver)this.menu.toggle();
    if(GameState.paused){ this.input.endFrame(); this.renderer.render(this.scene,this.camera); return; }

    if(GameState.started&&!GameState.paused&&!GameState.won){
      const dt=dtReal*GameState.timeScale;
      GameState.time+=dt;

      // menu consume clicks so opening doesn't swing sword
      this.player.update(dt,this.enemies);
      for(const e of this.enemies)if(!e.removed)e.update(dt,this.player,this.enemies);
      this.enemies=this.enemies.filter(e=>!e.removed);
      updateBolts(dt,this.scene,this.enemies,this.player,this.fx,this.hud);
      this.world.update(dt,GameState.realTime);
      this.fx.update(dt);
      // move directional light with player so 2k shadow map stays tight
      const pp=this.player.position;
      this.world.sun.position.set(pp.x-60,80,pp.z-90);
      this.world.sun.target.position.copy(pp);
      this.world.sun.target.updateMatrixWorld();
      if(!this.world.sun.target.parent) this.scene.add(this.world.sun.target);

      // staggered spawning (no pop-in ambush)
      this.spawnTimer-=dt;
      if(this.spawnQueue.length&&this.spawnTimer<=0&&this.enemies.length<14){
        this.spawnEnemy(this.spawnQueue.shift());
        this.spawnTimer=rand(0.5,1.4);
      }

      // loot pickup (F or proximity)
      for(const l of this.lootPiles){
        l.t+=dt;
        l.mesh.rotation.y+=dt*2;
        l.mesh.position.y=l.mesh.userData.baseY??(l.mesh.userData.baseY=l.mesh.position.y)+Math.sin(l.t*3)*0.12;
        const d=dist2(l.mesh.position.x,l.mesh.position.z,this.player.position.x,this.player.position.z);
        if(d<1.6||((d<3)&&this.input.justPressed('KeyF'))){
          this.items.add(l.mesh.userData.item);
          this.scene.remove(l.mesh); l.done=true;
        }
      }
      this.lootPiles=this.lootPiles.filter(l=>!l.done);

      // lock-on cycling with Tab-ish (use Q? no) → mouse wheel not needed; RShift toggles, handled in player
      this.camCtl.update(dt,this.player,this.world);
      this.hud.update(dt,this.player);
    } else {
      // still render idle world ambience while paused/title
      this.world.update(dtReal,GameState.realTime);
      this.fx.update(dtReal*0.2);
      this.camCtl.update(dtReal,this.player,this.world);
    }

    this.renderer.render(this.scene,this.camera);
    this.input.endFrame();
  }
}

new Game();
