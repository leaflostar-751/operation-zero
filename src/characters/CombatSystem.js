import * as THREE from 'three';
import { buildRifle } from './WeaponModel.js';
import { solveTwoBone, rotateBoneAboutAxis } from './TwoBoneIK.js';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

const WEAPON = {
  name: 'AR-7 CARBINE',
  magSize: 30,
  reserve: 120,
  fireInterval: 0.088, // ~680 rpm
  reloadTime: 2.1,
  damage: 22,
  range: 220,
  spreadHip: 0.011,
  spreadAim: 0.0025,
  spreadMove: 0.016,
  bloomPerShot: 0.0035,
  recoilPitch: 0.0075,
  recoilYaw: 0.0028
};

const wrapAngle = (a) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const smooth = (x) => x * x * (3 - 2 * x);
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// ---- tiny WebAudio synth so shooting has sound without any asset files -------------
class GunAudio {
  constructor() {
    this.ctx = null;
    this.noise = null;
    this.master = null;
  }
  ensure() {
    if (this.ctx) return this.ctx.state !== 'closed';
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (_) {
      this.ctx = null;
      return false;
    }
  }
  _burst({ dur, gain, lp, hp = 0, type = 'noise', f0 = 120, f1 = 40 }) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let src;
    if (type === 'noise') {
      src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
    } else {
      src = this.ctx.createOscillator();
      src.frequency.setValueAtTime(f0, t);
      src.frequency.exponentialRampToValueAtTime(f1, t + dur);
    }
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = lp;
    src.connect(lpf);
    let last = lpf;
    if (hp) {
      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = hp;
      lpf.connect(hpf);
      last = hpf;
    }
    last.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
  shot() {
    this._burst({ dur: 0.16, gain: 0.55, lp: 3200, hp: 300 });
    this._burst({ dur: 0.12, gain: 0.7, lp: 400, type: 'osc', f0: 140, f1: 38 });
  }
  dry() {
    this._burst({ dur: 0.04, gain: 0.25, lp: 5000, hp: 2000 });
  }
  click() {
    this._burst({ dur: 0.05, gain: 0.3, lp: 4000, hp: 1200 });
  }
  hit() {
    this._burst({ dur: 0.07, gain: 0.35, lp: 2500, hp: 700 });
  }
  thud() {
    this._burst({ dur: 0.12, gain: 0.5, lp: 300, type: 'osc', f0: 90, f1: 40 });
  }
}

/**
 * Weapons, shooting, reloading and melee for the hero.
 * - update()  : fixed step (state machines, firing)
 * - applyPose(): after animation + foot IK: torso aim, weapon placement, arm/leg IK
 * - updateFrame(): per displayed frame (camera zoom, recoil, effects)
 */
export class CombatSystem {
  constructor(scene, physics, camera, hero, cameraController) {
    this.scene = scene;
    this.physics = physics;
    this.camera = camera;
    this.hero = hero;
    this.cameraController = cameraController;
    this.audio = new GunAudio();

    // state
    this.equipped = true;
    this.aiming = false;
    this.aimBlend = 0;
    this.facingAim = false;
    this.facingBlend = 0;
    this.sprintBlend = 0;
    this.lastCombatTime = -99;
    this.time = 0;

    this.ammo = WEAPON.magSize;
    this.reserve = WEAPON.reserve;
    this.cooldown = 0;
    this.reloadT = -1; // -1 = not reloading, else 0..1
    this.bloom = 0;
    this.kick = 0; // weapon kick 0..1 (decays)
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.hitMarkerTimer = 0;
    this.melee = null; // { type, t, dur, hand, hit }
    this.meleeCooldown = 0;
    this.nextPunchHand = 0;
    this.weaponHideTimer = 0;
    this.kills = 0;
    this.shotsFired = 0;

    this.targets = new Map(); // collider key -> target
    this.targetList = [];

    // weapon
    this.rifle = buildRifle();
    this.rifle.group.visible = true;
    this.hero.rootGroup.add(this.rifle.group);
    this.hero.combat = this;
    this.magHome = this.rifle.magazine.position.clone();

    this._tmp = {
      v1: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      v3: new THREE.Vector3(),
      v4: new THREE.Vector3(),
      v5: new THREE.Vector3(),
      q1: new THREE.Quaternion(),
      q2: new THREE.Quaternion(),
      m1: new THREE.Matrix4(),
      camPos: new THREE.Vector3(),
      camDir: new THREE.Vector3(),
      aimPoint: new THREE.Vector3(),
      muzzle: new THREE.Vector3(),
      shotDir: new THREE.Vector3(),
      pole: new THREE.Vector3(),
      side: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      hand: new THREE.Vector3()
    };

    this.buildEffects();
    this.buildHUDHooks();
  }

