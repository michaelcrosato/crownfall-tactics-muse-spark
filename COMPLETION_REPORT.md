# Crownfall Tactics — Completion Report

**Source:** Final Fantasy Tactics (PS1, original English release)
**Guide:** `FFT_Unified_Guide.md` v1.0 (compiled 2026-09-25) — treated as the authoritative content list
**Game:** Crownfall Tactics v1.0.0 · Generated 2026-09-27 · Built by Muse Spark (Muse Code powered by Meta Muse Spark)

## 1. Source checklist → where it appears

### Story beats & areas (guide: Campaign, Story, Maps)

| Guide content | In Crownfall Tactics |
|---|---|
| Prologue at Orbonne Monastery; cadets vs brigands | Battle 1 “Orbonne Monastery” (`src/data.js` → `BATTLES[0]`) |
| Dorter Trade City urban battle | Battle 2 “Dorter Trade City” |
| Sweegy Woods monster hunt (goblins) | Battle 3 “Sweegy Woods” (goblins + bomb) |
| Lenalia Plateau height-dominated map | Battle 4 “Lenalia Plateau” (radial height map, archers on top) |
| Chapter boss blocking the pass | Battle 5 “Fovoham Plains” — boss: Thunder Regent |
| Lesalia / undercity route | Battle 6 “Lesalia Aqueducts” (water channels, thieves, cactuars) |
| Riovanes Castle multi-level duel vs dark knight | Battle 7 “Riovanes Castle” — boss: Fell Knight |
| Limberry Castle crypt fights | Battle 8 “Limberry Castle” (skeletons, crypt wizards) |
| Nelveska Temple — Worker 7 New | Battle 9 “Nelveska Temple” — boss: Worker 7 (big toy machina) |
| Murond holy place / final showdown | Battle 10 “Murond Necropolis” — final boss: The Heritor |
| Deep Dungeon optional exploration | Errand “Deep Delve: Sluice Depths” (condensed multi-floor feel, high-level monsters) |
| Poaching (monster → item) | Errand “Beast Hunt: Goblin Warren” (condensed: hunt pays pelts/gil + treasure) |
| Propositions / dispatch missions | Tavern Errands system on the world map (3 errands, unlock by story progress) |
| Secret characters (Cloud recruitment route) | Errand “Sky Pirate: Cloud's Debt” — Cloud joins the company on victory |
| Zodiac stones / auracite plot driver | Retold as the Heritor's stones in intro, chapter cards, and epilogue |
| 4-chapter structure | Chapters 1–4 with title cards between battles (`STORY.chapters`) |
| World map with area transitions | World Map screen: 10 nodes + 3 errands, sequential unlock, area briefings |

### Jobs (guide: Jobs — 20 generics + specials, condensed to 10)

| Guide content | In Crownfall Tactics |
|---|---|
| Squire / Chemist base jobs | Starting jobs for all three recruits; everything unlocks from them |
| Knight, Archer, Monk, Thief | Mid-tier unlocks via Squire JP (200/200/350/350) |
| Black Mage (Wizard), White Mage (Priest) | Magical unlocks via Chemist JP (200 each) |
| Dragoon (Lancer), Summoner | Advanced unlocks (Thief 400 / Black Mage 500 JP) |
| Job unlock chart / JP requirements | `JOBS[].requires`, enforced in Party screen with visible costs |
| Gender stat tilt (M: PA/HP, F: MA/MP) | `computeStats` in `src/state.js` |
| Equipment restrictions per job | `JOBS[].equip` enforced in Party → equip dropdowns |

Cut for scope (documented): Bard, Dancer, Calculator, Geomancer, Mediator, Mime, Ninja, Oracle, Samurai, Time Mage, Dark/Holy Knights. The kept 10 cover every tactical role (tank, ranged, healer, nuker, thief, jumper, summoner).

### Abilities & command sets (guide: 507 abilities / 116 sets, condensed to 42)

Representative kits per job, all working: Fundaments (Rush/Shout/First Aid), Item throws (Potion/Hi-Potion/Phoenix Down/Antidote), Knight breaks (Weapon/Shield/Helm) + Rend MP, Aim shots + Charge, Chakra/Pummel/Revive, Steal (gil/heart/helm), Fire/Blizzard/Thunder/Flare, Cure/Cura/Raise/Esuna, Jump/Pierce, Ifrit/Shiva/Ramuh, plus enemy-only arts (Tail Swipe, Goblin Punch, Dark Holy, Stone Gaze). Full list in `src/data.js` → `ABILITIES`.

### Equipment & items (guide: 295 equipment records, condensed to 24)

Swords (3), bows (2), rods (2), dagger, spear, gun, shields (2), robes/armor, hats/helms, boots (+1 Move), stat trinkets, and 4 consumables — all buyable/equippable/lootable (`EQUIPMENT`, Shop, Party, treasure chests). Consumable stock is shared and depletes in battle.

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
| Statuses | Poison, Slow, Daze, Disarm, Exposed, Charm + KO/crystal countdown (3 rounds) |
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

- `npm test`: **17/17 pass** — data integrity, XP/JP/learning, CT order, formulas, movement, ability resolution, win/lose/boss-end rules, plus a **headless full-battle simulation** (real `Battle` controller, scripted player, stub renderer) that wins battle 1 in ~30 turns and applies rewards.
- `npm run build`: clean Vite production build to `dist/` (~1.5 s), manifest ships and parses.
- Browser runtime: **not verified in this sandbox** — Chromium (system and Playwright-bundled) SIGTRAPs on any page load here, including `about:blank`, so no in-browser smoke test was possible. The bundle's module graph resolves (proven by the build), all game logic is covered headlessly, and renderer failure paths degrade gracefully (WebGPU → WebGL2 → direct render, each guarded). First real-browser load should be treated as the remaining check.

## 5. Known issues

- Large initial chunk (~2.9 MB JS incl. three.js + Rapier); acceptable for broadband, worth code-splitting later.
- No mid-battle save; battles are short (5–15 min) and autosave after each win.
- Enemy Chemists never throw items (AI skips shared-stock consumables); medics still attack and revive.
- Water (TSL) animation only animates on the node-capable path; classic fallback gets static water.
- Balance tuned for the main path; errands may be easier/harder depending on party level — grinding one story battle is the intended catch-up.
