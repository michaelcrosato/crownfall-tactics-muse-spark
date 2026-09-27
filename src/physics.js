// Physics: Rapier rigid bodies on a fixed 60 Hz timestep with render
// interpolation. Simple ball/box colliders, plausible mass + friction,
// per-preset body caps, and cleanup when objects are removed.
import RAPIER from '@dimforge/rapier3d-compat';

export class Physics {
  constructor() {
    this.world = null;
    this.bodies = new Map(); // id -> { body, collider, mesh, prev:{p,r}, cur:{p,r} }
    this.nextId = 1;
    this.acc = 0;
    this.step = 1 / 60;
    this.maxBodies = 40;
    this.gravity = -14;
    this.ready = false;
  }

  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: this.gravity, z: 0 });
    this.world.timestep = this.step;
    // Static ground plane so debris/props settle.
    const gb = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.6, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setFriction(0.9), gb);
    this.ready = true;
  }

  setMaxBodies(n) {
    this.maxBodies = n;
    this.enforceCap();
  }

  enforceCap() {
    while (this.bodies.size > this.maxBodies) {
      const oldest = this.bodies.keys().next().value;
      this.remove(oldest);
    }
  }

  // Spawn a toy-brick chunk. kind: 'box' | 'ball'. Returns id or -1 if capped.
  spawn({ kind = 'box', pos = [0, 3, 0], vel = [0, 0, 0], angvel = null, size = 0.22, mesh = null, ttl = 6, bounce = 0.45 }) {
    if (!this.ready || !this.world) return -1;
    this.enforceCap();
    if (this.bodies.size >= this.maxBodies) return -1;
    const id = this.nextId++;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos[0], pos[1], pos[2])
      .setLinvel(vel[0], vel[1], vel[2])
      .setCcdEnabled(true);
    if (angvel) desc.setAngvel({ x: angvel[0], y: angvel[1], z: angvel[2] });
    const body = this.world.createRigidBody(desc);
    const col = kind === 'ball'
      ? RAPIER.ColliderDesc.ball(size).setFriction(0.7).setRestitution(bounce).setDensity(1.2)
      : RAPIER.ColliderDesc.cuboid(size, size, size).setFriction(0.8).setRestitution(bounce).setDensity(1.0);
    const collider = this.world.createCollider(col, body);
    const t = body.translation();
    const r = body.rotation();
    const snap = { p: [t.x, t.y, t.z], r: [r.x, r.y, r.z, r.w] };
    this.bodies.set(id, { body, collider, mesh, prev: snap, cur: { ...snap, p: [...snap.p], r: [...snap.r] }, ttl });
    return id;
  }

  remove(id) {
    const e = this.bodies.get(id);
    if (!e) return;
    try {
      this.world.removeCollider(e.collider, true);
      this.world.removeRigidBody(e.body);
    } catch { /* already removed */ }
    if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
    this.bodies.delete(id);
  }

  clearAll() {
    for (const id of [...this.bodies.keys()]) this.remove(id);
    this.acc = 0;
  }

  // Fixed-step advance; call once per frame with clamped dt.
  update(dt) {
    if (!this.ready || !this.world) return;
    this.acc = Math.min(this.acc + Math.min(dt, 0.25), this.step * 4);
    while (this.acc >= this.step) {
      for (const e of this.bodies.values()) {
        const t = e.body.translation();
        const r = e.body.rotation();
        e.prev = { p: [t.x, t.y, t.z], r: [r.x, r.y, r.z, r.w] };
        e.ttl -= this.step;
      }
      this.world.step();
      for (const e of this.bodies.values()) {
        const t = e.body.translation();
        const r = e.body.rotation();
        e.cur = { p: [t.x, t.y, t.z], r: [r.x, r.y, r.z, r.w] };
      }
      this.acc -= this.step;
      for (const [id, e] of this.bodies) {
        const p = e.cur.p;
        if (e.ttl <= 0 || p[1] < -8) this.remove(id);
      }
    }
    // Interpolated render transforms.
    const a = this.acc / this.step;
    for (const e of this.bodies.values()) {
      if (!e.mesh) continue;
      const p0 = e.prev.p, p1 = e.cur.p;
      e.mesh.position.set(
        p0[0] + (p1[0] - p0[0]) * a,
        p0[1] + (p1[1] - p0[1]) * a,
        p0[2] + (p1[2] - p0[2]) * a,
      );
      e.mesh.quaternion.set(
        p0[0] * 0 + e.cur.r[0], e.cur.r[1], e.cur.r[2], e.cur.r[3],
      );
    }
  }

  get count() {
    return this.bodies.size;
  }
}
