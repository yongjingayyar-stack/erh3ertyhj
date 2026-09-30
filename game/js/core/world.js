// ============ core/world.js — dark fantasy open world (terrain, ruins, fog) ============
import * as THREE from 'three';
import { rand, clamp } from './mathx.js';

export class World {
  constructor(scene){
    this.scene=scene;
    this.size=240;             // world half-extent handled by radius
    this.radius=115;           // play area radius (invisible cursed border)
    this.colliders=[];         // {x,z,r} cylinders for props
    this.trees=[];
    this.buildTerrain();
    this.buildSky();
    this.buildLights();
    this.buildProps();
    this.buildBorder();
  }

  // deterministic fractal heightfield
  h(x,z){
    return Math.sin(x*0.045)*Math.cos(z*0.05)*2.2
         + Math.sin(x*0.11+3.1)*Math.cos(z*0.09-1.7)*0.9
         + Math.sin((x+z)*0.02)*1.6;
  }
  groundHeightAt(x,z){
    const d=Math.sqrt(x*x+z*z);
    let h=this.h(x,z);
    if(d>this.radius-8) h+= (d-(this.radius-8))*0.35; // rise into cursed hills at edge
    return h;
  }

  buildTerrain(){
    const seg=120;
    const g=new THREE.PlaneGeometry(this.radius*2.4,this.radius*2.4,seg,seg);
    g.rotateX(-Math.PI/2);
    const pos=g.attributes.position;
    const colors=[];
    const cGrass=new THREE.Color(0x2a3320), cMud=new THREE.Color(0x3b2f22), cRock=new THREE.Color(0x4a4a4e), cCurse=new THREE.Color(0x2b1740);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i), z=pos.getZ(i);
      const y=this.groundHeightAt(x,z);
      pos.setY(i,y);
      const n=(Math.sin(x*0.7)*Math.cos(z*0.6)+Math.sin(x*0.13+z*0.17))/2;
      const col=cGrass.clone().lerp(cMud,clamp(0.5+n*0.5,0,1));
      if(y>2.4) col.lerp(cRock,(y-2.4)/3);
      const d=Math.sqrt(x*x+z*z);
      if(d>this.radius*0.82) col.lerp(cCurse,(d-this.radius*0.82)/(this.radius*0.2));
      colors.push(col.r,col.g,col.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});
    const mesh=new THREE.Mesh(g,m);
    mesh.receiveShadow=true;
    this.scene.add(mesh);
    this.terrainMesh=mesh;
  }

  buildSky(){
    this.scene.background=new THREE.Color(0x120d16);
    this.scene.fog=new THREE.FogExp2(0x171021,0.016);
    // blood moon
    const moon=new THREE.Mesh(new THREE.SphereGeometry(9,24,24),
      new THREE.MeshBasicMaterial({color:0xd86a5a}));
    moon.position.set(-140,95,-220);
    this.scene.add(moon);
    const halo=new THREE.Mesh(new THREE.SphereGeometry(16,24,24),
      new THREE.MeshBasicMaterial({color:0x8a3a35,transparent:true,opacity:0.22}));
    halo.position.copy(moon.position);
    this.scene.add(halo);
    this.moon=moon;
    // drifting curse motes across the sky
    const n=420, p=new Float32Array(n*3);
    for(let i=0;i<n;i++){p[i*3]=rand(-120,120);p[i*3+1]=rand(2,40);p[i*3+2]=rand(-120,120);}
    const gg=new THREE.BufferGeometry();
    gg.setAttribute('position',new THREE.BufferAttribute(p,3));
    this.motes=new THREE.Points(gg,new THREE.PointsMaterial({color:0xa44df0,size:0.28,transparent:true,opacity:0.65}));
    this.scene.add(this.motes);
  }

  buildLights(){
    const hemi=new THREE.HemisphereLight(0x4a3a60,0x1a120c,0.7);
    this.scene.add(hemi);
    const dir=new THREE.DirectionalLight(0xff9a7a,1.15);   // moonlit dusk key
    dir.position.set(-60,80,-90);
    dir.castShadow=true;
    dir.shadow.mapSize.set(2048,2048);
    const s=dir.shadow.camera; s.left=-70;s.right=70;s.top=70;s.bottom=-70;s.near=1;s.far=260;
    dir.shadow.bias=-0.0006;
    this.scene.add(dir);
    this.sun=dir;
    this.fireLights=[];
  }

  addBrazier(x,z){
    const grp=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.14,2.2,6),
      new THREE.MeshStandardMaterial({color:0x2b2b2b,metalness:.8,roughness:.5}));
    pole.position.y=1.1; pole.castShadow=true; grp.add(pole);
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.25,0.4,8,1,true),
      new THREE.MeshStandardMaterial({color:0x33241a,metalness:.7,roughness:.4,side:THREE.DoubleSide}));
    bowl.position.y=2.3; grp.add(bowl);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(0.34,1.1,7),
      new THREE.MeshBasicMaterial({color:0xff8a30,transparent:true,opacity:.9}));
    flame.position.y=2.9; grp.add(flame);
    const light=new THREE.PointLight(0xff7a2a,22,26,2);
    light.position.y=3; grp.add(light);
    grp.position.set(x,this.groundHeightAt(x,z),z);
    this.scene.add(grp);
    this.fireLights.push({flame,light,seed:rand(10)});
    this.colliders.push({x,z,r:0.6});
  }

  buildProps(){
    const stoneMat=new THREE.MeshStandardMaterial({color:0x55525c,roughness:.95});
    const darkStone=new THREE.MeshStandardMaterial({color:0x3c3840,roughness:1});

    // ---- central ruined arena: broken ring of pillars ----
    for(let i=0;i<14;i++){
      const a=i/14*Math.PI*2;
      const r=22+Math.sin(i*3.7)*2;
      const x=Math.cos(a)*r, z=Math.sin(a)*r;
      const hgt=rand(3,9)*(i%3===0?1.3:1);
      const pil=new THREE.Mesh(new THREE.BoxGeometry(1.7,hgt,1.7), i%2?stoneMat:darkStone);
      pil.position.set(x,this.groundHeightAt(x,z)+hgt/2,z);
      pil.rotation.y=a+rand(-.2,.2);
      if(Math.random()<0.3) pil.rotation.z=rand(-.12,.12); // leaning ruin
      pil.castShadow=pil.receiveShadow=true;
      this.scene.add(pil);
      this.colliders.push({x,z,r:1.5});
      // rubble at base
      const rub=new THREE.Mesh(new THREE.DodecahedronGeometry(rand(.4,.9)),darkStone);
      rub.position.set(x+rand(-1.5,1.5),this.groundHeightAt(x,z)+.3,z+rand(-1.5,1.5));
      rub.castShadow=true; this.scene.add(rub);
    }
    // altar at center
    const altar=new THREE.Mesh(new THREE.BoxGeometry(3.4,1.1,2.2),darkStone);
    altar.position.set(0,this.groundHeightAt(0,0)+0.55,0);
    altar.castShadow=altar.receiveShadow=true; this.scene.add(altar);
    this.colliders.push({x:0,z:0,r:2.2});
    this.altarPos=new THREE.Vector3(0,this.groundHeightAt(0,0)+1.2,0);
    // cursed flame on altar
    const cf=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.6,8),new THREE.MeshBasicMaterial({color:0xa44df0,transparent:true,opacity:.85}));
    cf.position.copy(this.altarPos).add(new THREE.Vector3(0,0.8,0)); this.scene.add(cf);
    const cl=new THREE.PointLight(0xa44df0,30,30,2); cl.position.copy(cf.position); this.scene.add(cl);
    this.altarFlame={m:cf,l:cl};

    // braziers around arena
    [[14,0],[-14,0],[0,14],[0,-14],[10,10],[-10,-10]].forEach(([x,z])=>this.addBrazier(x,z));

    // ---- dead forest ----
    const bark=new THREE.MeshStandardMaterial({color:0x2e241c,roughness:1});
    for(let i=0;i<90;i++){
      const a=rand(0,Math.PI*2), d=rand(30,this.radius-6);
      const x=Math.cos(a)*d, z=Math.sin(a)*d;
      if(Math.abs(x)<26&&Math.abs(z)<26) continue;
      const h=rand(6,13);
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.4,h,6),bark);
      trunk.position.set(x,this.groundHeightAt(x,z)+h/2,z);
      trunk.rotation.z=rand(-.08,.08); trunk.castShadow=true;
      this.scene.add(trunk);
      // gnarled branches
      for(let b=0;b<3;b++){
        const br=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.12,rand(1.5,3.4),4),bark);
        br.position.set(x,this.groundHeightAt(x,z)+h*rand(.55,.9),z);
        br.rotation.set(rand(.6,1.4),rand(0,6.28),0);
        br.castShadow=true; this.scene.add(br);
      }
      this.colliders.push({x,z,r:0.55});
      this.trees.push({x,z});
    }

    // ---- scattered crypt rocks / monoliths ----
    for(let i=0;i<26;i++){
      const a=rand(0,Math.PI*2), d=rand(24,this.radius-10);
      const x=Math.cos(a)*d, z=Math.sin(a)*d;
      const h=rand(2.5,6);
      const mono=new THREE.Mesh(new THREE.BoxGeometry(rand(.8,1.6),h,rand(.5,1)),darkStone);
      mono.position.set(x,this.groundHeightAt(x,z)+h/2,z);
      mono.rotation.set(rand(-.1,.1),rand(0,6.28),rand(-.1,.1));
      mono.castShadow=mono.receiveShadow=true; this.scene.add(mono);
      this.colliders.push({x,z,r:1.1});
    }

    // ---- abandoned camp: tents & crates near arena ----
    const cloth=new THREE.MeshStandardMaterial({color:0x4a3a2a,roughness:1});
    const wood=new THREE.MeshStandardMaterial({color:0x4f3a24,roughness:.9});
    for(let i=0;i<5;i++){
      const x=rand(-34,34), z=rand(-34,34);
      if(Math.sqrt(x*x+z*z)<26) continue;
      const tent=new THREE.Mesh(new THREE.ConeGeometry(1.8,2.6,4),cloth);
      tent.position.set(x,this.groundHeightAt(x,z)+1.3,z); tent.rotation.y=rand(0,6.28);
      tent.castShadow=true; this.scene.add(tent);
      this.colliders.push({x,z,r:1.4});
      const crate=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),wood);
      crate.position.set(x+rand(-2,2),this.groundHeightAt(x,z)+.5,z+rand(-2,2));
      crate.rotation.y=rand(0,6.28); crate.castShadow=true; this.scene.add(crate);
    }
  }

  buildBorder(){
    // curtain of purple curse energy at world edge
    const g=new THREE.CylinderGeometry(this.radius+2,this.radius+2,30,64,1,true);
    const m=new THREE.ShaderMaterial({
      transparent:true, side:THREE.BackSide, depthWrite:false,
      uniforms:{uTime:{value:0}},
      vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uTime; varying vec2 vUv;
        void main(){
          float f=sin(vUv.x*40.+uTime*2.)*0.5+0.5;
          f*=sin(vUv.y*8.-uTime*1.4)*0.5+0.5;
          float fade=smoothstep(1.,0.1,vUv.y);
          gl_FragColor=vec4(0.45+f*0.2,0.15,0.75,f*(0.10+fade*0.18));
        }`});
    this.border=new THREE.Mesh(g,m);
    this.border.position.y=12;
    this.scene.add(this.border);
  }

  update(dt,t){
    if(this.border.material.uniforms) this.border.material.uniforms.uTime.value=t;
    this.motes.rotation.y=t*0.01;
    this.motes.position.y=Math.sin(t*0.2)*0.6;
    for(const f of this.fireLights){
      const fl=0.85+Math.sin(t*11+f.seed)*0.15+Math.sin(t*23+f.seed*2)*0.08;
      f.light.intensity=22*fl;
      f.flame.scale.set(1,fl*rand(0.94,1.06),1);
      f.flame.rotation.y=t*3+f.seed;
    }
    const af=this.altarFlame;
    const p=1+Math.sin(t*4)*0.15;
    af.m.scale.set(p,p*1.2,p); af.m.rotation.y=t*1.5;
    af.l.intensity=30*p;
  }

  // resolve player/enemy vs prop colliders; returns corrected XZ
  collideMove(px,pz,nx,nz,radius){
    let x=nx, z=nz;
    for(const c of this.colliders){
      const dx=x-c.x, dz=z-c.z;
      const d=Math.sqrt(dx*dx+dz*dz);
      const minD=c.r+radius;
      if(d<minD && d>0.0001){
        const push=(minD-d);
        x+=dx/d*push; z+=dz/d*push;
      }
    }
    // world bounds
    const dist=Math.sqrt(x*x+z*z);
    if(dist>this.radius){ x*=this.radius/dist; z*=this.radius/dist; }
    return [x,z];
  }
}
