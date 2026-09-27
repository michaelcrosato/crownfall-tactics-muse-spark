# Crownfall Tactics

An original low-poly, brick-built tactical RPG inspired by **Final Fantasy Tactics (PS1)** — grid battles, CT turn order, jobs and JP, Brave/Faith, height and facing-aware archery, KO crystals, shops, tavern errands, and a four-chapter Lion War story, playable from title screen to ending.

- **Generated:** 2026-09-27
- **Built by:** Muse Spark (Muse Code powered by Meta Muse Spark)
- **Version:** 1.1.0 (internal test build)

## Play

```sh
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173/`) in a recent Chrome, Edge, Firefox, or Safari. WebGPU is used when available; the game falls back to WebGL2 automatically.

Desktop and touch are both supported: click/tap tiles to move and target, drag to orbit, wheel/pinch to zoom, right-drag / two-finger drag to pan.

## Build & deploy

```sh
npm test          # 34 headless logic + simulation tests (Node built-in runner)
npm run build     # standard Vite build to dist/
npm run preview   # serve the production build locally
```

**Vercel:** import this repository — no manual configuration needed. Build command `npm run build`, output directory `dist` (declared in `vercel.json`, framework preset `vite`).

## Controls

See the in-game Controls screen. Summary: select with click/tap, orbit with drag (or Q/E), zoom with wheel/pinch, pan with right-drag, arrows/WASD, or two-finger drag. Esc/right-click cancels targeting.

## Tech

| Concern | Choice |
|---|---|
| Stack | Vite 6.3.5, Three.js 0.180.0 (pinned), `@dimforge/rapier3d-compat` 0.14.0 (pinned) |
| Renderer | `WebGPURenderer` from `three/webgpu`, automatic WebGL2 fallback, same scene both paths |
| Shading | TSL + node materials (pulsing water), node post-processing chain with restrained bloom |
| Lighting | PBR materials, procedural HDR environment (PMREM/IBL), soft PCF shadows, blob contact shadows, AA |
| Physics | Rapier rigid bodies, fixed 60 Hz timestep with interpolated rendering, per-preset body caps, cleanup on remove |
| Quality | Auto (measured fps, promotes/demotes), High, Balanced — resolution, shadows, bloom, physics caps |
| Audio | Single manifest `public/audio/manifest.json`; missing files fall back to WebAudio synth |
| Saves | Campaign + options persist in `localStorage` |

Deliberately avoided: `EffectComposer`, `ShaderMaterial`, `onBeforeCompile` (all WebGL-only APIs).

## Placeholder audio (internal test build)

All music/SFX load through [`public/audio/manifest.json`](public/audio/manifest.json). Each entry names a local file plus the placeholder source it stands in for. To ship original audio, drop finished files at the listed paths (or remap `file` fields) — no code changes needed. Missing or undecodable files fall back to synthesized WebAudio placeholders so the game stays playable.

No binary audio ships in this build; every cue below currently resolves to its synth fallback.

**Music placeholders** (intended sources: FFT PS1 rips):

| Cue id | Manifest file | Placeholder for |
|---|---|---|
| `title` | `audio/music-title.ogg` | FFT — Title Back · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `worldmap` | `audio/music-worldmap.ogg` | FFT — World Map theme · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `battle` | `audio/music-battle.ogg` | FFT — Random Battle theme · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `boss` | `audio/music-boss.ogg` | FFT — Boss battle theme · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `victory` | `audio/music-victory.ogg` | FFT — Victory fanfare · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `defeat` | `audio/music-defeat.ogg` | FFT — Game Over theme · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `ending` | `audio/music-ending.ogg` | FFT — Ending theme · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |

**SFX placeholders** (intended sources: FFT PS1 rips):

| Cue id | Manifest file | Placeholder for |
|---|---|---|
| `cursor` | `audio/sfx-cursor.ogg` | FFT menu cursor blip · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `confirm` | `audio/sfx-confirm.ogg` | FFT menu confirm · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `cancel` | `audio/sfx-cancel.ogg` | FFT menu cancel · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `step` | `audio/sfx-step.ogg` | FFT unit step tick · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `hit` | `audio/sfx-hit.ogg` | FFT physical hit · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `miss` | `audio/sfx-miss.ogg` | FFT evade whoosh · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `fire` | `audio/sfx-fire.ogg` | FFT Fire spell · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `ice` | `audio/sfx-ice.ogg` | FFT Blizzard spell · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `bolt` | `audio/sfx-bolt.ogg` | FFT Thunder spell · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `cure` | `audio/sfx-cure.ogg` | FFT Cure spell · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `potion` | `audio/sfx-potion.ogg` | FFT Chemist item throw · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `bow` | `audio/sfx-bow.ogg` | FFT Archer bow shot · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `ko` | `audio/sfx-ko.ogg` | FFT unit KO / crystal · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `levelup` | `audio/sfx-levelup.ogg` | FFT level-up jingle · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `pickup` | `audio/sfx-pickup.ogg` | FFT treasure pickup · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |
| `gil` | `audio/sfx-gil.ogg` | FFT gil reward chime · https://sounds.spriters-resource.com/ / https://www.zophar.net/ |

See [`COMPLETION_REPORT.md`](COMPLETION_REPORT.md) for the source-content checklist, design additions, and known issues.
