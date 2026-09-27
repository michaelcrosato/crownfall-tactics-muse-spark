// Battle rules: CT/AT turn flow, hit/damage formulas, status ticks, enemy AI.
// Faithful in shape to FFT (CT 0-100, Speed ticks, charge times, evasion,
// Brave/Faith scaling, KO countdown) with numbers tuned for short battles.
import { ABILITIES, MONSTERS, JOBS } from './data.js';
import { computeStats } from './state.js';

// --- Turn flow (CT) ---
export function tickCT(units, amount = null) {
  // Advance clockticks until some unit reaches 100 CT.
  const alive = units.filter((u) => u.alive);
  let guard = 500;
  while (guard-- > 0) {
    for (const u of alive) u.ct += u.sp;
    const ready = alive.filter((u) => u.ct >= 100);
    if (ready.length) {
      ready.sort((a, b) => b.ct - a.ct || b.sp - a.sp);
      return ready[0];
    }
  }
  return alive[0];
}

export function spendTurn(u) {
  u.ct = 0;
}

// Predicted order for the AT display: simulate ticks without mutating.
export function predictOrder(units, n = 6) {
  const snaps = units.filter((u) => u.alive).map((u) => ({ u, ct: u.ct }));
  const out = [];
  let guard = 200;
  while (out.length < n && guard-- > 0 && snaps.length) {
    for (const s of snaps) s.ct += s.u.sp;
    const ready = snaps.filter((s) => s.ct >= 100).sort((a, b) => b.ct - a.ct);
    for (const r of ready) {
      out.push(r.u);
      r.ct = 0;
      if (out.length >= n) break;
    }
  }
  return out;
}

// --- Formulas ---
export function hitChance(att, def, ability, heightDiff = 0) {
  if (!ability.evade) return 100;
  let ev = def.evade || 0;
  if (heightDiff > 0) ev += heightDiff * 2; // defender uphill is harder to hit
  const brave = 0.9 + (att.brave || 60) / 500;
  return Math.max(15, Math.min(100, Math.floor((75 - ev) * brave)));
}

export function physDamage(att, def, ability) {
  const wpn = 1 + (attWeaponPower(att) * 0.35);
  let dmg = att.pa * ability.power * wpn;
  dmg *= 0.9 + ((att.brave || 60) - 50) / 250;
  dmg *= 0.92 + Math.random() * 0.16;
  if (att.charged) dmg *= 2;
  if (att.statuses.disarm) dmg *= 0.6;
  return Math.max(1, Math.floor(dmg));
}

export function attWeaponPower(att) {
  // Approximated from PA contribution of weapon-ish stats; monsters use PA.
  return Math.max(0, Math.floor((att.pa - 4) / 2));
}

export function magicDamage(att, def, ability) {
  let dmg = att.ma * ability.power * 2.2;
  dmg *= 0.85 + ((att.faith || 60) / 100) * 0.5;
  dmg *= 1 - Math.min(0.4, ((def.faith || 50) / 100) * 0.4);
  dmg *= 0.92 + Math.random() * 0.16;
  return Math.max(1, Math.floor(dmg));
}

export function healAmount(att, ability) {
  if (ability.kind === 'item') return ability.power;
  if (ability.id === 'chakra') return ability.power;
  if (ability.id === 'potion_squire') return ability.power;
  return Math.max(5, Math.floor(att.ma * ability.power * 2.4 * (0.9 + Math.random() * 0.2)));
}

// Tiles affected by an ability targeted at (tx,ty).
export function aoeTiles(ability, tx, ty, w, d) {
  const tiles = [{ x: tx, y: ty }];
  if (ability.aoe === 1) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = tx + dx, y = ty + dy;
      if (x >= 0 && y >= 0 && x < w && y < d) tiles.push({ x, y });
    }
  } else if (ability.aoe === 2) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const x = tx + dx, y = ty + dy;
      if (x >= 0 && y >= 0 && x < w && y < d) tiles.push({ x, y });
    }
  }
  return tiles;
}

