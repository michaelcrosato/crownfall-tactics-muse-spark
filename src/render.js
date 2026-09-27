// Renderer: WebGPURenderer from three/webgpu with automatic WebGL2 fallback,
// TSL node-material shading hooks, node post-processing (restrained bloom),
// HDR environment lighting, soft shadows, AA. Same scene on both backends.
import * as THREE from 'three';
import { QUALITY_PRESETS } from './config.js';

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.backend = 'none'; // 'webgpu' | 'webgl2'
    this.isWebGPU = false;
    this.scene = null;
    this.camera = null;
    this.post = null;
    this.bloomNode = null;
    this.nodeCapable = true;
    this.preset = 'balanced';
    this.useBloom = false;
    this.envIntensity = 1.0;
  }

  async init() {
    // Try WebGPU first; fall back to WebGL2 automatically.
    let lastErr = null;
    try {
      const { WebGPURenderer } = await import('three/webgpu');
      const r = new WebGPURenderer({ canvas: this.canvas, antialias: true, forceWebGL: false });
      await r.init();
      this.renderer = r;
      const be = r.backend;
      this.isWebGPU = !!(be && be.isWebGPUBackend);
      this.backend = this.isWebGPU ? 'webgpu' : 'webgl2';
    } catch (e) {
      lastErr = e;
    }
    if (!this.renderer) {
      try {
        const { WebGPURenderer } = await import('three/webgpu');
        const r = new WebGPURenderer({ canvas: this.canvas, antialias: true, forceWebGL: true });
        await r.init();
        this.renderer = r;
        this.isWebGPU = false;
        this.backend = 'webgl2';
      } catch (e) {
        lastErr = e;
      }
    }
    if (!this.renderer) {
      // Last resort: classic WebGLRenderer (same scene graph).
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
      this.isWebGPU = false;
      this.backend = 'webgl2';
      this.nodeCapable = false;
      if (lastErr) console.warn('WebGPU init failed, using WebGLRenderer:', lastErr);
    }

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('toneMapping' in this.renderer) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1326);
    this.scene.fog = new THREE.Fog(0x0d1326, 26, 60);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.camera.position.set(8, 10, 12);

    this.buildLights();
    this.buildEnvironment();
    await this.setupPost();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  buildLights() {
    // Key: warm directional sun with soft shadows.
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    this.sun.position.set(10, 16, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -14;
    this.sun.shadow.camera.right = 14;
    this.sun.shadow.camera.top = 14;
    this.sun.shadow.camera.bottom = -14;
    this.sun.shadow.camera.far = 50;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    // Fill: cool hemisphere + faint counter light.
    this.hemi = new THREE.HemisphereLight(0x9db8e8, 0x3a2f28, 0.85);
    this.scene.add(this.hemi);
    this.rim = new THREE.DirectionalLight(0x88aaff, 0.5);
    this.rim.position.set(-8, 6, -10);
    this.scene.add(this.rim);
  }

  buildEnvironment() {
    // Procedural HDR-ish environment: gradient sky + warm ground bounce,
    // baked to a PMREM map so PBR materials get image-based lighting.
    const w = 256, h = 128;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1);
      // top: deep blue sky w/ warm horizon band; bottom: dark warm ground
      let r, g, b;
      if (t < 0.5) {
        const k = t / 0.5;
        r = 30 + 120 * k * k; g = 40 + 90 * k * k; b = 70 + 80 * k;
      } else {
        const k = (t - 0.5) / 0.5;
        r = 150 - 110 * k; g = 130 - 95 * k; b = 150 - 100 * k;
      }
      // sun blob
      for (let x = 0; x < w; x++) {
        const dx = (x / w - 0.68) * 2, dy = (t - 0.42) * 2;
        const sun = Math.exp(-(dx * dx * 6 + dy * dy * 18)) * 220;
        const i = (y * w + x) * 4;
        data[i] = Math.min(255, r + sun);
        data[i + 1] = Math.min(255, g + sun * 0.9);
        data[i + 2] = Math.min(255, b + sun * 0.7);
        data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.envTex = tex;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    // PMREM with WebGPURenderer may need async compile; guard it.
    try {
      const env = pmrem.fromEquirectangular(tex).texture;
      this.scene.environment = env;
      this.scene.environmentIntensity = 0.75;
    } catch (e) {
      console.warn('PMREM env failed, continuing without IBL:', e);
    }
    pmrem.dispose();
  }

  async setupPost() {
    // Node-based post chain (WebGPURenderer only). Classic fallback renders direct.
    this.post = null;
    if (!this.nodeCapable) return;
    if (typeof this.renderer.renderAsync !== 'function' && !this.isWebGPU) {
      // WebGPURenderer-with-WebGL-backend still supports .render(); PostProcessing needs nodes support.
    }
    try {
      const [{ PostProcessing }, tsl, { bloom }] = await Promise.all([
        import('three/webgpu'),
        import('three/tsl'),
        import('three/addons/tsl/display/BloomNode.js'),
      ]);
      this._tslPass = tsl.pass;
      this._bloomFn = bloom;
      this.post = new PostProcessing(this.renderer);
      this.rebuildPostChain();
    } catch (e) {
      console.warn('Node post-processing unavailable, rendering direct:', e);
      this.post = null;
    }
  }

  rebuildPostChain() {
    if (!this.post) return;
    try {
      const scenePass = this._tslPass(this.scene, this.camera);
      if (this.useBloom && this._bloomFn) {
        // Restrained bloom: low strength, high threshold.
        const b = this._bloomFn(scenePass, 0.35, 0.6, 0.85);
        this.post.outputNode = b.add(scenePass);
      } else {
        this.post.outputNode = scenePass;
      }
      this.post.needsUpdate = true;
    } catch (e) {
      console.warn('Post chain rebuild failed:', e);
      this.post = null;
    }
  }

  applyPreset(name) {
    const p = QUALITY_PRESETS[name] || QUALITY_PRESETS.balanced;
    this.preset = name;
    const pr = p.pixelRatio === 'native'
      ? Math.min(window.devicePixelRatio || 1, 2)
      : p.pixelRatio;
    this.renderer.setPixelRatio(pr);
    this.sun.castShadow = p.shadows;
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.shadow.mapSize.set(p.shadowMap, p.shadowMap);
    const wantBloom = p.bloom;
    if (wantBloom !== this.useBloom) {
      this.useBloom = wantBloom;
      this.rebuildPostChain();
    }
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  async render() {
    try {
      if (this.post) {
        await this.post.renderAsync();
        return;
      }
      if (typeof this.renderer.renderAsync === 'function') {
        await this.renderer.renderAsync(this.scene, this.camera);
        return;
      }
    } catch (e) {
      if (!this._postWarned) {
        console.warn('Node render path failed, using direct render:', e);
        this._postWarned = true;
      }
      this.post = null;
    }
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      if (!this._renderWarned) {
        console.error('Render failed:', e);
        this._renderWarned = true;
      }
    }
  }
}