  // ---------------------------------------------------------------- effects
  buildEffects() {
    // muzzle flash: two crossed additive quads + one pre-created point light (no shader recompiles)
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffc27a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false
    });
    this.flash = new THREE.Group();
    const q1 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), flashMat);
    const q2 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), flashMat);
    q2.rotation.z = Math.PI / 4;
    const q3 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), flashMat);
    q3.rotation.y = Math.PI / 2;
    q3.position.z = 0.1;
    this.flash.add(q1, q2, q3);
    this.flashMat = flashMat;
    this.flash.visible = false;
    this.rifle.muzzle.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffb060, 0, 9, 2);
    this.flashLight.castShadow = false;
    this.rifle.muzzle.add(this.flashLight);
    this.flashTimer = 0;

    // tracers
    this.tracers = [];
    const tracerGeo = new THREE.BoxGeometry(0.012, 0.012, 1);
    tracerGeo.translate(0, 0, 0.5);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      });
      const m = new THREE.Mesh(tracerGeo, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.tracerIdx = 0;

    // sparks (one Points object)
    this.sparkCount = 320;
    const sg = new THREE.BufferGeometry();
    this.sparkPos = new Float32Array(this.sparkCount * 3).fill(-9999);
    sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparkVel = new Float32Array(this.sparkCount * 3);
    this.sparkLife = new Float32Array(this.sparkCount);
    this.sparkMat = new THREE.PointsMaterial({
      color: 0xffc070,
      size: 0.045,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      fog: false
    });
    this.sparks = new THREE.Points(sg, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);
    this.sparkIdx = 0;

    // bullet-hole decals
    this.decals = [];
    const decalGeo = new THREE.CircleGeometry(0.045, 10);
    const decalMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a0a,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    });
    for (let i = 0; i < 28; i++) {
      const d = new THREE.Mesh(decalGeo, decalMat);
      d.visible = false;
      this.scene.add(d);
      this.decals.push({ mesh: d, life: 0 });
    }
    this.decalIdx = 0;
  }

  buildHUDHooks() {
    this.ammoEl = document.getElementById('hud-ammo');
    this.ammoResEl = document.getElementById('hud-ammo-reserve');
    this.weaponNameEl = document.getElementById('hud-weapon-name');
    this.hitMarkerEl = document.getElementById('hitmarker');
    this.reloadEl = document.getElementById('hud-reload');
    this.reticleEl = document.getElementById('reticle');
    if (this.weaponNameEl) this.weaponNameEl.textContent = WEAPON.name;
  }

  updateAmmoHUD() {
    if (this.ammoEl) this.ammoEl.textContent = String(this.ammo).padStart(2, '0');
    if (this.ammoResEl) this.ammoResEl.textContent = String(this.reserve);
    if (this.reloadEl) this.reloadEl.classList.toggle('hidden', this.reloadT < 0);
  }

  /** Register something shootable / punchable. */
  addTarget(collider, target) {
    this.targets.set(collider.handle ?? collider, target);
    if (!this.targetList.includes(target)) this.targetList.push(target);
  }

  /** Unregister a target (dead zombie, converted civilian). */
  removeTarget(target) {
    for (const [k, v] of this.targets) if (v === target) this.targets.delete(k);
    const i = this.targetList.indexOf(target);
    if (i >= 0) this.targetList.splice(i, 1);
  }

  // ----------------------------------------------------------------- helpers
  get isReloading() {
    return this.reloadT >= 0;
  }

  /** Aim ray from the displayed camera. */
  readCamera() {
    const t = this._tmp;
    this.camera.getWorldPosition(t.camPos);
    this.camera.getWorldDirection(t.camDir);
  }

  aimYawModel() {
    // model forward is atan2(x, z); camera forward is yaw + PI
    return this.cameraController.yaw + Math.PI;
  }

  // ------------------------------------------------------------- fixed step
  update(dt, step) {
    this.time += dt;
    const hero = this.hero;
    if (hero.externalControl) {
      // driving / scripted: weapon away, no shooting
      this.rifle.group.visible = false;
      this.aiming = false;
      this.facingAim = false;
      this.reloadT = -1;
      return;
    }

    if (step.weaponToggleJustPressed && !this.melee) {
      this.equipped = !this.equipped;
      this.reloadT = -1;
      this.audio.click();
    }

    const armed = this.equipped;
    const alive = hero.health > 0; // a dead hero cannot shoot or punch
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.bloom = Math.max(0, this.bloom - dt * 0.012);
    this.kick = Math.max(0, this.kick - dt * 9);
    this.weaponHideTimer = Math.max(0, this.weaponHideTimer - dt);

    const canAct = !this.melee && !hero.isSprinting;
    this.aiming = armed && step.aim && !hero.isSprinting && !this.melee && this.weaponHideTimer <= 0;

    // melee
    if (alive && !this.melee && this.meleeCooldown <= 0) {
      if (step.punchJustPressed) this.startMelee('punch');
      else if (step.kickJustPressed && hero.isGrounded && !hero.isCrouching) this.startMelee('kick');
    }
    if (this.melee) this.updateMelee(dt);

    // reload
    if (armed && !this.melee) {
      if (step.reloadJustPressed && !this.isReloading && this.ammo < WEAPON.magSize && this.reserve > 0) {
        this.reloadT = 0;
        this.audio.click();
      }
      if (this.isReloading) {
        const prev = this.reloadT;
        this.reloadT += dt / WEAPON.reloadTime;
        if (prev < 0.28 && this.reloadT >= 0.28) this.audio.click(); // mag out
        if (prev < 0.74 && this.reloadT >= 0.74) this.audio.click(); // mag in
        if (this.reloadT >= 1) {
          const need = WEAPON.magSize - this.ammo;
          const take = Math.min(need, this.reserve);
          this.ammo += take;
          this.reserve -= take;
          this.reloadT = -1;
        }
      }
    } else if (this.melee) {
      this.reloadT = -1;
    }

    // fire
    const wantsFire = alive && armed && step.fire && canAct && this.weaponHideTimer <= 0;
    if (wantsFire && !this.isReloading && this.cooldown <= 0) {
      if (this.ammo > 0) {
        this.fire();
      } else {
        this.cooldown = 0.25;
        this.audio.dry();
        if (this.reserve > 0) this.reloadT = 0; // auto reload on empty
      }
    }

    this.facingAim =
      armed && (this.aiming || this.time - this.lastCombatTime < 3.0 || (step.fire && canAct)) && !this.melee;
  }

  fire() {
    const t = this._tmp;
    this.readCamera();
    const hero = this.hero;

    this.ammo -= 1;
    this.shotsFired += 1;
    this.cooldown = WEAPON.fireInterval;
    this.lastCombatTime = this.time;
    this.kick = 1;

    const moving = hero.smoothedSpeed > 0.6;
    const spread =
      (this.aimBlend > 0.5 ? WEAPON.spreadAim : WEAPON.spreadHip) +
      (moving ? WEAPON.spreadMove * (this.aimBlend > 0.5 ? 0.5 : 1) : 0) +
      this.bloom;
    this.bloom = Math.min(0.035, this.bloom + WEAPON.bloomPerShot);

    // camera ray (what the crosshair sees), slightly spread
    const dir = t.shotDir.copy(t.camDir);
    dir.x += (Math.random() - 0.5) * 2 * spread;
    dir.y += (Math.random() - 0.5) * 2 * spread;
    dir.z += (Math.random() - 0.5) * 2 * spread;
    dir.normalize();

    const camHit = this.physics.castRay(t.camPos, dir, WEAPON.range, hero.collider);
    // never let the cheap camera ray hit our own back when the camera is close
    if (camHit) t.aimPoint.copy(camHit.point);
    else t.aimPoint.copy(t.camPos).addScaledVector(dir, WEAPON.range);

    // bullet leaves the muzzle towards that point (so the muzzle behind cover can't shoot through it)
    this.rifle.muzzle.getWorldPosition(t.muzzle);
    const toAim = t.v1.subVectors(t.aimPoint, t.muzzle);
    const dist = toAim.length();
    toAim.normalize();
    let hit = this.physics.castRay(t.muzzle, toAim, Math.max(0.01, dist + 0.5), hero.collider);
    const endPoint = hit ? hit.point.clone() : t.aimPoint.clone();

    this.spawnTracer(t.muzzle, endPoint);
    this.flashTimer = 0.05;
    this.flash.rotation.z = Math.random() * TAU;
    this.flashMat.opacity = 0.9;
    this.flash.visible = true;
    this.flashLight.intensity = 14;
    this.audio.shot();

    if (hit) this.applyHit(hit, toAim, WEAPON.damage, 'bullet');

    // recoil
    this.recoilPitch += WEAPON.recoilPitch * (this.aimBlend > 0.5 ? 0.8 : 1);
    this.recoilYaw += (Math.random() - 0.5) * 2 * WEAPON.recoilYaw;

    this.updateAmmoHUD();
  }

  applyHit(hit, dir, damage, kind) {
    const key = hit.collider.handle ?? hit.collider;
    const target = this.targets.get(key);
    if (target) {
      if (target.onHit) target.onHit(damage, dir, hit.point, kind);
      this.hitMarkerTimer = 0.18;
      this.audio.hit();
    } else {
      // dynamic rigid bodies get pushed
      const entry = this.physics.dynamicSyncList.find((e) => e.collider === hit.collider);
      if (entry && entry.body && !entry.isHeld) {
        const imp = kind === 'bullet' ? 7 : 20;
        try {
          entry.body.applyImpulseAtPoint(
            { x: dir.x * imp, y: dir.y * imp * 0.4, z: dir.z * imp },
            { x: hit.point.x, y: hit.point.y, z: hit.point.z },
            true
          );
        } catch (_) {
          entry.body.applyImpulse({ x: dir.x * imp, y: dir.y * imp * 0.4, z: dir.z * imp }, true);
        }
      }
    }
    if (kind === 'bullet') this.spawnImpact(hit.point, hit.normal, !!target);
  }

  spawnTracer(from, to) {
    const tr = this.tracers[this.tracerIdx++ % this.tracers.length];
    const len = from.distanceTo(to);
    tr.mesh.position.copy(from);
    tr.mesh.lookAt(to);
    tr.mesh.scale.set(1, 1, Math.max(0.1, len));
    tr.mesh.material.opacity = 0.75;
    tr.mesh.visible = true;
    tr.life = 0.07;
  }

  spawnImpact(point, normal, flesh) {
    // sparks
    for (let i = 0; i < 9; i++) {
      const k = this.sparkIdx++ % this.sparkCount;
      const sp = 1.5 + Math.random() * 4;
      this.sparkPos[k * 3] = point.x + normal.x * 0.02;
      this.sparkPos[k * 3 + 1] = point.y + normal.y * 0.02;
      this.sparkPos[k * 3 + 2] = point.z + normal.z * 0.02;
      this.sparkVel[k * 3] = (normal.x + (Math.random() - 0.5) * 1.2) * sp;
      this.sparkVel[k * 3 + 1] = (normal.y + (Math.random() - 0.5) * 1.2 + 0.3) * sp;
      this.sparkVel[k * 3 + 2] = (normal.z + (Math.random() - 0.5) * 1.2) * sp;
      this.sparkLife[k] = 0.25 + Math.random() * 0.25;
    }
    if (flesh) return;
    const d = this.decals[this.decalIdx++ % this.decals.length];
    d.mesh.position.copy(point).addScaledVector(normal, 0.004);
    d.mesh.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    d.mesh.rotation.z += Math.random() * TAU;
    d.mesh.visible = true;
    d.life = 14;
  }

  // ------------------------------------------------------------------ melee
  startMelee(type) {
    this.lastCombatTime = this.time;
    this.reloadT = -1;
    const hand = type === 'punch' ? this.nextPunchHand : 0;
    if (type === 'punch') this.nextPunchHand ^= 1;
    this.melee = { type, t: 0, dur: type === 'punch' ? 0.42 : 0.66, hand, hit: false };
    this.meleeCooldown = 0.12;
    this.audio.click();
  }

  updateMelee(dt) {
    const m = this.melee;
    m.t += dt;
    const u = m.t / m.dur;
    if (!m.hit && u >= (m.type === 'punch' ? 0.38 : 0.5)) {
      m.hit = true;
      this.meleeStrike(m);
    }
    if (m.t >= m.dur) {
      this.melee = null;
      this.weaponHideTimer = 0.0;
    }
  }

  meleeStrike(m) {
    const hero = this.hero;
    const yaw = hero.yaw;
    const f = this._tmp.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const center = hero.position.clone().addScaledVector(f, m.type === 'punch' ? 0.85 : 1.0);
    center.y += m.type === 'punch' ? 1.3 : 0.95;
    const radius = m.type === 'punch' ? 0.65 : 0.8;
    const dmg = m.type === 'punch' ? 14 : 28;
    let any = false;

    for (const target of this.targetList) {
      if (!target.getCenter || target.state === 'dead' || target.removed) continue;
      const c = target.getCenter();
      if (c.distanceTo(center) <= radius + (target.radius ?? 0.4)) {
        // line of sight: a wall / car between the fist and the target blocks the hit
        const eye = this._tmp.v2.set(hero.position.x, hero.position.y + 1.2, hero.position.z);
        const dirV = this._tmp.v3.subVectors(c, eye);
        const dd = dirV.length();
        if (dd > 0.05) {
          dirV.multiplyScalar(1 / dd);
          const block = this.physics.castRay(eye, dirV, dd, hero.collider);
          if (block && !this.targets.has(block.collider.handle ?? block.collider)) continue;
        }
        target.onHit?.(dmg, f, c, 'melee');
        any = true;
      }
    }
    for (const e of this.physics.dynamicSyncList) {
      if (e.isHeld || !e.body) continue;
      const p = e.body.translation();
      const d = Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z);
      if (d < radius + 0.55) {
        const imp = m.type === 'punch' ? 18 : 55;
        e.body.applyImpulse({ x: f.x * imp, y: imp * 0.25, z: f.z * imp }, true);
        any = true;
      }
    }
    if (any) {
      this.hitMarkerTimer = 0.2;
      this.audio.thud();
    }
  }

  // --------------------------------------------------------------- pose / IK
  /** After animation and foot IK, in the simulation pose of the root group. */
  applyPose(dt) {
    const hero = this.hero;
    const b = hero.bones;
    const t = this._tmp;
    const fp = this.cameraController.mode === 'FIRST_PERSON';

    // smooth blends
    const wantAim = this.aiming ? 1 : 0;
    this.aimBlend = damp(this.aimBlend, wantAim, 14, dt);
    this.facingBlend = damp(this.facingBlend, this.facingAim ? 1 : 0, 9, dt);
    this.sprintBlend = damp(this.sprintBlend, hero.isSprinting && !this.melee ? 1 : 0, 10, dt);

    hero.rootGroup.updateMatrixWorld(true);

    const showWeapon = this.equipped && !(this.melee && this.melee.t < this.melee.dur) && this.weaponHideTimer <= 0;
    this.rifle.group.visible = showWeapon;
    this.rifle.magazine.visible = !(this.isReloading && this.reloadT > 0.3 && this.reloadT < 0.62);

    // forward/side vectors of the body
    const yaw = hero.yaw;
    t.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    t.side.crossVectors(t.fwd, UP).normalize(); // character's right

    // Spine1/Neck have no animation tracks, so the mixer never resets them: reset here or the
    // torso twist/pitch below accumulates every frame (this was the hunched-over hero).
    if (b.Spine1) b.Spine1.quaternion.identity();
    if (b.Neck) b.Neck.quaternion.identity();
    hero.rootGroup.updateMatrixWorld(true);

    // ---- torso twist & pitch so the upper body follows the camera
    if (this.equipped && !this.melee && b.Spine && b.Spine1) {
      const camPitch = this.cameraController.pitch; // positive = looking down
      let twist = wrapAngle(this.aimYawModel() - yaw);
      twist = THREE.MathUtils.clamp(twist, -1.4, 1.4) * this.facingBlend;
      const pitch = THREE.MathUtils.clamp(camPitch, -0.7, 0.55) * (0.4 + 0.6 * this.facingBlend);

      rotateBoneAboutAxis(b.Spine, UP, twist * 0.35);
      rotateBoneAboutAxis(b.Spine1, UP, twist * 0.4);
      if (b.Neck) rotateBoneAboutAxis(b.Neck, UP, twist * 0.25);

      // pitch about the character's left axis (positive = nose down)
      t.v1.copy(t.side).negate();
      rotateBoneAboutAxis(b.Spine, t.v1, pitch * 0.2);
      rotateBoneAboutAxis(b.Spine1, t.v1, pitch * 0.2);
      // keep the head level-ish: cancel most of the torso fold so the chin never tucks into the chest
      if (b.Neck) rotateBoneAboutAxis(b.Neck, t.v1, -pitch * 0.25);
      // sprint: lean forward slightly
      rotateBoneAboutAxis(b.Spine1, t.v1, 0.12 * this.sprintBlend);
    } else if (this.melee && b.Spine && b.Spine1) {
      this.applyMeleeTorso();
    }

    // ---- weapon placement
    if (this.rifle.group.visible) {
      this.placeWeapon(dt, fp);
    }

    // ---- arms
    if (!fp) {
      if (this.rifle.group.visible) this.solveArmsOnWeapon();
      else if (this.melee) this.solveMeleeLimbs();
    } else if (this.melee) {
      // first person: legs/arms are hidden, nothing to pose
    }
  }

  applyMeleeTorso() {
    const m = this.melee;
    const b = this.hero.bones;
    const t = this._tmp;
    const u = m.t / m.dur;
    const bell = Math.sin(Math.PI * Math.min(1, u));
    t.v1.copy(t.side).negate();
    if (m.type === 'punch') {
      const dirSign = m.hand === 0 ? 1 : -1; // right punch twists left-to-right
      rotateBoneAboutAxis(b.Spine, UP, 0.35 * bell * dirSign);
      rotateBoneAboutAxis(b.Spine1, UP, 0.3 * bell * dirSign);
      rotateBoneAboutAxis(b.Spine1, t.v1, 0.1 * bell);
    } else {
      rotateBoneAboutAxis(b.Spine, t.v1, -0.28 * bell);
      rotateBoneAboutAxis(b.Spine1, t.v1, -0.2 * bell);
    }
  }

  placeWeapon(dt, fp) {
    const hero = this.hero;
    const b = hero.bones;
    const t = this._tmp;
    const rifle = this.rifle;
    this.readCamera();

    const aimYaw = this.aimYawModel();
    const pitch = this.cameraController.pitch;

    // weapon direction: low-ready -> raised -> aim
    const aimDir = t.v1.set(
      -Math.sin(this.cameraController.yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      -Math.cos(this.cameraController.yaw) * Math.cos(pitch)
    );
    // when not facing the aim direction (idle, hip) keep the weapon along the body
    const bodyDir = t.v2.set(Math.sin(hero.yaw), 0, Math.cos(hero.yaw));
    const base = t.v3.copy(bodyDir).lerp(aimDir, this.facingBlend).normalize();
    // low ready and sprint pitch the muzzle down
    const lowAmount = (1 - this.aimBlend) * (0.42 + 0.5 * this.sprintBlend);
    base.y = THREE.MathUtils.clamp(base.y - lowAmount, -0.95, 0.9);
    const dir = base.normalize().clone();

    // idle sway / movement bob / recoil
    const speed = hero.smoothedSpeed;
    const bobAmp = Math.min(1, speed / 4.5) * (1 - this.aimBlend * 0.7);
    const ph = this.time * (hero.isSprinting ? 12 : 8.5);
    const sway =
      Math.sin(this.time * 1.4) * 0.004 * (1 - this.aimBlend * 0.6) + Math.sin(ph) * 0.012 * bobAmp;
    const swayY = Math.sin(this.time * 1.9) * 0.003 + Math.abs(Math.cos(ph)) * 0.014 * bobAmp;

    // reload tilt
    let roll = 0;
    let dropY = 0;
    if (this.isReloading) {
      const r = this.reloadT;
      const w = r < 0.15 ? r / 0.15 : r > 0.85 ? (1 - r) / 0.15 : 1;
      roll = 0.55 * smooth(THREE.MathUtils.clamp(w, 0, 1));
      dropY = -0.05 * smooth(THREE.MathUtils.clamp(w, 0, 1));
    }

    // orientation from direction (z), keep up = world up
    const z = dir;
    const x = t.v4.crossVectors(UP, z).normalize();
    const y = t.v5.crossVectors(z, x).normalize();
    t.m1.makeBasis(x, y, z);
    t.q1.setFromRotationMatrix(t.m1);
    // kick: pitch up a bit; roll for reload
    t.q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.kick * 0.045 + 0);
    t.q1.multiply(t.q2);
    t.q2.setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
    t.q1.multiply(t.q2);

    // grip world position
    const gripPos = new THREE.Vector3();
    if (fp) {
      const camRight = new THREE.Vector3().crossVectors(t.camDir, UP).normalize();
      const camUp = new THREE.Vector3().crossVectors(camRight, t.camDir).normalize();
      const hip = new THREE.Vector3()
        .copy(t.camPos)
        .addScaledVector(camRight, 0.17 + sway)
        .addScaledVector(camUp, -0.24 + swayY + dropY)
        .addScaledVector(t.camDir, 0.36 - this.kick * 0.04);
      // aim: line the sight up with the eye
      const sight = rifle.sightPoint.position.clone().applyQuaternion(t.q1);
      const ads = new THREE.Vector3()
        .copy(t.camPos)
        .addScaledVector(t.camDir, 0.42 - this.kick * 0.035)
        .sub(sight);
      gripPos.lerpVectors(hip, ads, this.aimBlend);
    } else {
      b.RightArm.getWorldPosition(gripPos);
      // stock rests into the right shoulder pocket
      const stockLocal = rifle.stockPoint.position.clone().applyQuaternion(t.q1);
      const shoulder = new THREE.Vector3();
      b.RightArm.getWorldPosition(shoulder);
      shoulder.addScaledVector(t.side, -0.07 + sway); // towards the chest
      shoulder.y += -0.06 + swayY + dropY;
      shoulder.addScaledVector(dir, -0.02 - this.kick * 0.045);
      gripPos.copy(shoulder).sub(stockLocal);
    }

    // set weapon transform in root-local space
    const root = hero.rootGroup;
    rifle.group.position.copy(root.worldToLocal(gripPos.clone()));
    root.getWorldQuaternion(t.q2).invert();
    rifle.group.quaternion.copy(t.q2.multiply(t.q1));

    // magazine animation (drop + insert)
    const mag = rifle.magazine;
    mag.position.copy(this.magHome);
    mag.rotation.set(0, 0, 0);
    if (this.isReloading) {
      const r = this.reloadT;
      if (r >= 0.15 && r < 0.3) {
        mag.position.y -= 0.18 * smooth((r - 0.15) / 0.15);
      } else if (r >= 0.62 && r < 0.78) {
        mag.position.y -= 0.14 * (1 - smooth((r - 0.62) / 0.16));
      }
    }
    rifle.group.updateMatrixWorld(true);
  }

  solveArmsOnWeapon() {
    const hero = this.hero;
    const b = hero.bones;
    const t = this._tmp;
    const rifle = this.rifle;
    if (!b.RightHand || !b.LeftHand) return;

    const root = hero.rootGroup;
    root.updateMatrixWorld(true);

    // elbow pole vectors: down and outwards
    const poleR = t.pole.copy(t.side).multiplyScalar(0.9).addScaledVector(UP, -1);
    const handTarget = t.hand;

    // right hand: pistol grip
    rifle.gripR.getWorldPosition(handTarget);
    solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, handTarget, poleR, 1);

    // left hand: foregrip, or the magazine during a reload
    const poleL = t.v1.copy(t.side).multiplyScalar(-0.9).addScaledVector(UP, -1);
    rifle.gripL.getWorldPosition(handTarget);

    if (this.isReloading) {
      const r = this.reloadT;
      const magWorld = new THREE.Vector3();
      rifle.group.localToWorld(magWorld.set(0, -0.08, 0.16));
      const pouch = new THREE.Vector3();
      b.Spine1.getWorldPosition(pouch);
      pouch.addScaledVector(t.side, -0.16).addScaledVector(UP, -0.18).addScaledVector(t.fwd, 0.16);
      const grip = handTarget.clone();
      let target;
      if (r < 0.15) target = grip.lerp(magWorld, smooth(r / 0.15));
      else if (r < 0.3) target = magWorld.clone().add(new THREE.Vector3(0, -0.12 * smooth((r - 0.15) / 0.15), 0));
      else if (r < 0.5) {
        const k = smooth((r - 0.3) / 0.2);
        target = magWorld.clone().add(new THREE.Vector3(0, -0.12, 0)).lerp(pouch, k);
      } else if (r < 0.62) target = pouch.clone();
      else if (r < 0.78) target = pouch.clone().lerp(magWorld, smooth((r - 0.62) / 0.16));
      else target = magWorld.clone().lerp(grip, smooth((r - 0.78) / 0.22));
      handTarget.copy(target);
    }
    solveTwoBone(b.LeftArm, b.LeftForeArm, b.LeftHand, handTarget, poleL, 1);
  }

  solveMeleeLimbs() {
    const hero = this.hero;
    const b = hero.bones;
    const m = this.melee;
    const t = this._tmp;
    const u = THREE.MathUtils.clamp(m.t / m.dur, 0, 1);

    if (m.type === 'punch') {
      // guard pose for both hands, one hand extends
      const chest = new THREE.Vector3();
      b.Spine1.getWorldPosition(chest);
      const mk = (side, extend) => {
        const target = chest
          .clone()
          .addScaledVector(t.side, side * 0.16)
          .addScaledVector(t.fwd, 0.26 + 0.52 * extend)
          .add(new THREE.Vector3(0, 0.02 + 0.0 * extend, 0));
        return target;
      };
      // extension envelope: fast out, slower back
      const ext = u < 0.38 ? smooth(u / 0.38) : 1 - smooth((u - 0.38) / 0.62);
      const rightExt = m.hand === 0 ? ext : 0;
      const leftExt = m.hand === 1 ? ext : 0;
      if (b.RightHand) {
        const pole = t.pole.copy(t.side).multiplyScalar(1).addScaledVector(UP, -0.6);
        solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, mk(1, rightExt), pole, 1);
      }
      if (b.LeftHand) {
        const pole = t.v1.copy(t.side).multiplyScalar(-1).addScaledVector(UP, -0.6);
        solveTwoBone(b.LeftArm, b.LeftForeArm, b.LeftHand, mk(-1, leftExt), pole, 1);
      }
    } else {
      // guard hands + right leg front kick
      const chest = new THREE.Vector3();
      b.Spine1.getWorldPosition(chest);
      const guard = (side) =>
        chest.clone().addScaledVector(t.side, side * 0.2).addScaledVector(t.fwd, 0.3).add(new THREE.Vector3(0, -0.05, 0));
      if (b.RightHand) {
        solveTwoBone(
          b.RightArm,
          b.RightForeArm,
          b.RightHand,
          guard(1),
          new THREE.Vector3().copy(t.side).addScaledVector(UP, -0.7),
          1
        );
      }
      if (b.LeftHand) {
        solveTwoBone(
          b.LeftArm,
          b.LeftForeArm,
          b.LeftHand,
          guard(-1),
          new THREE.Vector3().copy(t.side).negate().addScaledVector(UP, -0.7),
          1
        );
      }

      // kick: chamber (0..0.35) -> extend (0.35..0.55) -> retract
      let k;
      if (u < 0.35) k = smooth(u / 0.35) * 0.55;
      else if (u < 0.55) k = 0.55 + 0.45 * smooth((u - 0.35) / 0.2);
      else k = 1 - smooth((u - 0.55) / 0.45);
      const hip = new THREE.Vector3();
      b.RightUpLeg.getWorldPosition(hip);
      const foot = new THREE.Vector3();
      b.RightFoot.getWorldPosition(foot);
      const kickTarget = hip.clone().addScaledVector(t.fwd, 0.82).add(new THREE.Vector3(0, -0.2, 0));
      const target = foot.clone().lerp(kickTarget, k);
      const pole = new THREE.Vector3().copy(t.fwd).addScaledVector(UP, 0.35);
      solveTwoBone(b.RightUpLeg, b.RightLeg, b.RightFoot, target, pole, 1);
    }
  }

  // ------------------------------------------------------------ per frame
  updateFrame(dt) {
    // camera feel: zoom & shoulder swap when aiming
    const cc = this.cameraController;
    const fp = cc.mode === 'FIRST_PERSON';
    const baseFov = 65;
    const aimFov = fp ? 48 : 52;
    const targetFov = baseFov + (aimFov - baseFov) * this.aimBlend;
    if (!this.hero.externalControl && Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
    cc.shoulderOffset = 0.32 + 0.2 * this.aimBlend;
    cc.targetDistance = 3.2 - 1.0 * this.aimBlend;

    // recoil: feed into the camera angles smoothly
    if (this.recoilPitch !== 0 || this.recoilYaw !== 0) {
      const k = 1 - Math.exp(-dt * 28);
      const dp = this.recoilPitch * k;
      const dy = this.recoilYaw * k;
      cc.pitch -= dp;
      cc.yaw += dy;
      this.recoilPitch -= dp;
      this.recoilYaw -= dy;
      if (Math.abs(this.recoilPitch) < 1e-5) this.recoilPitch = 0;
      if (Math.abs(this.recoilYaw) < 1e-5) this.recoilYaw = 0;
    }

    // muzzle flash fade
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const f = Math.max(0, this.flashTimer / 0.05);
      this.flashMat.opacity = 0.9 * f;
      this.flashLight.intensity = 14 * f;
      if (this.flashTimer <= 0) {
        this.flash.visible = false;
        this.flashLight.intensity = 0;
      }
    }

    // tracers
    for (const tr of this.tracers) {
      if (tr.life > 0) {
        tr.life -= dt;
        tr.mesh.material.opacity = Math.max(0, (tr.life / 0.07) * 0.75);
        if (tr.life <= 0) tr.mesh.visible = false;
      }
    }

    // sparks
    for (let i = 0; i < this.sparkCount; i++) {
      if (this.sparkLife[i] > 0) {
        this.sparkLife[i] -= dt;
        if (this.sparkLife[i] <= 0) {
          this.sparkPos[i * 3 + 1] = -9999;
          continue;
        }
        this.sparkVel[i * 3 + 1] -= 9.8 * dt;
        this.sparkPos[i * 3] += this.sparkVel[i * 3] * dt;
        this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
        this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
      }
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;

    // decals
    for (const d of this.decals) {
      if (d.life > 0) {
        d.life -= dt;
        if (d.life <= 0) d.mesh.visible = false;
      }
    }

    // hit marker
    if (this.hitMarkerEl) {
      if (this.hitMarkerTimer > 0) {
        this.hitMarkerTimer -= dt;
        this.hitMarkerEl.style.opacity = String(Math.min(1, this.hitMarkerTimer / 0.12));
      } else if (this.hitMarkerEl.style.opacity !== '0') {
        this.hitMarkerEl.style.opacity = '0';
      }
    }

    // reticle breathes with spread
    if (this.reticleEl) {
      const spread = (this.aimBlend > 0.5 ? 6 : 14) + this.bloom * 900 + (this.hero.smoothedSpeed > 0.6 ? 8 : 0);
      this.reticleEl.style.setProperty('--spread', `${spread.toFixed(1)}px`);
      this.reticleEl.style.opacity = this.equipped ? '1' : '0.6';
    }

    // keep the ammo HUD in sync (cheap)
    this._hudTick = (this._hudTick || 0) + dt;
    if (this._hudTick > 0.1) {
      this._hudTick = 0;
      this.updateAmmoHUD();
    }
  }
}
