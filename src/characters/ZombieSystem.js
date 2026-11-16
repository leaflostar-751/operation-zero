import { MAP_BOUNDS } from '../world/CityData.js';
import * as THREE from 'three';
import { buildHumanoid } from './CharacterBuilder.js';

const TAU = Math.PI * 2;
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const wrapAngle = (a) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};

/** Set bone = rest * Euler(x,y,z). Limbs hang along -Y: negative X swings a limb forward. */
function setRot(b, x = 0, y = 0, z = 0) {
  if (!b) return;
  _e.set(x, y, z);
  _q.setFromEuler(_e);
  b.quaternion.copy(b.userData.rest).multiply(_q);
}

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const clampX = (x) => Math.min(MAP_BOUNDS.maxX - 4, Math.max(MAP_BOUNDS.minX + 4, x));
const clampZ = (z) => Math.min(MAP_BOUNDS.maxZ - 4, Math.max(MAP_BOUNDS.minZ + 4, z));

const OUTFIT_POOL = ['survivor', 'executive', 'operator', 'racer'];

// ---------------------------------------------------------------------------------------
class Zombie {
  constructor(system, x, z, { outfit, seed, runner = false, hp = 70, fromCivilian = null } = {}) {
    this.sys = system;
    this.seed = seed;
    this.runner = runner;
    this.hp = hp;
    this.maxHp = hp;
    this.state = 'idle';
    this.t = Math.random() * 10;
    this.phase = Math.random() * TAU;
    this.attackT = 0;
    this.attackCooldown = 0;
    this.stagger = 0;
    this.deadT = 0;
    this.yaw = Math.random() * TAU;
    this.wanderT = 0;
    this.wanderYaw = this.yaw;
    this.pos = new THREE.Vector3(x, 0, z);
    this.speedMul = runner ? 3.0 : 0.85 + Math.random() * 0.55;
    this.moveSpeed = 0;
    this.limp = Math.random() < 0.5 ? 1 : -1; // which leg drags
    this.jawOpen = 0.3;

    this.human = fromCivilian || buildHumanoid({ outfit, seed, zombie: true });
    this.bones = this.human.bones;
    this.root = new THREE.Group();
    this.root.add(this.human.group);
    this.root.position.copy(this.pos);
    system.scene.add(this.root);

    const phys = system.physics.createKinematicBox(x, 0.9, z, 0.27, 0.9, 0.22);
    this.phys = phys;
    system.combat.addTarget(phys.collider, this);
    this.radius = 0.45;
  }

  getCenter() {
    return new THREE.Vector3(this.pos.x, 1.1, this.pos.z);
  }

  onHit(dmg, dir, point, kind) {
    if (this.state === 'dead') return;
    const head = point && point.y > 1.42 + (this.root.position.y || 0) && this.state !== 'down';
    const total = dmg * (head ? 3.2 : 1) * (kind === 'melee' ? 1.2 : 1);
    this.hp -= total;
    this.sys.combat.lastHeadshot = head;
    this.stagger = head ? 0.55 : 0.28;
    this.noticed = true;
    if (this.state === 'idle') this.state = 'chase';
    if (this.hp <= 0) this.die(dir, head);
  }

  die(dir, head) {
    this.state = 'dead';
    this.deadT = 0;
    this.fallDir = dir && dir.z < 0 ? -1 : 1;
    this.sys.kills += 1;
    this.sys.combat.kills += 1;
    // free the collider and the combat target now: a corpse must neither block, be shot, nor be punched,
    // and must not leak physics bodies / target entries while it lies there
    if (this.phys) this.sys.physics.removeEntry(this.phys);
    this.phys = null;
    this.sys.combat.removeTarget(this);
    if (head) this.human.setJaw(1);
  }

