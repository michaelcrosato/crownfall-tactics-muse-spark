// Campaign state: party, gil, inventory, job points, progression, deploy.
import { JOBS, EQUIPMENT, PROPOSITIONS, HIRE_NAMES } from './data.js';

let uid = 1;

export function makeUnit(name, jobId, level = 1, opts = {}) {
  const job = JOBS[jobId];
  const u = {
    uid: uid++,
    name, job: jobId, level,
    xp: 0,
    jp: { [jobId]: 0 },
    brave: opts.brave ?? 60 + Math.floor(Math.random() * 15),
    faith: opts.faith ?? 55 + Math.floor(Math.random() * 15),
    gender: opts.gender ?? (Math.random() < 0.5 ? 'M' : 'F'),
    equipment: { weapon: null, offhand: null, body: null, head: null, acc: null },
    learned: opts.learned || {},
    ct: 0,
    side: opts.side || 'player',
    // battle-only (reset per battle)
    hp: 0, mp: 0, maxHp: 0, maxMp: 0,
    x: 0, y: 0, alive: true, koTimer: 0,
    statuses: {}, buffs: {},
    charged: false,
    isGuest: !!opts.isGuest,
    monster: opts.monster || null,
    boss: !!opts.boss,
  };
  computeStats(u);
  u.hp = u.maxHp; u.mp = u.maxMp;
  return u;
}

export function computeStats(u) {
  const job = JOBS[u.job];
  const eq = u.equipment || {};
  let pa = job.pa, ma = job.ma, sp = job.sp;
  let hp = job.hp, mp = job.mp, move = job.move, evade = 5;
  const g = job.growth;
  const lv = u.level - 1;
  hp += Math.floor(g.hp * lv);
  mp += Math.floor(g.mp * lv);
  pa += Math.floor(g.pa * lv);
  ma += Math.floor(g.ma * lv);
  sp += Math.floor(g.sp * lv);
  for (const slot of Object.keys(eq)) {
    const id = eq[slot];
    if (!id || !EQUIPMENT[id]) continue;
    const e = EQUIPMENT[id];
    if (e.pa) pa += e.pa;
    if (e.ma) ma += e.ma;
    if (e.hp) hp += e.hp;
    if (e.mp) mp += e.mp;
    if (e.move) move += e.move;
    if (e.evade) evade += e.evade;
  }
  if (u.gender === 'M') { pa += 1; hp += 4; } else { ma += 1; mp += 4; }
  if (u.buffs.shout) pa += u.buffs.shout;
  u.maxHp = Math.max(10, hp);
  u.maxMp = Math.max(0, mp);
  u.pa = Math.max(1, pa); u.ma = Math.max(1, ma);
  u.sp = Math.max(3, sp - (u.statuses.daze ? 2 : 0) - (u.statuses.slow ? 2 : 0) + (u.statuses.haste ? 3 : 0));
  u.move = Math.max(2, move);
  u.jump = job.jump;
  u.evade = u.statuses.exposed ? 0 : evade;
  u.hp = Math.min(u.hp || u.maxHp, u.maxHp);
  u.mp = Math.min(u.mp || u.maxMp, u.maxMp);
}

export function xpForLevel(level) {
  return 20 + level * 12;
}

export function grantXpJp(u, xp, jp) {
  u.xp += xp;
  u.jp[u.job] = (u.jp[u.job] || 0) + jp;
  let need = xpForLevel(u.level);
  let leveled = false;
  while (u.xp >= need && u.level < 30) {
    u.xp -= need;
    u.level++;
    leveled = true;
    need = xpForLevel(u.level);
  }
  if (leveled) {
    const hpRatio = u.hp / Math.max(1, u.maxHp);
    const mpRatio = u.maxMp > 0 ? u.mp / u.maxMp : 1;
    computeStats(u);
    u.hp = Math.max(1, Math.floor(u.maxHp * hpRatio));
    u.mp = Math.floor(u.maxMp * mpRatio);
  }
  return leveled;
}

export function jobUnlocked(party, unit, jobId) {
  const j = JOBS[jobId];
  if (!j.requires) return true;
  const have = unit.jp[j.requires.job] || 0;
  return have >= j.requires.jp;
}

// JP costs to learn each ability (FFT-style job-point spending).
export const LEARN_COSTS = {
  attack: 0, rush: 0,
  shout: 120, potion_squire: 100,
  potion: 100, hipotion: 180, phoenix: 250, antidote: 80,
  break_weapon: 200, break_shield: 200, break_helm: 220, rend_mp: 150,
  aim_leg: 150, aim_arm: 150, charge: 200,
  pummel: 150, chakra: 180, revive_punch: 250,
  steal_gil: 150, steal_heart: 220, steal_helm: 200,
  fire: 150, blizzard: 150, thunder: 150, flare: 350,
  cure: 150, cura: 300, raise: 300, esuna: 150,
  jump_strike: 300, pierce: 120,
  ifrit: 400, shiva: 400, ramuh: 400,
  haste: 150, slow2: 150, stop: 250, meteor: 500,
  throw_knife: 120, shuriken: 180, shadowstrike: 250,
  kiyomori: 200, muramasa: 300, murasame: 250,
  flame_burst: 150, rock_throw: 150, undertow: 180,
  shell: 200, regen: 250,
  holy_hold: 250, holy_blade: 300, braver: 300, cross_slash: 300,
  ether: 200, remedy: 220, x_potion: 350, elixir: 500,
};

export function learnCost(abilityId) {
  return LEARN_COSTS[abilityId] ?? 150;
}

