// Entry: boot, main loop, auto quality, diagnostics, game flow, tile picking.
import './styles.css';
import * as THREE from 'three';
import { BUILD_INFO, QUALITY_PRESETS, AUTO_TUNING } from './config.js';
import { loadOptions, saveOptions, loadSave, writeSave, clearSave } from './save.js';
import { AudioEngine } from './audio.js';
import { BATTLES, ERRANDS, EQUIPMENT, JOBS, STORY, RECRUIT_CLOUD, RECRUIT_AVELINE } from './data.js';
import { newCampaign, applyLoadedCampaign, computeStats, jobUnlocked, learnAbility, hireRecruit, sendDispatch, tickDispatches } from './state.js';
import { Battle } from './battle.js';
import { Board, installWaterFactory } from './board.js';
import { CameraRig } from './camera.js';
import { Physics } from './physics.js';
import { GameRenderer } from './render.js';
import { UI } from './ui.js';

const bus = {
  map: new Map(),
  on(t, fn) {
    if (!this.map.has(t)) this.map.set(t, []);
    this.map.get(t).push(fn);
  },
  emit(t, p) {
    for (const fn of this.map.get(t) || []) {
      try { fn(p); } catch (e) { console.error('event', t, e); }
    }
  },
};

class Game {
  constructor() {
    this.options = loadOptions();
    this.campaign = null;
    this.battle = null;
    this.hud = null;
    this.state = 'boot';
    this.effectiveQuality = AUTO_TUNING.startAt;
    this.autoState = { window: [], lastSwitch: 0, goodWindows: 0 };
    this.frameMs = 16;
    this.fps = 60;
    this.treasureWon = [];
  }

