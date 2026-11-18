import * as THREE from 'three';
import { Scenery } from './Scenery.js';
import { City } from './City.js';
import { assetUrl } from '../utils/assetUrl.js';

const SUN_OFFSET = new THREE.Vector3(22, 32, 24); // sun position relative to the shadow focus point
const SHADOW_HALF_SIZE = 22;

export class World {
  constructor(scene, renderer, assetLoader, physics, tierConfig) {
    this.scene = scene;
    this.renderer = renderer;
    this.assetLoader = assetLoader;
    this.physics = physics;
    this.tierConfig = tierConfig;

    this.sunLight = null;
    this.groundMaterial = null;
    this.spheres = [];
    this.usingFallbackHDRI = false;

    this._sunOffset = SUN_OFFSET.clone();
    this._dir = SUN_OFFSET.clone().normalize();
    this._fwd = this._dir.clone().negate();
    this._right = new THREE.Vector3().crossVectors(this._fwd, new THREE.Vector3(0, 1, 0)).normalize();
    this._up = new THREE.Vector3().crossVectors(this._right, this._fwd).normalize();
    this._center = new THREE.Vector3();
  }

  async init(interactionSystem) {
    this.scene.fog = new THREE.FogExp2(0xaebbc9, 0.0013);

    // 1. HDRI sky / IBL (fallback sky has its sun in the same direction as the light)
    const hdriResult = await this.assetLoader.loadHDRI(assetUrl('/assets/hdri/sky.hdr'), this._dir);
    this.usingFallbackHDRI = hdriResult.isFallback;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer.instance);
    pmremGenerator.compileEquirectangularShader();
    const envRT = pmremGenerator.fromEquirectangular(hdriResult.texture);

    this.scene.background = hdriResult.texture;
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = this.tierConfig.envMapIntensity;
    pmremGenerator.dispose();

