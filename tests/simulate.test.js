// Headless end-to-end battle simulation: runs the REAL Battle controller with
// stub rendering/audio and a scripted player. Proves the full game loop
// (deploy -> CT turns -> AI -> win/lose -> rewards) terminates correctly.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BATTLES, ABILITIES } from '../src/data.js';
import { newCampaign, computeStats } from '../src/state.js';
import { Battle } from '../src/battle.js';
import { manhattan } from '../src/combat.js';

function stubBoard() {
  return {
    build: async () => {},
    addUnit: () => {},
    tilePos: (x, y) => ({ x, y: 0, z: y }),
    moveUnitMesh: async () => {},
    faceTile: () => {},
    setUnitVisible: () => {},
    setUnitKO: () => {},
    flashUnit: () => {},
    removeUnit: () => {},
    spawnBurst: () => {},
    spawnRing: () => {},
    showHighlights: () => {},
    clearAllHighlights: () => {},
    clearHighlights: () => {},
    addChest: () => ({ parent: null }),
  };
}

const stubAudio = { playMusic: async () => {}, playSfx: async () => {} };

// Scripted player: walk toward the nearest foe, attack when in range, wait.
function autoPlayer(battle) {
  return {
    emit(type, payload) {
      if (type !== 'playerMenu') return;
      const unit = payload.unit;
      queueMicrotask(async () => {
        try {
          if (battle.phase !== 'menu') return;
          const foes = battle.units.filter((u) => u.alive && u.side !== unit.side);
          if (!foes.length) { await battle.doWait(); return; }
          if (!battle.moved) {
            battle.beginMove();
            // step toward nearest foe
            let bestKey = null, bestD = Infinity;
            for (const k of battle.moveKeys.keys()) {
              const x = k % battle.w, y = Math.floor(k / battle.w);
              for (const f of foes) {
                const d = manhattan(x, y, f.x, f.y);
                if (d < bestD) { bestD = d; bestKey = k; }
              }
            }
            if (bestKey != null) {
              await battle.doMove(bestKey % battle.w, Math.floor(bestKey / battle.w));
              return; // doMove re-emits playerMenu; continue there
            }
          }
          if (!battle.acted) {
            const abs = battle.usableAbilities().filter((a) => a.usable);
            const atk = abs.find((a) => a.kind === 'phys' || a.kind === 'magic')
              || abs.find((a) => a.range === 0);
            if (atk) {
              if (atk.range === 0) {
                battle._targetAbility = atk.id;
                await battle.doTarget(unit.x, unit.y);
                return;
              }
              const inRange = foes.filter((f) => manhattan(unit.x, unit.y, f.x, f.y) <= atk.range);
              if (inRange.length) {
                battle._targetAbility = atk.id;
                if (await battle.doTarget(inRange[0].x, inRange[0].y)) return;
              }
            }
          }
          await battle.doWait();
        } catch (e) {
          console.error('autoPlayer error', e);
        }
      });
    },
  };
}

describe('headless battle simulation', () => {
  it('battle 1 runs to a win with rewards (overleveled party)', { timeout: 120000 }, async () => {
    const campaign = newCampaign();
    for (const u of campaign.party) {
      u.level = 6;
      computeStats(u);
      u.hp = u.maxHp; u.mp = u.maxMp;
    }
    const def = BATTLES[0];
    const deployed = campaign.party.slice(0, 3);
    deployed.forEach((u, i) => { u.x = def.player[i].x; u.y = def.player[i].y; });
    const battle = new Battle(def, {
      board: stubBoard(), physics: null, audio: stubAudio,
      campaign, isErrand: false, events: null,
    });
    battle.wait = () => Promise.resolve(); // no animation delays
    battle.events = autoPlayer(battle);
    await battle.setup(deployed);
    const result = await battle.run();
    assert.ok(result, 'battle returned a result');
    assert.equal(result.win, true);
    assert.ok(result.turns > 0 && result.turns < 200);
    const rewards = battle.applyRewards();
    assert.equal(rewards.gains.length, 3);
    assert.ok(rewards.gil >= def.gil);
  });

  it('boss KO ends a boss battle immediately', () => {
    const campaign = newCampaign();
    const def = BATTLES[4]; // Thunder Regent
    const battle = new Battle(def, {
      board: stubBoard(), physics: null, audio: stubAudio,
      campaign, isErrand: false, events: { emit: () => {} },
    });
    battle.heights = def.map.heights.map((r) => [...r].map(Number));
    const ally = campaign.party[0];
    ally.side = 'player'; ally.alive = true; ally.koTimer = 0;
    const boss = { uid: 999, side: 'enemy', boss: true, alive: false, koTimer: 2, x: 0, y: 0 };
    const minion = { uid: 1000, side: 'enemy', boss: false, alive: true, koTimer: 0, x: 1, y: 0 };
    battle.units = [ally, boss, minion];
    assert.equal(battle.checkEnd(), true);
    assert.equal(battle.result.win, true);
  });

  it('losing all units is a loss', () => {
    const campaign = newCampaign();
    const def = BATTLES[0];
    const battle = new Battle(def, {
      board: stubBoard(), physics: null, audio: stubAudio,
      campaign, isErrand: false, events: { emit: () => {} },
    });
    const dead = campaign.party[0];
    dead.alive = false; dead.koTimer = 0;
    const foe = { uid: 999, side: 'enemy', alive: true, koTimer: 0, x: 0, y: 0 };
    battle.units = [dead, foe];
    assert.equal(battle.checkEnd(), true);
    assert.equal(battle.result.win, false);
  });
});