export function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// BFS movement range honoring jump height and occupancy.
export function moveRange(unit, heights, w, d, occupied) {
  computeStats(unit);
  const start = { x: unit.x, y: unit.y, cost: 0 };
  const key = (x, y) => y * w + x;
  const best = new Map([[key(start.x, start.y), 0]]);
  const q = [start];
  const h0 = heights[unit.y][unit.x];
  while (q.length) {
    const cur = q.shift();
    if (cur.cost >= unit.move) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cur.x + dx, y = cur.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= d) continue;
      const h = heights[y][x];
      if (h <= 0) continue; // water/void
      if (Math.abs(h - heights[cur.y][cur.x]) > unit.jump) continue;
      if (occupied.has(key(x, y))) continue;
      const nc = cur.cost + 1;
      if (best.has(key(x, y)) && best.get(key(x, y)) <= nc) continue;
      best.set(key(x, y), nc);
      q.push({ x, y, cost: nc });
    }
  }
  best.delete(key(start.x, start.y));
  return best; // key -> cost
}

export function pathTo(unit, tx, ty, heights, w, d, occupied) {
  // BFS shortest path for animation.
  const key = (x, y) => y * w + x;
  const prev = new Map();
  const seen = new Set([key(unit.x, unit.y)]);
  const q = [{ x: unit.x, y: unit.y }];
  while (q.length) {
    const cur = q.shift();
    if (cur.x === tx && cur.y === ty) {
      const path = [];
      let k = key(tx, ty);
      let c = { x: tx, y: ty };
      while (prev.has(k)) {
        path.unshift(c);
        c = prev.get(k);
        k = key(c.x, c.y);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cur.x + dx, y = cur.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= d) continue;
      const h = heights[y][x];
      if (h <= 0) continue;
      if (Math.abs(h - heights[cur.y][cur.x]) > unit.jump) continue;
      const k = key(x, y);
      if (seen.has(k)) continue;
      if (occupied.has(k) && !(x === tx && y === ty)) continue;
      seen.add(k);
      prev.set(k, cur);
      q.push({ x, y });
    }
  }
  return [];
}