  async init() {
    this.canvas = document.getElementById('scene');
    this.ui = new UI(document.getElementById('ui'));
    this.audio = new AudioEngine();
    await this.audio.init();
    this.ui.setAudio(this.audio);

    this.renderer = new GameRenderer(this.canvas);
    await this.renderer.init();

    this.physics = new Physics();
    try {
      await this.physics.init();
    } catch (e) {
      console.warn('Physics unavailable, continuing without debris:', e);
    }

    // TSL node-material factory for water tiles (genuine TSL shading).
    this.installTslFactory();

    const supportsNodes = typeof this.renderer.renderer.renderAsync === 'function';
    this.board = new Board(this.renderer.scene, { supportsNodes });
    this.cameraRig = new CameraRig(this.renderer.camera, this.canvas);
    this.cameraRig.speed = this.options.cameraSpeed;

    this.applyOptions();
    this.buildCornerButtons();
    this.bindPicking();
    this.audio.setVolume(this.options.volume);
    this.audio.setMuted(this.options.muted);

    // Title backdrop: a living diorama behind the menu.
    await this.titleDiorama();
    this.toTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  installTslFactory() {
    installWaterFactory(() => {
      // Built lazily; throws back to the caller if node materials fail.
      const { MeshStandardNodeMaterial } = requireNodeMaterial();
      const tsl = requireTsl();
      const mat = new MeshStandardNodeMaterial({ roughness: 0.2, metalness: 0.35 });
      const deep = tsl.color(0x14425e);
      const foam = tsl.color(0x4fd8ff);
      const pulse = tsl.sin(tsl.time.mul(1.6)).add(1).mul(0.22);
      mat.colorNode = tsl.mix(deep, foam, pulse);
      return mat;
    });
  }

  applyOptions() {
    const q = this.options.quality === 'auto' ? this.effectiveQuality : this.options.quality;
    this.renderer.applyPreset(q);
    const p = QUALITY_PRESETS[q];
    if (this.physics) this.physics.setMaxBodies(p.maxBodies);
    this.ui.showDiag(this.options.showDiag);
    if (this.cameraRig) this.cameraRig.speed = this.options.cameraSpeed;
  }

  buildCornerButtons() {
    const wrap = document.createElement('div');
    wrap.id = 'corner-btns';
    wrap.innerHTML = `
      <button data-b="sound">${this.options.muted ? 'Muted' : 'Sound'}</button>
      <button data-b="full">Full</button>
      <button data-b="diag">Diag</button>`;
    document.getElementById('app').appendChild(wrap);
    if (this.options.showDiag) wrap.classList.add('diag-on');
    const soundBtn = wrap.querySelector('[data-b="sound"]');
    wrap.querySelector('[data-b="sound"]').onclick = () => {
      this.audio.ensureContext();
      this.options.muted = !this.options.muted;
      this.audio.setMuted(this.options.muted);
      soundBtn.textContent = this.options.muted ? 'Muted' : 'Sound';
      saveOptions(this.options);
    };
    wrap.querySelector('[data-b="full"]').onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
        this.options.fullscreen = !!document.fullscreenElement;
      } catch { this.ui.toast('Fullscreen not available here.'); }
      saveOptions(this.options);
    };
    wrap.querySelector('[data-b="diag"]').onclick = () => {
      this.options.showDiag = !this.options.showDiag;
      this.ui.showDiag(this.options.showDiag);
      saveOptions(this.options);
    };
    // First gesture unlocks audio everywhere.
    window.addEventListener('pointerdown', () => this.audio.ensureContext(), { passive: true });
    window.addEventListener('keydown', () => this.audio.ensureContext());
  }

  bindPicking() {
    this.ray = new THREE.Raycaster();
    this.ptr = new THREE.Vector2();
    let down = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dt = performance.now() - down.t;
      down = null;
      if (moved > 10 || dt > 600) return;
      this.tap(e.clientX, e.clientY);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.battle && this.battle.phase === 'awaitTarget') {
        this.battle.cancelTarget();
      }
    });
    this.canvas.addEventListener('contextmenu', () => {
      if (this.battle && this.battle.phase === 'awaitTarget') this.battle.cancelTarget();
      else if (this.battle && this.battle.phase === 'awaitMove') this.battle.cancelTarget();
    });
  }

  pickTile(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.ptr.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.renderer.camera);
    const hits = this.ray.intersectObjects(this.board.group.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o) {
        if (o.userData && Number.isInteger(o.userData.x)) return { x: o.userData.x, y: o.userData.y };
        if (o.userData && o.userData.uid) {
          const u = this.battle && this.battle.unitByUid(o.userData.uid);
          if (u) return { x: u.x, y: u.y, uid: u.uid };
        }
        o = o.parent;
      }
    }
    return null;
  }

  tap(cx, cy) {
    if (this.state !== 'battle' || !this.battle) return;
    const t = this.pickTile(cx, cy);
    if (!t) return;
    const b = this.battle;
    if (b.phase === 'awaitMove') {
      b.doMove(t.x, t.y);
    } else if (b.phase === 'awaitTarget') {
      b.doTarget(t.x, t.y);
    } else if (t.uid && this.hud) {
      const u = b.unitByUid(t.uid);
      if (u) this.hud.showCard(u);
    }
  }

  project(x, y) {
    const p = this.board.tilePos(x, y);
    p.y += 1.3;
    p.project(this.renderer.camera);
    return {
      x: (p.x * 0.5 + 0.5) * window.innerWidth,
      y: (-p.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  // ---------- flow ----------
  async titleDiorama() {
    this.state = 'title';
    await this.board.build(BATTLES[0].map);
    // decorative toy units
    const { makeUnit } = await import('./state.js');
    const deco = [
      { u: makeUnit('A', 'knight', 5, { side: 'player' }), x: 2, y: 5 },
      { u: makeUnit('B', 'archer', 5, { side: 'player' }), x: 4, y: 6 },
      { u: makeUnit('C', 'blackmage', 5, { side: 'enemy' }), x: 5, y: 2 },
    ];
    for (const d of deco) {
      d.u.x = d.x; d.u.y = d.y;
      this.board.addUnit(d.u, d.u.side);
    }
    this.cameraRig.frameBoard(BATTLES[0].map.w, BATTLES[0].map.d);
  }

  toTitle() {
    this.state = 'title';
    this.battle = null;
    this.audio.playMusic('title');
    const has = !!loadSave();
    this.ui.showTitle({
      canContinue: has,
      onNew: () => {
        clearSave();
        this.campaign = newCampaign();
        this.ui.showStory('Prologue', STORY.intro, { onDone: () => this.toWorld() });
      },
      onContinue: () => {
        const data = loadSave();
        if (!data) { this.ui.toast('No save found.'); return; }
        this.campaign = applyLoadedCampaign(data);
        this.toWorld();
      },
      onControls: () => this.ui.showControls(() => this.toTitle()),
      onOptions: () => this.ui.showOptions(this.options, {
        onChange: (k, v) => { this.options[k] = v; saveOptions(this.options); this.applyOptions(); this.audio.setVolume(this.options.volume); this.audio.setMuted(this.options.muted); },
        onBack: () => this.toTitle(),
      }),
    });
  }

  toWorld() {
    this.state = 'world';
    this.battle = null;
    this.audio.playMusic('worldmap');
    const battles = BATTLES;
    const errands = ERRANDS.map((e) => ({
      id: e.id,
      name: e.name,
      open: this.campaign.battleIndex >= e.requiresBattle,
      done: this.campaign.errandsDone.includes(e.id),
    }));
    this.ui.showWorld(this.campaign, battles, errands, {
      onBattle: () => {
        const def = BATTLES[this.campaign.battleIndex];
        if (def) this.toDeploy(def, false);
      },
      onErrand: (id) => {
        const e = ERRANDS.find((x) => x.id === id);
        if (e) this.toDeploy(e.battle, true, e);
      },
      onShop: () => this.toShop(),
      onParty: () => this.toParty(),
      onTavern: () => this.toTavern(),
      onOptions: () => this.ui.showOptions(this.options, {
        onChange: (k, v) => { this.options[k] = v; saveOptions(this.options); this.applyOptions(); this.audio.setVolume(this.options.volume); this.audio.setMuted(this.options.muted); },
        onBack: () => this.toWorld(),
      }),
      onTitle: async () => { await this.titleDiorama(); this.toTitle(); },
    });
  }

  toShop() {
    const def = BATTLES[this.campaign.battleIndex];
    const chapter = def ? def.chapter : 4;
    this.ui.showShop(this.campaign, chapter, {
      onBuy: (id) => {
        const e = EQUIPMENT[id];
        if (!e || this.campaign.gil < e.price) return false;
        this.campaign.gil -= e.price;
        if (e.slot === 'item') {
          this.campaign.inventory[id] = (this.campaign.inventory[id] || 0) + 1;
        } else {
          if (!this.campaign.stores) this.campaign.stores = [];
          if (!this.campaign.stores.includes(id)) this.campaign.stores.push(id);
        }
        writeSave(this.campaign);
        return true;
      },
      onBack: () => this.toWorld(),
    });
  }

  toParty() {
    this.ui.showParty(this.campaign, {
      onJob: (uid, jobId) => {
        const u = this.campaign.party.find((x) => x.uid === uid);
        if (!u || !JOBS[jobId]) return false;
        if (!jobUnlocked(this.campaign.party, u, jobId)) return false;
        const hpR = u.hp / Math.max(1, u.maxHp);
        const mpR = u.maxMp ? u.mp / u.maxMp : 1;
        u.job = jobId;
        // strip gear the new job cannot wear
        const job = JOBS[jobId];
        for (const slot of ['weapon', 'offhand', 'body', 'head']) {
          const id = u.equipment[slot];
          if (id && EQUIPMENT[id] && !job.equip.includes(EQUIPMENT[id].type)) u.equipment[slot] = null;
        }
        computeStats(u);
        u.hp = Math.max(1, Math.floor(u.maxHp * hpR));
        u.mp = Math.floor(u.maxMp * mpR);
        writeSave(this.campaign);
        return true;
      },
      onEquip: (uid, slot, itemId) => {
        const u = this.campaign.party.find((x) => x.uid === uid);
        if (!u) return;
        u.equipment[slot] = itemId;
        computeStats(u);
        u.hp = Math.min(u.hp, u.maxHp);
        u.mp = Math.min(u.mp, u.maxMp);
        writeSave(this.campaign);
      },
      onLearn: (uid, abilityId) => {
        const u = this.campaign.party.find((x) => x.uid === uid);
        if (!u) return false;
        const ok = learnAbility(u, abilityId);
        if (ok) writeSave(this.campaign);
        return ok;
      },
      onPromote: (uid) => {
        if (this.campaign.party.length >= 8) return false;
        const idx = (this.campaign.reserves || []).findIndex((x) => x.uid === uid);
        if (idx < 0) return false;
        this.campaign.party.push(this.campaign.reserves.splice(idx, 1)[0]);
        writeSave(this.campaign);
        return true;
      },
      onBack: () => this.toWorld(),
    });
  }

  toTavern() {
    this.ui.showTavern(this.campaign, {
      onHire: (i) => {
        const u = hireRecruit(this.campaign, i);
        if (u) writeSave(this.campaign);
        return u;
      },
      onDispatch: (uid, propId) => {
        const err = sendDispatch(this.campaign, uid, propId);
        if (!err) writeSave(this.campaign);
        return err;
      },
      onBack: () => this.toWorld(),
    });
  }

  toDeploy(def, isErrand, errand = null) {
    this.ui.showDeploy(this.campaign, def, {
      onStart: (uids) => this.startBattle(def, isErrand, errand, uids),
      onBack: () => this.toWorld(),
    });
  }

  async startBattle(def, isErrand, errand, uids) {
    this.state = 'battle';
    this.treasureWon = [];
    this.hud = this.ui.mountBattleHud();
    const deployed = uids
      .map((id) => this.campaign.party.find((u) => u.uid === id))
      .filter(Boolean);
    deployed.forEach((u, i) => {
      const slot = def.player[i % def.player.length];
      u.x = slot.x; u.y = slot.y;
    });
    const battle = new Battle(def, {
      board: this.board,
      physics: this.physics,
      audio: this.audio,
      campaign: this.campaign,
      isErrand,
      events: bus,
    });
    this.battle = battle;
    this.wireBattle(battle);
    this.cameraRig.frameBoard(def.map.w, def.map.d);
    this.hud.logMsg(`${def.name} — ${def.objective}`);
    this.hud.showHint(def.objective, 5000);
    await battle.setup(deployed);
    const result = await battle.run();
    this.onBattleEnd(def, isErrand, errand, result, battle);
  }

  wireBattle(battle) {
    bus.map.clear();
    bus.on('battleStart', () => {});
    bus.on('turnStart', ({ unit, order }) => {
      this.hud.setTurn(unit);
      this.hud.setOrder([unit, ...order.filter((u) => u.uid !== unit.uid)]);
      if (unit.side !== 'player') this.hud.hideMenu();
    });
    bus.on('playerMenu', ({ unit }) => {
      this.hud.setTurn(unit);
      this.hud.showMenu(unit, battle);
    });
    bus.on('hint', ({ text }) => this.hud.showHint(text));
    bus.on('message', ({ text }) => this.hud.logMsg(text));
    bus.on('floater', ({ x, y, text, cls }) => {
      const s = this.project(x, y);
      this.hud.floater(s.x, s.y, text, cls);
    });
    bus.on('hpChanged', ({ unit }) => {
      if (this.battle.active && unit.uid === this.battle.active.uid) this.hud.setTurn(unit);
    });
    bus.on('unitChanged', () => {
      if (this.battle.active) this.hud.setTurn(this.battle.active);
    });
    bus.on('treasure', ({ unit, item, hidden }) => {
      const name = EQUIPMENT[item] ? EQUIPMENT[item].name : item;
      this.treasureWon.push(item);
      const msg = hidden ? `${unit.name} sniffed out a hidden cache: ${name}!` : `${unit.name} found ${name}!`;
      this.hud.logMsg(msg);
      this.ui.toast(msg);
    });
    bus.on('crystal', ({ unit }) => {
      this.hud.logMsg(`${unit.name} crystallized...`);
    });
    bus.on('focus', ({ x, y, z }) => {
      // gentle refocus on the acting unit
      this.cameraRig.target.x = x * 0.35 + this.cameraRig.target.x * 0.65;
      this.cameraRig.target.z = z * 0.35 + this.cameraRig.target.z * 0.65;
      this.cameraRig.update();
    });
    // Show targeting bar whenever the battle enters target/move selection.
    const origBegin = battle.beginTarget.bind(battle);
    battle.beginTarget = (id) => {
      origBegin(id);
      const { ABILITIES } = requireAbilities();
      this.hud.showTargeting(ABILITIES[id].name, () => battle.cancelTarget());
    };
    const origMove = battle.beginMove.bind(battle);
    battle.beginMove = () => {
      origMove();
      this.hud.showTargeting('Move', () => battle.cancelTarget());
    };
  }

  onBattleEnd(def, isErrand, errand, result, battle) {
    this.physics.clearAll();
    if (!result || !result.win) {
      this.audio.playMusic('defeat');
      this.state = 'defeat';
      this.ui.showGameOver({
        onRetry: () => this.toDeploy(def, isErrand, errand),
        onMap: () => this.toWorld(),
      });
      return;
    }
    const rewards = battle.applyRewards();
    this.campaign.gil += rewards.gil;
    for (const item of battle.poached || []) this.treasureWon.push(item);
    this.audio.playMusic('victory');
    if (isErrand && errand) {
      if (!this.campaign.errandsDone.includes(errand.id)) this.campaign.errandsDone.push(errand.id);
      if (errand.battle.recruit === 'Cloud' && !this.campaign.party.some((u) => u.name === 'Cloud')) {
        this.recruitCloud();
      }
    } else {
      if (def.id === 'b6_lesalia' && !this.campaign.party.some((u) => u.name === 'Aveline')) {
        this.recruitAveline();
      }
      this.campaign.battleIndex = Math.min(BATTLES.length, this.campaign.battleIndex + 1);
    }
    for (const r of tickDispatches(this.campaign)) {
      this.ui.toast(`${r.name} returned: +${r.gil} G, +${r.jp} JP (${r.prop})`);
    }
    writeSave(this.campaign);
    this.state = 'results';
    const lastBattle = !isErrand && this.campaign.battleIndex >= BATTLES.length;
    this.ui.showResults(rewards, this.treasureWon, {
      title: lastBattle ? 'The Heritor Falls!' : 'Victory!',
      onDone: () => {
        if (lastBattle) {
          this.audio.playMusic('ending');
          this.ui.showEnding({ onDone: () => { clearSave(); this.toTitle(); } });
        } else {
          const next = BATTLES[this.campaign.battleIndex];
          const prev = BATTLES[this.campaign.battleIndex - 1];
          if (!isErrand && next && prev && next.chapter !== prev.chapter) {
            this.ui.showStory(`Chapter ${next.chapter}`, [STORY.chapters[next.chapter], next.brief], { onDone: () => this.toWorld() });
          } else {
            this.toWorld();
          }
        }
      },
    });
    for (const g of rewards.gains) {
      if (g.leveled) this.audio.playSfx('levelup');
    }
  }

  recruitCloud() {
    import('./state.js').then(({ makeUnit }) => {
      const c = makeUnit(RECRUIT_CLOUD.name, 'squire', 12, { gender: 'M', brave: 75, faith: 45 });
      c.equipment.weapon = 'mythril_sword';
      c.learned = { braver: true, cross_slash: true };
      computeStats(c);
      c.hp = c.maxHp; c.mp = c.maxMp;
      if (this.campaign.party.length < 8) this.campaign.party.push(c);
      else this.campaign.reserves.push(c);
      writeSave(this.campaign);
      this.ui.toast('Cloud joined the company — Limit arts learned!');
    });
  }

  recruitAveline() {
    import('./state.js').then(({ makeUnit }) => {
      const a = makeUnit(RECRUIT_AVELINE.name, 'knight', 11, { gender: 'F', brave: 72, faith: 65 });
      a.equipment.weapon = 'mythril_sword';
      a.equipment.body = 'mythril_armor';
      a.learned = { holy_hold: true, holy_blade: true };
      computeStats(a);
      a.hp = a.maxHp; a.mp = a.maxMp;
      if (this.campaign.party.length < 8) this.campaign.party.push(a);
      else this.campaign.reserves.push(a);
      writeSave(this.campaign);
      this.ui.toast('Aveline the Oathsworn joined the company!');
    });
  }

  // ---------- loop ----------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0.016;
    dt = Math.min(dt, 0.1);

    // frame stats (EMA)
    const ms = dt * 1000;
    this.frameMs = this.frameMs * 0.92 + ms * 0.08;
    this.fps = this.fps * 0.92 + (1 / Math.max(dt, 1e-4)) * 0.08;

    if (this.state === 'title') {
      this.cameraRig.yaw += dt * 0.12;
      this.cameraRig.update();
    }
    this.cameraRig.updateKeys(dt);
    if (this.physics) this.physics.update(dt);
    if (this.board) this.board.update(dt, now / 1000);
    this.autoQuality(now);
    this.renderer.render();
    this.updateDiag(now);
  }

  autoQuality(now) {
    if (this.options.quality !== 'auto') return;
    this.autoState.window.push(this.fps);
    if (now - this.autoState.lastSwitch < AUTO_TUNING.sampleMs) return;
    const avg = this.autoState.window.reduce((a, b) => a + b, 0) / Math.max(1, this.autoState.window.length);
    this.autoState.window = [];
    this.autoState.lastSwitch = now;
    if (avg < AUTO_TUNING.demoteFps && this.effectiveQuality !== 'balanced') {
      this.effectiveQuality = 'balanced';
      this.autoState.goodWindows = 0;
      this.applyOptions();
    } else if (avg > AUTO_TUNING.promoteFps && this.effectiveQuality !== 'high') {
      this.autoState.goodWindows++;
      if (this.autoState.goodWindows >= 2) {
        this.effectiveQuality = 'high';
        this.autoState.goodWindows = 0;
        this.applyOptions();
      }
    } else {
      this.autoState.goodWindows = 0;
    }
  }

  updateDiag(now) {
    if (!this.options.showDiag) return;
    if (this._lastDiag && now - this._lastDiag < 250) return;
    this._lastDiag = now;
    const q = this.options.quality === 'auto' ? `auto→${this.effectiveQuality}` : this.options.quality;
    const cap = (QUALITY_PRESETS[this.renderer.preset] || QUALITY_PRESETS.balanced).maxBodies;
    this.ui.setDiag(
      `${BUILD_INFO.title} v${BUILD_INFO.version}\n` +
      `backend: ${this.renderer.backend} · quality: ${q}\n` +
      `fps: ${this.fps.toFixed(0)} · frame: ${this.frameMs.toFixed(1)}ms\n` +
      `bodies: ${this.physics ? this.physics.count : 0}/${cap}`,
    );
  }
}

// Lazy ESM-friendly accessors (avoid cycles + keep TSL imports cached).
let _tsl = null;
let _nodeMat = null;
let _abilities = null;
function requireTsl() {
  if (!_tsl) throw new Error('TSL not loaded yet');
  return _tsl;
}
function requireNodeMaterial() {
  if (!_nodeMat) throw new Error('node materials not loaded yet');
  return _nodeMat;
}
function requireAbilities() {
  if (!_abilities) throw new Error('abilities not loaded yet');
  return _abilities;
}

async function boot() {
  try {
    // Preload TSL + node material constructors for the water factory.
    const [tsl, webgpu, data] = await Promise.all([
      import('three/tsl'),
      import('three/webgpu'),
      import('./data.js'),
    ]);
    _tsl = tsl;
    _nodeMat = { MeshStandardNodeMaterial: webgpu.MeshStandardNodeMaterial };
    _abilities = { ABILITIES: data.ABILITIES };
  } catch (e) {
    console.warn('TSL preload failed; standard materials will be used:', e);
  }
  const game = new Game();
  try {
    await game.init();
  } catch (e) {
    console.error('Boot failed:', e);
    document.getElementById('ui').innerHTML = `<div class="screen"><div class="panel">
      <h2>Crownfall Tactics failed to start</h2>
      <p>${escapeBoot(e)}</p>
      <p class="dim">Try a recent Chrome, Edge, Firefox, or Safari. WebGPU is preferred; WebGL2 is the automatic fallback.</p>
    </div></div>`;
  }
}

function escapeBoot(e) {
  return String((e && e.message) || e).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

boot();
