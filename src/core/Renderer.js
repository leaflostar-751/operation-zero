import * as THREE from 'three';

export class Renderer {
  constructor(container, initialTierConfig) {
    this.container = container;
    this.currentTier = initialTierConfig;

    this.instance = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: initialTierConfig.name !== 'LOW',
      stencil: false,
      depth: true
    });

    // Post-processing renders several passes per frame; we reset the stats
    // manually once per frame so the F3 draw-call counter shows the real total.
    this.instance.info.autoReset = false;

    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.05;

    this.instance.shadowMap.enabled = initialTierConfig.shadowsEnabled;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.instance.domElement);
    this.applyResize();
  }

  applyTier(tierConfig) {
    this.currentTier = tierConfig;
    this.instance.shadowMap.enabled = tierConfig.shadowsEnabled;
    this.instance.shadowMap.needsUpdate = true;
    this.applyResize();
  }

  applyResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const basePixelRatio = Math.min(window.devicePixelRatio || 1, this.currentTier.maxPixelRatio);
    const effectiveRatio = Math.max(0.5, basePixelRatio * this.currentTier.resolutionScale);

    this.instance.setPixelRatio(effectiveRatio);
    this.instance.setSize(width, height);
  }

  getMaxAnisotropy() {
    const hwMax = this.instance.capabilities.getMaxAnisotropy();
    return Math.min(hwMax, this.currentTier.maxAnisotropy);
  }
}
