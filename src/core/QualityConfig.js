export const QUALITY_TIERS = {
  LOW: {
    name: 'LOW',
    resolutionScale: 0.75,
    maxPixelRatio: 1.0,
    shadowMapSize: 512,
    shadowsEnabled: true,
    postProcessing: false,
    ssao: false,
    bloom: false,
    vignetteAndGrain: false,
    msaaSamples: 0,
    maxAnisotropy: 1,
    drawDistance: 120,
    particleCount: 50,
    envMapIntensity: 1.0
  },
  MEDIUM: {
    name: 'MEDIUM',
    resolutionScale: 1.0,
    maxPixelRatio: 1.25,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    postProcessing: true,
    ssao: false,
    bloom: true,
    vignetteAndGrain: true,
    msaaSamples: 2,
    maxAnisotropy: 4,
    drawDistance: 250,
    particleCount: 200,
    envMapIntensity: 1.15
  },
  HIGH: {
    name: 'HIGH',
    resolutionScale: 1.0,
    maxPixelRatio: 1.5,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    postProcessing: true,
    ssao: true,
    bloom: true,
    vignetteAndGrain: true,
    msaaSamples: 4,
    maxAnisotropy: 8,
    drawDistance: 500,
    particleCount: 500,
    envMapIntensity: 1.25
  },
  ULTRA: {
    name: 'ULTRA',
    resolutionScale: 1.0,
    maxPixelRatio: 2.0,
    shadowMapSize: 4096,
    shadowsEnabled: true,
    postProcessing: true,
    ssao: true,
    bloom: true,
    vignetteAndGrain: true,
    msaaSamples: 4,
    maxAnisotropy: 16,
    drawDistance: 1000,
    particleCount: 1200,
    envMapIntensity: 1.35
  }
};

function safeGetSaved() {
  try {
    return localStorage.getItem('opzero_quality_tier');
  } catch (_) {
    return null;
  }
}

const ORDER = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];

/** Highest tier this device can reasonably run (low-memory / few-core / mobile / integrated GPU => LOW). */
export function recommendQualityTier() {
  return detectHardwareTier();
}

export function detectDefaultQualityTier() {
  const saved = safeGetSaved();
  const rec = detectHardwareTier();
  if (saved && QUALITY_TIERS[saved]) {
    // a saved HIGH/ULTRA must not override a weak device (low RAM / integrated GPU); weak devices cap at MEDIUM
    const weak = rec === 'LOW';
    if (weak && ORDER.indexOf(saved) > ORDER.indexOf('MEDIUM')) return 'MEDIUM';
    return saved;
  }
  return rec;
}

function detectHardwareTier() {

  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (memory <= 4 || cores <= 4 || isMobile) {
    return 'LOW';
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)).toLowerCase();
        if (
          renderer.includes('intel') ||
          renderer.includes('uhd') ||
          renderer.includes('hd graphics') ||
          renderer.includes('iris') ||
          renderer.includes('mali') ||
          renderer.includes('adreno')
        ) {
          return 'LOW';
        }
        if (renderer.includes('rtx') || renderer.includes('rx 6') || renderer.includes('rx 7')) {
          return 'ULTRA';
        }
      }
    }
  } catch (_) {
    // Fallback if context query blocked
  }

  return memory >= 16 ? 'HIGH' : 'MEDIUM';
}
