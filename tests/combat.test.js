// Focused regression tests for pure battle/campaign logic.
// Run: npm test  (uses the Node built-in test runner, no extra deps)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, JOBS, BATTLES, ERRANDS, MONSTERS, EQUIPMENT, POACHES, PROPOSITIONS } from '../src/data.js';
import { makeUnit, computeStats, grantXpJp, jobUnlocked, learnAbility, newCampaign, hireCost, hireRecruit, sendDispatch, tickDispatches } from '../src/state.js';
import { tickCT, predictOrder, physDamage, magicDamage, moveRange, manhattan, aoeTiles, resolveAbility, isBackstab, maybePoach, startOfTurn, damageUnit } from '../src/combat.js';

describe('data integrity', () => {
  it('every job ability exists', () => {
    for (const j of Object.values(JOBS)) {
      for (const ab of j.abilities) assert.ok(ABILITIES[ab], `${j.id} -> ${ab}`);
    }
  });
  it('every monster ability exists', () => {
    for (const m of Object.values(MONSTERS)) {
      for (const ab of m.abilities) assert.ok(ABILITIES[ab], ab);
    }
  });
  it('battles reference valid maps, jobs, monsters, items', () => {
    const all = [...BATTLES, ...ERRANDS.map((e) => e.battle)];
    assert.ok(all.length >= 10);
    for (const b of all) {
      assert.equal(b.map.heights.length, b.map.d, b.id);
      for (const row of b.map.heights) assert.equal(row.length, b.map.w, b.id);
      for (const e of b.enemies) {
        if (e.monster) assert.ok(MONSTERS[e.monster], b.id);
        else assert.ok(JOBS[e.job || 'squire'], b.id);
        for (const ab of e.abilities || []) assert.ok(ABILITIES[ab], `${b.id}:${ab}`);
      }
      for (const t of b.treasure || []) assert.ok(EQUIPMENT[t.item], `${b.id}:${t.item}`);
      assert.ok(b.player.length > 0 && b.deployMax > 0, b.id);
    }
  });
});

describe('units and progression', () => {
  it('new campaign has 3 equipped units', () => {
    const c = newCampaign();
    assert.equal(c.party.length, 3);
    assert.equal(c.party[0].name, 'Rowan');
    for (const u of c.party) {
      assert.ok(u.maxHp > 20 && u.hp === u.maxHp);
      assert.ok(u.pa >= 1 && u.ma >= 1 && u.sp >= 3);
    }
  });
  it('xp grants levels and keeps ratios sane', () => {
    const u = makeUnit('T', 'squire', 1);
    const leveled = grantXpJp(u, 500, 100);
    assert.ok(leveled && u.level > 1);
    assert.ok(u.hp <= u.maxHp && u.jp.squire === 100);
  });
  it('job unlocks follow JP requirements', () => {
    const c = newCampaign();
    const u = c.party[0];
    assert.equal(jobUnlocked(c.party, u, 'knight'), false);
    u.jp.squire = 200;
    assert.equal(jobUnlocked(c.party, u, 'knight'), true);
    assert.equal(jobUnlocked(c.party, u, 'dragoon'), false);
  });
  it('learning spends current-job JP and sticks', () => {
    const u = makeUnit('T', 'squire', 3);
    u.jp.squire = 500;
    assert.equal(learnAbility(u, 'shout'), true);
    assert.equal(u.learned.shout, true);
    assert.equal(u.jp.squire, 500 - 120);
    assert.equal(learnAbility(u, 'shout'), false); // already known
    u.jp.squire = 0;
    assert.equal(learnAbility(u, 'flare'), false); // cannot afford
  });
});

describe('CT turn flow', () => {
  it('fastest unit acts first and spends to zero', () => {
    const a = makeUnit('A', 'thief', 5);   // sp 9+
    const b = makeUnit('B', 'knight', 5);  // sp 5
    computeStats(a); computeStats(b);
    a.ct = 0; b.ct = 0;
    const order = predictOrder([a, b], 4);
    assert.equal(order[0].uid, a.uid);
    const next = tickCT([a, b]);
    assert.equal(next.uid, a.uid);
    assert.ok(a.ct >= 100);
  });
});

