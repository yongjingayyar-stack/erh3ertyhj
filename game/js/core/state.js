// ============ core/state.js — global game state singleton ============
export const GameState = {
  started:false, paused:false, dead:false, won:false,
  time:0, dt:0, timeScale:1,          // timeScale for hit-stop / slow-mo
  realTime:0,                          // unscaled clock (for UI anims)
  mouseDX:0, mouseDY:0,                // consumed each frame by camera
  keys:Object.create(null),            // raw keymap (code->bool)
  pressed:Object.create(null),         // edge-triggered this frame
  stats:{ kills:0, parries:0, perfectDodges:0, maxCombo:0, damageDealt:0, lootFound:0 },
};

// ---- input manager: captures keyboard + pointer-lock mouse deltas ----
export function initInput(canvas){
  window.addEventListener('keydown', e=>{
    if(!GameState.keys[e.code]) GameState.pressed[e.code]=true;
    GameState.keys[e.code]=true;
    if(['Space','Tab','ControlLeft','ShiftRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e=>{ GameState.keys[e.code]=false; });
  window.addEventListener('blur', ()=>{ GameState.keys=Object.create(null); });

  const mouseButtons = {left:false, right:false};
  canvas.addEventListener('mousedown', e=>{
    if(document.pointerLockElement!==canvas){ canvas.requestPointerLock(); return; }
    if(e.button===0){mouseButtons.left=true; GameState.pressed.MOUSE0=true;}
    if(e.button===2){mouseButtons.right=true; GameState.pressed.MOUSE2=true;}
  });
  window.addEventListener('mouseup', e=>{
    if(e.button===0) mouseButtons.left=false;
    if(e.button===2) mouseButtons.right=false;
  });
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  window.addEventListener('mousemove', e=>{
    if(document.pointerLockElement===canvas){
      GameState.mouseDX += e.movementX;
      GameState.mouseDY += e.movementY;
    }
  });

  return {
    isDown:c=>!!GameState.keys[c],
    justPressed:c=>!!GameState.pressed[c],
    get left(){return mouseButtons.left},
    get right(){return mouseButtons.right},
    endFrame(){ GameState.pressed=Object.create(null); GameState.mouseDX=0; GameState.mouseDY=0; },
  };
}

// ---- global FX bus (screen shake / hitstop / slowmo / flash) ----
export const FXBus = {
  shakeAmt:0, shakeDecay:7,
  shake(a){ this.shakeAmt=Math.min(1.6, this.shakeAmt+a); },
  hitstop(dur=0.06, minScale=0.05){            // punchy freeze then recover
    GameState.timeScale=minScale;
    this._recover=this._recover||[];
    this._recover.push({t:dur});
  },
  slowmo(dur=0.8, scale=0.25){                  // extended bullet-time
    GameState.timeScale=scale;
    this._recover=this._recover||[];
    this._recover.push({t:dur, to:1});
  },
  update(dtReal){
    this.shakeAmt=Math.max(0,this.shakeAmt-this.shakeDecay*dtReal);
    if(this._recover){
      for(const r of this._recover){ r.t-=dtReal;
        if(r.t<=0){ GameState.timeScale=r.to??1; r.dead=true; } }
      this._recover=this._recover.filter(r=>!r.dead);
      if(!this._recover.length) GameState.timeScale=1;
    }
  },
};
