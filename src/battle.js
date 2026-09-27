// Battle controller: turn loop, player input phases, animation sequencing,
// win/lose, rewards. UI-agnostic: talks to the screen layer via callbacks.
import { ABILITIES, MONSTERS, JOBS, EQUIPMENT } from './data.js';
import { makeUnit, computeStats, grantXpJp } from './state.js';
import {
  tickCT, predictOrder, spendTurn, resolveAbility, startOfTurn, endOfTurn,
  tickKoTimers, moveRange, pathTo, manhattan, aiTakeTurn,
} from './combat.js';

const ITEM_OF = { potion: 'potion_item', hipotion: 'hipotion_item', phoenix: 'phoenix_item', antidote: 'antidote_item', ether: 'ether_item', remedy: 'remedy_item', x_potion: 'x_potion_item', elixir: 'elixir_item' };

export class Battle {
  constructor(def, opts) {
    this.def = def;
    this.map = def.map;
    this.board = opts.board;
    this.physics = opts.physics;
    this.audio = opts.audio;
    this.events = opts.events; // { emit(type, payload) }
    this.campaign = opts.campaign;
    this.isErrand = !!opts.isErrand;
    this.units = [];
    this.heights = [];
    this.pendingEnd = false;
    this.round = 1;
    this.turnCount = 0;
    this.active = null;
    this.phase = 'idle';
    this.moved = false;
    this.acted = false;
    this.moveKeys = new Map();
    this.stolenGil = 0;
    this.chests = new Map(); // key -> { x, y, item, mesh }
    this.hidden = new Map(); // key -> { x, y, item } (Move-Find-Item caches)
    this.poached = []; // item ids won by poaching this battle
    this.consumeItem = (abilityId) => {
      const item = ITEM_OF[abilityId];
      if (!item || !this.campaign) return;
      if ((this.campaign.inventory[item] || 0) > 0) this.campaign.inventory[item]--;
    };
  }

  get w() { return this.map.w; }
  get d() { return this.map.d; }
  unitByUid(uid) { return this.units.find((u) => u.uid === uid); }

  async setup(deployed) {
    await this.board.build(this.map);
    this.heights = this.map.heights.map((row) => [...row].map((c) => {
      const n = parseInt(c, 10);
      return Number.isFinite(n) ? n : 1;
    }));
    // player units
    this.units = [];
    for (const pu of deployed) {
      pu.fx = 0; pu.fz = -1; // face the enemy lines
      pu._poached = false;
      pu.side = 'player';
      pu.ct = 20 + Math.floor(Math.random() * 20);
      pu.statuses = {}; pu.buffs = {}; pu.charged = false;
      pu.alive = true; pu.koTimer = 0;
      computeStats(pu);
      pu.hp = pu.maxHp; pu.mp = pu.maxMp;
      this.units.push(pu);
      this.board.addUnit(pu, 'player');
    }
    // enemies
    for (const e of this.def.enemies) {
      const u = this.makeEnemy(e);
      this.units.push(u);
      this.board.addUnit(u, 'enemy');
    }
    // chests
    for (const t of this.def.treasure || []) {
      const mesh = this.board.addChest(t.x, t.y);
      this.chests.set(t.y * this.w + t.x, { ...t, mesh });
    }
    for (const t of this.def.hidden || []) {
      this.hidden.set(t.y * this.w + t.x, { ...t });
    }
    this.audio.playMusic(this.def.music || 'battle');
  }

  makeEnemy(e) {
    let u;
    if (e.monster) {
      const m = MONSTERS[e.monster];
      u = makeUnit(e.name, 'squire', e.level || 3, { side: 'enemy', monster: e.monster, boss: !!e.boss });
      u.pa = m.pa + Math.floor((e.level || 3) * 0.5);
      u.ma = m.ma; u.sp = m.sp;
      u.maxHp = m.hp + (e.level || 3) * 5;
      u.maxMp = m.mp;
      u.move = m.move; u.jump = m.jump; u.evade = 5;
      u.hp = u.maxHp; u.mp = u.maxMp;
      if (e.boss) { u.maxHp = Math.floor(u.maxHp * 1.5); u.hp = u.maxHp; }
    } else {
      u = makeUnit(e.name, e.job || 'squire', e.level || 3, { side: 'enemy', boss: !!e.boss });
      if (e.abilities) u.enemyAbilities = e.abilities;
      computeStats(u);
      u.hp = u.maxHp; u.mp = u.maxMp;
      if (e.boss) { u.maxHp = Math.floor(u.maxHp * 1.6); u.hp = u.maxHp; u.pa += 2; }
    }
    u.x = e.x; u.y = e.y;
    u.fx = 0; u.fz = 1; // face the player lines
    u.ct = 20 + Math.floor(Math.random() * 30);
    return u;
  }