  // ---------------------------------------------------------------------- fixed step
  update(dt) {
    const sys = this.sys;
    const hero = sys.hero;
    this.t += dt;
    if (this.state === 'dead') {
      this.deadT += dt;
      return;
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.stagger = Math.max(0, this.stagger - dt);

    const dx = hero.position.x - this.pos.x;
    const dz = hero.position.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const sense = sys.sense || { sight: 1, hear: 1 };
    const heardShot = sys.combat.time - sys.combat.lastCombatTime < 2.5 && dist < 45 * sense.hear;
    const seen = dist < (this.runner ? 34 : 20) * sense.sight;
    const alive = hero.health > 0 && !hero.externalControl;

    if (this.state === 'idle' && alive && (seen || heardShot || this.noticed)) {
      this.state = 'chase';
      this.sys.audio.groan(dist);
    }
    if (this.state === 'chase' && (!alive || dist > 60)) this.state = 'idle';

    let want = 0;
    let wantYaw = this.yaw;
    if (this.state === 'idle') {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2 + Math.random() * 4;
        this.wanderYaw = Math.random() * TAU;
        this.wanderGo = Math.random() < 0.6;
      }
      wantYaw = this.wanderYaw;
      want = this.wanderGo ? 0.45 : 0;
    } else if (this.state === 'chase') {
      wantYaw = Math.atan2(dx, dz);
      want = 1.15 * this.speedMul;
      if (dist < 1.05) {
        want = 0;
        if (this.attackCooldown <= 0 && this.attackT <= 0) {
          this.state = 'attack';
          this.attackT = 0.0;
        }
      }
    } else if (this.state === 'attack') {
      wantYaw = Math.atan2(dx, dz);
      this.attackT += dt;
      want = 0;
      if (!this.attackHit && this.attackT >= 0.55) {
        this.attackHit = true;
        if (dist < 1.5 && hero.health > 0) sys.hurtHero(this.runner ? 12 : 9, this);
      }
      if (this.attackT >= 1.0) {
        this.state = 'chase';
        this.attackT = 0;
        this.attackHit = false;
        this.attackCooldown = 1.1;
      }
    }

    if (this.stagger > 0) want *= 0.15;

    // turn (slowly: they are not agile)
    const diff = wrapAngle(wantYaw - this.yaw);
    this.yaw += diff * Math.min(1, dt * (this.runner ? 8 : 3.2));

    // move with simple obstacle + crowd avoidance
    this.moveSpeed += (want - this.moveSpeed) * Math.min(1, dt * 4);
    if (this.moveSpeed > 0.02) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      // obstacle probe: ignore other zombies / civilians (crowd avoidance handles them), react to everything else
      const probe = (dx, dz, len, y) => {
        _o.set(this.pos.x, y, this.pos.z);
        _d.set(dx, 0, dz);
        const h = sys.physics.castRay(_o, _d, len, this.phys.collider);
        return h && !sys.combat.targets.has(h.collider.handle ?? h.collider) ? h : null;
      };
      // look-ahead probe every 4th step only (steer is cached); the swept probe below runs every step
      if ((this._probeN = ((this._probeN ?? (this.seed | 0) % 4) + 1) % 4) === 0) {
        const hit = probe(fx, fz, 1.1, 0.7) || probe(fx, fz, 0.8, 0.3);
        this._steer = hit ? (hit.normal.x * fz - hit.normal.z * fx > 0 ? 1.2 : -1.2) : 0;
      }
      const steer = this._steer || 0;
      for (const o of sys.zombies) {
        if (o === this || o.state === 'dead') continue;
        const ox = this.pos.x - o.pos.x;
        const oz = this.pos.z - o.pos.z;
        const d2 = ox * ox + oz * oz;
        if (d2 < 0.6 && d2 > 1e-4) {
          this.pos.x += (ox / Math.sqrt(d2)) * dt * 0.8;
          this.pos.z += (oz / Math.sqrt(d2)) * dt * 0.8;
        }
      }
      const a = this.yaw + steer * 0.6;
      let mx = Math.sin(a) * this.moveSpeed * dt;
      let mz = Math.cos(a) * this.moveSpeed * dt;
      // swept move: never walk into a wall / car / prop - slide along it instead
      const len = Math.hypot(mx, mz);
      if (len > 1e-6) {
        const ux = mx / len;
        const uz = mz / len;
        const sw = probe(ux, uz, len + 0.4, 0.7) || probe(ux, uz, len + 0.4, 0.3);
        if (sw) {
          const dot = mx * sw.normal.x + mz * sw.normal.z;
          if (dot < 0) {
            mx -= dot * sw.normal.x;
            mz -= dot * sw.normal.z;
          }
        }
      }
      const nx = this.pos.x + mx;
      const nz = this.pos.z + mz;
      if (nx > MAP_BOUNDS.minX && nx < MAP_BOUNDS.maxX && nz > MAP_BOUNDS.minZ && nz < MAP_BOUNDS.maxZ) {
        this.pos.x = nx;
        this.pos.z = nz;
      }
    }
    if (this.phys) this.phys.body.setNextKinematicTranslation({ x: this.pos.x, y: 0.9, z: this.pos.z });
    this.phase += dt * (1.6 + this.moveSpeed * (this.runner ? 2.1 : 3.4));
  }

  // ---------------------------------------------------------------------- per frame pose
  pose(dt) {
    const b = this.bones;
    const t = this.t;
    this.root.position.copy(this.pos);
    this.root.rotation.set(0, this.yaw, 0);

    if (this.state === 'dead') return this.poseDead(dt);

    const walk = clamp01(this.moveSpeed / (this.runner ? 3 : 1.4));
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const hurt = clamp01(this.stagger / 0.5);
    const atk = this.state === 'attack' ? clamp01(this.attackT / 0.55) : 0;
    const swing = this.state === 'attack' ? Math.sin(Math.min(1, this.attackT / 1.0) * Math.PI) : 0;
    const lean = (this.runner ? 0.55 : 0.22) * (0.4 + walk * 0.6) + atk * 0.3 + hurt * -0.45;

    // hips bob + sway
    b.Hips.position.y = 0.96 - Math.abs(s) * 0.025 * walk - (this.state === 'attack' ? 0.05 * swing : 0);
    setRot(b.Hips, 0.05 * walk, s * 0.1 * walk, c * 0.06 * walk);
    setRot(b.Spine, lean * 0.5, -s * 0.18 * walk, Math.sin(t * 0.9) * 0.04 + c * 0.05 * walk);
    setRot(b.Spine1, lean * 0.5, -s * 0.14 * walk, Math.sin(t * 1.3 + 1) * 0.05);
    setRot(b.Neck, 0.15 + atk * 0.2, Math.sin(t * 0.7) * 0.12, 0.28 * Math.sin(t * 0.4) + 0.12);
    setRot(b.Head, 0.12 + (this.state === 'attack' ? -0.3 * swing : 0), Math.sin(t * 1.1) * 0.1, 0.1);

    // arms reach out; one dangling, one raised when walking, both lunging on attack
    const raise = this.state === 'idle' ? 0.25 : 1.25;
    const lunge = swing * 0.7;
    setRot(b.LeftArm, -(raise + lunge) - s * 0.15 * walk, 0.1, 0.14);
    setRot(b.RightArm, -(raise * 0.85 + lunge) + s * 0.15 * walk, -0.1, -0.14);
    setRot(b.LeftForeArm, -(0.35 + 0.4 * atk * (1 - swing)) - Math.abs(c) * 0.12 * walk, 0, 0);
    setRot(b.RightForeArm, -(0.5 + 0.3 * atk) + Math.abs(s) * 0.12 * walk, 0, 0);
    setRot(b.LeftHand, 0.3, 0, 0);
    setRot(b.RightHand, 0.3, 0, 0);

    // legs: stiff shamble, one leg drags
    const L = this.limp;
    const stride = (this.runner ? 0.75 : 0.42) * walk;
    const dragL = L > 0 ? 0.55 : 1;
    const dragR = L > 0 ? 1 : 0.55;
    setRot(b.LeftUpLeg, -s * stride * dragL + 0.02, 0, 0.03);
    setRot(b.RightUpLeg, s * stride * dragR + 0.02, 0, -0.03);
    setRot(b.LeftLeg, Math.max(0, s) * 0.55 * walk * dragL + (L > 0 ? 0.15 * walk : 0.04), 0, 0);
    setRot(b.RightLeg, Math.max(0, -s) * 0.55 * walk * dragR + (L > 0 ? 0.04 : 0.15 * walk), 0, 0);
    setRot(b.LeftFoot, 0.0, 0, 0);
    setRot(b.RightFoot, 0.0, 0, 0);

    // jaw working
    this.human.setJaw(0.25 + 0.25 * Math.max(0, Math.sin(t * 2.3)) + (this.state === 'attack' ? 0.5 * swing : 0));
  }

  poseDead(dt) {
    const b = this.bones;
    const k = smooth(clamp01(this.deadT / 0.75));
    this.root.rotation.x = -k * (Math.PI / 2 - 0.08) * (this.fallDir || 1);
    this.root.position.y = 0.17 * k;
    // limp limbs flop
    const f = k * 0.5;
    setRot(b.LeftArm, -0.3, 0, 0.6 * f);
    setRot(b.RightArm, -0.2, 0, -0.7 * f);
    setRot(b.LeftForeArm, -0.4, 0, 0);
    setRot(b.RightForeArm, -0.3, 0, 0);
    setRot(b.LeftUpLeg, -0.1, 0, 0.12);
    setRot(b.RightUpLeg, 0.1, 0, -0.18);
    setRot(b.LeftLeg, 0.2, 0, 0);
    setRot(b.RightLeg, 0.05, 0, 0);
    setRot(b.Neck, 0.1, 0, 0.3);
    setRot(b.Head, 0.2, 0, 0.2);
    b.Hips.position.y = 0.96;
    // sink into the ground and disappear
    if (this.deadT > 9) {
      this.root.position.y -= (this.deadT - 9) * 0.25;
      if (this.deadT > 13) this.remove = true;
    }
  }

  dispose() {
    if (this.phys) this.sys.physics.removeEntry(this.phys);
    this.sys.combat.removeTarget(this);
    this.sys.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}