    // 2. Sun with soft shadows that follow the hero (texel-snapped, see updateSun)
    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2.8);
    this.sunLight.position.copy(this._sunOffset);
    this.sunLight.castShadow = this.tierConfig.shadowsEnabled;

    const mapSize = this.tierConfig.shadowMapSize;
    this.sunLight.shadow.mapSize.set(mapSize, mapSize);
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 110.0;
    const d = SHADOW_HALF_SIZE;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(0xb8d0f0, 0x4a4f44, 0.42);
    this.scene.add(this.hemiLight);
    this.scenery = new Scenery(this.scene, this.tierConfig);
    this.scenery.build();

    // 3. PBR ground
    const maxAniso = this.renderer.getMaxAnisotropy();
    const [albedoMap, normalMap, roughnessMap] = await Promise.all([
      this.assetLoader.loadPBRTexture(assetUrl('/assets/textures/ground_albedo.jpg'), 'albedo', 32, maxAniso, true),
      this.assetLoader.loadPBRTexture(assetUrl('/assets/textures/ground_normal.jpg'), 'normal', 32, maxAniso, false),
      this.assetLoader.loadPBRTexture(assetUrl('/assets/textures/ground_roughness.jpg'), 'roughness', 32, maxAniso, false)
    ]);

    this.groundMaterial = new THREE.MeshStandardMaterial({
      map: albedoMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: roughnessMap,
      roughness: 1.0, // the roughness map is authoritative
      metalness: 0.08
    });

    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), this.groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    // The 160 m PBR slab used to sit on top of the city ground as a dark square with z-fighting stripes at its edges.
    // The city's macro-variation ground now covers the spawn too; flip this on only when real PBR ground assets exist.
    groundMesh.visible = !!window.__OZ_SPAWN_PBR_PATCH;
    this.scene.add(groundMesh);

    this.physics.createFixedGroundBox(1900, 0.5, 760);

    // Stage 0 PBR calibration grid, moved to the west side
    this.buildPBRSphereGrid(-12, 0);

    // Stage 1 locomotion / interaction course (proving ground at the spawn)
    this.buildLocomotionTestCourse(interactionSystem);

    // Gujranwala district: roads, canal, bridge, ~6000 buildings, landmarks (see CityData.js)
    this.city = new City(this.scene, this.physics, this.tierConfig, this.renderer.instance);
    this.city.build();

    this.updateSun(new THREE.Vector3(0, 0, 0));
  }

  /** Change the direction TOWARD the light (used by the day/night cycle). */
  setSunDirection(dir) {
    this._dir.copy(dir).normalize();
    this._sunOffset.copy(this._dir).multiplyScalar(SUN_OFFSET.length());
    this._fwd.copy(this._dir).negate();
    this._right.crossVectors(this._fwd, new THREE.Vector3(0, 1, 0)).normalize();
    this._up.crossVectors(this._right, this._fwd).normalize();
  }

  /** Move the shadow window with `focus`, snapped to whole shadow texels (no shimmering). */
  updateSun(focus) {
    if (!this.sunLight) return;

    const texel = (2 * SHADOW_HALF_SIZE) / this.sunLight.shadow.mapSize.width;
    const cx = focus.dot(this._right);
    const cy = focus.dot(this._up);
    const sx = Math.round(cx / texel) * texel;
    const sy = Math.round(cy / texel) * texel;

    this._center.copy(focus);
    this._center.addScaledVector(this._right, sx - cx);
    this._center.addScaledVector(this._up, sy - cy);

    this.sunLight.target.position.copy(this._center);
    this.sunLight.position.copy(this._center).add(this._sunOffset);
    this.sunLight.target.updateMatrixWorld();
  }

  buildPBRSphereGrid(offsetX = -12, offsetZ = 0) {
    const rows = 5;
    const cols = 5;
    const radius = 0.55;
    const spacing = 1.65;
    const sphereGeo = new THREE.SphereGeometry(radius, 36, 24);

    const startX = offsetX - ((cols - 1) * spacing) / 2;
    const startZ = offsetZ - ((rows - 1) * spacing) / 2;
    const palette = [0xe2e8f0, 0x38bdf8, 0xf59e0b, 0xef4444, 0x10b981];

    for (let r = 0; r < rows; r++) {
      const metalness = r / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const roughness = Math.max(0.05, c / (cols - 1));
        const mat = new THREE.MeshStandardMaterial({
          color: palette[r % palette.length],
          metalness,
          roughness
        });

        const x = startX + c * spacing;
        const y = radius;
        const z = startZ + r * spacing;

        const mesh = new THREE.Mesh(sphereGeo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.spheres.push(mesh);

        this.physics.createFixedSphere(x, y, z, radius);
      }
    }
  }

  buildLocomotionTestCourse(interactionSystem) {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75, metalness: 0.1 });
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.18 });

    const addStaticBox = (x, y, z, w, h, d, mat = concreteMat, rotEuler = null) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      if (rotEuler) mesh.rotation.copy(rotEuler);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.physics.createFixedBox(x, y, z, w / 2, h / 2, d / 2, rotEuler);
      return mesh;
    };

    // 1. Staircase: 10 steps x 0.22 m (autostep + foot IK test)
    const stepCount = 13; // real stair: rise 0.17 m, going 0.28 m
    const stepHeight = 0.17;
    const stepDepth = 0.28;
    for (let i = 0; i < stepCount; i++) {
      const h = (i + 1) * stepHeight;
      addStaticBox(0, h / 2, -2.5 - i * stepDepth, 3.2, h, stepDepth);
    }

    // Top deck (wide enough to receive both the stairs and the ramp)
    const topHeight = stepCount * stepHeight;
    addStaticBox(1.0, topHeight / 2, -8.25, 10.0, topHeight, 4.5);

    // 2. 22 degree ramp east of the stairs, rising towards -z, meeting the deck
    const rampEuler = new THREE.Euler((22 * Math.PI) / 180, 0, 0);
    addStaticBox(3.6, topHeight / 2 - 0.18, -4.4, 2.4, 0.3, 6.2, rampMat, rampEuler);

    // 3. Camera spring-arm corridor
    addStaticBox(5.5, 1.5, 0, 0.4, 3.0, 7.0);
    addStaticBox(8.2, 1.5, 0, 0.4, 3.0, 7.0);

    // 4. Doorway frame + hinged door
    addStaticBox(-4.5, 1.4, -2.0, 1.2, 2.8, 0.35);
    addStaticBox(-1.9, 1.4, -2.0, 1.2, 2.8, 0.35);
    addStaticBox(-3.2, 2.6, -2.0, 1.6, 0.4, 0.35);

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.45 });
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.35, 0.12), doorMat);
    doorMesh.position.set(-3.2, 1.18, -2.0);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    this.scene.add(doorMesh);

    const doorPhysics = this.physics.createKinematicBox(-3.2, 1.18, -2.0, 0.675, 1.175, 0.06);

    if (!interactionSystem) return;

    const doorObj = {
      mesh: doorMesh,
      isOpen: false,
      angle: 0,
      hingeX: -3.875,
      hingeZ: -2.0,
      _q: new THREE.Quaternion(),
      _e: new THREE.Euler(),
      getPrompt() {
        return this.isOpen ? 'Close Security Door (E)' : 'Open Security Door (E)';
      },
      onInteract() {
        this.isOpen = !this.isOpen;
      },
      update(dt) {
        const targetAngle = this.isOpen ? Math.PI * 0.52 : 0;
        this.angle += (targetAngle - this.angle) * Math.min(1, dt * 8);
        const radius = 0.675;
        const cx = this.hingeX + Math.cos(this.angle) * radius;
        const cz = this.hingeZ - Math.sin(this.angle) * radius;

        this.mesh.position.set(cx, 1.18, cz);
        this.mesh.rotation.y = this.angle;

        this._q.setFromEuler(this._e.set(0, this.angle, 0));
        doorPhysics.body.setNextKinematicTranslation({ x: cx, y: 1.18, z: cz });
        doorPhysics.body.setNextKinematicRotation({ x: this._q.x, y: this._q.y, z: this._q.z, w: this._q.w });
      }
    };
    interactionSystem.register(doorObj);

    // 5. Supply crate (pick up / drop / throw)
    const pickupMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55, metalness: 0.25 })
    );
    pickupMesh.position.set(2.2, 0.3, 2.5);
    pickupMesh.castShadow = true;
    pickupMesh.receiveShadow = true;
    this.scene.add(pickupMesh);
    const pickupPhys = this.physics.createDynamicBox(pickupMesh, 0.275, 0.275, 0.275, 6.0);

    interactionSystem.register({
      mesh: pickupMesh,
      physicsEntry: pickupPhys,
      getPrompt() {
        return 'Pick Up Supply Crate (E)';
      },
      onInteract(sys) {
        sys.pickUp(this);
      }
    });

    // 6. Heavy crate (push)
    const heavyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.0, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6, metalness: 0.3 })
    );
    heavyMesh.position.set(-2.2, 0.5, 2.5);
    heavyMesh.castShadow = true;
    heavyMesh.receiveShadow = true;
    this.scene.add(heavyMesh);
    const heavyPhys = this.physics.createDynamicBox(heavyMesh, 0.5, 0.5, 0.5, 28.0);

    interactionSystem.register({
      mesh: heavyMesh,
      physicsEntry: heavyPhys,
      getPrompt() {
        return 'Push Heavy Crate (E or G)  -  or just walk into it';
      },
      onInteract(_sys, _pPos, camDir) {
        this.onPush(camDir);
      },
      onPush(camDir) {
        const len = Math.hypot(camDir.x, camDir.z) || 1;
        heavyPhys.body.applyImpulse({ x: (camDir.x / len) * 115, y: 8, z: (camDir.z / len) * 115 }, true);
      }
    });
  }


  /** Shooting range with pop-up style dummies (south of the spawn, z = +16). */
  registerCombat(combat) {
    const scene = this.scene;
    const physics = this.physics;
    const THREE_ = THREE;
    const bodyMat = new THREE_.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.7, metalness: 0.1 });
    const flashMat = new THREE_.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4, emissive: 0xff2010, emissiveIntensity: 0.0 });

    // backstop wall + range floor markers
    const wall = new THREE_.Mesh(new THREE_.BoxGeometry(16, 4, 0.5), new THREE_.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.9 }));
    wall.position.set(0, 2, 25);
    wall.castShadow = wall.receiveShadow = true;
    scene.add(wall);
    physics.createFixedBox(0, 2, 25, 8, 2, 0.25);
    for (const z of [10, 14, 18, 22]) {
      const line = new THREE_.Mesh(new THREE_.PlaneGeometry(14, 0.12), new THREE_.MeshBasicMaterial({ color: 0xe5e7eb }));
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.012, z);
      scene.add(line);
    }

    const spots = [
      [-5, 14], [-2.5, 18], [0, 22], [2.5, 18], [5, 14], [-3, 22], [3, 22]
    ];
    for (const [x, z] of spots) {
      const g = new THREE_.Group();
      g.position.set(x, 0, z);
      g.rotation.y = Math.PI; // face the shooter (+z is south, shooter looks +z)
      const pivot = new THREE_.Group(); // pivots at the feet for knock-down
      g.add(pivot);
      const mats = [];
      const mk = (geo, y) => {
        const m = new THREE_.Mesh(geo, bodyMat.clone());
        m.position.y = y;
        m.castShadow = true;
        m.receiveShadow = true;
        pivot.add(m);
        mats.push(m);
        return m;
      };
      mk(new THREE_.CapsuleGeometry(0.24, 0.8, 8, 16), 1.0);
      mk(new THREE_.SphereGeometry(0.15, 20, 16), 1.72);
      const plate = new THREE_.Mesh(
        new THREE_.CircleGeometry(0.2, 24),
        new THREE_.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
      );
      plate.position.set(0, 1.12, 0.25);
      plate.rotation.y = 0;
      pivot.add(plate);
      const ring = new THREE_.Mesh(new THREE_.CircleGeometry(0.1, 24), flashMat.clone());
      ring.position.set(0, 1.12, 0.252);
      pivot.add(ring);
      const post = new THREE_.Mesh(new THREE_.CylinderGeometry(0.03, 0.03, 0.5, 8), bodyMat);
      post.position.y = 0.25;
      post.castShadow = true;
      g.add(post);
      scene.add(g);

      const phys = physics.createFixedBox(x, 1.0, z, 0.3, 1.0, 0.22);
      const target = {
        hp: 60,
        down: 0,
        flash: 0,
        fall: 0,
        radius: 0.45,
        getCenter: () => new THREE_.Vector3(x, 1.1, z),
        onHit(dmg) {
          if (this.down > 0) return;
          this.hp -= dmg;
          this.flash = 0.12;
          if (this.hp <= 0) {
            this.down = 3.5;
            combat.kills += 1;
          }
        }
      };
      combat.addTarget(phys.collider, target);
      
      // simple per-frame animation hook
      (this._rangeTargets ||= []).push({ target, pivot, ring, mats });
    }
  }

  updateRange(dt) {
    if (!this._rangeTargets) return;
    for (const r of this._rangeTargets) {
      const t = r.target;
      if (t.flash > 0) t.flash -= dt;
      if (t.down > 0) {
        t.down -= dt;
        t.fall = Math.min(1, t.fall + dt * 5);
        if (t.down <= 0) {
          t.hp = 60;
        }
      } else {
        t.fall = Math.max(0, t.fall - dt * 2.5);
      }
      r.pivot.rotation.x = -t.fall * 1.45;
      const f = t.flash > 0 ? 1 : 0;
      r.ring.material.emissiveIntensity = f * 2.0;
      for (const m of r.mats) m.material.emissive.setRGB(f * 0.5, f * 0.1, f * 0.05);
    }
  }

  applyTier(tierConfig) {
    this.tierConfig = tierConfig;
    if (!this.weather) this.scene.environmentIntensity = tierConfig.envMapIntensity;

    if (this.sunLight) {
      this.sunLight.castShadow = tierConfig.shadowsEnabled;
      if (this.sunLight.shadow.mapSize.width !== tierConfig.shadowMapSize) {
        this.sunLight.shadow.mapSize.set(tierConfig.shadowMapSize, tierConfig.shadowMapSize);
        if (this.sunLight.shadow.map) {
          this.sunLight.shadow.map.dispose();
          this.sunLight.shadow.map = null;
        }
      }
    }

    const maxAniso = this.renderer.getMaxAnisotropy();
    if (this.groundMaterial) {
      ['map', 'normalMap', 'roughnessMap'].forEach((key) => {
        if (this.groundMaterial[key]) {
          this.groundMaterial[key].anisotropy = maxAniso;
          this.groundMaterial[key].needsUpdate = true;
        }
      });
    }
  }
}
