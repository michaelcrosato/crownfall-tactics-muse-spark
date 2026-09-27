// Camera: isometric-style orbit rig with zoom + pan.
// Desktop: drag rotate, wheel zoom, right-drag/QE rotate, arrows pan.
// Touch: one-finger drag orbit, pinch zoom, two-finger pan.
export class CameraRig {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.target = { x: 0, y: 0, z: 0 };
    this.yaw = Math.PI / 4;
    this.pitch = 0.9; // radians above horizon-ish
    this.dist = 13;
    this.minDist = 6;
    this.maxDist = 26;
    this.speed = 1.0;
    this.keys = new Set();
    this.pointers = new Map();
    this.lastPinch = 0;
    this.enabled = true;
    this.bind();
    this.update();
  }

  bind() {
    const el = this.canvas;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.lastPinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p || !this.enabled) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 1) {
        if (e.pointerType === 'mouse' && e.buttons === 2) this.pan(dx, dy);
        else if (e.pointerType === 'mouse' && e.shiftKey) this.pan(dx, dy);
        else this.orbit(dx, dy);
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.lastPinch > 0) this.zoom(-(d - this.lastPinch) * 0.03);
        this.lastPinch = d;
        this.pan(dx * 0.5, dy * 0.5);
      }
    });
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      this.lastPinch = 0;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.zoom(e.deltaY * 0.01);
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  orbit(dx, dy) {
    this.yaw -= dx * 0.006 * this.speed;
    this.pitch = Math.max(0.25, Math.min(1.35, this.pitch + dy * 0.004 * this.speed));
    this.update();
  }

  zoom(d) {
    this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist + d * this.speed));
    this.update();
  }

  pan(dx, dy) {
    const s = this.dist * 0.0016 * this.speed;
    const fx = Math.cos(this.yaw), fz = Math.sin(this.yaw);
    const rx = -fz, rz = fx;
    this.target.x -= (rx * dx - fx * dy) * s * 4;
    this.target.z -= (rz * dx - fz * dy) * s * 4;
    this.target.x = Math.max(-9, Math.min(9, this.target.x));
    this.target.z = Math.max(-9, Math.min(9, this.target.z));
    this.update();
  }

  frameBoard(w, d) {
    this.target = { x: 0, y: 0, z: 0 };
    this.dist = Math.max(11, Math.max(w, d) * 1.45);
    this.yaw = Math.PI / 4;
    this.pitch = 0.9;
    this.update();
  }

  focus(x, y, z) {
    this.target = { x, y, z: z ?? this.target.z };
    this.update();
  }

  updateKeys(dt) {
    if (!this.enabled) return;
    const mv = this.dist * dt * 0.6 * this.speed;
    let dx = 0, dz = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dx -= mv;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dx += mv;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) dz -= mv;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) dz += mv;
    if (this.keys.has('KeyQ')) this.yaw += dt * 1.6;
    if (this.keys.has('KeyE')) this.yaw -= dt * 1.6;
    if (dx || dz) {
      const fx = Math.cos(this.yaw), fz = Math.sin(this.yaw);
      this.target.x += dx * -fz + dz * fx;
      this.target.z += dx * fx + dz * fz;
      this.update();
    } else if (this.keys.has('KeyQ') || this.keys.has('KeyE')) {
      this.update();
    }
  }

  update() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.camera.position.set(
      this.target.x + Math.cos(this.yaw) * cp * this.dist,
      this.target.y + sp * this.dist,
      this.target.z + Math.sin(this.yaw) * cp * this.dist,
    );
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
  }
}