// ---------------------------------------------------------------------------------------
/** A healthy-looking person who gets infected in front of you and turns. */
class InfectedCivilian {
  constructor(system, x, z, outfit = 'executive') {
    this.sys = system;
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = Math.PI;
    this.human = buildHumanoid({ outfit, seed: 2, zombie: false });
    this.bones = this.human.bones;
    this.root = new THREE.Group();
    this.root.add(this.human.group);
    this.root.position.copy(this.pos);
    system.scene.add(this.root);
    this.outfit = outfit;
    this.t = -1; // -1 = waiting for trigger
    this.done = false;
    this.phys = system.physics.createKinematicBox(x, 0.9, z, 0.27, 0.9, 0.22);
    system.combat.addTarget(this.phys.collider, this);
    this.radius = 0.45;
    this.walkPhase = 0;
    this.hp = 1e9; // invulnerable until he turns
    this.stagger = 0;
    this.moveSpeed = 0;
    this.stage = 'waiting';
  }
  getCenter() {
    return new THREE.Vector3(this.pos.x, 1.1, this.pos.z);
  }
  onHit(dmg, dir, point, kind) {
    // shooting him early just startles him; once turned he becomes a normal zombie
    this.shock = 0.3;
    void dmg; void dir; void point; void kind;
  }
  start() {
    if (this.t < 0) this.t = 0;
  }
  update(dt) {
    const hero = this.sys.hero;
    if (this.t < 0) {
      const d = Math.hypot(hero.position.x - this.pos.x, hero.position.z - this.pos.z);
      if (d < 11) this.start();
      return;
    }
    this.t += dt;
    if (this.shock) this.shock = Math.max(0, this.shock - dt);
    const t = this.t;
    // stage timeline (seconds)
    const T = { cough: 0, stagger: 3.2, collapse: 7.2, convulse: 8.6, still: 12.2, snap: 13.0, rise: 14.0, turned: 16.4 };
    if (t < T.stagger) this.stage = 'cough';
    else if (t < T.collapse) this.stage = 'stagger';
    else if (t < T.convulse) this.stage = 'collapse';
    else if (t < T.still) this.stage = 'convulse';
    else if (t < T.snap) this.stage = 'still';
    else if (t < T.rise) this.stage = 'snap';
    else if (t < T.turned) this.stage = 'rise';
    else this.stage = 'turned';

    // infection level 0..1 over the whole sequence
    this.human.setInfection(clamp01(t / 12.5));

    // stagger movement: wobbles forward slowly, turning a little
    this.moveSpeed = this.stage === 'stagger' ? 0.55 : 0;
    if (this.stage === 'stagger') {
      this.yaw += Math.sin(t * 1.3) * dt * 0.6;
      this.pos.x += Math.sin(this.yaw) * this.moveSpeed * dt;
      this.pos.z += Math.cos(this.yaw) * this.moveSpeed * dt;
      this.walkPhase += dt * 3.2;
    }
    if (this.stage === 'snap' || this.stage === 'rise') {
      const dx = hero.position.x - this.pos.x;
      const dz = hero.position.z - this.pos.z;
      const want = Math.atan2(dx, dz);
      this.yaw += wrapAngle(want - this.yaw) * Math.min(1, dt * 6);
    }
    this.phys.body.setNextKinematicTranslation({ x: this.pos.x, y: this.stage === 'turned' ? 0.9 : 0.35, z: this.pos.z });
    if (this.stage === 'turned' && !this.done) {
      this.done = true;
      this.sys.convertCivilian(this);
    }
  }

