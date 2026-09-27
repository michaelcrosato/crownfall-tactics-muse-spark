// Game data: jobs, abilities, equipment, battles, story, errands.
// Condensed but faithful adaptation of the FFT PS1 content list
// (see COMPLETION_REPORT.md for the guide record mapping).

export const ELEMENTS = ['fire', 'ice', 'bolt', 'holy', 'none'];

export const JOBS = {
  squire: {
    id: 'squire', name: 'Squire', requires: null,
    desc: 'Balanced beginners. Fundaments: dash, shout, and steel.',
    move: 4, jump: 3, pa: 5, ma: 3, sp: 7, hp: 42, mp: 12,
    growth: { hp: 7, mp: 2, pa: 0.8, ma: 0.4, sp: 0.15 },
    equip: ['sword', 'dagger', 'shield', 'cloth', 'helm'],
    abilities: ['attack', 'rush', 'shout', 'potion_squire'],
  },
  chemist: {
    id: 'chemist', name: 'Chemist', requires: null,
    desc: 'Item-throwers. Guns aside, they keep the army alive.',
    move: 3, jump: 3, pa: 4, ma: 4, sp: 6, hp: 38, mp: 14,
    growth: { hp: 6, mp: 3, pa: 0.5, ma: 0.6, sp: 0.15 },
    equip: ['gun', 'dagger', 'cloth', 'hat'],
    abilities: ['attack', 'potion', 'hipotion', 'phoenix', 'antidote'],
  },
  knight: {
    id: 'knight', name: 'Knight', requires: { job: 'squire', jp: 200 },
    desc: 'Heavy steel. Breaks blades, shields, and helms.',
    move: 3, jump: 3, pa: 8, ma: 2, sp: 5, hp: 55, mp: 8,
    growth: { hp: 9, mp: 1, pa: 1.1, ma: 0.2, sp: 0.1 },
    equip: ['sword', 'shield', 'armor', 'helm'],
    abilities: ['attack', 'break_weapon', 'break_shield', 'break_helm', 'rend_mp'],
  },
  archer: {
    id: 'archer', name: 'Archer', requires: { job: 'squire', jp: 200 },
    desc: 'Longbows and height. Owns the high ground.',
    move: 3, jump: 3, pa: 6, ma: 2, sp: 6, hp: 42, mp: 8,
    growth: { hp: 7, mp: 1, pa: 0.9, ma: 0.2, sp: 0.2 },
    equip: ['bow', 'dagger', 'cloth', 'hat'],
    abilities: ['attack', 'aim_leg', 'aim_arm', 'charge'],
  },
  monk: {
    id: 'monk', name: 'Monk', requires: { job: 'squire', jp: 350 },
    desc: 'Bare fists that outpunch swords. Heals with chakra.',
    move: 4, jump: 4, pa: 9, ma: 3, sp: 7, hp: 52, mp: 12,
    growth: { hp: 8, mp: 2, pa: 1.0, ma: 0.4, sp: 0.2 },
    equip: ['fist', 'cloth', 'hat'],
    abilities: ['attack', 'pummel', 'chakra', 'revive_punch'],
  },
  thief: {
    id: 'thief', name: 'Thief', requires: { job: 'squire', jp: 350 },
    desc: 'Fast hands: gil, hearts, and helmets.',
    move: 4, jump: 4, pa: 5, ma: 3, sp: 9, hp: 40, mp: 10,
    growth: { hp: 6, mp: 2, pa: 0.7, ma: 0.4, sp: 0.35 },
    equip: ['dagger', 'sword', 'cloth', 'hat'],
    abilities: ['attack', 'steal_gil', 'steal_heart', 'steal_helm'],
  },
  blackmage: {
    id: 'blackmage', name: 'Black Mage', requires: { job: 'chemist', jp: 200 },
    desc: 'Black magicks: fire, ice, and lightning.',
    move: 3, jump: 3, pa: 2, ma: 9, sp: 5, hp: 34, mp: 26,
    growth: { hp: 5, mp: 5, pa: 0.2, ma: 1.2, sp: 0.1 },
    equip: ['rod', 'cloth', 'hat'],
    abilities: ['attack', 'fire', 'blizzard', 'thunder', 'flare'],
  },
  whitemage: {
    id: 'whitemage', name: 'White Mage', requires: { job: 'chemist', jp: 200 },
    desc: 'White magicks: cure wounds, mend faith, raise the fallen.',
    move: 3, jump: 3, pa: 2, ma: 8, sp: 6, hp: 36, mp: 26,
    growth: { hp: 5, mp: 5, pa: 0.2, ma: 1.1, sp: 0.12 },
    equip: ['rod', 'cloth', 'hat'],
    abilities: ['attack', 'cure', 'cura', 'raise', 'esuna'],
  },
  dragoon: {
    id: 'dragoon', name: 'Dragoon', requires: { job: 'thief', jp: 400 },
    desc: 'Spear-jumpers who strike from the sky.',
    move: 3, jump: 5, pa: 8, ma: 2, sp: 6, hp: 54, mp: 10,
    growth: { hp: 9, mp: 2, pa: 1.1, ma: 0.3, sp: 0.15 },
    equip: ['spear', 'armor', 'helm', 'shield'],
    abilities: ['attack', 'jump_strike', 'pierce'],
  },
  summoner: {
    id: 'summoner', name: 'Summoner', requires: { job: 'blackmage', jp: 500 },
    desc: 'Calls espers down on wide fields. Slow, vast, final.',
    move: 3, jump: 3, pa: 2, ma: 11, sp: 4, hp: 38, mp: 34,
    growth: { hp: 5, mp: 6, pa: 0.2, ma: 1.4, sp: 0.08 },
    equip: ['rod', 'cloth', 'hat'],
    abilities: ['attack', 'ifrit', 'shiva', 'ramuh'],
  },
};

