import * as THREE from 'three';
import { QUALITY_TIERS, detectDefaultQualityTier } from './core/QualityConfig.js';
import { Renderer } from './core/Renderer.js';
import { PostProcessing } from './core/PostProcessing.js';
import { AssetLoader } from './core/AssetLoader.js';
import { Physics } from './core/Physics.js';
import { Input } from './core/Input.js';
import { GameLoop } from './core/GameLoop.js';
import { World } from './world/World.js';
import { CharacterController, CameraController, InteractionSystem, CombatSystem, ZombieSystem } from './characters/index.js';
import { loadVehicleManifest } from './vehicles/VehicleImporter.js';
import { VehicleSystem } from './vehicles/VehicleSystem.js';
import { DebugOverlay } from './ui/DebugOverlay.js';
import { SettingsMenu } from './ui/SettingsMenu.js';
import { TestChecklist } from './ui/TestChecklist.js';
import { Minimap } from './ui/Minimap.js';
import { installOzDebug } from './debug/OzDebug.js';
import { GokuPartner, installGokuApi } from './ai/GokuPartner.js';
import { WeatherSystem } from './world/WeatherSystem.js';

class OperationZeroApp {
  constructor() {
    this.container = document.getElementById('app');
    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingBar = document.getElementById('loading-bar');
    this.loadingStatus = document.getElementById('loading-status');
    this.loadingPercent = document.getElementById('loading-percent');

    this.hpBar = document.getElementById('hud-hp-bar');
    this.hpVal = document.getElementById('hud-hp-val');
    this.stmBar = document.getElementById('hud-stm-bar');
    this.stmVal = document.getElementById('hud-stm-val');
    this.animStateEl = document.getElementById('hud-anim-state');
    this.camModeEl = document.getElementById('hud-cam-mode');

    this.activeTierName = detectDefaultQualityTier();
    this.activeTier = QUALITY_TIERS[this.activeTierName];

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.15,
      Math.max(3200, this.activeTier.drawDistance)
    );

    // One-shot actions are latched here so they are consumed by exactly one fixed step,
    // even when a display frame runs zero or several simulation steps.
    this.pending = {
      jump: false, crouch: false, interact: false, push: false,
      reload: false, punch: false, kick: false, weapon: false,
      zombie: false, infect: false, vehicle: false, stow: false
    };
    this.stepInput = {};
    this.hudTimer = 0;

