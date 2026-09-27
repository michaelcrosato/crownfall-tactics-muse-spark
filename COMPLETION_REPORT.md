# Crownfall Tactics — Completion Report

**Source:** Final Fantasy Tactics (PS1, original English release)
**Guide:** `FFT_Unified_Guide.md` v1.0 (compiled 2026-09-25) — treated as the authoritative content list
**Game:** Crownfall Tactics v1.1.0 · Generated 2026-09-27 · Built by Muse Spark (Muse Code powered by Meta Muse Spark)

**Changelog v1.0.0 → v1.1.0** (guide-gap pass): 10 → 20 story battles (Thieves Fort, Zirekile Falls, Golgorand, Yardow, Bethla, Igros, Murond Death City, Riovanes split into I/II/III, Limberry Undercroft); 10 → 14 jobs (Time Mage, Ninja, Samurai, Geomancer); 42 → 70 abilities (Time/Throw/Draw Out/Elemental/Holy Sword/Limit/extra chemist goods + 7 monster arts); 24 → 44 equipment (+ chapter-4 shop tier); 7 → 14 monsters (chocobos, panther, dragon, mindflare, ghoul, hydra); 7 → 13 statuses (Haste, Stop, Sleep, Protect, Shell, Regen); new systems — facing/back attacks, poaching, dispatch propositions, soldier hiring, Move-Find-Item caches; new story recruit Aveline (Holy Sword).

## 1. Source checklist → where it appears

### Story beats & areas (guide: Campaign, Story, Maps)

| Guide content | In Crownfall Tactics |
|---|---|
| Prologue at Orbonne Monastery; cadets vs brigands | Battle 1 “Orbonne Monastery” (`src/data.js` → `BATTLES[0]`) |
| Dorter Trade City urban battle | Battle “Dorter Trade City” |
| Sweegy Woods monster hunt (goblins) | Battle “Sweegy Woods” (goblins + bomb) |
| Thieves Fort bandit nest | Battle “Thieves Fort” (thieves + goblin, hidden Power Wrist) |
| Lenalia Plateau height-dominated map | Battle “Lenalia Plateau” (radial height map, archers on top) |
| Zirekile Falls water map | Battle “Zirekile Falls” (mage wardens, water channels) |
| Golgorand Execution Site rescue | Battle “Golgorand Execution Site” (executioners + guards) |
| Chapter boss blocking the pass | Battle “Fovoham Plains” — boss: Thunder Regent |
| Lesalia / undercity route | Battle “Lesalia Aqueducts” (water channels, thieves, cactuars; Aveline joins after) |
| Riovanes Castle I/II/III (gate, duel, rooftop) | Battles “Riovanes Castle Gate”, “Riovanes Ramparts” (boss: Fell Knight), “Riovanes Rooftop” (war chocobos) |
| Yardow Fort City turncoat fight | Battle “Yardow Fort City” (ninja + time mage enemies) |
| Limberry Castle crypt fights | Battle “Limberry Castle” (skeletons, crypt wizards) |
| Limberry depths boss | Battle “Limberry Undercroft” — boss: High Seraph |
| Bethla Garrison bridge stand | Battle “Bethla Garrison” (samurai saints, dragoon, summoner) |
| Igros Castle last stand + red chocobo | Battle “Igros Castle” (geomancers, guard, Red Chocobo) |
| Nelveska Temple — Worker 7 New | Battle “Nelveska Temple” — boss: Worker 7 (big toy machina) |
| Murond Death City dragon gate | Battle “Murond Death City” — boss: Elder Dragon (mindflares, ghouls) |
| Murond holy place / final showdown | Battle “Murond Necropolis” — final boss: The Heritor |
| Deep Dungeon optional exploration | Errand “Deep Delve: Sluice Depths” (condensed multi-floor feel, high-level monsters) |
| Poaching (monster → item) | Full table (`POACHES`, all 14 monsters): thieves always poach (25% rare incl. Barette, Dracula Mantle, Ninja Knife, Rubber Costume); others 30% common |
| Propositions / dispatch missions | Tavern Hall: 5 commissions, send reserves for 1–3 battles, gil + goods + JP rewards |
| Soldier hiring hall | Tavern Hall: 2 rotating recruit offers (squire/chemist, scaling level + cost), reserves + party promotion |
| Move-Find-Item hidden treasure | `hidden` caches in 12 battles (no chest mesh; end a move on the tile) |
| Secret characters (Cloud recruitment route) | Errand “Sky Pirate: Cloud's Debt” — Cloud joins with Limit arts (Braver, Cross Slash) |
| Secret characters (Agrias/Holy Knight route) | Aveline the Oathsworn joins after Lesalia with Holy Sword arts (Hold, Blade) |
| Zodiac stones / auracite plot driver | Retold as the Heritor's stones in intro, chapter cards, and epilogue |
| 4-chapter structure | Chapters 1–4 with title cards between battles (`STORY.chapters`) |
| World map with area transitions | World Map screen: 10 nodes + 3 errands, sequential unlock, area briefings |