// kind: phys | magic | heal | revive | item | steal | buff | jump
// range: Manhattan tiles; aoe: 0 = single, 1 = plus, 2 = 3x3-ish radius
export const ABILITIES = {
  attack: { id: 'attack', name: 'Attack', kind: 'phys', range: 1, aoe: 0, power: 1.0, evade: true, sfx: 'hit', desc: 'Strike with the equipped weapon.' },
  rush: { id: 'rush', name: 'Rush', kind: 'phys', range: 1, aoe: 0, power: 0.8, evade: true, sfx: 'hit', desc: 'A quick shove: light damage, +10 CT to self.' },
  shout: { id: 'shout', name: 'Shout', kind: 'buff', range: 0, aoe: 0, power: 0, sfx: 'confirm', desc: 'Rally: +1 PA for 3 turns.' },
  potion_squire: { id: 'potion_squire', name: 'First Aid', kind: 'heal', range: 1, aoe: 0, power: 18, sfx: 'potion', desc: 'Field dressing: restore a little HP.' },
  potion: { id: 'potion', name: 'Potion', kind: 'item', range: 4, aoe: 0, power: 30, price: 50, sfx: 'potion', desc: 'Throw: restore 30 HP at range.' },
  hipotion: { id: 'hipotion', name: 'Hi-Potion', kind: 'item', range: 4, aoe: 0, power: 70, price: 150, sfx: 'potion', desc: 'Throw: restore 70 HP at range.' },
  phoenix: { id: 'phoenix', name: 'Phoenix Down', kind: 'revive', range: 4, aoe: 0, power: 25, price: 200, sfx: 'cure', desc: 'Throw: revive with 25% HP.' },
  antidote: { id: 'antidote', name: 'Antidote', kind: 'item', range: 4, aoe: 0, power: 0, price: 40, sfx: 'potion', desc: 'Throw: cure Poison.' },
  break_weapon: { id: 'break_weapon', name: 'Break: Weapon', kind: 'phys', range: 1, aoe: 0, power: 0.5, debuff: 'disarm', evade: true, sfx: 'hit', desc: 'Half damage and Disarm (2 turns).' },
  break_shield: { id: 'break_shield', name: 'Break: Shield', kind: 'phys', range: 1, aoe: 0, power: 0.5, debuff: 'exposed', evade: true, sfx: 'hit', desc: 'Half damage and Exposed: -evasion (3 turns).' },
  break_helm: { id: 'break_helm', name: 'Break: Helm', kind: 'phys', range: 1, aoe: 0, power: 0.6, debuff: 'daze', evade: true, sfx: 'hit', desc: 'Damage and Daze: -2 Speed (2 turns).' },
  rend_mp: { id: 'rend_mp', name: 'Rend MP', kind: 'phys', range: 2, aoe: 0, power: 0.3, drainMp: true, evade: true, sfx: 'hit', desc: 'Light damage and burn 12 MP.' },
  aim_leg: { id: 'aim_leg', name: 'Aim: Leg', kind: 'phys', range: 5, aoe: 0, power: 0.7, debuff: 'slow', evade: true, sfx: 'bow', desc: 'Bow shot that Slows (2 turns).' },
  aim_arm: { id: 'aim_arm', name: 'Aim: Arm', kind: 'phys', range: 5, aoe: 0, power: 0.7, debuff: 'disarm', evade: true, sfx: 'bow', desc: 'Bow shot that Disarms (2 turns).' },
  charge: { id: 'charge', name: 'Charge +2', kind: 'buff', range: 0, aoe: 0, power: 0, sfx: 'bow', desc: 'Next bow shot deals double damage.' },
  pummel: { id: 'pummel', name: 'Pummel', kind: 'phys', range: 1, aoe: 0, power: 1.3, evade: true, sfx: 'hit', desc: 'Heavy bare-handed blow.' },
  chakra: { id: 'chakra', name: 'Chakra', kind: 'heal', range: 0, aoe: 0, power: 35, sfx: 'cure', desc: 'Restore 35 HP and 8 MP to self.' },
  revive_punch: { id: 'revive_punch', name: 'Revive', kind: 'revive', range: 1, aoe: 0, power: 20, sfx: 'cure', desc: 'A shocking palm: revive adjacent ally at 20%.' },
  steal_gil: { id: 'steal_gil', name: 'Steal Gil', kind: 'steal', range: 1, aoe: 0, power: 0, steal: 'gil', sfx: 'gil', desc: 'Steal gil from the target.' },
  steal_heart: { id: 'steal_heart', name: 'Steal Heart', kind: 'steal', range: 3, aoe: 0, power: 0, steal: 'charm', sfx: 'confirm', desc: 'Charm: target skips its next turn.' },
  steal_helm: { id: 'steal_helm', name: 'Steal Helm', kind: 'steal', range: 1, aoe: 0, power: 0, steal: 'helm', sfx: 'confirm', desc: 'Steal a helm: target Exposed, gain 100 gil value.' },
  fire: { id: 'fire', name: 'Fire', kind: 'magic', element: 'fire', range: 4, aoe: 1, power: 1.1, mp: 6, ctr: 40, sfx: 'fire', desc: 'Fire damage, plus-shaped area.' },
  blizzard: { id: 'blizzard', name: 'Blizzard', kind: 'magic', element: 'ice', range: 4, aoe: 1, power: 1.1, mp: 6, ctr: 40, sfx: 'ice', desc: 'Ice damage, plus-shaped area.' },
  thunder: { id: 'thunder', name: 'Thunder', kind: 'magic', element: 'bolt', range: 4, aoe: 1, power: 1.1, mp: 6, ctr: 40, sfx: 'bolt', desc: 'Lightning damage, plus-shaped area.' },
  flare: { id: 'flare', name: 'Flare', kind: 'magic', element: 'none', range: 4, aoe: 0, power: 1.8, mp: 14, ctr: 60, sfx: 'fire', desc: 'Heavy non-elemental damage.' },
  cure: { id: 'cure', name: 'Cure', kind: 'heal', range: 4, aoe: 1, power: 1.0, mp: 6, ctr: 40, sfx: 'cure', desc: 'Restore HP, plus-shaped area.' },
  cura: { id: 'cura', name: 'Cura', kind: 'heal', range: 4, aoe: 1, power: 1.8, mp: 12, ctr: 50, sfx: 'cure', desc: 'Strong HP restore, plus-shaped area.' },
  raise: { id: 'raise', name: 'Raise', kind: 'revive', range: 4, aoe: 0, power: 30, mp: 10, ctr: 50, sfx: 'cure', desc: 'Revive at 30% HP.' },
  esuna: { id: 'esuna', name: 'Esuna', kind: 'heal', range: 4, aoe: 0, power: 0, mp: 6, ctr: 30, cleanse: true, sfx: 'cure', desc: 'Cure Poison, Slow, Daze, Disarm.' },
  jump_strike: { id: 'jump_strike', name: 'Jump', kind: 'jump', range: 4, aoe: 0, power: 1.6, evade: false, sfx: 'hit', desc: 'Leap skyward; land for heavy spear damage. Unavoidable.' },
  pierce: { id: 'pierce', name: 'Pierce', kind: 'phys', range: 2, aoe: 0, power: 1.1, evade: true, sfx: 'hit', desc: 'Long spear thrust, 2 tiles.' },
  ifrit: { id: 'ifrit', name: 'Ifrit', kind: 'magic', element: 'fire', range: 5, aoe: 2, power: 1.4, mp: 18, ctr: 70, sfx: 'fire', desc: 'Summon: great fire over a wide area.' },
  shiva: { id: 'shiva', name: 'Shiva', kind: 'magic', element: 'ice', range: 5, aoe: 2, power: 1.4, mp: 18, ctr: 70, sfx: 'ice', desc: 'Summon: great ice over a wide area.' },
  ramuh: { id: 'ramuh', name: 'Ramuh', kind: 'magic', element: 'bolt', range: 5, aoe: 2, power: 1.4, mp: 18, ctr: 70, sfx: 'bolt', desc: 'Summon: great lightning over a wide area.' },
  // enemy-only
  tail_swipe: { id: 'tail_swipe', name: 'Tail Swipe', kind: 'phys', range: 1, aoe: 0, power: 0.9, evade: true, sfx: 'hit', desc: 'Monster attack.' },
  goblin_punch: { id: 'goblin_punch', name: 'Goblin Punch', kind: 'phys', range: 1, aoe: 0, power: 1.0, evade: true, sfx: 'hit', desc: 'Gremlin fists.' },
  dark_holy: { id: 'dark_holy', name: 'Dark Holy', kind: 'magic', element: 'holy', range: 5, aoe: 1, power: 1.3, mp: 10, ctr: 50, sfx: 'bolt', desc: 'Wicked holy light.' },
  stone_gaze: { id: 'stone_gaze', name: 'Stone Gaze', kind: 'phys', range: 3, aoe: 0, power: 0.4, debuff: 'slow', evade: true, sfx: 'miss', desc: 'Petrifying look that slows.' },
};