// Apply one ability from att onto target tile; returns event list for animation.
export function resolveAbility(att, abilityId, tx, ty, allUnits, heights, battle) {
  const ability = ABILITIES[abilityId];
  const events = [];
  const w = battle.map.w, d = battle.map.d;
  const tiles = aoeTiles(ability, tx, ty, w, d);
  const targets = allUnits.filter((u) => u.alive && tiles.some((t) => t.x === u.x && t.y === u.y));

  if (ability.mp) att.mp = Math.max(0, att.mp - ability.mp);
  if (ability.kind === 'item' || abilityId === 'phoenix') {
    // consume from shared inventory when used by player side
    if (att.side === 'player' && battle && battle.consumeItem) battle.consumeItem(abilityId);
  }

  const hostile = (t) => t.side !== att.side;
  const friendly = (t) => t.side === att.side;

  switch (ability.kind) {
    case 'phys':
    case 'jump': {
      const list = targets.filter(hostile);
      if (!list.length) events.push({ type: 'whiff', x: tx, y: ty });
      for (const t of list) {
        const hd = (heights[t.y]?.[t.x] || 1) - (heights[att.y]?.[att.x] || 1);
        const h = hitChance(att, t, ability, hd);
        if (Math.random() * 100 < h) {
          const dmg = ability.kind === 'jump' ? Math.floor(att.pa * ability.power * 1.6) : physDamage(att, t, ability);
          damageUnit(t, dmg, events);
          events.push({ type: 'damage', target: t.uid, amount: dmg, x: t.x, y: t.y, element: 'none', sfx: ability.sfx });
          if (ability.debuff) {
            t.statuses[ability.debuff] = ability.debuff === 'exposed' ? 3 : 2;
            events.push({ type: 'status', target: t.uid, status: ability.debuff });
          }
          if (ability.drainMp) {
            t.mp = Math.max(0, t.mp - 12);
            events.push({ type: 'drain', target: t.uid, amount: 12 });
          }
        } else {
          events.push({ type: 'miss', target: t.uid, x: t.x, y: t.y, sfx: 'miss' });
        }
      }
      att.charged = false;
      break;
    }
    case 'magic': {
      const list = targets.filter(hostile);
      if (!list.length) events.push({ type: 'whiff', x: tx, y: ty });
      for (const t of list) {
        const h = 88 + Math.floor(((att.faith || 60) - 50) / 4);
        if (Math.random() * 100 < h) {
          const dmg = magicDamage(att, t, ability);
          damageUnit(t, dmg, events);
          events.push({ type: 'damage', target: t.uid, amount: dmg, x: t.x, y: t.y, element: ability.element || 'none', sfx: ability.sfx });
        } else {
          events.push({ type: 'miss', target: t.uid, x: t.x, y: t.y, sfx: 'miss' });
        }
      }
      break;
    }
    case 'heal': {
      const list = ability.cleanse ? targets.filter(friendly) : targets.filter(friendly);
      if (!list.length && !ability.cleanse) events.push({ type: 'whiff', x: tx, y: ty });
      for (const t of list) {
        if (ability.cleanse) {
          for (const s of ['poison', 'slow', 'daze', 'disarm']) delete t.statuses[s];
          events.push({ type: 'cleanse', target: t.uid, x: t.x, y: t.y, sfx: ability.sfx });
        } else {
          let amt = healAmount(att, ability);
          if (ability.id === 'chakra' && t.uid !== att.uid) continue;
          if (t.uid !== att.uid && ability.id === 'chakra') continue;
          t.hp = Math.min(t.maxHp, t.hp + amt);
          if (ability.id === 'chakra') att.mp = Math.min(att.maxMp, att.mp + 8);
          events.push({ type: 'heal', target: t.uid, amount: amt, x: t.x, y: t.y, sfx: ability.sfx });
        }
      }
      break;
    }
    case 'item': {
      const t = allUnits.find((u) => u.alive && u.x === tx && u.y === ty && friendly(u));
      if (!t) { events.push({ type: 'whiff', x: tx, y: ty }); break; }
      if (abilityId === 'antidote') {
        delete t.statuses.poison;
        events.push({ type: 'cleanse', target: t.uid, x: t.x, y: t.y, sfx: 'potion' });
      } else {
        t.hp = Math.min(t.maxHp, t.hp + ability.power);
        events.push({ type: 'heal', target: t.uid, amount: ability.power, x: t.x, y: t.y, sfx: 'potion' });
      }
      break;
    }
    case 'revive': {
      const t = allUnits.find((u) => !u.alive && u.koTimer > 0 && u.side === att.side && u.x === tx && u.y === ty);
      if (t) {
        t.alive = true;
        t.hp = Math.max(1, Math.floor(t.maxHp * (ability.power / 100)));
        t.koTimer = 0;
        t.ct = 0;
        events.push({ type: 'revive', target: t.uid, x: t.x, y: t.y, sfx: ability.sfx });
      } else {
        events.push({ type: 'whiff', x: tx, y: ty });
      }
      break;
    }
    case 'buff': {
      if (abilityId === 'shout') {
        att.buffs.shout = Math.min(3, (att.buffs.shout || 0) + 1);
        computeStats(att);
        events.push({ type: 'buff', target: att.uid, status: 'shout', sfx: 'confirm' });
      } else if (abilityId === 'charge') {
        att.charged = true;
        events.push({ type: 'buff', target: att.uid, status: 'charge', sfx: 'bow' });
      }
      break;
    }
    case 'steal': {
      const t = targets.find(hostile);
      if (!t) { events.push({ type: 'whiff', x: tx, y: ty }); break; }
      const h = 55 + Math.floor((att.sp - (t.sp || 6)) * 4);
      if (Math.random() * 100 < h) {
        if (ability.steal === 'gil') {
          const amt = 40 + Math.floor(Math.random() * 60) + t.level * 8;
          battle.stolenGil = (battle.stolenGil || 0) + amt;
          events.push({ type: 'steal', target: t.uid, amount: amt, x: t.x, y: t.y, sfx: 'gil' });
        } else if (ability.steal === 'charm') {
          t.statuses.charm = 1;
          events.push({ type: 'status', target: t.uid, status: 'charm' });
        } else if (ability.steal === 'helm') {
          t.statuses.exposed = 3;
          battle.stolenGil = (battle.stolenGil || 0) + 100;
          events.push({ type: 'steal', target: t.uid, amount: 100, x: t.x, y: t.y, sfx: 'gil' });
        }
      } else {
        events.push({ type: 'miss', target: t.uid, x: t.x, y: t.y, sfx: 'miss' });
      }
      break;
    }
    default:
      events.push({ type: 'whiff', x: tx, y: ty });
  }
  return events;
}