### Jobs (guide: Jobs — 20 generics + specials, condensed to 14)

| Guide content | In Crownfall Tactics |
|---|---|
| Squire / Chemist base jobs | Starting jobs for all three recruits; everything unlocks from them |
| Knight, Archer, Monk, Thief | Mid-tier unlocks via Squire JP (200/200/350/350) |
| Black Mage (Wizard), White Mage (Priest) | Magical unlocks via Chemist JP (200 each) |
| Dragoon (Lancer), Summoner | Advanced unlocks (Thief 400 / Black Mage 500 JP) |
| Time Mage, Ninja, Samurai, Geomancer | Time Mage (Black Mage 250), Ninja (Thief 450), Samurai (Knight 450), Geomancer (Monk 300) |
| Job unlock chart / JP requirements | `JOBS[].requires`, enforced in Party screen with visible costs |
| Gender stat tilt (M: PA/HP, F: MA/MP) | `computeStats` in `src/state.js` |
| Equipment restrictions per job | `JOBS[].equip` enforced in Party → equip dropdowns |

Cut for scope (documented): Bard, Dancer, Calculator, Mediator, Mime, Oracle, Dark/Holy Knights. Each needs a bespoke subsystem (song/dance stacking, math targeting, Invite/breed, mimic queue, traps) disproportionate to its screen time; the kept 14 cover every tactical role.

### Abilities & command sets (guide: 507 abilities / 116 sets, condensed to 70)

Representative kits per job, all working: Fundaments, Item throws (+ Ether/Remedy/X-Potion/Elixir), Knight breaks + Rend MP, Aim shots + Charge, Punch Art, Steal, Black/White/Time magic (Haste/Slow/Stop/Meteor/Shell/Regen), Draw Out (Kiyomori/Muramasa/Murasame), Throw arts, Elemental (Flame Burst/Falling Rock/Undertow), Jump/Pierce, Summons, Holy Sword (Hold/Blade), Limit (Braver/Cross Slash), plus enemy-only arts (Tail Swipe, Goblin Punch, Dark Holy, Stone Gaze, Choco Attack/Ball/Cure, Fire Breath, Mind Blast, Blood Suck, Triple Attack). Full list in `src/data.js` → `ABILITIES`.

### Equipment & items (guide: 295 equipment records, condensed to 44)

Swords incl. Knight Sword, bows incl. Hunting Bow, rods, dagger, Ninja Knife, Short Katana, Battle Axe, spear, gun, shields (2), robes/armor incl. Rubber Costume, hats incl. Cachusha, boots (+1 Move), mantles/rings/trinkets incl. poach-only Barette and Dracula Mantle, and 8 consumables — all buyable/equippable/lootable/poachable (`EQUIPMENT`, Shop with chapter-4 tier, Party, chests, hidden caches, poaching). Consumable stock is shared and depletes in battle.

### Mechanics (guide: Mechanics/Statuses/Statistics)