  pose(dt) {
    const b = this.bones;
    const t = this.t < 0 ? this.sys.time : this.t;
    this.root.position.copy(this.pos);
    this.root.rotation.set(0, this.yaw, 0);
    const hum = this.human;

    // default: relaxed civilian idle
    let spine = 0.02, head = 0, headRoll = 0, headYaw = Math.sin(t * 0.6) * 0.25;
    let armL = 0.05, armR = 0.05, foreL = 0.2, foreR = 0.2;
    let hipsY = 0.96;
    let rootPitch = 0, rootY = 0;
    let legSwing = 0, kneeL = 0.03, kneeR = 0.03, thighL = 0, thighR = 0;
    let shake = 0;
    const st = this.stage;
    const u = (a, bb) => clamp01((this.t - a) / (bb - a));

    if (st === 'waiting') {
      // looking around, checking phone-ish pose
      armR = -0.6; foreR = -1.2;
    } else if (st === 'cough') {
      const cough = Math.max(0, Math.sin(this.t * 4.2)) ** 6; // sharp bursts
      spine = 0.12 + cough * 0.45;
      head = cough * 0.35 + 0.1;
      headYaw = Math.sin(this.t * 1.5) * 0.3;
      armR = -1.6; foreR = -1.4; // hand to the throat
      armL = -0.2 + cough * -0.3;
      shake = 0.02 * u(0, 3.2);
      hum.setJaw(cough * 0.6);
    } else if (st === 'stagger') {
      const s = Math.sin(this.walkPhase);
      const c = Math.cos(this.walkPhase);
      const k = u(T_STAGGER, T_COLLAPSE);
      spine = 0.25 + k * 0.2;
      head = 0.2; headRoll = 0.2 + Math.sin(this.t * 1.7) * 0.25; headYaw = Math.sin(this.t * 0.9) * 0.4;
      armL = -0.3 - c * 0.2; armR = -0.35 + c * 0.2; foreL = -0.5; foreR = -0.6;
      thighL = -s * 0.28; thighR = s * 0.28;
      kneeL = Math.max(0, s) * 0.4 + 0.1; kneeR = Math.max(0, -s) * 0.4 + 0.1;
      hipsY = 0.96 - Math.abs(s) * 0.02;
      shake = 0.015;
      hum.setJaw(0.15);
    } else if (st === 'collapse') {
      const k = smooth(u(T_COLLAPSE, T_CONVULSE));
      // drops to the knees (k<0.5) then topples forward
      const knee = clamp01(k * 2);
      const fall = clamp01(k * 2 - 1);
      hipsY = 0.96 - knee * 0.42 - fall * 0.1;
      thighL = -knee * 1.2; thighR = -knee * 1.2;
      kneeL = knee * 2.2; kneeR = knee * 2.2;
      spine = 0.3 + knee * 0.2;
      armL = -0.3 + knee * 0.2; armR = -0.3 + knee * 0.2;
      head = 0.3; headRoll = 0.3;
      rootPitch = smooth(fall) * (Math.PI / 2 - 0.1);
      rootY = smooth(fall) * 0.14;
    } else if (st === 'convulse') {
      const k = u(T_CONVULSE, T_STILL);
      rootPitch = Math.PI / 2 - 0.1; rootY = 0.14;
      hipsY = 0.96 - 0.5;
      thighL = -1.2; thighR = -1.2; kneeL = 2.2; kneeR = 2.2;
      // violent seizure, strongest in the middle
      const amp = Math.sin(k * Math.PI) * 1.0 + 0.2;
      shake = 0.08 * amp;
      spine = Math.sin(this.t * 31) * 0.3 * amp;
      armL = Math.sin(this.t * 23) * 0.7 * amp - 0.3; armR = Math.sin(this.t * 27 + 1) * 0.7 * amp - 0.3;
      head = Math.sin(this.t * 29) * 0.4 * amp; headRoll = Math.sin(this.t * 19) * 0.5 * amp;
      hum.setJaw(0.5 + Math.sin(this.t * 25) * 0.4);
    } else if (st === 'still') {
      rootPitch = Math.PI / 2 - 0.1; rootY = 0.14;
      hipsY = 0.96 - 0.5;
      thighL = -1.2; thighR = -1.2; kneeL = 2.2; kneeR = 2.2;
      shake = 0.004;
      armL = -0.3; armR = -0.3;
      head = 0.1;
    } else if (st === 'snap') {
      // the head whips round to look at you, mouth wide, back arches
      const k = smooth(u(T_STILL, T_SNAP));
      rootPitch = Math.PI / 2 - 0.1; rootY = 0.14;
      hipsY = 0.96 - 0.5;
      thighL = -1.2; thighR = -1.2; kneeL = 2.2; kneeR = 2.2;
      spine = -0.5 * k;
      head = -0.6 * k;
      headYaw = 0; headRoll = 0;
      hum.setJaw(1);
      hum.parts.jaw.rotation.x = 0.55;
      this.headScale = 1 + 0.07 * k;
    } else if (st === 'rise') {
      // stop-start jerky stand-up, like a puppet pulled on strings
      const k = u(T_SNAP, T_RISE);
      const jerk = Math.floor(k * 7) / 7 + (k * 7 % 1 > 0.6 ? (k * 7 % 1 - 0.6) / 0.4 / 7 : 0);
      const e = smooth(jerk);
      rootPitch = (Math.PI / 2 - 0.1) * (1 - e);
      rootY = 0.14 * (1 - e);
      hipsY = 0.96 - 0.5 * (1 - e);
      thighL = -1.2 * (1 - e); thighR = -1.2 * (1 - e); kneeL = 2.2 * (1 - e); kneeR = 2.2 * (1 - e);
      spine = 0.35 * e - 0.2 * (1 - e);
      head = 0.25 - 0.4 * (1 - e); headRoll = 0.3;
      armL = -1.2 * e; armR = -1.2 * e; foreL = -0.5; foreR = -0.5;
      hum.parts.jaw.rotation.x = 0.5;
      this.headScale = 1.07;
    } else {
      spine = 0.25; head = 0.15; armL = -1.2; armR = -1.2; foreL = -0.4; foreR = -0.4;
    }

    this.root.rotation.x = -rootPitch * 0; // pitch applied through a child so the pivot sits at the feet
    this.human.group.rotation.x = rootPitch;
    this.human.group.position.y = rootY;
    const jx = shake ? (Math.random() - 0.5) * shake : 0;
    const jz = shake ? (Math.random() - 0.5) * shake : 0;
    b.Hips.position.set(jx, hipsY, jz);
    setRot(b.Hips, 0, 0, 0);
    setRot(b.Spine, spine * 0.5, 0, 0);
    setRot(b.Spine1, spine * 0.5, 0, 0);
    setRot(b.Neck, head * 0.5, headYaw * 0.5, headRoll * 0.5);
    setRot(b.Head, head * 0.5, headYaw * 0.5, headRoll * 0.5);
    setRot(b.LeftArm, armL, 0, 0.08);
    setRot(b.RightArm, armR, 0, -0.08);
    setRot(b.LeftForeArm, foreL, 0, 0);
    setRot(b.RightForeArm, foreR, 0, 0);
    setRot(b.LeftUpLeg, thighL, 0, 0.02);
    setRot(b.RightUpLeg, thighR, 0, -0.02);
    setRot(b.LeftLeg, kneeL, 0, 0);
    setRot(b.RightLeg, kneeR, 0, 0);
    b.Head.scale.setScalar(this.headScale || 1);
    void legSwing;
  }
}
const T_STAGGER = 3.2;
const T_COLLAPSE = 7.2;
const T_CONVULSE = 8.6;
const T_STILL = 12.2;
const T_SNAP = 13.0;
const T_RISE = 14.0;

