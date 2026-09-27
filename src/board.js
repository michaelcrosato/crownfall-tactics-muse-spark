// Board: brick-built toy terrain, toy units, highlights, chests, spell VFX.
// Style: untextured low-poly boxes with PBR + vertex-ish flat colors,
// faceted shading preserved, blob contact shadows under units.
import * as THREE from 'three';

export const TILE = 1.0;

const THEMES = {
  monastery: { top: 0x9aa3b2, side: 0x6b7280, accent: 0x8a6d3b, ground: 0x2a3350 },
  town: { top: 0xa89880, side: 0x6e6250, accent: 0x7a4a2e, ground: 0x2a3350 },
  woods: { top: 0x4d7a45, side: 0x5d4a33, accent: 0x2e5d2a, ground: 0x1d2b22 },
  plateau: { top: 0xb09a6a, side: 0x7a6a4a, accent: 0x8a8a7a, ground: 0x2b2b22 },
  plains: { top: 0x5d8a4d, side: 0x6b5a3e, accent: 0x7ab648, ground: 0x223322 },
  aqueduct: { top: 0x7a8a99, side: 0x4a5a6a, accent: 0x3e7a8a, ground: 0x1a2530 },
  castle: { top: 0x8a8a99, side: 0x5a5a6a, accent: 0xa33a3a, ground: 0x252530 },
  crypt: { top: 0x6a6a7a, side: 0x3e3e4a, accent: 0x5e3a8a, ground: 0x1a1a24 },
  ruin: { top: 0x9a937a, side: 0x6a6552, accent: 0x4a8a7a, ground: 0x24302c },
  necropolis: { top: 0x5a5a6a, side: 0x2e2e3a, accent: 0x8a2e4a, ground: 0x14141c },
};

const JOB_COLORS = {
  squire: 0x4a7ab6, chemist: 0x3fa37a, knight: 0x8a8f99, archer: 0x3f8f3f,
  monk: 0xc77a2e, thief: 0x6a5a8a, blackmage: 0x3a3a6a, whitemage: 0xe8e4d8,
  dragoon: 0x2e6a7a, summoner: 0x8a3a6a,
};

