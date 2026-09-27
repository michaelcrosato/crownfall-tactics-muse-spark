// Focused regression tests for pure battle/campaign logic.
// Run: npm test  (uses the Node built-in test runner, no extra deps)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, JOBS, BATTLES, ERRANDS, MONSTERS, EQUIPMENT } from '../src/data.js';
import { makeUnit, computeStats, grantXpJp, jobUnlocked, learnAbility, newCampaign } from '../src/state.js';
import { tickCT, predictOrder, physDamage, magicDamage, moveRange, manhattan, aoeTiles, resolveAbility } from '../src/combat.js';

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

describe('resolveAbility', () => {
  it('attack can KO and starts a 3-round crystal timer', () => {
    const att = makeUnit('A', 'knight', 20, { side: 'player' });
    const def = makeUnit('D', 'squire', 1, { side: 'enemy' });
    att.x = 0; att.y = 0; def.x = 1; def.y = 0;
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
