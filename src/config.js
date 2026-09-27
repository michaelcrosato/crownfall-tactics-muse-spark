// Shared constants, quality presets, and build info.
export const BUILD_INFO = {
  title: 'Crownfall Tactics',
  date: '2026-09-27',
  model: 'Muse Spark (Muse Code powered by Meta Muse Spark)',
  version: '1.1.0',
};

// Quality presets: each meaningfully changes rendering + physics cost.
export const QUALITY_PRESETS = {
  high: {
    label: 'High',
    pixelRatio: 'native', // min(devicePixelRatio, 2)
    shadowMap: 2048,
    shadows: true,
    bloom: true,
    msaa: true,
    maxBodies: 90,
    particles: 1.0,
  },
  balanced: {
    label: 'Balanced',
    pixelRatio: 1.0,
    shadowMap: 1024,
    shadows: true,
    bloom: false,
    msaa: true,
    maxBodies: 40,
    particles: 0.5,
  },
};

// Auto preset starts at Balanced and promotes/demotes on measured fps.
export const AUTO_TUNING = {
  sampleMs: 2500,
  promoteFps: 55,
  demoteFps: 32,
  startAt: 'balanced',
};

export const SAVE_KEY = 'crownfall-tactics-save-v1';
export const OPTIONS_KEY = 'crownfall-tactics-options-v1';

export const DEFAULT_OPTIONS = {
  quality: 'auto', // auto | high | balanced
  volume: 0.7,
  muted: false,
  fullscreen: false,
  showDiag: true,
  cameraSpeed: 1.0,
};