export class Board {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.supportsNodes = opts.supportsNodes !== false;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.tiles = new Map(); // key -> { mesh, x, y, h }
    this.units = new Map(); // uid -> { root, parts, unit }
    this.highlights = new Map(); // key -> mesh
    this.effects = []; // transient { mesh, ttl, update }
    this.w = 0; this.d = 0; this.heights = [];
    this.waterMat = null;
    this.hlMats = {};
    this.tileGeo = new THREE.BoxGeometry(TILE, 1, TILE);
    this.topGeo = new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98);
    this.blobGeo = new THREE.CircleGeometry(0.42, 20);
  }

  key(x, y) { return y * this.w + x; }
  tilePos(x, y) {
    const h = this.heights[y] ? this.heights[y][x] : 1;
    return new THREE.Vector3(
      (x - (this.w - 1) / 2) * TILE,
      Math.max(0, h - 1) * 0.55,
      (y - (this.d - 1) / 2) * TILE,
    );
  }

  async build(def) {
    this.clear();
    this.w = def.w; this.d = def.d;
    const theme = THEMES[def.theme] || THEMES.plains;
    this.heights = def.heights.map((row) => [...row].map((c) => {
      const n = parseInt(c, 10);
      return Number.isFinite(n) ? n : 1;
    }));
    const sideMat = new THREE.MeshStandardMaterial({ color: theme.side, roughness: 0.9, metalness: 0.0, flatShading: true });
    const topMat = new THREE.MeshStandardMaterial({ color: theme.top, roughness: 0.75, metalness: 0.05, flatShading: true });
    const accentMat = new THREE.MeshStandardMaterial({ color: theme.accent, roughness: 0.8, metalness: 0.05, flatShading: true });
    this.waterMat = this.makeWaterMaterial();

    for (let y = 0; y < this.d; y++) {
      for (let x = 0; x < this.w; x++) {
        const h = this.heights[y][x];
        const p = this.tilePos(x, y);
        let mesh;
        if (h <= 0) {
          mesh = new THREE.Mesh(this.tileGeo, this.waterMat);
          mesh.position.set(p.x, -0.35, p.z);
          mesh.scale.y = 0.3;
        } else {
          const g = new THREE.Group();
          const base = new THREE.Mesh(this.tileGeo, sideMat);
          base.scale.y = 0.5 + h * 0.55;
          base.position.y = -0.25 - (h - 1) * 0.0;
          base.position.y = -base.scale.y / 2 + 0.0;
          base.castShadow = false; base.receiveShadow = true;
          const top = new THREE.Mesh(this.topGeo, topMat);
          top.position.y = 0.0;
          top.castShadow = false; top.receiveShadow = true;
          // toy-brick stud for readable grid + charm (skip some for variety)
          if ((x + y) % 3 !== 0) {
            const stud = new THREE.Mesh(Board.studGeo(), accentMat);
            stud.position.y = 0.12;
            stud.castShadow = false; stud.receiveShadow = true;
            g.add(stud);
          }
          g.add(base); g.add(top);
          g.position.set(p.x, p.y, p.z);
          mesh = g;
        }
        mesh.userData = { x, y };
        this.group.add(mesh);
        this.tiles.set(this.key(x, y), { mesh, x, y, h });
      }
    }
    // ground skirt
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(this.w + 6, 0.5, this.d + 6),
      new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1, flatShading: true }),
    );
    skirt.position.y = -1.35;
    skirt.receiveShadow = true;
    this.group.add(skirt);
    this.skirt = skirt;

    this.hlMats = {
      move: new THREE.MeshBasicMaterial({ color: 0x3fa7ff, transparent: true, opacity: 0.45, depthWrite: false }),
      target: new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.5, depthWrite: false }),
      aoe: new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.5, depthWrite: false }),
      path: new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.65, depthWrite: false }),
      cursor: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
    };
    this.hlGeo = new THREE.PlaneGeometry(0.92, 0.92);
  }

  static studGeo() {
    if (!Board._stud) Board._stud = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 10);
    return Board._stud;
  }

  makeWaterMaterial() {
    // TSL node material: gently pulsing water. Falls back to standard material.
    if (this.supportsNodes) {
      try {
        return makeWaterNodeMaterial();
      } catch (e) {
        console.warn('Water node material failed, using standard:', e);
      }
    }
    return new THREE.MeshStandardMaterial({ color: 0x2e6a8a, roughness: 0.25, metalness: 0.35, flatShading: true });
  }

  clear() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry && o.geometry !== this.tileGeo && o.geometry !== this.topGeo && o.geometry !== Board._stud) {
        // shared geos kept; unit geos disposed below via unit roots
      }
    });
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.tiles.clear();
    this.units.clear();
    this.highlights.clear();
    this.effects = [];
  }

  // --- units ---
  addUnit(unit, side) {
    const root = new THREE.Group();
    const color = unit.monster ? monsterColor(unit) : (JOB_COLORS[unit.job] ?? 0x888888);
    const trim = side === 'player' ? 0x2e5db6 : 0xb62e2e;
    const parts = buildToyFigure(color, trim, unit);
    root.add(parts.group);
    // blob contact shadow
    const blob = new THREE.Mesh(this.blobGeo, Board.blobMat());
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.075;
    root.add(blob);
    const p = this.tilePos(unit.x, unit.y);
    root.position.copy(p);
    root.userData.uid = unit.uid;
    this.group.add(root);
    this.units.set(unit.uid, { root, parts, unit, flash: 0 });
    return root;
  }

  static blobMat() {
    if (!Board._blob) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, 'rgba(0,0,0,0.42)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      Board._blob = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    }
    return Board._blob;
  }

  moveUnitMesh(uid, x, y, animate = true) {
    const e = this.units.get(uid);
    if (!e) return Promise.resolve();
    const to = this.tilePos(x, y);
    if (!animate) {
      e.root.position.copy(to);
      return Promise.resolve();
    }
    const from = e.root.position.clone();
    const dist = from.distanceTo(to);
    const dur = Math.min(0.6, 0.12 + dist * 0.09);
    return tween(dur, (k) => {
      e.root.position.lerpVectors(from, to, k);
      e.root.position.y += Math.sin(k * Math.PI) * 0.18; // hop
      e.parts.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    });
  }

  faceTile(uid, tx, ty) {
    const e = this.units.get(uid);
    if (!e) return;
    const to = this.tilePos(tx, ty);
    e.parts.group.rotation.y = Math.atan2(to.x - e.root.position.x, to.z - e.root.position.z);
  }

  setUnitVisible(uid, v) {
    const e = this.units.get(uid);
    if (e) e.root.visible = v;
  }

  setUnitKO(uid, ko) {
    const e = this.units.get(uid);
    if (!e) return;
    e.parts.group.rotation.x = ko ? -Math.PI / 2.2 : 0;
    e.parts.group.position.y = ko ? 0.15 : 0;
  }

  flashUnit(uid, color = 0xffffff) {
    const e = this.units.get(uid);
    if (e) { e.flash = 1; e.flashColor = color; }
  }

  removeUnit(uid) {
    const e = this.units.get(uid);
    if (!e) return;
    this.group.remove(e.root);
    this.units.delete(uid);
  }

  // --- highlights ---
  showHighlights(keys, kind = 'move') {
    this.clearHighlights(kind);
    const mat = this.hlMats[kind];
    if (!mat) return;
    for (const k of keys) {
      const t = this.tiles.get(k);
      if (!t) continue;
      const m = new THREE.Mesh(this.hlGeo, mat);
      m.rotation.x = -Math.PI / 2;
      const p = this.tilePos(t.x, t.y);
      m.position.set(p.x, p.y + 0.09, p.z);
      m.userData = { kind, x: t.x, y: t.y };
      this.group.add(m);
      this.highlights.set(`${kind}:${k}`, m);
    }
  }

  clearHighlights(kind = null) {
    for (const [k, m] of [...this.highlights]) {
      if (!kind || k.startsWith(kind + ':')) {
        this.group.remove(m);
        this.highlights.delete(k);
      }
    }
  }

  clearAllHighlights() {
    this.clearHighlights(null);
  }

  // --- transient effects ---
  spawnBurst(x, y, colorHex, n = 10, physics = null, chunkMat = null) {
    const p = this.tilePos(x, y);
    for (let i = 0; i < n; i++) {
      const s = 0.07 + Math.random() * 0.1;
      const mat = chunkMat || new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, emissive: colorHex, emissiveIntensity: 0.7, flatShading: true });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
      mesh.castShadow = false;
      this.group.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3;
      if (physics && physics.ready) {
        mesh.position.set(p.x, p.y + 0.6, p.z);
        const id = physics.spawn({
          kind: 'box', size: s / 2, mesh, ttl: 1.6,
          pos: [p.x, p.y + 0.6, p.z],
          vel: [Math.cos(a) * sp, 3 + Math.random() * 3, Math.sin(a) * sp],
          angvel: [Math.random() * 8, Math.random() * 8, Math.random() * 8],
        });
        if (id < 0) {
          // capped: fake it with a tween then remove
          this.group.remove(mesh);
        }
      } else {
        mesh.position.set(p.x, p.y + 0.6, p.z);
        const vx = Math.cos(a) * sp, vy = 3 + Math.random() * 3, vz = Math.sin(a) * sp;
        let ttl = 0.7;
        this.effects.push({
          mesh, ttl,
          update: (dt) => {
            ttl -= dt;
            mesh.position.x += vx * dt;
            mesh.position.y += vy * dt;
            mesh.position.z += vz * dt;
            mesh.position.y -= 9 * dt * dt * 10;
            mesh.rotation.x += dt * 7;
            return ttl > 0 && mesh.position.y > -1;
          },
        });
      }
    }
  }

  spawnRing(x, y, colorHex = 0xffffff) {
    const p = this.tilePos(x, y);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 24), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, p.y + 0.12, p.z);
    this.group.add(mesh);
    let t = 0;
    this.effects.push({
      mesh,
      update: (dt) => {
        t += dt;
        const k = t / 0.5;
        mesh.scale.setScalar(1 + k * 3);
        mat.opacity = 0.9 * (1 - k);
        if (k >= 1) { this.group.remove(mesh); mat.dispose(); return false; }
        return true;
      },
    });
  }

  // Chest / treasure marker: small brick chest that bobs.
  addChest(x, y) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8, flatShading: true });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8a83a, roughness: 0.4, metalness: 0.6, flatShading: true });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.36), wood);
    box.position.y = 0.22; box.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.36), wood);
    lid.position.y = 0.44; lid.castShadow = true;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.38), gold);
    band.position.y = 0.3;
    g.add(box, lid, band);
    const p = this.tilePos(x, y);
    g.position.copy(p);
    this.group.add(g);
    let t = Math.random() * 6;
    const baseY = p.y;
    this.effects.push({
      mesh: g, chest: true,
      update: (dt) => {
        t += dt;
        g.position.y = baseY + Math.sin(t * 2.2) * 0.05;
        g.rotation.y += dt * 0.6;
        return g.parent !== null;
      },
    });
    return g;
  }

  update(dt, time) {
    // unit idle bob + hit flash decay
    for (const e of this.units.values()) {
      if (e.unit.alive) {
        e.parts.group.position.y = Math.sin(time * 2 + e.unit.uid) * 0.03;
      }
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt * 4);
        const f = e.flash;
        for (const m of e.parts.mats) {
          if (m.emissive) {
            m.emissive.setHex(e.flashColor ?? 0xffffff);
            m.emissiveIntensity = f * 0.9;
          }
        }
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const ef = this.effects[i];
      let alive = true;
      try { alive = ef.update(dt); } catch { alive = false; }
      if (!alive) {
        if (ef.mesh && ef.mesh.parent && !ef.chest) {
          // physics-owned meshes are removed by physics; only remove tween ones
          if (!ef.physics) ef.mesh.parent.remove(ef.mesh);
        }
        this.effects.splice(i, 1);
      }
    }
  }
}