export const EQUIPMENT = {
  // weapons
  dagger: { id: 'dagger', name: 'Dagger', slot: 'weapon', type: 'dagger', pa: 2, price: 120, desc: 'A small reliable blade.' },
  short_sword: { id: 'short_sword', name: 'Short Sword', slot: 'weapon', type: 'sword', pa: 4, price: 300, desc: 'Standard knightly sidearm.' },
  mythril_sword: { id: 'mythril_sword', name: 'Mythril Sword', slot: 'weapon', type: 'sword', pa: 6, price: 900, desc: 'Light, keen mythril edge.' },
  rune_blade: { id: 'rune_blade', name: 'Rune Blade', slot: 'weapon', type: 'sword', pa: 8, ma: 2, price: 2400, desc: 'A blade etched with glyphs.' },
  longbow: { id: 'longbow', name: 'Longbow', slot: 'weapon', type: 'bow', pa: 4, price: 400, desc: 'Reach out and touch someone.' },
  mythril_bow: { id: 'mythril_bow', name: 'Mythril Bow', slot: 'weapon', type: 'bow', pa: 7, price: 1400, desc: 'Sings when drawn.' },
  rod: { id: 'rod', name: 'Rod', slot: 'weapon', type: 'rod', ma: 3, price: 250, desc: 'Focus for magicks.' },
  mythril_rod: { id: 'mythril_rod', name: 'Mythril Rod', slot: 'weapon', type: 'rod', ma: 5, price: 1200, desc: 'Hums with stored spells.' },
  spear: { id: 'spear', name: 'Spear', slot: 'weapon', type: 'spear', pa: 6, price: 800, desc: 'Long reach, cold point.' },
  spark_gun: { id: 'spark_gun', name: 'Spark Gun', slot: 'weapon', type: 'gun', pa: 5, price: 1100, desc: 'Goug machinist work. Never misses short range.' },
  // offhand / armor
  buckler: { id: 'buckler', name: 'Buckler', slot: 'offhand', type: 'shield', evade: 8, price: 200, desc: 'Small shield, +8 evade.' },
  mythril_shield: { id: 'mythril_shield', name: 'Mythril Shield', slot: 'offhand', type: 'shield', evade: 14, price: 1000, desc: '+14 evade.' },
  linen: { id: 'linen', name: 'Linen Robe', slot: 'body', type: 'cloth', hp: 8, price: 150, desc: '+8 HP.' },
  mythril_armor: { id: 'mythril_armor', name: 'Mythril Armor', slot: 'body', type: 'armor', hp: 22, price: 1300, desc: '+22 HP.' },
  cloth_hat: { id: 'cloth_hat', name: 'Cloth Hat', slot: 'head', type: 'hat', mp: 8, price: 150, desc: '+8 MP.' },
  mythril_helm: { id: 'mythril_helm', name: 'Mythril Helm', slot: 'head', type: 'helm', hp: 12, price: 800, desc: '+12 HP.' },
  // accessories
  leather_boots: { id: 'leather_boots', name: 'Leather Boots', slot: 'acc', move: 1, price: 600, desc: '+1 Move.' },
  magic_ring: { id: 'magic_ring', name: 'Magic Ring', slot: 'acc', ma: 2, price: 900, desc: '+2 MA.' },
  power_wrist: { id: 'power_wrist', name: 'Power Wrist', slot: 'acc', pa: 2, price: 900, desc: '+2 PA.' },
  // consumables
  potion_item: { id: 'potion_item', name: 'Potion', slot: 'item', ability: 'potion', price: 50, desc: 'Restores 30 HP.' },
  hipotion_item: { id: 'hipotion_item', name: 'Hi-Potion', slot: 'item', ability: 'hipotion', price: 150, desc: 'Restores 70 HP.' },
  phoenix_item: { id: 'phoenix_item', name: 'Phoenix Down', slot: 'item', ability: 'phoenix', price: 200, desc: 'Revives a KO ally.' },
  antidote_item: { id: 'antidote_item', name: 'Antidote', slot: 'item', ability: 'antidote', price: 40, desc: 'Cures Poison.' },
};

