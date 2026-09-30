// ============ ui/hud.js — HUD bindings, feedback popups, toasts, combo ============
import { GameState } from '../core/state.js';

const $=id=>document.getElementById(id);

export class HUD {
  constructor(game){
    this.game=game;
    this.combo=0; this.comboT=0;
    this.flashT=0;
    this.slowmoTint=$('slowmo-tint');
  }

  feedback(text,kind='crit'){
    const el=document.createElement('div');
    el.className=`fb-pop fb-${kind}`;
    el.textContent=text;
    $('feedback-stack').appendChild(el);
    setTimeout(()=>el.remove(),950);
  }

  toast(text,rarity=''){
    const el=document.createElement('div');
    el.className='toast '+rarity;
    el.innerHTML=text;
    $('toast-log').appendChild(el);
    if($('toast-log').children.length>6)$('toast-log').firstChild.remove();
    setTimeout(()=>el.remove(),4000);
  }

  registerHit(n=1){
    this.combo+=n; this.comboT=2.2;
    GameState.stats.maxCombo=Math.max(GameState.stats.maxCombo,this.combo);
    const c=$('combo-counter'); c.classList.remove('hidden');
    c.classList.add('bump'); setTimeout(()=>c.classList.remove('bump'),180);
    $('combo-num').textContent=this.combo;
  }

  damageFlash(){ this.flashT=0.35; }

  levelUp(lvl){
    const f=$('levelup-flash'); f.classList.remove('hidden');
    $('levelup-text').textContent='LEVEL '+lvl;
    setTimeout(()=>f.classList.add('hidden'),2200);
    this.toast(`⚜ <b>Level ${lvl}</b> — the curse deepens`,'epic');
  }

  ultReady(on){ $('ult-wrap').classList.toggle('ready',!!on); }

  wave(title,sub){
    const w=$('wave-banner');
    $('wave-title').textContent=title; $('wave-sub').textContent=sub;
    w.classList.remove('hidden');
    // restart animation
    w.style.animation='none'; void w.offsetWidth; w.style.animation='';
    setTimeout(()=>w.classList.add('hidden'),2700);
  }

  update(dt,player){
    // vitals
    const hpPct=player.hp/player.maxHp;
    $('hp-orb-fill').style.height=(hpPct*100)+'%';
    $('hp-text').textContent=`${Math.ceil(player.hp)}/${player.maxHp}`;
    $('stamina-fill').style.width=(player.stamina/player.staminaMax*100)+'%';
    $('ult-fill').style.width=(player.curse/player.curseMax*100)+'%';
    $('xp-fill').style.width=(player.xp/player.xpNext*100)+'%';
    $('lvl-num').textContent=player.level;

    // combo decay
    if(this.comboT>0){ this.comboT-=dt; if(this.comboT<=0){this.combo=0;$('combo-counter').classList.add('hidden');} }

    // boss bar / lock-on bar
    const boss=this.game.enemies.find(e=>e.isBoss&&!e.removed);
    if(boss){
      $('boss-bar').classList.remove('hidden');
      $('boss-hp-inner').style.width=(boss.hp/boss.hpMax*100)+'%';
    } else $('boss-bar').classList.add('hidden');

    const lock=this.game.camera.lockTarget;
    if(lock&&!lock.dead){
      $('lockon-ui').classList.remove('hidden');
      $('lockon-name').textContent=lock.def.name+(lock.isBoss?` — PHASE ${lock.phase}`:'');
      $('lockon-hp-inner').style.width=Math.max(0,(lock.hp/lock.hpMax*100))+'%';
    } else $('lockon-ui').classList.add('hidden');

    // damage flash overlay
    if(this.flashT>0){ this.flashT-=dt*2; $('dmg-flash').style.opacity=Math.max(0,this.flashT); }

    // slow-mo tint
    this.slowmoTint.style.opacity=GameState.timeScale<0.6?1:0;

    // skill rail cooldowns
    const skDash=$('sk-dash');
    skDash.classList.toggle('cooling',player.dashCooldown>0);
    $('sk-heavy').classList.toggle('cooling',player.stamina<30);
    $('sk-parry').classList.toggle('cooling',player.state==='parry');
    $('sk-ult').classList.toggle('cooling',player.curse<player.curseMax);
  }
}
