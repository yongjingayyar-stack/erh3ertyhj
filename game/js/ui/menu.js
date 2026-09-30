// ============ ui/menu.js — M menu: stats / inventory / equipment / skills / bestiary ============
import { GameState } from '../core/state.js';
import { TYPES } from '../enemies/enemy.js';

const $=id=>document.getElementById(id);

// ---------- loot database ----------
export const ITEMS={
  sword_rusted:{name:'Rusted Cursed Blade',type:'weapon',ico:'🗡️',rarity:'common',atk:4,desc:'Chipped iron that hums faintly at dusk.'},
  sword_crescent:{name:'Crescent Reaver',type:'weapon',ico:'⚔️',rarity:'rare',atk:12,desc:'Moon-forged curve. Hungry edge.'},
  sword_gravebound:{name:'Gravebound Oath',type:'weapon',ico:'🔱',rarity:'epic',atk:20,crit:.1,desc:'Sworn blade of a dead crusade.'},
  sword_nulllight:{name:'Nulllight, World-Ender',type:'weapon',ico:'✨',rarity:'legendary',atk:32,crit:.15,desc:'The curse given edge.'},
  armor_chain:{name:'Worn Chainmail',type:'armor',ico:'🥋',rarity:'common',def:3,hp:10},
  armor_ironmaiden:{name:'Iron Maiden Harness',type:'armor',ico:'🛡️',rarity:'rare',def:8,hp:30},
  armor_cursedplate:{name:'Cursed Templar Plate',type:'armor',ico:'⚜️',rarity:'epic',def:14,hp:60,desc:'It whispers. Do not listen.'},
  trink_bloodring:{name:'Ring of Coagulated Vows',type:'trinket',ico:'💍',rarity:'uncommon',hp:20,desc:'+HP while worn.'},
  trink_hexeye:{name:'Hex-Seer Eye',type:'trinket',ico:'👁️',rarity:'rare',crit:.08,curseGain:.15,desc:'See the windup, reap the parry.'},
  trink_wardenheart:{name:"Warden's Black Heart",type:'trinket',ico:'🖤',rarity:'legendary',atk:8,def:8,hp:50,curseGain:.25,desc:'Pulled still-beating from the Warden.'},
  potion_ember:{name:'Ember Draught',type:'consumable',ico:'🧪',rarity:'common',stack:true,heal:40,desc:'Restores 40 HP.'},
  mat_soulash:{name:'Soul Ash',type:'material',ico:'🕯️',rarity:'uncommon',stack:true,desc:'Grit of unquiet dead.'},
  mat_cursemail:{name:'Cursemail Scrap',type:'material',ico:'🔩',rarity:'rare',stack:true,desc:'Armor fused with purple rot.'},
};

const LOOT_TABLE=[
  ['potion_ember',35],['mat_soulash',30],['mat_cursemail',15],
  ['trink_bloodring',6],['armor_chain',6],['sword_crescent',4],['armor_ironmaiden',4],
  ['trink_hexeye',3],['sword_gravebound',2],['armor_cursedplate',2],
  ['sword_nulllight',0.7],['trink_wardenheart',0.5],
];

export class LootSystem{
  static roll(){
    const total=LOOT_TABLE.reduce((s,[,w])=>s+w,0);
    let r=Math.random()*total;
    for(const [id,w] of LOOT_TABLE){ r-=w; if(r<=0)return id; }
    return 'potion_ember';
  }
}