// height maps use single chars; legend per battle (h = height, w = water/blocked)
function H(rows) { return rows; }

export const BATTLES = [
  {
    id: 'b1_orbonne', name: 'Orbonne Monastery', chapter: 1, boss: false, music: 'battle',
    brief: 'Cadets on patrol: brigands raid the monastery stores. Drive them off.',
    objective: 'Defeat all enemies. Keep Rowan alive.',
    deployMax: 3, gil: 200,
    map: {
      w: 8, d: 8, theme: 'monastery',
      heights: H(['11111111', '11122111', '11122111', '11111111', '11111111', '11222111', '11111111', '11111111']),
    },
    player: [{ x: 1, y: 6 }, { x: 3, y: 6 }, { x: 5, y: 6 }],
    enemies: [
      { job: 'squire', name: 'Brigand', x: 2, y: 1, level: 1 },
      { job: 'squire', name: 'Brigand', x: 4, y: 1, level: 1 },
      { job: 'archer', name: 'Poacher', x: 6, y: 2, level: 1 },
    ],
    treasure: [{ x: 6, y: 6, item: 'potion_item' }],
  },
  {
    id: 'b2_dorter', name: 'Dorter Trade City', chapter: 1, boss: false, music: 'battle',
    brief: 'A cardinal\'s men shake down the markets. Hold the square.',
    objective: 'Defeat all enemies.',
    deployMax: 4, gil: 350,
    map: { w: 9, d: 8, theme: 'town', heights: H(['111111111', '122111211', '122111211', '111111111', '111111111', '121111121', '111111111', '111111111']) },
    player: [{ x: 1, y: 6 }, { x: 3, y: 6 }, { x: 5, y: 6 }, { x: 7, y: 6 }],
    enemies: [
      { job: 'knight', name: 'Temple Knight', x: 4, y: 1, level: 3 },
      { job: 'archer', name: 'Temple Bowman', x: 2, y: 2, level: 2 },
      { job: 'archer', name: 'Temple Bowman', x: 6, y: 2, level: 2 },
      { job: 'chemist', name: 'Temple Medic', x: 4, y: 3, level: 2 },
    ],
    treasure: [{ x: 0, y: 0, item: 'phoenix_item' }],
  },
  {
    id: 'b3_sweegy', name: 'Sweegy Woods', chapter: 1, boss: false, music: 'battle',
    brief: 'Goblins nest in the wood. Clear the road for the supply carts.',
    objective: 'Defeat all monsters.',
    deployMax: 4, gil: 300,
    map: { w: 9, d: 9, theme: 'woods', heights: H(['111111111', '111111111', '112111211', '112111211', '111111111', '111111111', '211111112', '111111111', '111111111']) },
    player: [{ x: 1, y: 7 }, { x: 3, y: 7 }, { x: 5, y: 7 }, { x: 7, y: 7 }],
    enemies: [
      { monster: 'goblin', name: 'Goblin', x: 2, y: 1, level: 3 },
      { monster: 'goblin', name: 'Goblin', x: 4, y: 1, level: 3 },
      { monster: 'goblin', name: 'Goblin', x: 6, y: 1, level: 4 },
      { monster: 'bomb', name: 'Red Bomb', x: 4, y: 3, level: 4 },
    ],
    treasure: [{ x: 8, y: 4, item: 'hipotion_item' }],
  },
  {
    id: 'b4_lenalia', name: 'Lenalia Plateau', chapter: 2, boss: false, music: 'battle',
    brief: 'Windmill militia block the pass. Take the high ground first.',
    objective: 'Defeat all enemies.',
    deployMax: 4, gil: 450,
    map: { w: 9, d: 9, theme: 'plateau', heights: H(['333333333', '333222333', '332222233', '322111223', '321111123', '321111123', '322111223', '332222233', '333333333']) },
    player: [{ x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 6 }],
    enemies: [
      { job: 'archer', name: 'Militia Bowman', x: 4, y: 0, level: 5 },
      { job: 'archer', name: 'Militia Bowman', x: 2, y: 1, level: 5 },
      { job: 'knight', name: 'Militia Blade', x: 4, y: 2, level: 6 },
      { job: 'blackmage', name: 'Hedge Wizard', x: 6, y: 1, level: 5 },
    ],
    treasure: [{ x: 0, y: 4, item: 'leather_boots' }],
  },
  {
    id: 'b5_fovoham', name: 'Fovoham Plains', chapter: 2, boss: true, music: 'boss',
    brief: 'The Thunder Regent rides to crush the rebellion. End him.',
    objective: 'Defeat the Thunder Regent.',
    deployMax: 4, gil: 700, bossName: 'Thunder Regent',
    map: { w: 10, d: 8, theme: 'plains', heights: H(['1111111111', '1111111111', '1112222111', '1112222111', '1111111111', '1111111111', '1111111111', '1111111111']) },
    player: [{ x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }, { x: 8, y: 6 }],
    enemies: [
      { job: 'knight', name: 'Thunder Regent', boss: true, x: 5, y: 1, level: 9, abilities: ['attack', 'thunder', 'break_weapon'] },
      { job: 'monk', name: 'Regent Guard', x: 3, y: 2, level: 7 },
      { job: 'archer', name: 'Regent Bowman', x: 7, y: 2, level: 7 },
      { job: 'whitemage', name: 'Regent Cleric', x: 5, y: 3, level: 7 },
    ],
    treasure: [{ x: 9, y: 0, item: 'mythril_sword' }],
  },
  {
    id: 'b6_lesalia', name: 'Lesalia Aqueducts', chapter: 3, boss: false, music: 'battle',
    brief: 'Through the undercity: thieves and worse nest below the capital.',
    objective: 'Defeat all enemies.',
    deployMax: 5, gil: 600,
    map: { w: 10, d: 9, theme: 'aqueduct', heights: H(['1111111111', '1111111111', '1110000111', '1110000111', '1110000111', '1110000111', '1111111111', '1111111111', '1111111111']) },
    player: [{ x: 1, y: 7 }, { x: 3, y: 7 }, { x: 5, y: 7 }, { x: 7, y: 7 }, { x: 9, y: 7 }],
    enemies: [
      { job: 'thief', name: 'Canal Rat', x: 2, y: 1, level: 9 },
      { job: 'thief', name: 'Canal Rat', x: 5, y: 1, level: 9 },
      { job: 'thief', name: 'Canal Rat', x: 8, y: 1, level: 10 },
      { monster: 'cactuar', name: 'Cactuar', x: 4, y: 4, level: 10 },
      { monster: 'cactuar', name: 'Cactuar', x: 6, y: 4, level: 10 },
    ],
    treasure: [{ x: 0, y: 0, item: 'power_wrist' }],
  },
  {
    id: 'b7_riovanes', name: 'Riovanes Castle', chapter: 3, boss: true, music: 'boss',
    brief: 'A duel on the ramparts. Rowan must face the Fell Knight alone... with friends below.',
    objective: 'Defeat the Fell Knight.',
    deployMax: 5, gil: 900, bossName: 'Fell Knight',
    map: { w: 9, d: 10, theme: 'castle', heights: H(['444444444', '444444444', '333333333', '333333333', '222222222', '222222222', '111111111', '111111111', '111111111', '111111111']) },
    player: [{ x: 2, y: 8 }, { x: 4, y: 8 }, { x: 6, y: 8 }, { x: 3, y: 9 }, { x: 5, y: 9 }],
    enemies: [
      { job: 'knight', name: 'Fell Knight', boss: true, x: 4, y: 1, level: 14, abilities: ['attack', 'dark_holy', 'break_helm'] },
      { job: 'dragoon', name: 'Wyvern Guard', x: 2, y: 2, level: 11 },
      { job: 'dragoon', name: 'Wyvern Guard', x: 6, y: 2, level: 11 },
      { job: 'summoner', name: 'Court Summoner', x: 4, y: 3, level: 11 },
    ],
    treasure: [{ x: 8, y: 9, item: 'mythril_armor' }],
  },
  {
    id: 'b8_limberry', name: 'Limberry Castle', chapter: 4, boss: false, music: 'battle',
    brief: 'The undercroft swarms. Push through to the holy vault.',
    objective: 'Defeat all enemies.',
    deployMax: 5, gil: 800,
    map: { w: 10, d: 10, theme: 'crypt', heights: H(['1111111111', '1111111111', '1121111211', '1121111211', '1111111111', '1111111111', '1121111211', '1121111211', '1111111111', '1111111111']) },
    player: [{ x: 1, y: 8 }, { x: 3, y: 8 }, { x: 5, y: 8 }, { x: 7, y: 8 }, { x: 9, y: 8 }],
    enemies: [
      { monster: 'skeleton', name: 'Skeleton', x: 2, y: 1, level: 13 },
      { monster: 'skeleton', name: 'Skeleton', x: 5, y: 1, level: 13 },
      { monster: 'skeleton', name: 'Skeleton', x: 8, y: 1, level: 14 },
      { job: 'blackmage', name: 'Crypt Wizard', x: 3, y: 3, level: 14 },
      { job: 'whitemage', name: 'Crypt Cleric', x: 7, y: 3, level: 14 },
    ],
    treasure: [{ x: 5, y: 0, item: 'rune_blade' }],
  },
  {
    id: 'b9_nelveska', name: 'Nelveska Temple', chapter: 4, boss: true, music: 'boss',
    brief: 'An ancient machina, Worker 7, guards the sky-ruin. Topple it.',
    objective: 'Defeat Worker 7.',
    deployMax: 5, gil: 1200, bossName: 'Worker 7',
    map: { w: 10, d: 10, theme: 'ruin', heights: H(['2222222222', '2111111112', '2111111112', '2111221112', '2111221112', '2111221112', '2111111112', '2111111112', '2111111112', '2222222222']) },
    player: [{ x: 2, y: 8 }, { x: 4, y: 8 }, { x: 6, y: 8 }, { x: 3, y: 9 }, { x: 7, y: 9 }],
    enemies: [
      { monster: 'worker7', name: 'Worker 7', boss: true, x: 5, y: 4, level: 18 },
      { monster: 'cockatrice', name: 'Cockatrice', x: 2, y: 2, level: 15 },
      { monster: 'cockatrice', name: 'Cockatrice', x: 8, y: 2, level: 15 },
    ],
    treasure: [{ x: 0, y: 0, item: 'magic_ring' }, { x: 9, y: 9, item: 'mythril_shield' }],
  },
  {
    id: 'b10_necropolis', name: 'Murond Necropolis', chapter: 4, boss: true, music: 'boss',
    brief: 'The last Zodiac stone burns below. End the Heritor and the war.',
    objective: 'Defeat the Heritor.',
    deployMax: 5, gil: 0, bossName: 'The Heritor',
    map: { w: 10, d: 10, theme: 'necropolis', heights: H(['1111111111', '1221111221', '1221111221', '1113333111', '1113333111', '1113333111', '1111111111', '1221111221', '1221111221', '1111111111']) },
    player: [{ x: 2, y: 8 }, { x: 4, y: 8 }, { x: 6, y: 8 }, { x: 3, y: 9 }, { x: 7, y: 9 }],
    enemies: [
      { job: 'summoner', name: 'The Heritor', boss: true, x: 5, y: 4, level: 20, abilities: ['attack', 'ifrit', 'shiva', 'ramuh', 'dark_holy'] },
      { monster: 'demon', name: 'Zodiac Warden', x: 3, y: 2, level: 17 },
      { monster: 'demon', name: 'Zodiac Warden', x: 7, y: 2, level: 17 },
      { job: 'knight', name: 'Oathsworn Blade', x: 5, y: 2, level: 16 },
    ],
    treasure: [],
  },
];