  occupied(exceptUid = -1) {
    const m = new Map();
    for (const u of this.units) {
      if (u.uid === exceptUid || !u.alive) continue;
      m.set(u.y * this.w + u.x, u.uid);
    }
    return m;
  }

  // --- main loop ---
  async run() {
    this.events.emit('battleStart', { def: this.def });
    while (!this.pendingEnd) {
      const next = tickCT(this.units.filter((u) => u.alive || u.koTimer <= 0));
      const alive = this.units.filter((u) => u.alive);
      if (!alive.length) break;
      const actor = alive.includes(next) ? next : alive[0];
      this.active = actor;
      this.turnCount++;
      const evs = [];
      const skip = startOfTurn(actor, evs);
      await this.playEvents(evs);
      if (!actor.alive) { this.checkEnd(); continue; }
      this.events.emit('turnStart', { unit: actor, order: predictOrder(this.units, 6) });
      this.board.faceTile && null;
      this.focusOn(actor);
      if (skip) {
        this.events.emit('message', { text: `${actor.name} is charmed!` });
        spendTurn(actor);
        endOfTurn(actor);
        continue;
      }
      if (actor.side === 'player') {
        await this.playerTurn(actor);
      } else {
        await this.enemyTurn(actor);
      }
      spendTurn(actor);
      // spell recovery: CTR-style delay modeled as recovery time (documented choice)
      if (actor._recovery) {
        actor.ct = -actor._recovery;
        actor._recovery = 0;
      }
      endOfTurn(actor);
      if (this.turnCount % Math.max(1, alive.length) === 0) {
        this.round++;
        const gone = tickKoTimers(this.units);
        for (const g of gone) {
          this.events.emit('crystal', { unit: g });
          this.board.removeUnit(g.uid);
        }
      }
      this.checkEnd();
    }
    return this.result;
  }

  focusOn(u) {
    const p = this.board.tilePos(u.x, u.y);
    this.events.emit('focus', { x: p.x, y: p.y, z: p.z });
  }

  // --- player turn (driven by UI promises) ---
  playerTurn(actor) {
    return new Promise((resolve) => {
      this._playerResolve = resolve;
      this.moved = false;
      this.acted = false;
      this.phase = 'menu';
      this.events.emit('playerMenu', { unit: actor });
    });
  }

  finishPlayerTurn() {
    this.board.clearAllHighlights();
    this.phase = 'idle';
    if (this._playerResolve) {
      const r = this._playerResolve;
      this._playerResolve = null;
      r();
    }
  }

  // UI: enter move selection
  beginMove() {
    const u = this.active;
    this.moveKeys = moveRange(u, this.heights, this.w, this.d, this.occupied(u.uid));
    this.board.showHighlights([...this.moveKeys.keys()], 'move');
    this.phase = 'awaitMove';
    this.events.emit('hint', { text: 'Choose a blue tile to move, or wait.' });
  }

  async doMove(x, y) {
    const u = this.active;
    const k = y * this.w + x;
    if (!this.moveKeys.has(k)) return false;
    this.phase = 'animating';
    this.board.clearAllHighlights();
    const path = pathTo(u, x, y, this.heights, this.w, this.d, this.occupied(u.uid));
    for (const step of path) {
      this.faceToward(u, step.x, step.y);
      u.x = step.x; u.y = step.y;
      this.audio.playSfx('step');
      await this.board.moveUnitMesh(u.uid, step.x, step.y, true);
    }
    this.moved = true;
    this.checkChest(u);
    this.phase = 'menu';
    this.events.emit('playerMenu', { unit: u });
    return true;
  }

  // UI: list usable abilities for active unit.
  // First two job abilities are innate; the rest must be learned with JP
  // (see Party → Train). Learned abilities carry across jobs.
  usableAbilities() {
    const u = this.active;
    const job = JOBS[u.job];
    const innate = job ? job.abilities.slice(0, 2) : ['attack'];
    const learned = Object.keys(u.learned || {}).filter((k) => u.learned[k]);
    const ids = [...new Set([...innate, ...learned])];
    return ids.map((id) => ABILITIES[id]).filter(Boolean).map((ab) => {
      let usable = true;
      let why = '';
      if (ab.mp && u.mp < ab.mp) { usable = false; why = 'No MP'; }
      const item = ITEM_OF[ab.id];
      if (item && (this.campaign.inventory[item] || 0) <= 0 && u.side === 'player') { usable = false; why = 'None left'; }
      if (ab.id === 'attack' && u.statuses.disarm) { /* still usable, weakened */ }
      return { ...ab, usable, why };
    });
  }

