import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const CinemaLensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uGrainIntensity: { value: 0.012 },
    uSat: { value: 1.08 },
    uContrast: { value: 1.1 },
    uShadowTint: { value: new THREE.Color(0.94, 1.0, 1.06) },
    uHighTint: { value: new THREE.Color(1.05, 1.0, 0.94) },
    uVignetteOffset: { value: 0.95 },
    uVignetteDarkness: { value: 1.15 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrainIntensity;
    uniform float uVignetteOffset;
    uniform float uVignetteDarkness;
    uniform float uSat, uContrast;
    uniform vec3 uShadowTint, uHighTint;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);

      // Subtle vignette
      vec2 uv = (vUv - vec2(0.5)) * vec2(uVignetteOffset);
      float vig = clamp(1.0 - dot(uv, uv) * uVignetteDarkness, 0.0, 1.0);
      texel.rgb *= mix(0.65, 1.0, vig);

      // Subtle film grain (kept in HDR range: lower clamp only, so bloom/ACES keep highlights)
      float luma0 = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
      float noise = (rand(vUv) - 0.5) * uGrainIntensity * smoothstep(0.02, 0.4, luma0);
      texel.rgb = max(texel.rgb + vec3(noise), vec3(0.0));

      // colour grade (before tone mapping): split-tone, saturation, contrast around mid grey
      texel.rgb *= mix(uShadowTint, uHighTint, smoothstep(0.05, 0.8, luma0));
      float l = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
      texel.rgb = mix(vec3(l), texel.rgb, uSat);
      texel.rgb = max((texel.rgb - 0.18) * uContrast + 0.18, vec3(0.0));

      gl_FragColor = texel;
    }
  `
};

export class PostProcessing {
  constructor(renderer, scene, camera, tierConfig) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.tierConfig = tierConfig;
    this.ssaoPass = null; // created lazily, only when a tier needs it (saves GPU memory on LOW/MEDIUM)

    const size = new THREE.Vector2();
    this.renderer.instance.getDrawingBufferSize(size);

    // HDR half-float target; MSAA samples are applied per tier in applyTier()
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: tierConfig.msaaSamples || 0
    });

    this.composer = new EffectComposer(this.renderer.instance, target);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.28, // strength
      0.45, // radius
      0.85  // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.cinemaPass = new ShaderPass(CinemaLensShader);
    this.composer.addPass(this.cinemaPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.applyTier(tierConfig);
  }

  ensureSSAO() {
    if (this.ssaoPass) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.ssaoPass = new SSAOPass(this.scene, this.camera, width, height);
    this.ssaoPass.kernelRadius = 6;
    this.ssaoPass.minDistance = 0.002;
    this.ssaoPass.maxDistance = 0.08;
    // SSAO must come right after the RenderPass
    this.composer.insertPass(this.ssaoPass, 1);
  }

  applyTier(tierConfig) {
    this.tierConfig = tierConfig;
    this.enabled = Boolean(tierConfig.postProcessing);

    const wantSSAO = Boolean(tierConfig.postProcessing && tierConfig.ssao);
    if (wantSSAO) this.ensureSSAO();
    if (this.ssaoPass) this.ssaoPass.enabled = wantSSAO;

    this.bloomPass.enabled = Boolean(tierConfig.postProcessing && tierConfig.bloom);
    this.cinemaPass.enabled = Boolean(tierConfig.postProcessing && tierConfig.vignetteAndGrain);

    // MSAA on the HDR composer targets (the canvas "antialias" flag does not
    // apply to render targets, so without this post-processing tiers have jagged edges)
    const samples = tierConfig.msaaSamples || 0;
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt.samples !== samples) {
        rt.samples = samples;
        rt.dispose();
      }
    }

    this.handleResize();
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = this.renderer.instance.getPixelRatio();

    // EffectComposer.setSize resizes every pass (including SSAO) itself
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render(dt, elapsedTime) {
    this.renderer.instance.info.reset();

    if (!this.enabled) {
      this.renderer.instance.render(this.scene, this.camera);
      return;
    }
    if (this.cinemaPass.enabled) {
      this.cinemaPass.uniforms.uTime.value = elapsedTime % 100.0;
    }
    this.composer.render(dt);
  }
}
