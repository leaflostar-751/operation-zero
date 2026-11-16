import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export class AssetLoader {
  constructor(rendererInstance, onProgressCallback) {
    this.renderer = rendererInstance;
    this.onProgressCallback = onProgressCallback;
    this.missingAssets = [];

    this.manager = new THREE.LoadingManager();
    this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const pct = itemsTotal > 0 ? Math.round((itemsLoaded / itemsTotal) * 100) : 100;
      if (this.onProgressCallback) {
        this.onProgressCallback(pct, `Loading: ${url.split('/').pop()}`);
      }
    };

    // Draco & KTX2 use local decoder bundles (copied by scripts/copy-decoders.mjs)
    this.dracoLoader = new DRACOLoader(this.manager);
    this.dracoLoader.setDecoderPath('/assets/decoders/draco/');

    this.ktx2Loader = new KTX2Loader(this.manager);
    this.ktx2Loader.setTranscoderPath('/assets/decoders/basis/');
    this.ktx2Loader.detectSupport(this.renderer);

    this.gltfLoader = new GLTFLoader(this.manager);
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    this.gltfLoader.setKTX2Loader(this.ktx2Loader);

    this.fbxLoader = new FBXLoader(this.manager);
    this.textureLoader = new THREE.TextureLoader(this.manager);
    this.rgbeLoader = new RGBELoader(this.manager);
    this.exrLoader = new EXRLoader(this.manager);
  }

  async probeFileExists(url) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (!res.ok) return false;
      const contentType = res.headers.get('content-type') || '';
      // Vite dev server returns text/html for SPA fallback on missing paths
      if (contentType.includes('text/html')) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * @param {string} url      /assets/hdri/sky.hdr (or .exr)
   * @param {THREE.Vector3} sunDir  direction TOWARD the sun; used so the fallback sky's
   *                                sun matches the directional light (and its shadows)
   */
  async loadHDRI(url, sunDir) {
    const exists = await this.probeFileExists(url);
    if (exists) {
      try {
        const isExr = url.toLowerCase().endsWith('.exr');
        const loader = isExr ? this.exrLoader : this.rgbeLoader;
        const tex = await loader.loadAsync(url);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        return { texture: tex, isFallback: false };
      } catch (_) {
        this.missingAssets.push(url);
      }
    } else {
      this.missingAssets.push(url);
    }

    return { texture: this.createProceduralHDRI(sunDir), isFallback: true };
  }

  async loadPBRTexture(url, fallbackType, repeat = 16, maxAnisotropy = 4, isSRGB = false) {
    const exists = await this.probeFileExists(url);
    let tex = null;

    if (exists) {
      try {
        tex = await this.textureLoader.loadAsync(url);
      } catch (_) {
        this.missingAssets.push(url);
      }
    } else {
      this.missingAssets.push(url);
    }

    if (!tex) {
      tex = this.createProceduralTexture(fallbackType);
    }

    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = maxAnisotropy;
    tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;

    return tex;
  }

  async loadGLB(url) {
    return this.gltfLoader.loadAsync(url);
  }

  /**
   * Loads the hero model from <basePath>.glb or <basePath>.fbx (whichever exists).
   * @returns {Promise<THREE.Object3D|null>}
   */
  async loadCharacterModel(basePath) {
    const glbUrl = `${basePath}.glb`;
    const fbxUrl = `${basePath}.fbx`;

    if (await this.probeFileExists(glbUrl)) {
      try {
        const gltf = await this.gltfLoader.loadAsync(glbUrl);
        return gltf.scene;
      } catch (err) {
        console.warn('[AssetLoader] failed to load', glbUrl, err);
        this.missingAssets.push(glbUrl);
      }
    }
    if (await this.probeFileExists(fbxUrl)) {
      try {
        return await this.fbxLoader.loadAsync(fbxUrl);
      } catch (err) {
        console.warn('[AssetLoader] failed to load', fbxUrl, err);
        this.missingAssets.push(fbxUrl);
      }
    }
    this.missingAssets.push(glbUrl);
    return null;
  }

  /**
   * Loads one Mixamo animation from .glb or .fbx. `candidateBasePaths` lets one state
   * accept several file names (e.g. crouch-walk and crouch_walk).
   * @returns {Promise<THREE.AnimationClip|null>}
   */
  async loadAnimationClip(candidateBasePaths, clipName) {
    const paths = Array.isArray(candidateBasePaths) ? candidateBasePaths : [candidateBasePaths];

    for (const basePath of paths) {
      const glbUrl = `${basePath}.glb`;
      const fbxUrl = `${basePath}.fbx`;

      if (await this.probeFileExists(glbUrl)) {
        try {
          const gltf = await this.gltfLoader.loadAsync(glbUrl);
          if (gltf.animations && gltf.animations.length > 0) {
            const clip = gltf.animations[0];
            clip.name = clipName;
            return clip;
          }
        } catch (err) {
          console.warn('[AssetLoader] failed to load', glbUrl, err);
        }
      }

      if (await this.probeFileExists(fbxUrl)) {
        try {
          const fbx = await this.fbxLoader.loadAsync(fbxUrl);
          if (fbx.animations && fbx.animations.length > 0) {
            const clip = fbx.animations[0];
            clip.name = clipName;
            return clip;
          }
        } catch (err) {
          console.warn('[AssetLoader] failed to load', fbxUrl, err);
        }
      }
    }

    this.missingAssets.push(`${paths[0]}.fbx|glb`);
    return null;
  }

  /**
   * Upgrades character materials to realistic PBR:
   * - skin gets a subsurface-style rim scatter approximation (injected AFTER the light loop,
   *   where reflectedLight is in scope)
   * - hair cards use alphaTest 0.5 + DoubleSide + depthWrite
   */
  applyCharacterPBRMaterials(rootObject) {
    rootObject.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      // Skinned bounds are computed from the bind pose; never cull the hero by them
      if (child.isSkinnedMesh) child.frustumCulled = false;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (!mat || !mat.isMeshStandardMaterial) continue;
        const matName = (mat.name || child.name || '').toLowerCase();
        const isSkin =
          matName.includes('skin') ||
          matName.includes('head') ||
          matName.includes('face') ||
          matName.includes('body');
        const isHair =
          matName.includes('hair') ||
          matName.includes('brow') ||
          matName.includes('lash') ||
          matName.includes('beard');

        if (isHair) {
          mat.alphaTest = 0.5;
          mat.transparent = false;
          mat.side = THREE.DoubleSide;
          mat.depthWrite = true;
          mat.roughness = 0.45;
        } else if (isSkin) {
          mat.roughness = 0.52;
          mat.metalness = 0.02;
          mat.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <lights_fragment_end>',
              `
              #include <lights_fragment_end>
              float sssRim = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 2.0);
              reflectedLight.indirectDiffuse += vec3(0.16, 0.045, 0.025) * sssRim * diffuseColor.rgb * 0.8;
              `
            );
          };
          mat.customProgramCacheKey = () => 'opzero-skin-sss';
        }
        mat.needsUpdate = true;
      }
    });
  }

  /**
   * Procedural fallback sky (half-float HDR so it filters smoothly, no pixelation).
   * Uses three.js's exact equirect convention:
   *   u = atan2(dir.z, dir.x) / 2PI + 0.5 ,  v = asin(dir.y) / PI + 0.5
   */
  createProceduralHDRI(sunDirection) {
    const width = 1024;
    const height = 512;
    const data = new Uint16Array(width * height * 4);
    const toHalf = THREE.DataUtils.toHalfFloat;

    const sunDir = (sunDirection ? sunDirection.clone() : new THREE.Vector3(0.55, 0.45, 0.7)).normalize();
    const dir = new THREE.Vector3();

    for (let y = 0; y < height; y++) {
      const v = (y + 0.5) / height;
      const lat = (v - 0.5) * Math.PI; // -90deg (down) .. +90deg (up)
      const sinLat = Math.sin(lat);
      const cosLat = Math.cos(lat);

      for (let x = 0; x < width; x++) {
        const u = (x + 0.5) / width;
        const phi = (u - 0.5) * Math.PI * 2.0;

        dir.set(Math.cos(phi) * cosLat, sinLat, Math.sin(phi) * cosLat);

        let r, g, b;
        if (dir.y >= 0) {
          const zenith = Math.pow(dir.y, 0.55);
          r = THREE.MathUtils.lerp(0.85, 0.16, zenith);
          g = THREE.MathUtils.lerp(0.92, 0.36, zenith);
          b = THREE.MathUtils.lerp(1.15, 0.78, zenith);

          const sunAmt = Math.max(0.0, dir.dot(sunDir));
          const sunGlow = Math.pow(sunAmt, 24.0) * 2.2 + Math.pow(sunAmt, 380.0) * 12.0;
          r += sunGlow * 1.1;
          g += sunGlow * 0.98;
          b += sunGlow * 0.82;
        } else {
          const groundFactor = Math.min(1.0, -dir.y * 3.0);
          r = THREE.MathUtils.lerp(0.28, 0.08, groundFactor);
          g = THREE.MathUtils.lerp(0.3, 0.09, groundFactor);
          b = THREE.MathUtils.lerp(0.34, 0.11, groundFactor);
        }

        const idx = (y * width + x) * 4;
        data[idx] = toHalf(r);
        data[idx + 1] = toHalf(g);
        data[idx + 2] = toHalf(b);
        data[idx + 3] = toHalf(1.0);
      }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  createProceduralTexture(type) {
    const size = 256;
    const data = new Uint8Array(size * size * 4);

    for (let i = 0; i < size * size; i++) {
      const idx = i * 4;
      const grain = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;

      if (type === 'albedo') {
        // concrete slabs: fine grain + thin joints every 128 px (tileable)
        const x = i % size;
        const y = Math.floor(i / size);
        const joint = x % 128 < 2 || y % 128 < 2 ? 0.55 : 1;
        const low = (Math.sin(x * 0.049) + Math.sin(y * 0.037) + Math.sin((x + y) * 0.024)) * 3;
        const base = (62 + Math.floor(grain * 16) + low) * joint;
        data[idx] = base;
        data[idx + 1] = base + 1;
        data[idx + 2] = base + 3;
        data[idx + 3] = 255;
      } else if (type === 'normal') {
        data[idx] = 124 + Math.floor(grain * 8);
        data[idx + 1] = 124 + Math.floor((1 - grain) * 8);
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      } else if (type === 'roughness') {
        // Wet-surface variation (puddles vs rough asphalt)
        const x = i % size;
        const y = Math.floor(i / size);
        const rough = 170 + Math.floor(grain * 40) + (x % 128 < 2 || y % 128 < 2 ? 30 : 0);
        data[idx] = rough;
        data[idx + 1] = rough;
        data[idx + 2] = rough;
        data[idx + 3] = 255;
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    // Mipmaps + trilinear: without these the tiled ground shimmers/aliases at distance
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
}