describe('formulas', () => {
  it('physical damage is positive and scales with PA', () => {
    const att = makeUnit('A', 'knight', 10);
    const weak = makeUnit('W', 'squire', 1);
    computeStats(att); computeStats(weak);
    const d1 = physDamage(att, weak, ABILITIES.attack);
    const d2 = physDamage(weak, att, ABILITIES.attack);
    assert.ok(d1 >= 1 && d2 >= 1);
    assert.ok(d1 > d2);
  });
  it('magic damage scales with MA and faith', () => {
    const m = makeUnit('M', 'blackmage', 8);
    const t = makeUnit('T', 'squire', 5);
    computeStats(m); computeStats(t);
    const d = magicDamage(m, t, ABILITIES.fire);
    assert.ok(d >= 5);
  });
  it('manhattan and aoe shapes', () => {
    assert.equal(manhattan(0, 0, 3, 4), 7);
    assert.equal(aoeTiles(ABILITIES.attack, 2, 2, 8, 8).length, 1);
    assert.equal(aoeTiles(ABILITIES.fire, 2, 2, 8, 8).length, 5);
    assert.equal(aoeTiles(ABILITIES.ifrit, 4, 4, 10, 10).length, 9);
  });
  it('move range respects jump and blocked tiles', () => {
    const u = makeUnit('U', 'squire', 1);
    u.x = 1; u.y = 1;
    computeStats(u);
    const heights = [[1, 1, 1], [1, 1, 5], [1, 0, 1]];
    const reach = moveRange(u, heights, 3, 3, new Map());
    const has = (x, y) => reach.has(y * 3 + x);
    assert.equal(has(2, 1), false); // cliff too high (jump 3, diff 4)
    assert.equal(has(1, 2), false); // water
    assert.equal(has(0, 1), true);
  });
});

describe('facing and back attacks', () => {
  it('detects attacks from behind the facing', () => {
    const def = makeUnit('D', 'squire', 1);
    def.x = 5; def.y = 5; def.fx = 0; def.fz = -1; // looking north
    const behind = makeUnit('A', 'squire', 1);
    behind.x = 5; behind.y = 7; // south of defender = behind
    const front = makeUnit('F', 'squire', 1);
    front.x = 5; front.y = 3;
    const side = makeUnit('S', 'squire', 1);
    side.x = 7; side.y = 5;
    assert.equal(isBackstab(behind, def), true);
    assert.equal(isBackstab(front, def), false);
    assert.equal(isBackstab(side, def), false);
  });
  it('back attacks always hit for +30%', () => {
    const att = makeUnit('A', 'knight', 10, { side: 'player' });
    const def = makeUnit('D', 'knight', 10, { side: 'enemy' });
    att.x = 0; att.y = 1; def.x = 0; def.y = 0;
    def.fx = 0; def.fz = -1; // looking away from attacker
    def.evade = 90;
    computeStats(att);
    const evs = resolveAbility(att, 'attack', 0, 0, [att, def], [[1], [1]], { map: { w: 1, d: 2 } });
    assert.ok(evs.some((e) => e.type === 'backstab'));
    assert.ok(evs.some((e) => e.type === 'damage'));
    assert.ok(!evs.some((e) => e.type === 'miss'));
  });
});

describe('new statuses and wards', () => {
  function pair() {
    const att = makeUnit('A', 'timemage', 8, { side: 'player' });
    const def = makeUnit('D', 'squire', 5, { side: 'enemy' });
    att.x = 0; att.y = 0; def.x = 1; def.y = 0;
    computeStats(att); computeStats(def);
    return { att, def };
  }
  it('ailments land and stop/sleep skip turns', () => {
    const { att, def } = pair();
    const real = Math.random;
    Math.random = () => 0; // force hits
    try {
      resolveAbility(att, 'stop', 1, 0, [att, def], [[1, 1]], { map: { w: 2, d: 1 } });
    } finally { Math.random = real; }
    assert.ok(def.statuses.stop > 0);
    const evs = [];
    assert.equal(startOfTurn(def, evs), true);
    assert.ok(evs.some((e) => e.type === 'stopped'));
  });
  it('sleep breaks on damage', () => {
    const { def } = pair();
    def.statuses.sleep = 2;
    damageUnit(def, 5, []);
    assert.ok(!('sleep' in def.statuses));
  });
  it('haste raises speed; protect/shell reduce damage', () => {
    const { att, def } = pair();
    computeStats(def);
    const baseSp = def.sp;
    def.statuses.haste = 3;
    computeStats(def);
    assert.equal(def.sp, baseSp + 3);
    const plain = physDamage(att, def, ABILITIES.attack);
    def.statuses.protect = 3;
    const warded = physDamage(att, def, ABILITIES.attack);
    assert.ok(warded < plain);
    const mPlain = magicDamage(att, def, ABILITIES.fire);
    def.statuses.shell = 3;
    const mWarded = magicDamage(att, def, ABILITIES.fire);
    assert.ok(mWarded < mPlain);
  });
  it('regen mends at turn start', () => {
    const { def } = pair();
    def.statuses.regen = 3;
    def.hp = 10;
    const evs = [];
    startOfTurn(def, evs);
    assert.ok(def.hp > 10);
    assert.ok(evs.some((e) => e.type === 'heal'));
  });
  it('ranged buffs ward allies in the area', () => {
    const att = makeUnit('A', 'whitemage', 8, { side: 'player' });
    const ally = makeUnit('B', 'squire', 5, { side: 'player' });
    att.x = 1; att.y = 1; ally.x = 1; ally.y = 2;
    computeStats(att); computeStats(ally);
    const h = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
    resolveAbility(att, 'shell', 1, 1, [att, ally], h, { map: { w: 3, d: 3 } });
    assert.ok(ally.statuses.shell === 3);
    assert.ok(att.statuses.shell === 3);
  });
});