// Spend current-job JP to permanently learn an ability (usable in any job).
export function learnAbility(u, abilityId) {
  if (!u.learned) u.learned = {};
  if (u.learned[abilityId]) return false;
  const cost = learnCost(abilityId);
  if ((u.jp[u.job] || 0) < cost) return false;
  u.jp[u.job] -= cost;
  u.learned[abilityId] = true;
  return true;
}

export function newCampaign() {
  uid = 1;
  const rowan = makeUnit('Rowan', 'squire', 1, { gender: 'M', brave: 70, faith: 60 });
  const mira = makeUnit('Mira', 'chemist', 1, { gender: 'F', brave: 55, faith: 72 });
  const bram = makeUnit('Bram', 'squire', 1, { gender: 'M', brave: 65, faith: 50 });
  rowan.equipment.weapon = 'short_sword';
  rowan.equipment.body = 'linen';
  mira.equipment.weapon = 'dagger';
  mira.equipment.head = 'cloth_hat';
  bram.equipment.weapon = 'dagger';
  bram.equipment.offhand = 'buckler';
  [rowan, mira, bram].forEach(computeStats);
  rowan.hp = rowan.maxHp; rowan.mp = rowan.maxMp;
  mira.hp = mira.maxHp; mira.mp = mira.maxMp;
  bram.hp = bram.maxHp; bram.mp = bram.maxMp;
  return {
    version: 2,
    battleIndex: 0,
    errandsDone: [],
    gil: 500,
    inventory: { potion_item: 3, phoenix_item: 1, antidote_item: 1 },
    party: [rowan, mira, bram],
    reserves: [],
    dispatches: [],
    hireOffers: [genHireOffer(0, 0), genHireOffer(0, 1)],
    result: null,
  };
}

export function hireCost(battleIndex) {
  return 250 + battleIndex * 120;
}

export function genHireOffer(battleIndex, slot) {
  const name = HIRE_NAMES[(battleIndex * 2 + slot * 7 + Math.floor(Math.random() * HIRE_NAMES.length)) % HIRE_NAMES.length];
  return {
    name,
    job: Math.random() < 0.5 ? 'squire' : 'chemist',
    level: 1 + Math.floor(battleIndex / 3),
    gender: Math.random() < 0.5 ? 'M' : 'F',
  };
}

export function hireRecruit(campaign, offerIndex) {
  const offer = (campaign.hireOffers || [])[offerIndex];
  if (!offer) return null;
  const cost = hireCost(campaign.battleIndex);
  if (campaign.gil < cost) return null;
  campaign.gil -= cost;
  const u = makeUnit(offer.name, offer.job, offer.level, { gender: offer.gender });
  if (!campaign.reserves) campaign.reserves = [];
  campaign.reserves.push(u);
  campaign.hireOffers[offerIndex] = genHireOffer(campaign.battleIndex, Math.floor(Math.random() * 24));
  return u;
}

// Send a reserve unit on a proposition. Returns error string or null.
export function sendDispatch(campaign, uid, propId) {
  const prop = PROPOSITIONS.find((p) => p.id === propId);
  if (!prop) return 'Unknown commission.';
  if (!campaign.dispatches) campaign.dispatches = [];
  if (campaign.dispatches.some((d) => d.uid === uid)) return 'Already away.';
  const idx = (campaign.reserves || []).findIndex((u) => u.uid === uid);
  if (idx < 0) return 'Unit must wait in reserves.';
  const u = campaign.reserves[idx];
  if (u.level < prop.minLevel) return `Needs level ${prop.minLevel}.`;
  campaign.reserves.splice(idx, 1);
  campaign.dispatches.push({ propId, uid: u.uid, name: u.name, job: u.job, level: u.level, battlesLeft: prop.days, snapshot: u });
  return null;
}

// Advance all dispatches by one completed battle. Returns completed reports.
export function tickDispatches(campaign) {
  const done = [];
  if (!campaign.dispatches) campaign.dispatches = [];
  for (const d of campaign.dispatches) {
    d.battlesLeft--;
  }
  const remaining = [];
  for (const d of campaign.dispatches) {
    if (d.battlesLeft > 0) {
      remaining.push(d);
      continue;
    }
    const prop = PROPOSITIONS.find((p) => p.id === d.propId);
    if (!prop) continue;
    campaign.gil += prop.gil;
    for (const item of prop.items || []) {
      const e = EQUIPMENT[item];
      if (!e) continue;
      if (e.slot === 'item') {
        campaign.inventory[item] = (campaign.inventory[item] || 0) + 1;
      } else {
        if (!campaign.stores) campaign.stores = [];
        if (!campaign.stores.includes(item)) campaign.stores.push(item);
      }
    }
    const u = d.snapshot;
    u.jp[u.job] = (u.jp[u.job] || 0) + prop.jp;
    if (!campaign.reserves) campaign.reserves = [];
    campaign.reserves.push(u);
    done.push({ name: d.name, prop: prop.name, gil: prop.gil, items: prop.items || [], jp: prop.jp });
  }
  campaign.dispatches = remaining;
  return done;
}

export function serializeCampaign(c) {
  return JSON.parse(JSON.stringify(c));
}

export function applyLoadedCampaign(c) {
  // Keep uid ahead of any loaded unit id.
  for (const u of [...(c.party || []), ...(c.reserves || [])]) {
    if (u.uid >= uid) uid = u.uid + 1;
  }
  for (const d of c.dispatches || []) {
    if (d.snapshot && d.snapshot.uid >= uid) uid = d.snapshot.uid + 1;
  }
  // Migrate pre-1.1 saves.
  if (!c.dispatches) c.dispatches = [];
  if (!c.hireOffers) c.hireOffers = [genHireOffer(c.battleIndex || 0, 0), genHireOffer(c.battleIndex || 0, 1)];
  if (!c.reserves) c.reserves = [];
  c.version = 2;
  return c;
}