export const MONSTERS = {
  goblin: { pa: 6, ma: 1, sp: 6, hp: 30, mp: 0, move: 4, jump: 3, abilities: ['goblin_punch'], color: 0x4d9b4d },
  bomb: { pa: 7, ma: 5, sp: 5, hp: 34, mp: 10, move: 3, jump: 3, abilities: ['tail_swipe', 'fire'], color: 0xd24a2e },
  cactuar: { pa: 8, ma: 2, sp: 9, hp: 36, mp: 0, move: 4, jump: 3, abilities: ['goblin_punch'], color: 0x3f8f3f },
  skeleton: { pa: 9, ma: 2, sp: 6, hp: 55, mp: 0, move: 4, jump: 3, abilities: ['attack', 'break_weapon'], color: 0xd8d4c8 },
  cockatrice: { pa: 8, ma: 4, sp: 7, hp: 60, mp: 10, move: 5, jump: 4, abilities: ['tail_swipe', 'stone_gaze'], color: 0xc9a13b },
  worker7: { pa: 14, ma: 6, sp: 4, hp: 220, mp: 20, move: 2, jump: 2, abilities: ['attack', 'thunder', 'pummel'], color: 0x8a8f99, big: true },
  demon: { pa: 12, ma: 8, sp: 7, hp: 110, mp: 20, move: 4, jump: 3, abilities: ['attack', 'dark_holy'], color: 0x7a2e8f },
};

