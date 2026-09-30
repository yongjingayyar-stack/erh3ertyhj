// ============ fx/effects.js — impacts, slash arcs, trails, particles ============
import * as THREE from 'three';
import { rand } from '../core/mathx.js';

export class FXSystem {
  constructor(scene){
    this.scene=scene;
    this.particles=[];        // {mesh,vel,life,maxLife,grav,fadeScale}
    this.slashArcs=[];        // animated arc meshes
    this.trailPool=null;
    this.rings=[];            // expanding shockwave rings
    this.dmgNums=[];          // canvas-sprite damage numbers
    this.initParticlePools();
    this.initRingGeo();
    this.initSlashGeo();
    this.initDmgSpriteCache();
  }

  initParticlePools(){
    // shared geometries for cheap particles
    this.boxGeo=new THREE.BoxGeometry(0.12,0.12,0.12);
    this.sparkGeo=new THREE.SphereGeometry(0.06,5,5);
  }

  initRingGeo(){
    this.ringGeo=new THREE.RingGeometry(0.86,1,40);
    this.ringGeo.rotateX(-Math.PI/2);
  }

  initSlashGeo(){
    // crescent arc: a torus segment (flat) used for sword trails / slashes
    this.arcGeo=new THREE.TorusGeometry(1,0.075,6,32,Math.PI*1.15);
  }

  initDmgSpriteCache(){}

  makeDmgSprite(text,color='#ffe9b0',size=48){
    const cv=document.createElement('canvas'); cv.width=256; cv.height=128;
    const ctx=cv.getContext('2d');
    ctx.font=`900 ${size}px Cinzel, serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.lineWidth=8; ctx.strokeStyle='#000'; ctx.strokeText(text,128,64);
    ctx.fillStyle=color; ctx.fillText(text,128,64);
    const tex=new THREE.CanvasTexture(cv);
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
    spr.scale.set(2.2,1.1,1);
    return spr;
  }

  spawnDamageNumber(pos,val,color){
    const s=this.makeDmgSprite(String(Math.round(val)),color, val>=40?58:44);
    s.position.copy(pos).add(new THREE.Vector3(rand(-.4,.4),rand(1.6,2.2),rand(-.4,.4)));
    this.scene.add(s);
    this.dmgNums.push({spr:s,vy:rand(2.2,3.4),life:0,max:1.1});
  }

  // ---- burst of generic particles at point ----
  burst(pos,{count=14,color=0xffcc66,speed=6,size=1,grav=9,life=.6,spark=false}={}){
    for(let i=0;i<count;i++){
      const geo=spark?this.sparkGeo:this.boxGeo;
      const mat=new THREE.MeshBasicMaterial({color,transparent:true});
      const m=new THREE.Mesh(geo,mat);
      m.scale.setScalar(size*rand(.6,1.3));
      m.position.copy(pos);
      const dir=new THREE.Vector3(rand(-1,1),rand(-.1,1),rand(-1,1)).normalize();
      this.scene.add(m);
      this.particles.push({m,vel:dir.multiplyScalar(speed*rand(.5,1.2)),life:0,max:life*rand(.7,1.2),grav,fade:true});
    }
  }

  // blood splatter: dark red chunks + mist
  blood(pos,dirHint){
    this.burst(pos,{count:16,color:0x8e1c1c,speed:7,grav:14,life:.55,size:1.1});
    this.burst(pos,{count:8,color:0xd33b3b,speed:3,grav:6,life:.4,size:.7,spark:true});
  }

  // metallic sparks for parry/block
  sparks(pos,intensity=1){
    this.burst(pos,{count:Math.round(22*intensity),color:0xfff2a8,speed:11*intensity,grav:16,life:.4,size:.9,spark:true});
    this.burst(pos,{count:Math.round(10*intensity),color:0x7ad4ff,speed:7,grav:10,life:.5,size:1.1,spark:true});
  }

  // curse energy wisps (purple)
  curseBurst(pos,count=18,power=1){
    this.burst(pos,{count,color:0xa44df0,speed:5*power,grav:-2,life:.9,size:1.2,spark:true});
    this.burst(pos,{count:Math.round(count/2),color:0xe6b8ff,speed:3*power,grav:-1,life:1.1,size:.8,spark:true});
  }

  // dust puff for landing/dash
  dust(pos,count=8){
    this.burst(pos,{count,color:0x6b5b46,speed:2.4,grav:1.5,life:.7,size:1.4});
  }

  // ---- expanding ground ring (shockwave / dash marker / ult) ----
  ring(pos,{color=0xffffff,radius=3,time=.45,yOffset=0.06,widthMul=1}={}){
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false});
    const m=new THREE.Mesh(this.ringGeo,mat);
    m.position.copy(pos); m.position.y+=yOffset;
    m.scale.setScalar(0.1*widthMul);
    this.scene.add(m);
    this.rings.push({m,mat,life:0,max:time,target:radius});
  }

  // ---- slash arc: oriented crescent that flashes & fades ----
  slashArc(origin, facingYaw, tiltAxis, {color=0xf0d27a,scale=2.2,time=.22,roll=0}={}){
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false});
    const m=new THREE.Mesh(this.arcGeo,mat);
    m.position.copy(origin);
    m.rotation.order='YXZ';
    m.rotation.y=facingYaw+roll;
    m.rotation.x=tiltAxis;
    m.scale.setScalar(scale);
    this.scene.add(m);
    this.slashArcs.push({m,mat,life:0,max:time,spin:rand(2,5)});
  }

  update(dt){
    // particles
    for(const p of this.particles){
      p.life+=dt;
      p.vel.y-=p.grav*dt;
      p.m.position.addScaledVector(p.vel,dt);
      const u=p.life/p.max;
      if(p.fade) p.m.material.opacity=Math.max(0,1-u);
      p.m.rotation.x+=dt*6;p.m.rotation.z+=dt*4;
      if(p.m.position.y<0) {p.m.position.y=0;p.vel.y*=-0.3;p.vel.x*=.6;p.vel.z*=.6;}
    }
    this.particles=this.particles.filter(p=>{
      if(p.life>=p.max){this.scene.remove(p.m);p.m.material.dispose();return false}
      return true;
    });
    // rings
    for(const r of this.rings){
      r.life+=dt;
      const u=r.life/r.max;
      const s=lerpS(0.1,r.target,easeOut(u));
      r.m.scale.set(s,s,s);
      r.mat.opacity=0.9*(1-u);
    }
    this.rings=this.rings.filter(r=>{
      if(r.life>=r.max){this.scene.remove(r.m);r.mat.dispose();return false}
      return true;
    });
    // slash arcs
    for(const s of this.slashArcs){
      s.life+=dt;
      const u=s.life/s.max;
      s.mat.opacity=1-u;
      s.m.scale.multiplyScalar(1+dt*3.5);
      s.m.rotation.y+=dt*s.spin;
    }
    this.slashArcs=this.slashArcs.filter(s=>{
      if(s.life>=s.max){this.scene.remove(s.m);s.mat.dispose();return false}
      return true;
    });
    // damage numbers
    for(const d of this.dmgNums){
      d.life+=dt;
      d.spr.position.y+=d.vy*dt; d.vy-=6*dt;
      d.spr.material.opacity=Math.max(0,1-d.life/d.max);
    }
    this.dmgNums=this.dmgNums.filter(d=>{
      if(d.life>=d.max){this.scene.remove(d.spr);d.spr.material.map.dispose();d.spr.material.dispose();return false}
      return true;
    });
  }
}
const easeOut=t=>1-Math.pow(1-t,2);
const lerpS=(a,b,t)=>a+(b-a)*t;