export class Menu {
  constructor(game){
    this.game=game; this.open=false;
    document.querySelectorAll('.mtab').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.mtab').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      document.querySelectorAll('#menu-body section').forEach(s=>s.classList.add('hidden'));
      $('tab-'+b.dataset.tab).classList.remove('hidden');
    }));
  }

  toggle(force){
    this.open=force!==undefined?force:!this.open;
    $('menu-overlay').classList.toggle('hidden',!this.open);
    GameState.paused=this.open;
    if(this.open){ document.exitPointerLock?.(); this.renderAll(); }
    else this.game.canvas.requestPointerLock?.();
  }

  renderAll(){
    const p=this.game.player;
    const eq=this.game.items.equipStats();
    // ---- STATS ----
    $('tab-stats').innerHTML=`
      <div class="menu-h">THE CURSED KNIGHT — LEVEL ${p.level}</div>
      <div class="stat-grid">
        <div class="stat-card"><div class="k">HEART</div><div class="v">${Math.ceil(p.hp)} / ${p.maxHp}</div></div>
        <div class="stat-card"><div class="k">STAMINA</div><div class="v">${p.staminaMax}</div></div>
        <div class="stat-card"><div class="k">ATTACK</div><div class="v">${p.stats.str+p.level*2}<small>+${eq.atk} gear</small></div></div>
        <div class="stat-card"><div class="k">DEFENSE</div><div class="v">${p.stats.def}<small>+${eq.def} gear</small></div></div>
        <div class="stat-card"><div class="k">AGILITY</div><div class="v">${p.stats.agi}</div></div>
        <div class="stat-card"><div class="k">CRIT CHANCE</div><div class="v">${Math.round((0.12+p.stats.agi*0.008+(eq.crit||0)+(p.skillsUnlocked.critEye?0.15:0))*100)}%</div></div>
        <div class="stat-card"><div class="k">CURSE AFFINITY</div><div class="v">${Math.round((1+(eq.curseGain||0))*100)}%</div></div>
        <div class="stat-card"><div class="k">EXP</div><div class="v">${p.xp} / ${p.xpNext}</div></div>
      </div>
      <div class="menu-h">DEEDS OF THE HUNT</div>
      <div class="stat-grid">
        <div class="stat-card"><div class="k">SLAIN</div><div class="v">${GameState.stats.kills}</div></div>
        <div class="stat-card"><div class="k">PARRIES</div><div class="v">${GameState.stats.parries}</div></div>
        <div class="stat-card"><div class="k">PERFECT DODGES</div><div class="v">${GameState.stats.perfectDodges}</div></div>
        <div class="stat-card"><div class="k">MAX COMBO</div><div class="v">${GameState.stats.maxCombo}</div></div>
        <div class="stat-card"><div class="k">DAMAGE DEALT</div><div class="v">${Math.round(GameState.stats.damageDealt)}</div></div>
        <div class="stat-card"><div class="k">LOOT FOUND</div><div class="v">${GameState.stats.lootFound}</div></div>
      </div>`;

    // ---- INVENTORY ----
    const inv=p.inventory;
    let html=`<div class="menu-h">SATCHEL (${inv.length})</div><div class="inv-grid">`;
    if(!inv.length)html+=`<div style="opacity:.5;font-size:12px">Empty. Slay cursed things; they drop spoils.</div>`;
    for(const it of inv){
      const d=ITEMS[it.id];
      html+=`<div class="inv-slot rarity-${d.rarity}" title="${d.desc||''}">
        <div class="ico">${d.ico}</div><div>${d.name.split(',')[0]}</div>
        ${it.qty>1?`<div class="qty">×${it.qty}</div>`:''}
        ${d.type==='consumable'?`<button class="equip-btn" data-use="${it.id}">USE</button>`:''}
        ${(d.type==='weapon'||d.type==='armor'||d.type==='trinket')?`<button class="equip-btn" data-equip="${it.id}">EQUIP</button>`:''}
      </div>`;
    }
    html+='</div>';
    const tabInv=$('tab-inventory'); tabInv.innerHTML=html;
    tabInv.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>this.game.items.use(b.dataset.use));
    tabInv.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>this.game.items.equip(b.dataset.equip));

    // ---- EQUIPMENT ----
    const slots=[['weapon','WEAPON'],['armor','ARMOR'],['trinket','TRINKET']];
    let eh=`<div class="menu-h">ARMS & ARMORS</div>`;
    for(const [slot,label] of slots){
      const id=p.equipment[slot]; const d=id?ITEMS[id]:null;
      const bonus=d?[d.atk?`ATK +${d.atk}`:'',d.def?`DEF +${d.def}`:'',d.hp?`HP +${d.hp}`:'',d.crit?`CRIT +${Math.round(d.crit*100)}%`:'',d.curseGain?`CURSE GAIN +${Math.round(d.curseGain*100)}%`:''].filter(Boolean).join(' · '):'';
      eh+=`<div class="equip-row"><div class="slot-ico">${d?d.ico:'▫'}</div>
        <div class="info"><b>${label}: ${d?d.name:'— none —'}</b>
        <div>${bonus} ${d?`<i style='color:#a44df0'>· ${d.rarity.toUpperCase()}</i>`:''}</div></div>
        ${d?`<button class="equip-btn" data-uneq="${slot}">UNEQUIP</button>`:''}
      </div>`;
    }
    eh+=`<div class="menu-h">TOTAL BONUS FROM GEAR</div><div class="stat-grid">
      <div class="stat-card"><div class="k">ATK</div><div class="v">+${eq.atk}</div></div>
      <div class="stat-card"><div class="k">DEF</div><div class="v">+${eq.def}</div></div>
      <div class="stat-card"><div class="k">HP</div><div class="v">+${eq.hp}</div></div></div>`;
    const tabEq=$('tab-equipment'); tabEq.innerHTML=eh;
    tabEq.querySelectorAll('[data-uneq]').forEach(b=>b.onclick=()=>this.game.items.unequip(b.dataset.uneq));

    // ---- SKILLS ----
    const skillDefs=[
      {id:'comboFlow',lvl:2,name:'Flow State',desc:'Light-combo chain window widened — mash LMB faster.'},
      {id:'critEye',lvl:3,name:"Assassin's Hex-Eye",desc:'+15% critical chance.'},
      {id:'curbStomp',lvl:4,name:'Curbed Vigor',desc:'Dash costs less stamina; regen improved.'},
      {id:'bloodDrinker',lvl:5,name:'Blood Drinker',desc:'Crits heal a slice of damage dealt.'},
      {id:'doubleTap',lvl:6,name:'Reaver Instinct',desc:'Heavy attack recovers into light-combo step 3.'},
    ];
    let sh=`<div class="menu-h">PATH OF THE CURSE — unlock by leveling</div>`;
    for(const s of skillDefs){
      const on=p.skillsUnlocked[s.id];
      sh+=`<div class="skill-node ${on?'on':''}"><div class="dot"></div>
        <div class="info"><b>${s.name}</b> <span style="font-size:10px;color:#c9a24b">LV ${s.lvl}</span>
        <div style="font-size:11px;opacity:.75;margin-top:3px">${s.desc}</div></div>
        ${!on&&p.level>=s.lvl?`<button class="equip-btn" data-learn="${s.id}">LEARN</button>`:''}
      </div>`;
    }
    const tabSk=$('tab-skills'); tabSk.innerHTML=sh;
    tabSk.querySelectorAll('[data-learn]').forEach(b=>b.onclick=()=>this.game.items.learn(b.dataset.learn));

    // ---- BESTIARY ----
    const seen=this.game.bestiarySeen;
    let bh=`<div class="menu-h">BESTIARY OF THE CURSED LANDS</div>`;
    for(const [k,t] of Object.entries(TYPES)){
      bh+=`<div class="bestiary-entry"><b>${seen[k]?t.name:'???'}</b>
        <div>${seen[k]?t.desc:'Not yet encountered. Die first, then learn.'}</div>
        ${seen[k]?`<div style="color:#c9a24b">HP ${t.hp} · DMG ${t.dmg} · XP ${t.xp}</div>`:''}</div>`;
    }
    $('tab-bestiary').innerHTML=bh;
  }
}