describe('new chemist goods', () => {
  it('ether restores MP, remedy cleanses, elixir fills HP', () => {
    const c = makeUnit('C', 'chemist', 5, { side: 'player' });
    const a = makeUnit('A', 'squire', 5, { side: 'player' });
    c.x = 0; c.y = 0; a.x = 0; a.y = 1;
    computeStats(c); computeStats(a);
    a.mp = 0; a.hp = 5;
    a.statuses.slow = 2; a.statuses.sleep = 2;
    const units = [c, a], h = [[1], [1]], b = { map: { w: 1, d: 2 } };
    resolveAbility(c, 'ether', 0, 1, units, h, b);
    assert.ok(a.mp > 0);
    resolveAbility(c, 'remedy', 0, 1, units, h, b);
    assert.deepEqual(Object.keys(a.statuses), []);
    resolveAbility(c, 'elixir', 0, 1, units, h, b);
    assert.equal(a.hp, a.maxHp);
  });
});

describe('poaching', () => {
  it('thieves always poach (forced rare); others sometimes', () => {
    const thief = makeUnit('T', 'thief', 10, { side: 'player' });
    const knight = makeUnit('K', 'knight', 10, { side: 'player' });
    const gob = makeUnit('G', 'squire', 1, { side: 'enemy', monster: 'goblin' });
    gob.hp = 1;
    computeStats(thief); computeStats(knight); computeStats(gob);
    thief.x = 0; thief.y = 0; knight.x = 0; knight.y = 0; gob.x = 1; gob.y = 0;
    const real = Math.random;
    try {
      Math.random = () => 0.05; // rare roll + auto-hit
      let evs = resolveAbility(thief, 'attack', 1, 0, [thief, gob], [[1, 1]], { map: { w: 2, d: 1 } });
      const rare = evs.find((e) => e.type === 'poach');
      assert.ok(rare && rare.rare === true && rare.item === POACHES.goblin.rare);
      // fresh goblin, non-thief, bad roll -> nothing
      const gob2 = makeUnit('G2', 'squire', 1, { side: 'enemy', monster: 'goblin' });
      gob2.hp = 1; computeStats(gob2);
      gob2.x = 1; gob2.y = 0;
      knight.x = 1; knight.y = 1;
      Math.random = () => 0.95;
      gob2.fx = 0; gob2.fz = -1; // looking north; knight due south -> behind
      evs = resolveAbility(knight, 'attack', 1, 0, [knight, gob2], [[1, 1], [1, 1]], { map: { w: 2, d: 2 } });
      // roll 0.95: backstab hits (100), poach roll 0.95 >= 0.3 -> no poach
      assert.ok(evs.some((e) => e.type === 'damage'));
      assert.ok(!evs.some((e) => e.type === 'poach'));
    } finally { Math.random = real; }
  });
  it('every monster has valid poach goods', () => {
    for (const id of Object.keys(MONSTERS)) {
      const p = POACHES[id];
      assert.ok(p, `poach table for ${id}`);
      assert.ok(EQUIPMENT[p.common], `${id} common`);
      assert.ok(EQUIPMENT[p.rare], `${id} rare`);
    }
  });
  it('maybePoach ignores non-monsters and enemy killers', () => {
    const evs = [];
    const foe = makeUnit('F', 'squire', 1, { side: 'enemy' });
    const human = makeUnit('H', 'squire', 1, { side: 'enemy' });
    human.alive = false;
    maybePoach(foe, human, evs);
    assert.equal(evs.length, 0);
  });
});