export function damageUnit(t, dmg, events) {
  t.hp -= dmg;
  if (t.hp <= 0) {
    t.hp = 0;
    t.alive = false;
    t.koTimer = 3;
    events.push({ type: 'ko', target: t.uid, x: t.x, y: t.y, sfx: 'ko' });
  }
}

// Start-of-turn status processing. Returns events + whether unit loses turn.
export function startOfTurn(u, events) {
  let skip = false;
  if (u.statuses.charm) {
    delete u.statuses.charm;
    skip = true;
    events.push({ type: 'charmed', target: u.uid });
  }
  if (u.statuses.poison && u.alive) {
    const dmg = Math.max(2, Math.floor(u.maxHp * 0.08));
    damageUnit(u, dmg, events);
    events.push({ type: 'damage', target: u.uid, amount: dmg, x: u.x, y: u.y, element: 'none', sfx: 'hit' });
  }
  return skip;
}

export function endOfTurn(u) {
  for (const k of Object.keys(u.statuses)) {
    if (k === 'poison') continue;
    u.statuses[k]--;
    if (u.statuses[k] <= 0) delete u.statuses[k];
  }
  computeStats(u);
}

// KO countdown each full round; returns newly-crystallized units.
export function tickKoTimers(units) {
  const gone = [];
  for (const u of units) {
    if (!u.alive && u.koTimer > 0) {
      u.koTimer--;
      if (u.koTimer <= 0) gone.push(u);
    }
  }
  return gone;
}