// ---------- item manager (inventory/equip/consumes/stat aggregation) ----------
export class ItemManager{
  constructor(game){ this.game=game; }
  add(id){
    const p=this.game.player, d=ITEMS[id];
    GameState.stats.lootFound++;
    if(d.stack){
      const ex=p.inventory.find(i=>i.id===id);
      if(ex){ex.qty++;}else p.inventory.push({id,qty:1});
    } else p.inventory.push({id,qty:1});
    const r=d.rarity;
    this.game.hud.toast(`Picked up <b>${d.name}</b>`,(r==='epic'||r==='legendary')?'epic':(r==='rare'?'rare':''));
    this.game.fx.ring(this.game.player.position,{color:r==='legendary'?0xffce54:r==='epic'?0xa44df0:0xc9a24b,radius:1.5,time:.4});
    if(this.game.menu.open)this.game.menu.renderAll();
  }
  remove(id){
    const p=this.game.player;
    const i=p.inventory.findIndex(x=>x.id===id);
    if(i<0)return;
    p.inventory[i].qty--; if(p.inventory[i].qty<=0)p.inventory.splice(i,1);
  }
  equip(id){
    const p=this.game.player,d=ITEMS[id];
    const slot=d.type;
    if(p.equipment[slot]) this.add(p.equipment[slot]);
    this.remove(id);
    p.equipment[slot]=id;
    this.recalcDerived();
    this.game.hud.toast(`Equipped <b>${d.name}</b>`);
    if(this.game.menu.open)this.game.menu.renderAll();
  }
  unequip(slot){
    const p=this.game.player;
    if(!p.equipment[slot])return;
    this.add(p.equipment[slot]); p.equipment[slot]=null;
    this.recalcDerived();
    if(this.game.menu.open)this.game.menu.renderAll();
  }
  use(id){
    const d=ITEMS[id]; const p=this.game.player;
    if(d.heal){ p.hp=Math.min(p.maxHp,p.hp+d.heal);
      this.game.fx.burst(p.position.clone().add(new THREE.Vector3(0,1.4,0)),{count:12,color:0x7affb4,speed:3,grav:-2,life:.8,spark:true});
      this.game.hud.toast(`Quaffed <b>${d.name}</b> (+${d.heal} HP)`);
      this.remove(id);
      if(this.game.menu.open)this.game.menu.renderAll();
    }
  }
  learn(id){
    const p=this.game.player;
    p.skillsUnlocked[id]=true;
    this.game.hud.toast(`Skill learned: <b>${id}</b>`,'rare');
    if(this.game.menu.open)this.game.menu.renderAll();
  }
  equipStats(){
    const p=this.game.player; const out={atk:0,def:0,hp:0,crit:0,curseGain:0};
    for(const slot of ['weapon','armor','trinket']){
      const id=p.equipment[slot]; if(!id)continue;
      const d=ITEMS[id];
      out.atk+=d.atk||0; out.def+=d.def||0; out.hp+=d.hp||0; out.crit+=d.crit||0; out.curseGain+=d.curseGain||0;
    }
    return out;
  }
  equipStatsKey(k){ return this.equipStats()[k]||0; }
  recalcDerived(){
    const p=this.game.player;
    const eq=this.equipStats();
    const newMax=p.baseHp+p.stats.def*4+eq.hp;
    const diff=newMax-p.maxHp; p.maxHp=newMax; if(diff>0)p.hp+=diff;
    p.hp=Math.min(p.hp,p.maxHp);
  }
}