// Side content: tavern errands (dispatch-style bonus battles).
export const ERRANDS = [
  {
    id: 'e1_poach', name: 'Beast Hunt: Goblin Warren', requiresBattle: 2,
    desc: 'A hamlet pays for goblin pelts. (Poaching, condensed.)',
    battle: {
      id: 'e1_poach', name: 'Goblin Warren', chapter: 1, boss: false, music: 'battle',
      brief: 'Errand: clear the warren, keep the pelts.',
      objective: 'Defeat all monsters.', deployMax: 4, gil: 400,
      map: { w: 8, d: 8, theme: 'woods', heights: H(['11111111', '11111111', '11222111', '11222111', '11111111', '11111111', '11111111', '11111111']) },
      player: [{ x: 1, y: 6 }, { x: 3, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }],
      enemies: [
        { monster: 'goblin', name: 'Goblin', x: 2, y: 1, level: 5 },
        { monster: 'goblin', name: 'Goblin', x: 4, y: 1, level: 5 },
        { monster: 'goblin', name: 'Goblin', x: 6, y: 1, level: 6 },
        { monster: 'bomb', name: 'Red Bomb', x: 4, y: 2, level: 6 },
      ],
      treasure: [{ x: 7, y: 0, item: 'hipotion_item' }],
    },
  },
  {
    id: 'e2_deep', name: 'Deep Delve: Sluice Depths', requiresBattle: 5,
    desc: 'Something nests in the floodgates. Bring antidotes.',
    battle: {
      id: 'e2_deep', name: 'Sluice Depths', chapter: 3, boss: false, music: 'battle',
      brief: 'Errand: purge the depths (Deep Dungeon, condensed).',
      objective: 'Defeat all monsters.', deployMax: 5, gil: 800,
      map: { w: 9, d: 9, theme: 'aqueduct', heights: H(['111111111', '111000111', '111000111', '111000111', '111000111', '111000111', '111000111', '111111111', '111111111']) },
      player: [{ x: 1, y: 7 }, { x: 3, y: 7 }, { x: 5, y: 7 }, { x: 7, y: 7 }, { x: 4, y: 7 }],
      enemies: [
        { monster: 'cockatrice', name: 'Cockatrice', x: 2, y: 1, level: 12 },
        { monster: 'skeleton', name: 'Drowned Bones', x: 4, y: 1, level: 12 },
        { monster: 'skeleton', name: 'Drowned Bones', x: 6, y: 1, level: 12 },
        { monster: 'cactuar', name: 'Cactuar', x: 4, y: 3, level: 12 },
      ],
      treasure: [{ x: 8, y: 8, item: 'mythril_rod' }],
    },
  },
  {
    id: 'e3_sky', name: 'Sky Pirate: Cloud\'s Debt', requiresBattle: 7,
    desc: 'A blond swordsman needs an escort — and his blade back.',
    battle: {
      id: 'e3_sky', name: 'Airship Graveyard', chapter: 4, boss: true, music: 'boss',
      brief: 'Errand: recruit the sky-pirate (secret character, condensed). Reward: Cloud joins!',
      objective: 'Defeat all enemies. Recruit Cloud.', deployMax: 5, gil: 500, recruit: 'Cloud',
      map: { w: 9, d: 9, theme: 'ruin', heights: H(['111111111', '111111111', '111222111', '111222111', '111222111', '111111111', '111111111', '111111111', '111111111']) },
      player: [{ x: 1, y: 7 }, { x: 3, y: 7 }, { x: 5, y: 7 }, { x: 7, y: 7 }, { x: 4, y: 7 }],
      enemies: [
        { job: 'thief', name: 'Sky Pirate', x: 4, y: 1, level: 14 },
        { job: 'thief', name: 'Sky Pirate', x: 2, y: 2, level: 14 },
        { job: 'archer', name: 'Sky Pirate', x: 6, y: 2, level: 14 },
        { monster: 'demon', name: 'Graveyard Warden', x: 4, y: 3, level: 14 },
      ],
      treasure: [{ x: 4, y: 0, item: 'mythril_bow' }],
    },
  },
];