    this.init().catch((err) => this.showFatalError(err));
  }

  updateLoadingUI(percent, message) {
    if (this.loadingBar) this.loadingBar.style.width = `${percent}%`;
    if (this.loadingPercent) this.loadingPercent.textContent = `${percent}%`;
    if (message && this.loadingStatus) this.loadingStatus.textContent = message;
  }

  showFatalError(err) {
    console.error('[OPERATION ZERO] Startup failed:', err);
    this.loadingScreen.style.display = '';
    this.loadingScreen.classList.remove('fade-out');
    if (this.loadingStatus) {
      this.loadingStatus.classList.add('error');
      this.loadingStatus.textContent =
        'Startup failed: ' + (err && err.message ? err.message : String(err)) +
        ' (press F12 and open Console for details; WebGL2 / hardware acceleration must be enabled)';
    }
  }

  async init() {
    this.updateLoadingUI(10, 'Initializing WebGL2 Renderer...');
    this.renderer = new Renderer(this.container, this.activeTier);
    if (!this.renderer.instance.capabilities.isWebGL2) {
      throw new Error('WebGL2 is not available on this browser/GPU');
    }

    this.updateLoadingUI(25, 'Initializing Rapier 3D Physics WASM...');
    this.physics = new Physics(this.scene);
    await this.physics.init();

    this.assetLoader = new AssetLoader(this.renderer.instance, (pct, msg) => {
      this.updateLoadingUI(30 + Math.round(pct * 0.55), msg);
    });

    this.interactionSystem = new InteractionSystem(this.camera, this.physics);

    this.updateLoadingUI(40, 'Building World & Obstacle Course...');
    this.world = new World(this.scene, this.renderer, this.assetLoader, this.physics, this.activeTier);
    await this.world.init(this.interactionSystem);

    this.updateLoadingUI(70, 'Loading Hero Character & Mixamo Animations...');
    this.hero = new CharacterController(this.scene, this.physics, this.assetLoader, this.activeTier);
    await this.hero.init();

    this.cameraController = new CameraController(this.camera, this.physics);
    this.combat = new CombatSystem(this.scene, this.physics, this.camera, this.hero, this.cameraController);
    this.world.registerCombat?.(this.combat);
    this.zombies = new ZombieSystem(this.scene, this.physics, this.hero, this.combat);
    this.zombies.city = this.world.city; // spawn avoidance of buildings
    // zombie yard (west-south): a few idle walkers and one person who is about to turn
    this.zombies.spawnZombie(-20, 18, { seed: 11 });
    this.zombies.spawnZombie(-23, 21, { seed: 12 });
    this.zombies.spawnZombie(-18, 23, { seed: 13, runner: true });
    this.zombies.spawnInfected(-10, 13, 'executive');

    // parking pad (east): 4 cars + a superbike, all drivable (walk to a door, press Y)
    await loadVehicleManifest(this.assetLoader.gltfLoader);
    this.vehicles = new VehicleSystem(this.scene, this.physics, this.camera, this.hero, this.cameraController, this.combat);
    this.vehicles.getCity = () => this.world.city;
    // GOKU partner player (O = on/off, K = follow / explore / hold)
    this.goku = new GokuPartner({ scene: this.scene, physics: this.physics, hero: this.hero, zombies: this.zombies, vehicles: this.vehicles, getCity: () => this.world.city, assetLoader: this.assetLoader });
    await this.goku.init();
    installGokuApi(this.goku);
    const HALF_PI = Math.PI / 2;
    this.vehicles.spawn('apex-gt', 18, 4, HALF_PI);
    this.vehicles.spawn('stallion', 18, 10, HALF_PI);
    this.vehicles.spawn('ranger', 18, 16, HALF_PI);
    this.vehicles.spawn('vortex', 18, 22, HALF_PI);
    this.vehicles.spawn('sprint-r', 24, 7, HALF_PI);

    this.interactionSystem.hero = this.hero;
    this.interactionSystem.onPickUp = () => this.hero.playPickup();

    this.updateLoadingUI(95, 'Configuring Post-Processing Pipeline...');
    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera, this.activeTier);

    this.input = new Input();
    this.debugOverlay = new DebugOverlay(this.renderer, this.physics, () => this.activeTierName);
    this.testChecklist = new TestChecklist();
    this.minimap = new Minimap(this.world.city);
    this.weather = new WeatherSystem(this.scene, this.camera, this.world, this.activeTierName);
    this.world.weather = this.weather;
    this.zombies.sense = this.weather.sense;
    this.weather.grade = this.postProcessing.cinemaPass.uniforms;

    this.settingsMenu = new SettingsMenu(
      this.activeTierName,
      (newTierName) => this.applyQualityTier(newTierName),
      this.physics,
      () => {
        this.physics.setDebugEnabled(!this.physics.debugEnabled);
        this.debugOverlay.syncColliderButton();
      }
    );

    this.bindUIEvents();

    if (this.assetLoader.missingAssets.length > 0) {
      console.info(
        '[OPERATION ZERO] Built-in fallbacks in use for (add real files, see README):',
        this.assetLoader.missingAssets
      );
    }

    this.updateLoadingUI(100, 'Ready');
    setTimeout(() => this.loadingScreen.classList.add('fade-out'), 250);
    setTimeout(() => { this.loadingScreen.style.display = 'none'; }, 900); // remove the layer completely once faded (no leftover outline)

    this.gameLoop = new GameLoop(
      (fixedDt) => this.fixedUpdate(fixedDt),
      (dt, elapsed, alpha) => this.render(dt, elapsed, alpha)
    );
    this.gameLoop.start();
  }

  applyQualityTier(tierName) {
    const tier = QUALITY_TIERS[tierName];
    if (!tier) return;
    this.activeTierName = tierName;
    this.activeTier = tier;

    this.camera.far = Math.max(3200, tier.drawDistance);
    this.camera.updateProjectionMatrix();

    this.renderer.applyTier(tier);
    this.world.applyTier(tier);
    this.weather?.applyTier(tierName);
    this.postProcessing.applyTier(tier);
  }

  toggleCameraMode() {
    const mode = this.cameraController.toggleMode(null);
    this.hero.setFirstPerson(mode === 'FIRST_PERSON');
    if (this.camModeEl) this.camModeEl.textContent = mode === 'FIRST_PERSON' ? '1ST' : '3RD';
  }

  bindUIEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.applyResize();
      this.postProcessing.handleResize();
    });

    document.getElementById('btn-toggle-cam')?.addEventListener('click', () => this.toggleCameraMode());
    document.getElementById('btn-toggle-checklist')?.addEventListener('click', () => this.testChecklist.toggle());
    document.getElementById('btn-toggle-debug')?.addEventListener('click', () => this.debugOverlay.toggle());
    document.getElementById('btn-toggle-settings')?.addEventListener('click', () => this.settingsMenu.toggle());
  }

  /** 60 Hz: character simulation, interactions, then physics. */
  fixedUpdate(fixedDt) {
    const s = this.input.state;
    const p = this.pending;
    const step = this.stepInput;

    step.moveX = s.moveX;
    step.moveY = s.moveY;
    step.sprint = s.sprint;
    step.walk = s.walk;
    step.jumpJustPressed = p.jump;
    step.crouchJustPressed = p.crouch;
    step.interactJustPressed = p.interact;
    step.pushJustPressed = p.push;
    step.fire = s.fire;
    step.aim = s.aim;
    step.reloadJustPressed = p.reload;
    step.punchJustPressed = p.punch;
    step.kickJustPressed = p.kick;
    step.weaponToggleJustPressed = p.weapon;
    p.jump = p.crouch = p.interact = p.push = false;
    p.reload = p.punch = p.kick = p.weapon = false;

    step.vehicleJustPressed = p.vehicle;
    step.stowJustPressed = p.stow;
    if (p.zombie) this.zombies.spawnWave(3, 12);
    if (p.infect) this.zombies.spawnInfectedAhead();
    p.zombie = p.infect = p.vehicle = p.stow = false;

    step.handbrake = s.handbrake;
    if (this.testChecklist.visible || this.settingsMenu.visible) {
      // menus pause gameplay input (character stands still, no accidental shots)
      step.moveX = step.moveY = 0;
      step.sprint = step.fire = step.aim = step.handbrake = false;
      step.jumpJustPressed = step.crouchJustPressed = step.interactJustPressed = step.reloadJustPressed = step.punchJustPressed = step.kickJustPressed = step.vehicleJustPressed = false;
    }
    this.vehicles.update(fixedDt, step);
    this.combat.update(fixedDt, step);
    this.hero.update(fixedDt, step, this.cameraController.yaw);
    this.vehicles.applyPose(fixedDt);
    this.interactionSystem.update(fixedDt, this.hero.position, this.cameraController.yaw, step);
    this.zombies.update(fixedDt);
    this.physics.step();
  }

  /** Once per displayed frame: input, camera, interpolation, HUD, drawing. */
  render(dt, elapsed, alpha) {
    this.input.update();
    const s = this.input.state;

    if (this.input.consumeJustPressed('F2')) this.testChecklist.toggle();
    if (this.input.consumeJustPressed('F3')) this.debugOverlay.toggle();
    if (this.goku && this.input.consumeJustPressed('KeyO')) this.goku.setEnabled(!this.goku.enabled);
    if (this.goku && this.input.consumeJustPressed('KeyK')) { const order = ['follow', 'explore', 'hold']; this.goku.command({ type: order[(order.indexOf(this.goku.mode) + 1) % order.length] }); }
    if (this.input.consumeJustPressed('F1')) document.body.classList.toggle('dev-hud');
    if (this.input.consumeJustPressed('KeyM')) this.toggleMap3D();
    if (this.map3d?.on) { // map open: the hero stands still, mouse drags the map
      s.moveX = 0; s.moveY = 0; s.lookX = 0; s.lookY = 0; s.fire = false; s.aim = false; s.sprint = false;
      for (const k of Object.keys(s)) if (k.endsWith('JustPressed')) s[k] = false;
    }
    if (this.input.consumeJustPressed('Period')) this.weather?.nextWeather();
    if (this.input.consumeJustPressed('Comma')) this.weather?.addHours(1);
    if (this.input.consumeJustPressed('Slash')) { if (this.weather) this.weather.timeFlow = !this.weather.timeFlow; }
    if (this.input.consumeJustPressed('Escape')) this.settingsMenu.toggle();
    if (s.cameraToggleJustPressed) this.toggleCameraMode();
    if (s.outfitJustPressed) this.hero.cycleOutfit();

    // latch one-shot actions until a fixed step consumes them
    if (s.jumpJustPressed) this.pending.jump = true;
    if (s.crouchJustPressed) this.pending.crouch = true;
    if (s.interactJustPressed) this.pending.interact = true;
    if (s.pushJustPressed) this.pending.push = true;
    if (s.reloadJustPressed) this.pending.reload = true;
    if (s.punchJustPressed) this.pending.punch = true;
    if (s.kickJustPressed) this.pending.kick = true;
    if (s.weaponToggleJustPressed) this.pending.weapon = true;
    if (s.zombieJustPressed) this.pending.zombie = true;
    if (s.infectJustPressed) this.pending.infect = true;
    if (s.vehicleJustPressed) this.pending.vehicle = true;
    if (s.stowJustPressed) this.pending.stow = true;

    if (this.hero.landImpact) {
      this.cameraController.kick = Math.max(this.cameraController.kick || 0, this.hero.landImpact);
      this.hero.landImpact = 0;
    }
    this.hero.applyInterpolation(alpha);
    this.combat.updateFrame(dt);
    this.zombies.updateFrame(dt);
    this.goku?.update(dt);
    this.cameraController.update(
      dt,
      s,
      this.hero.renderPosition,
      this.hero.isCrouching,
      this.hero.bones.Head,
      this.hero.collider
    );
    if (this.map3d?.on) this.updateMap3D(dt);
    if (this.debugCam) { const d = this.debugCam; this.camera.position.set(d.x, d.y, d.z); this.camera.rotation.set(d.pitch, d.yaw + Math.PI, 0, 'YXZ'); }
    this.vehicles.updateFrame(dt, alpha);
    this.weather?.update(dt, this.hero.renderPosition);
    this.world.updateSun(this.hero.renderPosition);
    this.world.updateRange(dt);
    this.world.scenery?.update(dt);
    this.world.city?.update(dt, this.hero.renderPosition);
    this.minimap?.update(this.hero.renderPosition, this.cameraController.yaw);

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.updatePlayerHUD();
    }

    this.postProcessing.render(dt, elapsed);
    this.debugOverlay.update(dt);
  }

  /** 3D map: tilted bird's-eye view of the real city centred on the player. Drag = rotate, wheel = zoom, M = close. */
  toggleMap3D() {
    if (!this.map3d) {
      const m = (this.map3d = { on: false, yaw: 0, pitch: 0.95, dist: 230, drag: false });
      const beacon = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthTest: false });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 16).rotateX(Math.PI), mat);
      cone.position.y = 5; const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 60, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.4, depthTest: false }));
      beam.position.y = 30; beacon.add(cone, beam); beacon.renderOrder = 999; beacon.visible = false; this.scene.add(beacon); m.beacon = beacon;
      const el = this.renderer.instance.domElement;
      el.addEventListener('mousedown', () => { if (m.on) m.drag = true; });
      window.addEventListener('mouseup', () => { m.drag = false; });
      window.addEventListener('mousemove', (e) => { if (m.on && m.drag) { m.yaw -= e.movementX * 0.006; m.pitch = Math.min(1.45, Math.max(0.35, m.pitch + e.movementY * 0.005)); } });
      window.addEventListener('wheel', (e) => { if (m.on) m.dist = Math.min(900, Math.max(60, m.dist * (1 + Math.sign(e.deltaY) * 0.12))); }, { passive: true });
      const hint = document.createElement('div'); hint.id = 'map3d-hint'; hint.textContent = 'MAP  •  drag: rotate  •  wheel: zoom  •  M: close'; document.body.appendChild(hint);
    }
    const m = this.map3d; m.on = !m.on; m.beacon.visible = m.on;
    document.body.classList.toggle('map3d', m.on);
    if (this.minimap) this.minimap.el.style.display = m.on ? 'none' : '';
    if (m.on && document.pointerLockElement) document.exitPointerLock();
  }

  updateMap3D() {
    const m = this.map3d, p = this.hero.renderPosition, c = this.camera;
    const hz = Math.cos(m.pitch) * m.dist, hy = Math.sin(m.pitch) * m.dist;
    c.position.set(p.x + Math.sin(m.yaw) * hz, p.y + hy, p.z + Math.cos(m.yaw) * hz);
    c.lookAt(p.x, p.y, p.z);
    m.beacon.position.set(p.x, p.y, p.z);
    m.beacon.scale.setScalar(Math.max(1, m.dist / 90));
  }

  updatePlayerHUD() {
    const fin = (v, d) => (Number.isFinite(v) ? v : d);
    const stm = Math.round(Math.min(100, Math.max(0, fin(this.hero.stamina, 0))));
    if (this.stmBar) this.stmBar.style.width = `${stm}%`;
    if (this.stmVal) this.stmVal.textContent = `${stm}`;

    const maxHp = fin(this.hero.maxHealth, 100) || 100;
    const hp = Math.round(Math.min(maxHp, Math.max(0, fin(this.hero.health, 0))));
    if (this.hpBar) this.hpBar.style.width = `${(hp / maxHp) * 100}%`;
    if (this.hpVal) this.hpVal.textContent = `${hp}`;

    const state = this.hero.animController?.currentState;
    if (this.animStateEl && state) this.animStateEl.textContent = state.toUpperCase();
  }
}

// start now if the page already finished parsing (modules with top-level await run after DOMContentLoaded)
const startApp = () => { window.__opzero = new OperationZeroApp(); if (new URLSearchParams(location.search).has('oz_debug')) installOzDebug(window.__opzero); }; // handy for debugging in the console
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', startApp);
else startApp();