// ---------------------------------------------------------------------------------------
class ZombieAudio {
  constructor(combatAudio) {
    this.a = combatAudio;
    this.last = 0;
  }
  groan(dist) {
    const now = performance.now();
    if (now - this.last < 700) return;
    this.last = now;
    if (!this.a.ensure()) return;
    const ctx = this.a.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    const base = 70 + Math.random() * 40;
    o.frequency.setValueAtTime(base * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.9);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(220, t + 0.9);
    const vol = Math.max(0.03, 0.28 - dist * 0.008);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    o.connect(f);
    f.connect(g);
    g.connect(this.a.master);
    o.start(t);
    o.stop(t + 1.05);
  }
}

export class ZombieSystem {
  constructor(scene, physics, hero, combat) {
    this.scene = scene;
    this.physics = physics;
    this.hero = hero;
    this.combat = combat;
    this.zombies = [];
    this.civilians = [];
    this.kills = 0;
    this.time = 0;
    this.audio = new ZombieAudio(combat.audio);
    this.damageEl = document.getElementById('damage-flash');
    this.killsEl = document.getElementById('hud-kills');
    this.hurtT = 0;
    this.respawnT = 0;
    this.maxZombies = 14;
  }

  spawnZombie(x, z, opts = {}) {
    if (this.zombies.filter((q) => q.state !== 'dead').length >= this.maxZombies) return null;
    const seed = opts.seed ?? Math.floor(Math.random() * 1000);
    const outfit = opts.outfit || OUTFIT_POOL[seed % OUTFIT_POOL.length];
    const zb = new Zombie(this, x, z, { outfit, seed, runner: opts.runner, hp: opts.hp });
    this.zombies.push(zb);
    return zb;
  }