export const RECRUIT_CLOUD = {
  name: 'Cloud', job: 'squire', level: 12,
  desc: 'Blond sky-pirate. Limitless attitude.',
};

export const SHOP_STOCK = [
  'dagger', 'short_sword', 'longbow', 'rod', 'buckler', 'linen', 'cloth_hat',
  'potion_item', 'antidote_item', 'phoenix_item',
];
export const SHOP_STOCK_CH3 = ['mythril_sword', 'mythril_bow', 'mythril_rod', 'spear', 'spark_gun', 'mythril_shield', 'mythril_armor', 'mythril_helm', 'leather_boots', 'power_wrist', 'magic_ring', 'hipotion_item'];

export const STORY = {
  intro: [
    'The Lion War has ended. The peace has not begun.',
    'Two lions circle the fallen crown of Crownfall — and in the monastery at Orbonne, a cadet named ROWAN copies scriptures while soldiers gather at the gate.',
    'What follows is a tale of stones that choose their bearers... and of the choice Rowan must make.',
  ],
  chapters: {
    1: 'Chapter 1 — The Fallen Cadet. Brigands, knights, and the first stone.',
    2: 'Chapter 2 — The Thunder Regent. The pass must be forced.',
    3: 'Chapter 3 — Blood Below Lesalia. The undercity remembers.',
    4: 'Chapter 4 — The Heritor. Every stone has a price.',
  },
  ending: [
    'The last stone goes dark. The Heritor is gone.',
    'No songs are sung for Rowan\'s company — history will credit the lions, as it always does.',
    'But in the villages along the road home, the wells are clean, the roads are safe, and the children play at knights with wooden swords.',
    'That is enough. That was always enough.',
    '— THE END —',
  ],
};