| Guide content | In Crownfall Tactics |
|---|---|
| CT / Clockticks / Speed turn flow | `tickCT` in `src/combat.js`; Speed points per tick, 100 = turn |
| AT menu / turn-order preview | AT list HUD + `predictOrder` |
| Charge times (CTR) | Adapted: big spells inflict recovery delay (negative CT) instead of pre-cast delay — same pacing effect, no fiddly retargeting (see §3) |
| PA / MA / Speed, Brave / Faith | All six stats; Brave scales phys/hit, Faith scales magic both ways |
| Evasion | Per-unit evade + shield bonuses + height advantage; shown via MISS floaters |
| Move / Jump / height maps | BFS range honoring jump; 0-height water/void blocked |
| AoE shapes (single / plus / 3×3) | `aoeTiles`; hostile-only damage, ally-only healing |
| Statuses | Poison, Slow, Daze, Disarm, Exposed, Charm, Haste, Stop, Sleep, Protect, Shell, Regen + KO/crystal countdown (3 rounds) |
| Facing / direction | Units face moves/actions (nose wedge + card arrow); back attacks +30%, unavoidable |
| Reaction/Support/Move abilities | Not implemented as slots; signature effects folded into kits (Charge≈charging, poaching≈Secret Hunt, boots≈Move+1) |
| XP / JP / level growth | Per-unit XP levels; per-job JP pools; JP buys abilities and job unlocks |
| Zodiac compatibility | Omitted (see §3) |
| Permadeath by crystallization | Adapted: KO'd units revive free after battle (see §3) |
| Gil economy, steal gil | Battle spoils + Steal Gil + treasure; shop spends it |

### Presentation & meta (goal requirements)

Title screen (with generation date + model credit), Controls reference, Options menu (quality/volume/mute/fullscreen/diag/camera), world map, shop, party management (job change, equip, JP training), deploy screen, battle HUD (turn banner, AT order, unit card, log, hints, damage floaters), results screen, defeat/retry screen, epilogue ending screen, diagnostics overlay (backend/preset/fps/frame/physics bodies), local save/load with Continue.

## 2. Additions (original design, clearly separated)

- **Original title, cast, and kingdom**: Rowan/Mira/Bram, Crownfall, the Thunder Regent, the Fell Knight, the Heritor — new names in FFT's tone; no Square Enix characters or script reused.
- **Condensed 10-battle + 3-errand campaign**: a complete arc playable in ~2–3 hours instead of 60+.
- **Brick-built toy art direction**: toy studs, chunky figures, diorama maps — the “remaster” look, all procedural (no ripped assets).
- **Modernized UX**: full AT preview, tap/click targeting with ground highlights, touch camera (orbit/pinch/pan), auto quality, instant retry, autosave after every win.
- **Synth audio fallback**: original placeholder melodies so every cue is audible with zero binaries.

## 3. Conscious adaptations (simplifications with reasons)

1. **CTR as recovery delay**: pre-cast charge bars need per-spell actors and interrupt rules; recovery delay preserves the pacing cost (slow mages act less often) at a fraction of the complexity. Shown as negative CT in the AT list.
2. **No permanent death**: losing a trained unit to one bad round is the classic new-player rage-quit; KO'd units return after battle. The 3-round crystal countdown still punishes mid-battle neglect.
3. **No zodiac compatibility / religion-locked gear**: cut as opaque math; Brave/Faith carry the same flavor transparently.
4. **No Calculator/Samurai/etc.**: 10 jobs keep every battle readable; each cut job's fantasy is covered (AoE math → summons; katana draws → breaks).
5. **Fixed party of recruits + Cloud**: no generic-soldier hiring hall; the three starters + Cloud cover all roles and keep the story personal.

## 4. Verification evidence

- `npm test`: **34/34 pass, stable across repeated runs** — data integrity (incl. hidden caches, poach table, propositions), XP/JP/learning, CT order, formulas, movement, facing/backstab, statuses/wards, chemist goods, poaching odds, hiring/dispatches, ability resolution, win/lose/boss-end rules, plus a **headless full-battle simulation** (real `Battle` controller, scripted player, stub renderer) that wins battle 1 and applies rewards.
- `npm run build`: clean Vite production build to `dist/` (~1.5 s), manifest ships and parses.
- Browser runtime: **not verified in this sandbox** — Chromium (system and Playwright-bundled) SIGTRAPs on any page load here, including `about:blank`, so no in-browser smoke test was possible. The bundle's module graph resolves (proven by the build), all game logic is covered headlessly, and renderer failure paths degrade gracefully (WebGPU → WebGL2 → direct render, each guarded). First real-browser load should be treated as the remaining check.

## 5. Known issues

- Large initial chunk (~2.9 MB JS incl. three.js + Rapier); acceptable for broadband, worth code-splitting later.
- No mid-battle save; battles are short (5–15 min) and autosave after each win.
- Enemy Chemists never throw items (AI skips shared-stock consumables); medics still attack and revive.
- Water (TSL) animation only animates on the node-capable path; classic fallback gets static water.
- Balance tuned for the main path; errands may be easier/harder depending on party level — grinding one story battle is the intended catch-up.