  /** Spawn n zombies in a ring in front of the hero (for testing). */
  spawnWave(n = 3, dist = 12, runnerChance = 0.2) {
    const h = this.hero;
    const base = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      let x = 0;
      let z = 0;
      for (let k = 0; k < 8; k++) {
        const a = base + (i / n) * 1.4 + k * 0.7;
        x = clampX(h.position.x + Math.sin(a) * dist);
        z = clampZ(h.position.z + Math.cos(a) * dist);
        if (!this.city?.hitsBuilding?.(x, z)) break; // never spawn inside a building
      }
      const zb = this.spawnZombie(x, z, { runner: Math.random() < runnerChance });
      if (zb) zb.noticed = true;
    }
  }

  spawnInfected(x, z, outfit = 'executive') {
    const c = new InfectedCivilian(this, x, z, outfit);
    this.civilians.push(c);
    return c;
  }

  /** Spawn an infected person a few metres ahead of the hero and start the sequence. */
  spawnInfectedAhead() {
    const h = this.hero;
    const yaw = h.yaw;
    const x = clampX(h.position.x + Math.sin(yaw) * 5);
    const z = clampZ(h.position.z + Math.cos(yaw) * 5);
    const outfits = ['executive', 'survivor', 'racer'];
    const c = this.spawnInfected(x, z, outfits[this.civilians.length % outfits.length]);
    c.yaw = yaw + Math.PI;
    c.start();
    return c;
  }

  convertCivilian(c) {
    const zb = new Zombie(this, c.pos.x, c.pos.z, { outfit: c.outfit, seed: 2, fromCivilian: c.human, hp: 80 });
    zb.yaw = c.yaw;
    zb.state = 'chase';
    zb.noticed = true;
    zb.human.setInfection(1);
    zb.root.remove(zb.human.group);
    // keep the same human mesh: re-parent it from the civilian root
    c.root.remove(c.human.group);
    zb.root.add(c.human.group);
    c.human.group.rotation.x = 0;
    c.human.group.position.y = 0;
    zb.bones.Head.scale.setScalar(1.05);
    this.scene.remove(c.root);
    this.physics.removeEntry(c.phys);
    this.combat.removeTarget(c);
    c.removed = true;
    this.zombies.push(zb);
    this.audio.groan(2);
  }

  hurtHero(dmg, from) {
    const h = this.hero;
    h.health = Math.max(0, h.health - dmg);
    this.hurtT = 0.45;
    void from;
    if (h.health <= 0 && this.respawnT <= 0) this.respawnT = 3.0;
  }

  /** fixed step */
  update(dt) {
    this.time += dt;
    for (const z of this.zombies) z.update(dt);
    for (const c of this.civilians) if (!c.removed) c.update(dt);

    if (this.respawnT > 0) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        const h = this.hero;
        h.health = h.maxHealth;
        h.teleportTo(0, 0, 4, 0);
        this.combat.ammo = 30;
        this.combat.reserve = 120;
        this.combat.reloadT = -1;
        this.combat.melee = null;
      }
    }
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      if (this.zombies[i].remove) {
        this.zombies[i].dispose();
        this.zombies.splice(i, 1);
      }
    }
    this.civilians = this.civilians.filter((c) => !c.removed);
  }

  /** per displayed frame */
  updateFrame(dt) {
    for (const z of this.zombies) z.pose(dt);
    for (const c of this.civilians) c.pose(dt);
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.damageEl) {
      const low = this.hero.health < 35 ? (35 - this.hero.health) / 35 : 0;
      this.damageEl.style.opacity = String(Math.min(0.85, Math.max(this.hurtT * 1.6, low * 0.5)));
    }
    if (this.killsEl) this.killsEl.textContent = String(this.kills);
  }
}