function monsterColor(unit) {
  const colors = { goblin: 0x4d9b4d, bomb: 0xd24a2e, cactuar: 0x3f8f3f, skeleton: 0xd8d4c8, cockatrice: 0xc9a13b, worker7: 0x8a8f99, demon: 0x7a2e8f };
  return colors[unit.monster] ?? 0x777777;
}

// Brick-built toy figure: stacked boxes + studs, team trim, job hat/weapon.
function buildToyFigure(color, trim, unit) {
  const g = new THREE.Group();
  const mats = [];
  const M = (c, rough = 0.7) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.05, flatShading: true });
    mats.push(m);
    return m;
  };
  const big = unit.boss ? 1.22 : 1;
  const dark = new THREE.Color(color).multiplyScalar(0.55).getHex();
  const skin = M(0xe8b88a);
  const cloth = M(color);
  const darkM = M(dark);
  const trimM = M(trim, 0.5);

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = false;
    g.add(m);
    return m;
  };

  if (unit.monster === 'bomb') {
    add(new THREE.IcosahedronGeometry(0.34, 0), M(0xd24a2e, 0.5), 0, 0.5, 0);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6), darkM, 0, 0.85, 0);
  } else if (unit.monster === 'cactuar') {
    add(new THREE.BoxGeometry(0.3, 0.8, 0.3), M(0x3f8f3f), 0, 0.5, 0);
    add(new THREE.BoxGeometry(0.12, 0.4, 0.12), M(0x3f8f3f), -0.22, 0.5, 0);
    add(new THREE.BoxGeometry(0.12, 0.4, 0.12), M(0x3f8f3f), 0.22, 0.5, 0);
  } else if (unit.monster === 'worker7') {
    add(new THREE.BoxGeometry(0.9, 0.9, 0.7), M(0x8a8f99, 0.4), 0, 0.75, 0);
    add(new THREE.BoxGeometry(0.4, 0.35, 0.4), M(0xd24a2e, 0.4), 0, 1.35, 0);
    add(new THREE.BoxGeometry(0.25, 0.6, 0.25), darkM, -0.55, 0.5, 0);
    add(new THREE.BoxGeometry(0.25, 0.6, 0.25), darkM, 0.55, 0.5, 0);
  } else {
    // legs
    add(new THREE.BoxGeometry(0.16, 0.28, 0.18), darkM, -0.11, 0.2, 0);
    add(new THREE.BoxGeometry(0.16, 0.28, 0.18), darkM, 0.11, 0.2, 0);
    // torso (brick with studs)
    add(new THREE.BoxGeometry(0.44, 0.4, 0.3), cloth, 0, 0.55, 0);
    add(new THREE.BoxGeometry(0.46, 0.08, 0.32), trimM, 0, 0.38, 0);
    // arms
    add(new THREE.BoxGeometry(0.12, 0.34, 0.14), cloth, -0.29, 0.55, 0);
    add(new THREE.BoxGeometry(0.12, 0.34, 0.14), cloth, 0.29, 0.55, 0);
    // head
    add(new THREE.BoxGeometry(0.3, 0.28, 0.28), skin, 0, 0.9, 0);
    // job headgear
    if (unit.job === 'knight' || unit.job === 'dragoon') {
      add(new THREE.BoxGeometry(0.36, 0.14, 0.34), M(0x9aa0ad, 0.35), 0, 1.08, 0);
    } else if (unit.job === 'blackmage' || unit.job === 'whitemage' || unit.job === 'summoner') {
      add(new THREE.ConeGeometry(0.24, 0.4, 6), cloth, 0, 1.2, 0);
    } else if (unit.job === 'archer' || unit.job === 'thief') {
      add(new THREE.BoxGeometry(0.4, 0.06, 0.4), trimM, 0, 1.06, 0);
    } else if (unit.monster === 'skeleton') {
      // bare skull look: lighten head is enough
    }
    // weapon brick in right hand
    const wgeo = weaponGeo(unit.job);
    if (wgeo) add(wgeo, M(0xc9c9d4, 0.35), 0.29, 0.72, 0.1);
    if (unit.boss) {
      add(new THREE.BoxGeometry(0.5, 0.1, 0.36), M(0xd8a83a, 0.3), 0, 1.3, 0); // crown brick
    }
  }
  g.scale.setScalar(big);
  return { group: g, mats };
}

