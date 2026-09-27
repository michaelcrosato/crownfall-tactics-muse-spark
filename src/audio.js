// Audio engine: loads every cue through public/audio/manifest.json.
// Missing/undecodable placeholder files fall back to synthesized WebAudio
// tones so the game is fully playable with zero binary assets.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.manifest = { music: [], sfx: [] };
    this.buffers = new Map(); // id -> AudioBuffer
    this.musicNodes = [];
    this.currentMusic = null;
    this.volume = 0.7;
    this.muted = false;
    this.ready = false;
  }

  async init(baseUrl = import.meta.env.BASE_URL || './') {
    const url = new URL('audio/manifest.json', new URL(baseUrl, location.href)).toString();
    try {
      const res = await fetch(url);
      if (res.ok) this.manifest = await res.json();
    } catch { /* keep empty manifest: synth fallback covers everything */ }
    this.ready = true;
  }

  // Must be called from a user gesture at least once.
  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.applyLevels();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyLevels();
  }

  setMuted(m) {
    this.muted = !!m;
    this.applyLevels();
  }

  applyLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.muted ? 0 : this.volume;
    this.master.gain.setTargetAtTime(g, t, 0.02);
    this.musicGain.gain.setTargetAtTime(0.5, t, 0.02);
    this.sfxGain.gain.setTargetAtTime(0.9, t, 0.02);
  }

  async bufferFor(id) {
    if (this.buffers.has(id)) return this.buffers.get(id);
    const entry = [...(this.manifest.music || []), ...(this.manifest.sfx || [])].find((e) => e.id === id);
    if (!entry || !this.ctx) return null;
    try {
      const url = new URL(entry.file, new URL(import.meta.env.BASE_URL || './', location.href)).toString();
      const res = await fetch(url);
      if (!res.ok) return null;
      const raw = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(raw);
      this.buffers.set(id, buf);
      return buf;
    } catch {
      return null;
    }
  }

  async playSfx(id) {
    this.ensureContext();
    if (!this.ctx) return;
    const buf = await this.bufferFor(id);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.sfxGain);
      src.start();
      return;
    }
    this.synthSfx(id);
  }

  async playMusic(id) {
    this.ensureContext();
    if (!this.ctx || this.currentMusic === id) return;
    this.stopMusic();
    this.currentMusic = id;
    const buf = await this.bufferFor(id);
    if (this.currentMusic !== id) return; // superseded while loading
    if (buf) {
      const entry = (this.manifest.music || []).find((e) => e.id === id);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = !!(entry && entry.loop);
      src.connect(this.musicGain);
      src.start();
      this.musicNodes = [src];
      return;
    }
    this.synthMusic(id);
  }

  stopMusic() {
    this.currentMusic = null;
    for (const n of this.musicNodes) {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
      } catch { /* already stopped */ }
    }
    this.musicNodes = [];
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
  }

  // --- Synthesized fallbacks (placeholder timbres, original patterns) ---
  tone({ freq = 440, dur = 0.12, type = 'square', gain = 0.25, slide = 0, delay = 0, dest = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, gain = 0.3, delay = 0, lowpass = 3000, dest = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(t0);
  }

  synthSfx(id) {
    switch (id) {
      case 'cursor': this.tone({ freq: 880, dur: 0.05, type: 'square', gain: 0.12 }); break;
      case 'confirm': this.tone({ freq: 660, dur: 0.07, gain: 0.2 }); this.tone({ freq: 990, dur: 0.09, gain: 0.2, delay: 0.07 }); break;
      case 'cancel': this.tone({ freq: 330, dur: 0.12, gain: 0.2, slide: -120 }); break;
      case 'step': this.noise({ dur: 0.05, gain: 0.1, lowpass: 1200 }); break;
      case 'hit': this.noise({ dur: 0.18, gain: 0.4, lowpass: 1800 }); this.tone({ freq: 160, dur: 0.15, type: 'triangle', gain: 0.35, slide: -80 }); break;
      case 'miss': this.noise({ dur: 0.25, gain: 0.2, lowpass: 4000 }); break;
      case 'fire': this.noise({ dur: 0.5, gain: 0.35, lowpass: 900 }); this.tone({ freq: 220, dur: 0.4, type: 'sawtooth', gain: 0.15, slide: -140 }); break;
      case 'ice': this.tone({ freq: 1560, dur: 0.3, type: 'triangle', gain: 0.22, slide: -700 }); this.noise({ dur: 0.3, gain: 0.15, lowpass: 6000 }); break;
      case 'bolt': this.noise({ dur: 0.28, gain: 0.4, lowpass: 8000 }); this.tone({ freq: 90, dur: 0.3, type: 'sawtooth', gain: 0.3, slide: -40 }); break;
      case 'cure': this.tone({ freq: 523, dur: 0.15, type: 'sine', gain: 0.25 }); this.tone({ freq: 659, dur: 0.15, type: 'sine', gain: 0.25, delay: 0.12 }); this.tone({ freq: 784, dur: 0.25, type: 'sine', gain: 0.25, delay: 0.24 }); break;
      case 'potion': this.tone({ freq: 400, dur: 0.1, type: 'sine', gain: 0.25, slide: 300 }); this.tone({ freq: 700, dur: 0.12, type: 'sine', gain: 0.2, delay: 0.1 }); break;
      case 'bow': this.tone({ freq: 1200, dur: 0.06, type: 'square', gain: 0.15, slide: -600 }); this.noise({ dur: 0.15, gain: 0.18, lowpass: 5000, delay: 0.05 }); break;
      case 'ko': this.tone({ freq: 392, dur: 0.5, type: 'triangle', gain: 0.3, slide: -300 }); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: 'square', gain: 0.18, delay: i * 0.11 })); break;
      case 'pickup': this.tone({ freq: 784, dur: 0.1, type: 'square', gain: 0.18 }); this.tone({ freq: 1175, dur: 0.16, type: 'square', gain: 0.18, delay: 0.09 }); break;
      case 'gil': [1318, 1568, 2093].forEach((f, i) => this.tone({ freq: f, dur: 0.1, type: 'sine', gain: 0.2, delay: i * 0.08 })); break;
      default: this.tone({ freq: 440, dur: 0.1, gain: 0.15 }); break;
    }
  }

  synthMusic(id) {
    // Simple looping motif per track so every screen has scored audio.
    const motifs = {
      title: [262, 330, 392, 523, 392, 330],
      worldmap: [392, 440, 523, 587, 523, 440],
      battle: [196, 196, 262, 196, 330, 294],
      boss: [147, 147, 175, 147, 220, 196],
      victory: [523, 659, 784, 1046, 784, 1046],
      defeat: [330, 311, 294, 262, 247, 220],
      ending: [523, 587, 659, 784, 659, 587],
    };
    const seq = motifs[id] || motifs.title;
    const stepDur = id === 'battle' || id === 'boss' ? 0.22 : 0.34;
    let i = 0;
    const tick = () => {
      if (this.currentMusic !== id) return;
      this.tone({ freq: seq[i % seq.length], dur: stepDur * 0.95, type: 'triangle', gain: 0.3, dest: this.musicGain });
      if (i % 2 === 0) this.tone({ freq: seq[i % seq.length] / 2, dur: stepDur * 1.4, type: 'sine', gain: 0.2, dest: this.musicGain });
      i++;
    };
    tick();
    if (id === 'victory' || id === 'defeat') {
      // one-shot jingle
      for (let k = 1; k < seq.length; k++) {
        this.tone({ freq: seq[k], dur: 0.3, type: 'triangle', gain: 0.3, delay: k * 0.3, dest: this.musicGain });
      }
      return;
    }
    this._musicTimer = setInterval(tick, stepDur * 1000);
  }
}