describe('hiring and dispatches', () => {
  it('hire costs scale and add reserves', () => {
    assert.ok(hireCost(4) > hireCost(0));
    const c = newCampaign();
    c.gil = 100000;
    const before = c.reserves.length;
    const u = hireRecruit(c, 0);
    assert.ok(u && c.reserves.length === before + 1);
    assert.ok(c.hireOffers[0]);
  });
  it('hire fails when broke', () => {
    const c = newCampaign();
    c.gil = 0;
    assert.equal(hireRecruit(c, 0), null);
  });
  it('dispatch validates and completes with rewards', () => {
    const c = newCampaign();
    c.gil = 100000;
    const u = hireRecruit(c, 0);
    assert.equal(sendDispatch(c, 999999, 'p1'), 'Unit must wait in reserves.');
    u.level = 1;
    assert.equal(sendDispatch(c, u.uid, 'p5'), 'Needs level 14.');
    assert.equal(sendDispatch(c, u.uid, 'p1'), null);
    assert.equal(c.reserves.length, 0);
    const gil0 = c.gil;
    const done = tickDispatches(c);
    assert.equal(done.length, 1);
    assert.equal(done[0].prop, PROPOSITIONS[0].name);
    assert.ok(c.gil > gil0);
    assert.equal(c.reserves.length, 1);
    assert.ok(c.reserves[0].jp[c.reserves[0].job] >= PROPOSITIONS[0].jp);
  });
});

describe('new content integrity', () => {
  it('covers 20 battles and 14 jobs', () => {
    assert.ok(BATTLES.length >= 20);
    assert.ok(Object.keys(JOBS).length >= 14);
    assert.ok(Object.keys(ABILITIES).length >= 65);
    assert.ok(Object.keys(MONSTERS).length >= 13);
  });
  it('hidden caches are valid items on walkable tiles', () => {
    for (const b of BATTLES) {
      for (const t of b.hidden || []) {
        assert.ok(EQUIPMENT[t.item], `${b.id}: ${t.item}`);
        assert.ok(t.x >= 0 && t.y >= 0 && t.x < b.map.w && t.y < b.map.d, b.id);
        const h = parseInt(b.map.heights[t.y][t.x], 10);
        assert.ok(h > 0, `${b.id} hidden walkable`);
      }
    }
  });
  it('propositions reference valid rewards', () => {
    for (const p of PROPOSITIONS) {
      for (const item of p.items) assert.ok(EQUIPMENT[item], p.id);
      assert.ok(p.days >= 1 && p.gil > 0);
    }
  });
});

describe('resolveAbility', () => {
  it('attack can KO and starts a 3-round crystal timer', () => {
    const att = makeUnit('A', 'knight', 20, { side: 'player' });
    const def = makeUnit('D', 'squire', 1, { side: 'enemy' });
    att.x = 0; att.y = 0; def.x = 1; def.y = 0;
    def.fx = 1; def.fz = 0; // looking away: back attack always hits
    computeStats(att); computeStats(def);
    def.hp = 1;
    const evs = resolveAbility(att, 'attack', 1, 0, [att, def], [[1, 1]], { map: { w: 2, d: 1 } });
    assert.equal(def.alive, false);
    assert.equal(def.koTimer, 3);
    assert.ok(evs.some((e) => e.type === 'ko'));
  });
  it('cure heals allies only', () => {
    const c = makeUnit('C', 'whitemage', 8, { side: 'player' });
    const ally = makeUnit('A', 'squire', 5, { side: 'player' });
    const foe = makeUnit('F', 'squire', 5, { side: 'enemy' });
    c.x = 1; c.y = 1; ally.x = 1; ally.y = 2; foe.x = 2; foe.y = 1;
    computeStats(c); computeStats(ally); computeStats(foe);
    ally.hp = 5;
    const foeHp = foe.hp;
    resolveAbility(c, 'cure', 1, 1, [c, ally, foe], [[1, 1, 1], [1, 1, 1], [1, 1, 1]], { map: { w: 3, d: 3 } });
    assert.ok(ally.hp > 5);
    assert.equal(foe.hp, foeHp);
  });
});