  beginTarget(abilityId) {
    const u = this.active;
    const ab = ABILITIES[abilityId];
    if (!ab) return;
    this._targetAbility = abilityId;
    this.phase = 'awaitTarget';
    // highlight valid target tiles
    const keys = [];
    for (let y = 0; y < this.d; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.validTarget(u, ab, x, y)) keys.push(y * this.w + x);
      }
    }
    this.board.showHighlights(keys, ab.kind === 'heal' || ab.kind === 'revive' || ab.kind === 'buff' || ab.kind === 'item' ? 'move' : 'target');
    this.events.emit('hint', { text: `${ab.name}: choose a highlighted tile.` });
  }

  validTarget(u, ab, x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.d) return false;
    if (this.heights[y][x] <= 0 && ab.range > 0) return false;
    const dist = manhattan(u.x, u.y, x, y);
    if (dist > ab.range) return false;
    if (ab.range === 0) return x === u.x && y === u.y;
    const occ = this.units.find((t) => t.x === x && t.y === y);
    switch (ab.kind) {
      case 'phys':
      case 'magic':
      case 'jump':
      case 'iaido':
      case 'steal':
      case 'ailment':
        return true; // ground-targetable; hits enemies in AoE
      case 'heal':
        return !occ || (occ.alive && occ.side === u.side);
      case 'item':
        return !!occ && occ.alive && occ.side === u.side;
      case 'revive':
        return !!occ && !occ.alive && occ.koTimer > 0 && occ.side === u.side;
      case 'buff':
        if (ab.range === 0) return x === u.x && y === u.y;
        return true; // wards: ground-targetable, bless allies in AoE
      default:
        return true;
    }
  }

  faceToward(u, tx, ty) {
    const dx = tx - u.x, dy = ty - u.y;
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) >= Math.abs(dy)) { u.fx = Math.sign(dx); u.fz = 0; }
    else { u.fx = 0; u.fz = Math.sign(dy); }
  }

  async doTarget(x, y) {
    const u = this.active;
    const ab = ABILITIES[this._targetAbility];
    if (!ab || !this.validTarget(u, ab, x, y)) return false;
    this.phase = 'animating';
    this.board.clearAllHighlights();
    this.faceToward(u, x, y);
    this.board.faceTile(u.uid, x, y);
    // caster hop / projectile flourish
    if (ab.kind === 'jump') {
      this.board.setUnitVisible(u.uid, false);
      this.events.emit('message', { text: `${u.name} leaps skyward!` });
      await this.wait(450);
      this.board.setUnitVisible(u.uid, true);
    }
    const events = resolveAbility(u, ab.id, x, y, this.units, this.heights, this);
    if (ab.ctr) u._recovery = Math.floor(ab.ctr / 2);
    if (ab.id === 'rush') u.ct += 10;
    await this.playEvents(events);
    this.acted = true;
    this.events.emit('unitChanged', {});
    if (this.checkEnd()) return true;
    this.phase = 'menu';
    this.events.emit('playerMenu', { unit: u });
    return true;
  }

  async doWait() {
    const u = this.active;
    u.ct += 10;
    this.board.clearAllHighlights();
    this.events.emit('message', { text: `${u.name} waits. (+10 CT)` });
    this.finishPlayerTurn();
  }

  cancelTarget() {
    this.board.clearAllHighlights();
    this.phase = 'menu';
    this.events.emit('playerMenu', { unit: this.active });
  }

  // --- enemy turn ---
  async enemyTurn(u) {
    this.phase = 'animating';
    this.events.emit('message', { text: `${u.name}'s turn` });
    await this.wait(350);
    const plan = aiTakeTurn(u, this);
    if (plan.move) {
      const path = pathTo(u, plan.move.x, plan.move.y, this.heights, this.w, this.d, this.occupied(u.uid));
      for (const step of path) {
        this.faceToward(u, step.x, step.y);
        u.x = step.x; u.y = step.y;
        await this.board.moveUnitMesh(u.uid, step.x, step.y, true);
      }
      this.checkChest(u);
    }
    if (plan.ability) {
      const ab = ABILITIES[plan.ability];
      this.faceToward(u, plan.tx, plan.ty);
      this.board.faceTile(u.uid, plan.tx, plan.ty);
      this.events.emit('message', { text: `${u.name} uses ${ab.name}!` });
      await this.wait(300);
      const events = resolveAbility(u, ab.id, plan.tx, plan.ty, this.units, this.heights, this);
      if (ab.ctr) u._recovery = Math.floor(ab.ctr / 2);
      await this.playEvents(events);
      this.events.emit('unitChanged', {});
    }
    this.phase = 'idle';
  }

  checkChest(u) {
    const k = u.y * this.w + u.x;
    const c = this.chests.get(k);
    if (c) {
      this.chests.delete(k);
      if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
      if (u.side === 'player') {
        this.grantItem(c.item);
        this.events.emit('treasure', { unit: u, item: c.item });
        this.audio.playSfx('pickup');
        this.board.spawnRing(u.x, u.y, 0xffd76a);
      } else {
        this.events.emit('message', { text: `${u.name} smashed a chest!` });
      }
    }
    const h = this.hidden.get(k);
    if (h && u.side === 'player') {
      this.hidden.delete(k);
      this.grantItem(h.item);
      this.events.emit('treasure', { unit: u, item: h.item, hidden: true });
      this.audio.playSfx('pickup');
      this.board.spawnRing(u.x, u.y, 0x7ae8ff);
    }
  }

  grantItem(item) {
    const e = EQUIPMENT[item];
    if (!e) return;
    if (e.slot === 'item') {
      const inv = this.campaign.inventory;
      inv[item] = (inv[item] || 0) + 1;
    } else {
      if (!this.campaign.stores) this.campaign.stores = [];
      if (!this.campaign.stores.includes(item)) this.campaign.stores.push(item);
    }
  }

  async playEvents(events) {
    for (const e of events) {
      const t = e.target != null ? this.unitByUid(e.target) : null;
      switch (e.type) {
        case 'damage': {
          this.board.flashUnit(e.target, elementColor(e.element));
          this.board.spawnBurst(e.x, e.y, elementColor(e.element), 8, this.physics);
          this.board.spawnRing(e.x, e.y, elementColor(e.element));
          this.events.emit('floater', { x: e.x, y: e.y, text: `-${e.amount}`, cls: 'dmg' });
          if (e.sfx) this.audio.playSfx(e.sfx);
          if (t) this.events.emit('hpChanged', { unit: t });
          await this.wait(260);
          break;
        }
        case 'miss':
          this.events.emit('floater', { x: e.x, y: e.y, text: 'MISS', cls: 'miss' });
          if (e.sfx) this.audio.playSfx(e.sfx);
          await this.wait(200);
          break;
        case 'heal':
          this.board.spawnRing(e.x, e.y, 0x6aff9a);
          this.board.flashUnit(e.target, 0x6aff9a);
          this.events.emit('floater', { x: e.x, y: e.y, text: `+${e.amount}`, cls: 'heal' });
          if (e.sfx) this.audio.playSfx(e.sfx);
          if (t) this.events.emit('hpChanged', { unit: t });
          await this.wait(220);
          break;
        case 'ko':
          this.board.setUnitKO(e.target, true);
          this.board.spawnBurst(e.x, e.y, 0x888888, 10, this.physics);
          this.events.emit('floater', { x: e.x, y: e.y, text: 'K.O.!', cls: 'ko' });
          if (e.sfx) this.audio.playSfx(e.sfx);
          await this.wait(300);
          break;
        case 'revive':
          this.board.setUnitKO(e.target, false);
          this.board.spawnRing(e.x, e.y, 0xfff2a8);
          this.events.emit('floater', { x: e.x, y: e.y, text: 'REVIVE!', cls: 'heal' });
          if (e.sfx) this.audio.playSfx(e.sfx);
          await this.wait(250);
          break;
        case 'status':
          this.events.emit('floater', { x: t.x, y: t.y, text: statusLabel(e.status), cls: 'status' });
          await this.wait(180);
          break;
        case 'cleanse':
          this.events.emit('floater', { x: e.x, y: e.y, text: 'CURED', cls: 'heal' });
          if (e.sfx) this.audio.playSfx(e.sfx);
          await this.wait(180);
          break;
        case 'buff':
          this.events.emit('floater', { x: t.x, y: t.y, text: e.status === 'charge' ? 'CHARGED!' : e.status === 'shout' ? 'RALLY!' : statusLabel(e.status), cls: 'buff' });
          if (e.sfx) this.audio.playSfx(e.sfx);
          await this.wait(180);
          break;
        case 'steal':
          this.events.emit('floater', { x: e.x, y: e.y, text: `+${e.amount} G`, cls: 'gil' });
          this.audio.playSfx('gil');
          await this.wait(200);
          break;
        case 'drain':
          this.events.emit('floater', { x: t.x, y: t.y, text: `-${e.amount} MP`, cls: 'miss' });
          await this.wait(150);
          break;
        case 'charmed':
          this.events.emit('floater', { x: t.x, y: t.y, text: 'CHARMED', cls: 'status' });
          await this.wait(200);
          break;
        case 'stopped':
          this.events.emit('floater', { x: t.x, y: t.y, text: 'STOPPED', cls: 'status' });
          await this.wait(200);
          break;
        case 'asleep':
          this.events.emit('floater', { x: t.x, y: t.y, text: 'ASLEEP', cls: 'status' });
          await this.wait(200);
          break;
        case 'backstab':
          this.events.emit('floater', { x: e.x, y: e.y, text: 'BACK ATTACK!', cls: 'ko' });
          this.events.emit('message', { text: 'A back attack! (+30%, unavoidable)' });
          await this.wait(150);
          break;
        case 'restoreMp':
          this.events.emit('floater', { x: e.x, y: e.y, text: `+${e.amount} MP`, cls: 'buff' });
          if (e.sfx) this.audio.playSfx(e.sfx);
          await this.wait(180);
          break;
        case 'poach': {
          this.grantItem(e.item);
          this.poached.push(e.item);
          const name = EQUIPMENT[e.item] ? EQUIPMENT[e.item].name : e.item;
          this.events.emit('floater', { x: e.x, y: e.y, text: e.rare ? `RARE POACH: ${name}!` : `Poached: ${name}`, cls: 'gil' });
          this.events.emit('message', { text: `${e.killer} poached ${name}${e.rare ? ' (RARE!)' : ''}.` });
          if (e.sfx) this.audio.playSfx(e.sfx);
          await this.wait(220);
          break;
        }
        case 'whiff':
          this.board.spawnRing(e.x, e.y, 0xcccccc);
          await this.wait(150);
          break;
        default:
          break;
      }
    }
  }

  wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  checkEnd() {
    if (this.pendingEnd) return true;
    // Only living units count: a side with no one standing loses immediately
    // (KO countdowns matter for mid-battle revives, not for the outcome).
    const players = this.units.filter((u) => u.side === 'player' && u.alive);
    const enemies = this.units.filter((u) => u.side === 'enemy' && u.alive);
    const boss = this.units.find((u) => u.side === 'enemy' && u.boss);
    let win = false, lose = false;
    if (players.length === 0) lose = true;
    else if (this.def.bossName && boss && !boss.alive) win = true; // boss KO ends it
    else if (enemies.length === 0) win = true;
    if (!win && !lose) return false;
    this.pendingEnd = true;
    this.result = { win, turns: this.turnCount };
    // finish any dangling player promise so run() can return
    if (this._playerResolve) {
      const r = this._playerResolve;
      this._playerResolve = null;
      this.phase = 'idle';
      r();
    }
    return true;
  }

  // Rewards for player-side survivors + participants.
  applyRewards() {
    const base = 10 + this.units.length * 2;
    const gains = [];
    for (const u of this.units.filter((x) => x.side === 'player')) {
      const xp = base + Math.floor(Math.random() * 6);
      const jp = 24 + Math.floor(Math.random() * 10);
      const leveled = grantXpJp(u, xp, jp);
      gains.push({ uid: u.uid, name: u.name, xp, jp, leveled, level: u.level });
      u.alive = true; u.hp = u.maxHp; u.mp = u.maxMp; u.koTimer = 0; u.ct = 0; u.statuses = {};
      computeStats(u);
    }
    // remove crystallized guests? player units never permanently die in this adaptation (noted in report)
    const gil = (this.def.gil || 0) + (this.stolenGil || 0);
    return { gains, gil };
  }
}

function elementColor(el) {
  switch (el) {
    case 'fire': return 0xff6a2a;
    case 'ice': return 0x6ad8ff;
    case 'bolt': return 0xffe14a;
    case 'holy': return 0xfff2c8;
    default: return 0xffffff;
  }
}

function statusLabel(s) {
  const m = { slow: 'SLOW', daze: 'DAZE', disarm: 'DISARM', exposed: 'EXPOSED', charm: 'CHARM', poison: 'POISON', haste: 'HASTE!', stop: 'STOP!', sleep: 'SLEEP', protect: 'PROTECT', shell: 'SHELL', regen: 'REGEN' };
  return m[s] || s.toUpperCase();
}