function weaponGeo(job) {
  switch (job) {
    case 'archer': return new THREE.BoxGeometry(0.08, 0.5, 0.08);
    case 'blackmage':
    case 'whitemage':
    case 'summoner': return new THREE.BoxGeometry(0.08, 0.55, 0.08);
    case 'monk': return null;
    case 'dragoon': return new THREE.BoxGeometry(0.08, 0.7, 0.08);
    default: return new THREE.BoxGeometry(0.1, 0.42, 0.1);
  }
}

function tween(dur, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    function frame(now) {
      const k = Math.min(1, (now - t0) / (dur * 1000));
      fn(k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
      if (k < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

// TSL water: pulsing color mix driven by time. Loaded lazily so a failure
// falls back cleanly to MeshStandardMaterial.
let _waterCtor = null;
function makeWaterNodeMaterial() {
  if (!_waterCtor) {
    // Synchronous require-style via already-verified static imports is done
    // in main.js and stashed on globalThis; see note below.
    const fac = globalThis.__crownfallWaterFactory;
    if (!fac) throw new Error('node factory not installed');
    _waterCtor = fac;
  }
  return _waterCtor();
}

// Installed by main.js after verifying TSL node-material support.
export function installWaterFactory(factory) {
  globalThis.__crownfallWaterFactory = factory;
}
