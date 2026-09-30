// ============ core/camera.js — dynamic 3rd-person combat camera ============
import * as THREE from 'three';
import { clamp, lerp, angleWrap, smoothstep } from './mathx.js';
import { FXBus, GameState } from './state.js';

export class CombatCamera {
  constructor(camera, canvas){
    this.cam=camera; this.canvas=canvas;
    this.yaw=0; this.pitch=0.32;                 // orbit angles
    this.dist=7.5; this.distGoal=7.5;
    this.target=new THREE.Vector3();             // smoothed look-at point
    this.focus=new THREE.Vector3();              // raw desired focus (player head / lock target)
    this.sens=0.0022;
    this.lockTarget=null;                        // enemy being locked on
    this.lockBlend=0;                            // 0..1 blend toward over-shoulder
    this.shakeSeed=Math.random()*100;
    this.kickPitch=0; this.kickYaw=0;            // impulse "yank" from attacks/impacts
    this.fovBase=60; this.fovPunch=0;
    this.crouchDrop=0;
    camera.rotation.order='YXZ';
  }

  // Horizontal axis is ROLL-inverted (mouse RIGHT orbits camera LEFT),
  // vertical pitch stays standard (mouse UP looks UP).
  addLook(dx,dy){
    this.yaw   -= dx*this.sens;
    this.pitch = clamp(this.pitch + dy*this.sens, -0.45, 1.25);
  }
  kick(pitch=0,yaw=0,fov=0){ this.kickPitch+=pitch; this.kickYaw+=yaw; this.fovPunch=Math.max(this.fovPunch,fov); }

  update(dt, player, world){
    const rt=GameState.realTime;
    // ---- mouse yank (only when pointer captured & not in menu) ----
    if(document.pointerLockElement===this.canvas && !GameState.paused){
      this.addLook(GameState.mouseDX, GameState.mouseDY);
    }

    // ---- focus point: player chest, or the locked enemy (soft aim assist framing) ----
    const crouchFlag=!!(player.anim&&player.anim.crouch)||player.crouching;
    const pHead=player.position.clone().add(new THREE.Vector3(0,(crouchFlag?1.25:1.55)+ (player.jumpLift||0)*0.5,0));
    let want=pHead.clone();
    if(this.lockTarget && !this.lockTarget.dead){
      const e=this.lockTarget.position.clone().add(new THREE.Vector3(0,1.3,0));
      this.lockBlend=lerp(this.lockBlend,1,dt*6);
      want.lerpVectors(pHead,e,this.lockBlend*0.55);
    } else { this.lockBlend=lerp(this.lockBlend,0,dt*6); }
    this.target.lerp(want, 1-Math.pow(0.0008,dt)); // heavy smoothing frame-rate independent

    // ---- distance dynamics: pull back on sprint, push in during combos/lock ----
    let d=this.distBase=7.2;
    if(player.sprinting) d=9.4;
    if(player.state==='dash'||player.state==='air') d=8.6;
    if(player.combatActive) d=6.2;                // intimacy during attacks
    if(this.lockBlend>0.1) d=lerp(d,5.6,this.lockBlend);
    if(player.ultActive) d=10.5;                  // wide shot for the spectacle
    this.dist=lerp(this.dist,d,dt*5);

    // ---- collision: keep camera above terrain ----
    const camPos=new THREE.Vector3();
    for(let iter=0;iter<1;iter++){
      const yaw=this.yaw+this.kickYaw, pitch=clamp(this.pitch+this.kickPitch,-0.45,1.25);
      const horiz=this.dist*Math.cos(pitch);
      camPos.set(
        this.target.x + Math.sin(yaw)*horiz,
        this.target.y + Math.sin(pitch)*this.dist + 0.4,
        this.target.z + Math.cos(yaw)*horiz
      );
      const ground=world.groundHeightAt(camPos.x,camPos.z)+0.8;
      if(camPos.y<ground) camPos.y=ground;
    }

    // ---- screen shake ----
    const s=FXBus.shakeAmt;
    if(s>0.001){
      const t=rt*40+this.shakeSeed;
      camPos.x+=Math.sin(t*13.7)*s*0.34; camPos.y+=Math.sin(t*17.3+2)*s*0.30; camPos.z+=Math.cos(t*11.1)*s*0.34;
      this.cam.rotation.z=Math.sin(t*15.5)*s*0.035; // roll wobble = dense impact feel
    } else {
      this.cam.rotation.z=lerp(this.cam.rotation.z, player.rollTilt||0, dt*8); // subtle lean into strafes/dashes
    }

    this.cam.position.copy(camPos);
    this.cam.lookAt(this.target);

    // ---- FOV punch (snappy speed feel on dash/hits) ----
    this.fovPunch=Math.max(0,this.fovPunch-dt*40);
    const fovWant=this.fovBase + this.fovPunch + (player.sprinting?6:0) + (player.dashTimer>0?10:0) + (player.ultActive?14:0);
    this.cam.fov=lerp(this.cam.fov, fovWant, dt*10);
    this.cam.updateProjectionMatrix();

    // decay kicks
    this.kickPitch=lerp(this.kickPitch,0,dt*10);
    this.kickYaw=lerp(this.kickYaw,0,dt*10);
  }
}