// --- Enemy AI ---
export function aiTakeTurn(unit, battle) {
  // Returns { move: {x,y} | null, ability: id | null, tx, ty }.
  const heights = battle.heights, w = battle.map.w, d = battle.map.d;
  const foes = battle.units.filter((u) => u.alive && u.side !== unit.side);
  const friends = battle.units.filter((u) => u.alive && u.side === unit.side && u.uid !== unit.uid);
  if (!foes.length) return { move: null, ability: null };
  const occupied = new Map();
  for (const u of battle.units) {
    if (u.uid === unit.uid) continue;
    if (!u.alive && u.koTimer <= 0) continue;
    if (!u.alive) continue;
    occupied.set(u.y * w + u.x, u.uid);
  }
  const reach = moveRange(unit, heights, w, d, occupied);
  const candidates = [{ x: unit.x, y: unit.y }, ...[...reach.keys()].map((k) => ({ x: k % w, y: Math.floor(k / w) }))];

  const unitAbilities = unitAbilityList(unit);
  let best = null;

  const allies = [unit, ...friends];
  const hurtAlly = allies.filter((a) => a.hp < a.maxHp * 0.55).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const deadAlly = battle.units.find((u) => !u.alive && u.koTimer > 0 && u.side === unit.side);

  for (const pos of candidates.slice(0, 60)) {
    for (const abId of unitAbilities) {
      const ab = ABILITIES[abId];
      if (!ab || (ab.mp && unit.mp < ab.mp)) continue;
      if (ab.kind === 'item') continue; // enemies don't use shared stock
      // candidate targets
      let spots = [];
      if (ab.kind === 'buff' || (ab.kind === 'heal' && ab.range === 0)) {
        spots = [{ x: pos.x, y: pos.y }];
      } else if (ab.kind === 'heal' || ab.kind === 'revive') {
        const pool = ab.kind === 'revive'
          ? battle.units.filter((u) => !u.alive && u.koTimer > 0 && u.side === unit.side)
          : allies.filter((a) => a.hp < a.maxHp * 0.85);
        for (const a of pool) {
          if (manhattan(pos.x, pos.y, a.x, a.y) <= ab.range) spots.push({ x: a.x, y: a.y });
        }
      } else {
        for (const f of foes) {
          if (manhattan(pos.x, pos.y, f.x, f.y) <= ab.range) spots.push({ x: f.x, y: f.y });
        }
      }
      for (const s of spots.slice(0, 6)) {
        const score = aiScore(unit, ab, pos, s, foes, allies, hurtAlly, deadAlly);
        if (!best || score > best.score) best = { score, move: pos, ability: abId, tx: s.x, ty: s.y };
      }
    }
  }
  if (!best) {
    // Walk toward nearest foe.
    let np = null, nd = 1e9;
    for (const pos of candidates) {
      for (const f of foes) {
        const dd = manhattan(pos.x, pos.y, f.x, f.y);
        if (dd < nd) { nd = dd; np = pos; }
      }
    }
    const moved = np && (np.x !== unit.x || np.y !== unit.y);
    return { move: moved ? np : null, ability: null };
  }
  const moved = best.move && (best.move.x !== unit.x || best.move.y !== unit.y);
  return { move: moved ? best.move : null, ability: best.ability, tx: best.tx, ty: best.ty };
}

function unitAbilityList(unit) {
  if (unit.monster && MONSTERS[unit.monster]) return MONSTERS[unit.monster].abilities;
  if (unit.enemyAbilities) return unit.enemyAbilities;
  const job = JOBS[unit.job];
  const list = [...(job ? job.abilities : ['attack'])];
  // Player units can use learned cross-job abilities: keep to job list + attack.
  if (!list.includes('attack')) list.unshift('attack');
  return list;
}

function aiScore(unit, ab, pos, spot, foes, allies, hurtAlly, deadAlly) {
  let s = Math.random() * 6;
  const foeThere = foes.find((f) => f.x === spot.x && f.y === spot.y);
  const allyThere = allies.find((a) => a.x === spot.x && a.y === spot.y);
  if ((ab.kind === 'phys' || ab.kind === 'magic' || ab.kind === 'jump') && foeThere) {
    s += 30 + ab.power * 20;
    if (ab.aoe) s += 12;
    if (foeThere.hp < 20) s += 15; // finish kills
    s -= manhattan(pos.x, pos.y, unit.x, unit.y); // prefer less movement
  } else if (ab.kind === 'heal' && allyThere && allyThere.hp < allyThere.maxHp * 0.8) {
    s += 45 - (allyThere.hp / allyThere.maxHp) * 30;
    if (allyThere.uid === (hurtAlly && hurtAlly.uid)) s += 10;
  } else if (ab.kind === 'revive' && deadAlly && spot.x === deadAlly.x && spot.y === deadAlly.y) {
    s += 60;
  } else if (ab.kind === 'buff') {
    s += 8;
  } else if (ab.kind === 'steal' && foeThere) {
    s += 12;
  } else {
    s -= 50;
  }
  return s;
}
