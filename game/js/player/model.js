// ============ player/model.js — knight rig built from primitives ============
import * as THREE from 'three';

// Builds a humanoid "bone" hierarchy of grouped meshes so we can keyframe
// torso/arms/legs/weapon procedurally (no external assets).
export function buildKnight(){
  const mk=(color,metal=.3,rough=.7)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});
  const steel=mk(0x6a6f78,.85,.35), dark=mk(0x221d18,.2,.9), leather=mk(0x3b2c1e,.1,.95),
        cloth=mk(0x5c1f24,.05,.9), gold=mk(0xc9a24b,.9,.3), skin=mk(0xb98a63,0,.8),
        curse=mk(0x7a3fbf,.4,.4);

  const root=new THREE.Group();                 // placed at feet level
  const hips=new THREE.Group(); hips.position.y=1.0; root.add(hips);

  // pelvis + belt
  const pelvis=new THREE.Mesh(new THREE.BoxGeometry(.52,.26,.34),dark); hips.add(pelvis);
  const belt=new THREE.Mesh(new THREE.BoxGeometry(.56,.1,.38),gold); belt.position.y=.1; hips.add(belt);

  // ---- torso chain ----
  const spine=new THREE.Group(); spine.position.y=.14; hips.add(spine);
  const chest=new THREE.Mesh(new THREE.BoxGeometry(.62,.62,.38),steel); chest.position.y=.34; spine.add(chest);
  const tabard=new THREE.Mesh(new THREE.BoxGeometry(.5,.7,.42),cloth); tabard.position.set(0,.3,.01); spine.add(tabard);
  const pauldronL=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),steel); pauldronL.position.set(.4,.55,0); pauldronL.scale.set(1,.8,.9); spine.add(pauldronL);
  const pauldronR=pauldronL.clone(); pauldronR.position.x=-.4; spine.add(pauldronR);
  // cursed gem on chest (glows with ult gauge)
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.09),new THREE.MeshBasicMaterial({color:0xa44df0}));
  gem.position.set(0,.5,.2); spine.add(gem);

  // ---- head ----
  const neck=new THREE.Group(); neck.position.y=.72; spine.add(neck);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.3,.34,.3),steel); head.position.y=.2; neck.add(head);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.26,.1,.06),new THREE.MeshBasicMaterial({color:0xff5a3c}));
  visor.position.set(0,.22,.16); neck.add(visor);
  const plume=new THREE.Mesh(new THREE.ConeGeometry(.05,.3,6),cloth); plume.position.set(0,.42,-.08); plume.rotation.x=-.4; neck.add(plume);

  // ---- arms (shoulder -> upper -> elbow -> forearm -> hand) ----
  function arm(side){ // side: 1 left, -1 right
    const sh=new THREE.Group(); sh.position.set(.34*side,.56,0); spine.add(sh);
    const upper=new THREE.Mesh(new THREE.BoxGeometry(.15,.42,.15),leather); upper.position.y=-.24; sh.add(upper);
    const el=new THREE.Group(); el.position.y=-.46; sh.add(el);
    const fore=new THREE.Mesh(new THREE.BoxGeometry(.13,.4,.13),steel); fore.position.y=-.2; el.add(fore);
    const hand=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.12),skin); hand.position.y=-.42; el.add(hand);
    return {sh,el,hand};
  }
  const armL=arm(1), armR=arm(-1);

  // ---- weapon in RIGHT hand: cursed longsword ----
  const weapon=new THREE.Group();
  armR.hand.add(weapon);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.22,6),dark); grip.position.y=-.05; weapon.add(grip);
  const guard=new THREE.Mesh(new THREE.BoxGeometry(.26,.05,.06),gold); guard.position.y=.08; weapon.add(guard);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.07,1.15,.02),steel); blade.position.y=.68; weapon.add(blade);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.05,.18,4),steel); tip.position.y=1.34; weapon.add(tip);
  const runeLine=new THREE.Mesh(new THREE.BoxGeometry(.02,1.0,.025),new THREE.MeshBasicMaterial({color:0xa44df0}));
  runeLine.position.set(0,.68,.012); weapon.add(runeLine);
  weapon.rotation.x=-Math.PI/2*0; // default pointing down along arm; anims override

  // shield on LEFT forearm
  const shield=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.07,8),steel);
  shield.rotation.z=Math.PI/2; shield.position.set(.12,-.3,0); armL.el.add(shield);
  const shieldFace=new THREE.Mesh(new THREE.CircleGeometry(.26,8),cloth);
  shieldFace.rotation.y=Math.PI/2; shieldFace.position.set(.16,-.3,0); armL.el.add(shieldFace);

  // ---- legs ----
  function leg(side){
    const hip=new THREE.Group(); hip.position.set(.16*side,-.1,0); hips.add(hip);
    const thigh=new THREE.Mesh(new THREE.BoxGeometry(.18,.44,.18),leather); thigh.position.y=-.26; hip.add(thigh);
    const knee=new THREE.Group(); knee.position.y=-.5; hip.add(knee);
    const shin=new THREE.Mesh(new THREE.BoxGeometry(.16,.42,.16),steel); shin.position.y=-.22; knee.add(shin);
    const boot=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.28),dark); boot.position.set(0,-.46,.05); knee.add(boot);
    return {hip,knee};
  }
  const legL=leg(1), legR=leg(-1);

  // ---- cape attached to spine, physics-ish sway ----
  const cape=new THREE.Group(); spine.add(cape);
  const capeMeshes=[];
  for(let i=0;i<4;i++){
    const seg=new THREE.Mesh(new THREE.BoxGeometry(.58,.3,.04),cloth);
    seg.position.set(0,-.1-i*.3,-.2-i*.05);
    cape.add(seg); capeMeshes.push(seg);
  }

  root.traverse(o=>{ if(o.isMesh){o.castShadow=true;} });

  return {root,hips,spine,neck,head:neck,armL,armR,legL,legR,weapon,shield,gem,blade,runeLine,visor,cape,capeMeshes,pauldronL,pauldronR};
}
