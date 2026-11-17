import * as THREE from 'three';
import { MAP_BOUNDS } from '../world/CityData.js';
import { buildVehicle, VEHICLE_INFO } from './VehicleModels.js';
import { solveTwoBone, rotateBoneAboutAxis } from '../characters/TwoBoneIK.js';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const smooth = (x) => x * x * (3 - 2 * x);
const wrap = (a) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
function setRot(b, x = 0, y = 0, z = 0) {
  if (!b) return;
  if (!b.userData.rest) b.userData.rest = b.quaternion.clone();
  _e.set(x, y, z);
  _q.setFromEuler(_e);
  b.quaternion.copy(b.userData.rest).multiply(_q);
}

// per-vehicle handling (m, m/s, m/s^2)
// mu = tyre friction coefficient (limits cornering g); accel is tuned so 0-100 km/h is plausible
// (traction-limited ~1 g): apex ~3.6 s, stallion ~4.3 s, ranger ~7.5 s, vortex ~2.6 s, sprint-r ~3 s
const TUNE = {
  'apex-gt': { vmax: 56, accel: 10, grip: 7.0, steerMax: 0.5, mass: 1, bodyRoll: 0.05, brake: 10.5, mu: 1.05 },
  stallion: { vmax: 52, accel: 10.5, grip: 5.2, steerMax: 0.5, mass: 1.3, bodyRoll: 0.07, brake: 9.5, mu: 0.95 },
  ranger: { vmax: 38, accel: 11, grip: 6.0, steerMax: 0.52, mass: 1.5, bodyRoll: 0.11, brake: 8.5, mu: 0.8 },
  vortex: { vmax: 72, accel: 12.5, grip: 9.0, steerMax: 0.46, mass: 0.9, bodyRoll: 0.035, brake: 12, mu: 1.25 },
  'sprint-r': { vmax: 64, accel: 8, grip: 8.0, steerMax: 0.62, mass: 0.5, bodyRoll: 0, brake: 10, mu: 1.1 }
};

/**
 * [dirLeft, dirFwd, offLeft, offFwd, extent, face] - ray comb: dense (every ~0.15 m) on the front and rear face so
 * thin posts / lamp poles cannot slip between rays, sparse on the sides, plus 4 diagonals for the corners.
 * Only the face the vehicle travels towards is cast (see integrate), so ~27 rays per moving vehicle.
 */
function buildRaySet(he) {
  const n = Math.max(5, Math.ceil((2 * he.x * 0.95) / 0.15) + 1);
  const r = [];
  for (let i = 0; i < n; i++) {
    const f = (-0.95 + (1.9 * i) / (n - 1)) * he.x;
    r.push([0, 1, f, 0, he.z, 'f']); // front
    r.push([0, -1, f, 0, he.z, 'r']); // rear
  }
  for (const f of [-0.9, -0.45, 0, 0.45, 0.9]) {
    r.push([1, 0, 0, f * he.z, he.x, 's']); // left
    r.push([-1, 0, 0, f * he.z, he.x, 's']); // right
  }
  for (const [x, z] of [[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) r.push([x, z, 0, 0, he.z * 0.9, 'd']);
  return r;
}

class EngineSound {
  constructor(audio) {
    this.audio = audio;
    this.nodes = null;
  }
  start() {
    if (this.nodes || !this.audio.ensure()) return;
    const ctx = this.audio.ctx;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.audio.master);
    o1.start();
    o2.start();
    this.nodes = { o1, o2, f, g, ctx };
  }
  set(speedNorm, throttle, bike) {
    if (!this.nodes) return;
    const { o1, o2, f, g, ctx } = this.nodes;
    // fake gearbox: rpm sweeps in 5 gears
    const gear = Math.min(4, Math.floor(speedNorm * 5));
    const within = speedNorm * 5 - gear;
    const rpm = 0.25 + 0.75 * clamp(within * 0.9 + 0.1 * throttle, 0, 1);
    const base = (bike ? 70 : 45) + rpm * (bike ? 190 : 120);
    const t = ctx.currentTime;
    o1.frequency.setTargetAtTime(base, t, 0.05);
    o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    f.frequency.setTargetAtTime(350 + rpm * 1400 + throttle * 600, t, 0.08);
    g.gain.setTargetAtTime(0.05 + 0.1 * throttle + 0.05 * rpm, t, 0.08);
  }
  stop() {
    if (!this.nodes) return;
    const { o1, o2, g, ctx } = this.nodes;
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
    o1.stop(ctx.currentTime + 0.4);
    o2.stop(ctx.currentTime + 0.4);
    this.nodes = null;
  }
}


/** Pooled skid marks (one instanced draw call) + tyre smoke sprites. */
class TyreFX {
  constructor(scene) {
    this.scene = scene;
    const N = 420;
    const g = new THREE.PlaneGeometry(0.2, 0.55);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: 0x0b0b0c, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.skids = new THREE.InstancedMesh(g, m, N);
    this.skids.frustumCulled = false;
    this.skids.count = 0;
    this.skidN = N;
    this.skidI = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3(1, 1, 1);
    scene.add(this.skids);

    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(235,235,235,0.9)');
    gr.addColorStop(1, 'rgba(235,235,235,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.smoke = [];
    for (let i = 0; i < 40; i++) {
      const sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
      const sp = new THREE.Sprite(sm);
      sp.visible = false;
      sp.userData = { life: 0, max: 1, vel: new THREE.Vector3() };
      scene.add(sp);
      this.smoke.push(sp);
    }
    this.smokeI = 0;
  }

  mark(x, z, yaw) {
    this._e.set(0, yaw, 0);
    this._q.setFromEuler(this._e);
    this._m.compose(new THREE.Vector3(x, 0.012, z), this._q, this._s);
    this.skids.setMatrixAt(this.skidI, this._m);
    this.skidI = (this.skidI + 1) % this.skidN;
    this.skids.count = Math.min(this.skidN, this.skids.count + 1);
    this.skids.instanceMatrix.needsUpdate = true;
  }

  puff(x, z, vx, vz) {
    const sp = this.smoke[this.smokeI];
    this.smokeI = (this.smokeI + 1) % this.smoke.length;
    sp.position.set(x, 0.2, z);
    sp.userData.life = 0;
    sp.userData.max = 0.9 + Math.random() * 0.6;
    sp.userData.vel.set(vx * 0.15 + (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.5, vz * 0.15 + (Math.random() - 0.5) * 0.8);
    sp.scale.setScalar(0.5);
    sp.visible = true;
  }

  update(dt) {
    for (const sp of this.smoke) {
      if (!sp.visible) continue;
      const u = sp.userData;
      u.life += dt;
      const k = u.life / u.max;
      if (k >= 1) {
        sp.visible = false;
        continue;
      }
      sp.position.addScaledVector(u.vel, dt);
      sp.scale.setScalar(0.5 + k * 2.4);
      sp.material.opacity = 0.42 * (1 - k);
    }
  }
}

class Vehicle {
  constructor(system, type, x, z, yaw, color) {
    this.sys = system;
    this.type = type;
    this.info = VEHICLE_INFO[type];
    this.tune = TUNE[type];
    this.model = buildVehicle(type, color ? { color } : {});
    this.group = this.model.group;
    this.bike = this.model.kind === 'bike';
    this.pos = new THREE.Vector3(x, 0, z);
    this.prevPos = this.pos.clone();
    this.yaw = yaw;
    this.prevYaw = yaw;
    this.vel = new THREE.Vector3();
    this.speed = 0;
    this.steer = 0;
    this.roll = 0;
    this.pitch = 0;
    this.lean = 0;
    this.yawRate = 0;
    this.accelSm = 0;
    this.braking = false;
    this.driver = false;
    this.wheelAngle = 0;
    this.collisionCooldown = 0;
    this.health = 100; // vehicle damage: crashes wear it down, <35% smokes, 0 = engine dead
    this.smokeT = 0;
    system.scene.add(this.group);
    this.group.position.copy(this.pos);
    this.group.rotation.y = yaw;

    const he = this.model.dims.halfExtents;
    this.he = he;
    this.phys = system.physics.createKinematicBox(x, he.y, z, he.x, he.y, he.z);
    this.syncPhysics();
  }

  get doorWorld() {
    const d = this.model.doorPoint;
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    return new THREE.Vector3(this.pos.x + d.x * c + d.z * s, 0, this.pos.z - d.x * s + d.z * c);
  }

  syncPhysics() {
    const q = _q.setFromAxisAngle(UP, this.yaw);
    this.phys.body.setNextKinematicTranslation({ x: this.pos.x, y: this.he.y, z: this.pos.z });
    this.phys.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }
}

export class VehicleSystem {
  constructor(scene, physics, camera, hero, cameraController, combat) {
    this.scene = scene;
    this.physics = physics;
    this.camera = camera;
    this.hero = hero;
    this.cameraController = cameraController;
    this.combat = combat;
    this.vehicles = [];
    this.mode = 'foot'; // 'foot' | 'entering' | 'driving' | 'exiting'
    this.active = null;
    this.t = 0;
    this.engine = new EngineSound(combat.audio);
    this.speedEl = document.getElementById('hud-speed');
    this.speedBox = document.getElementById('speedo');
    this.promptEl = document.getElementById('interaction-prompt');
    this.promptText = document.getElementById('interaction-text');
    this.promptOwned = false;
    this.input = { throttle: 0, steer: 0, brake: 0, hand: false, nitro: false };
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
    this._o = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this.enterStart = new THREE.Vector3();
    this.camYawFollow = 0;
    this.fx = new TyreFX(scene);
  }

  spawn(type, x, z, yaw = 0, color) {
    const v = new Vehicle(this, type, x, z, yaw, color);
    this.vehicles.push(v);
    return v;
  }

  /** Remove a vehicle completely (scene, collider, geometry) - no leaks on despawn. */
  remove(v) {
    const i = this.vehicles.indexOf(v);
    if (i < 0) return;
    if (this.active === v) { this.engine.stop(); this.active = null; this.mode = 'foot'; this.hero.externalControl = false; }
    this.scene.remove(v.group);
    this.physics.removeEntry(v.phys);
    v.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.vehicles.splice(i, 1);
  }

  nearest(maxDist = 2.6) {
    let best = null;
    let bd = maxDist;
    for (const v of this.vehicles) {
      const d = v.doorWorld.distanceTo(this.hero.position);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  get isDriving() {
    return this.mode !== 'foot';
  }

  getPrompt() {
    if (this.mode === 'driving') return this.active.speed < 3 ? `Exit ${this.active.info.name} (Y)` : null;
    if (this.mode !== 'foot') return null;
    const v = this.nearest();
    return v ? `Enter ${v.info.name} (Y)` : null;
  }

  // ------------------------------------------------------------------ fixed step
  update(dt, step) {
    const hero = this.hero;
    this.input.throttle = Math.max(0, step.moveY);
    this.input.brake = Math.max(0, -step.moveY);
    this.input.steer = step.moveX;
    this.input.hand = !!step.handbrake;
    this.input.nitro = !!step.sprint;

    for (const v of this.vehicles) {
      v.lastImpact = 0;
      v.prevPos.copy(v.pos);
      v.prevYaw = v.yaw;
      if (v === this.active && this.mode === 'driving') this.drive(v, dt);
      else this.coast(v, dt);
      v.syncPhysics();
      if (v.health < 35 && (v.smokeT -= dt) <= 0) {
        v.smokeT = v.health <= 0 ? 0.12 : 0.3;
        const sx = v.pos.x + Math.sin(v.yaw) * v.he.z * 0.7;
        const sz = v.pos.z + Math.cos(v.yaw) * v.he.z * 0.7;
        this.fx.puff(sx, sz, 0, 0);
      }
    }
    const av = this.active;
    if (av && this.mode === 'driving' && av.lastImpact > (av.bike ? 9 : 19)) {
      // hard crash: damage, and a bike throws the rider off
      hero.health = Math.max(1, hero.health - av.lastImpact * (av.bike ? 2.2 : 1.1));
      this.sys_shake = 1.0;
      if (av.bike || av.lastImpact > 26) this.beginExit(true);
    }

    if (step.vehicleJustPressed) {
      if (this.mode === 'foot' && hero.health > 0) {
        const v = this.nearest();
        if (v) this.beginEnter(v);
      } else if (this.mode === 'driving' && this.active.speed < 3.5) {
        this.beginExit();
      }
    }

    if (this.mode === 'entering') this.stepEnter(dt);
    else if (this.mode === 'exiting') this.stepExit(dt);
    else if (this.mode === 'driving') {
      hero.position.copy(this.active.pos);
      hero.prevPosition.copy(hero.position);
    }
    if (this.mode === 'driving' && hero.health <= 0) this.beginExit(true);
  }

  coast(v, dt) {
    // parked / abandoned vehicles roll to a stop
    v.speed *= Math.exp(-dt * 1.2);
    if (Math.abs(v.speed) < 0.05) v.speed = 0;
    if (v.speed !== 0) this.integrate(v, dt, 0);
    v.accelSm *= Math.exp(-dt * 6);
    v.braking = false;
  }

  drive(v, dt) {
    const tune = v.tune;
    const inp = this.input;
    const fwd = this._v.set(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    const left = this._v2.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw));

    let vF = v.vel.dot(fwd);
    let vL = v.vel.dot(left);
    const vmax = tune.vmax * (inp.nitro && inp.throttle > 0 ? 1.12 : 1);
    const accel = tune.accel * (inp.nitro ? 1.4 : 1) / Math.sqrt(tune.mass);

    let a = 0;
    v.braking = false;
    const engineOn = v.health > 0;
    const brakeDecel = tune.brake || 9.5; // m/s^2, grip-limited (about 1 g), not 3-6 g
    if (inp.throttle > 0 && engineOn) {
      a = accel * inp.throttle * (1 - clamp(vF / vmax, 0, 1) ** 2);
      if (vF < -0.5) {
        a = accel * 2; // braking out of reverse
        v.braking = true;
      }
    }
    if (inp.brake > 0) {
      if (vF > 0.5) {
        a = -brakeDecel * inp.brake;
        v.braking = true;
      } else if (engineOn) a = -accel * 0.45 * inp.brake * (1 - clamp(-vF / (v.bike ? 2.5 : 9), 0, 1)); // reverse is slow: ~32 km/h car, walking pace bike
    }
    if (inp.hand) {
      v.braking = true;
      a -= Math.sign(vF) * Math.min(accel * 0.7, brakeDecel * 0.45);
    }
    // rolling + aero drag
    a -= vF * 0.12 + Math.sign(vF) * 0.25;
    vF += a * dt;
    if (inp.throttle === 0 && inp.brake === 0 && Math.abs(vF) < 0.15) vF = 0;

    // lateral grip (handbrake lets the rear slide)
    const grip = inp.hand ? tune.grip * 0.18 : tune.grip;
    vL *= Math.exp(-grip * dt);

    v.vel.copy(fwd).multiplyScalar(vF).addScaledVector(left, vL);
    v.speed = vF;

    // steering (bicycle model, less lock at speed)
    const speedN = clamp(Math.abs(vF) / tune.vmax, 0, 1);
    const maxLock = THREE.MathUtils.lerp(tune.steerMax, 0.09, speedN ** 0.7);
    const targetSteer = -inp.steer * maxLock;
    v.steer += (targetSteer - v.steer) * Math.min(1, dt * (inp.steer === 0 ? 9 : 6));
    const L = v.model.dims.wheelbase || 2.6;
    let yawRate = (vF / L) * Math.tan(v.steer);
    if (inp.hand && Math.abs(vF) > 6) yawRate *= 1.5;
    const G = 9.81;
    if (v.bike) {
      // two-wheel model: the rider commands a yaw rate, the bike LEANS into it (tan(phi) = v*w/g),
      // and the lagged lean is what actually turns the bike (so there is a real delay, like countersteer).
      const av = Math.abs(vF);
      const kin = smooth(clamp((av - 2) / 4, 0, 1)); // 0 = low speed (kinematic, upright), 1 = lean-driven
      const wMaxLean = (G * Math.tan(0.82)) / Math.max(av, 1); // 47 deg lean limit
      const wCmd = clamp((vF / L) * Math.tan(targetSteer), -wMaxLean, wMaxLean);
      const leanTarget = -Math.atan((wCmd * vF) / G) * kin;
      v.lean = (v.lean || 0);
      v.lean += (leanTarget - v.lean) * Math.min(1, dt * 4.5);
      const wLean = (-G * Math.tan(v.lean * kin)) / Math.max(av, 4) * (vF >= 0 ? 1 : -1);
      yawRate = clamp(THREE.MathUtils.lerp((vF / L) * Math.tan(v.steer), wLean, kin), -2.2, 2.2);
      if (av < 3) v.lean *= Math.exp(-dt * 6); // the bike stands up as it slows
      // handlebar angle: small steer to hold the turn plus a countersteer pulse while the lean builds
      const pulse = clamp(Math.abs(leanTarget) - Math.abs(v.lean), 0, 0.5) * Math.sign(wCmd) * kin;
      v.steer = clamp((L * yawRate) / Math.max(av, 2), -0.5, 0.5) * 0.7 - pulse * 0.35;
      // beyond the grip limit with the rear locked the bike highsides
      if (Math.abs(v.lean) > 0.8 && av > 10 && inp.hand) v.lastImpact = Math.max(v.lastImpact || 0, 14);
    } else {
      // friction limit: lateral acceleration v*w cannot exceed mu*g (less with the handbrake)
      const muG = (inp.hand ? 0.55 : 1.0) * G * (tune.mu || 1);
      const aLat = Math.abs(vF * yawRate);
      if (Math.abs(vF) > 3 && aLat > muG) {
        const scale = muG / aLat;
        yawRate *= scale;
        vF *= 1 - Math.min(0.25, (1 - scale) * 0.6) * dt * 3; // understeer scrubs speed
        v.vel.copy(fwd).multiplyScalar(vF).addScaledVector(left, vL);
        v.speed = vF;
      }
    }
    v.yawRate += (yawRate - v.yawRate) * Math.min(1, dt * 10);
    v.yaw += v.yawRate * dt;

    v.accelSm += (a - v.accelSm) * Math.min(1, dt * 5);
    this.integrate(v, dt, vF);
  }

  /** Move with ray-fan collision against the physics world (walls, crates, other vehicles, zombies). */
  integrate(v, dt, vF) {
    const move = this._v3.copy(v.vel).multiplyScalar(dt);
    if (v.speed !== 0 && !v.driver) v.vel.set(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(v.speed);
    v.collisionCooldown = Math.max(0, v.collisionCooldown - dt);
    const he = v.he;
    const origin = this._o;
    const d = this._d;
    const s = Math.sin(v.yaw);
    const c = Math.cos(v.yaw);
    // Ray set (local left, forward): a comb of parallel rays per face so thin posts / lamp poles between
    // the old 8 centre rays cannot slip through, plus 4 diagonals for the corners.
    const rays = v.rayset || (v.rayset = buildRaySet(he));
    let hitAny = false;
    for (const [lx, lz, ox, oz, ext, face] of rays) {
      if ((face === 'r' && v.speed > 0.3) || (face === 'f' && v.speed < -0.3)) continue; // trailing face
      // local (left, forward) -> world
      const dx = lx * c + lz * s;
      const dz = -lx * s + lz * c;
      const len = Math.hypot(dx, dz);
      d.set(dx / len, 0, dz / len);
      origin.set(v.pos.x + ox * c + oz * s, 0.55, v.pos.z - ox * s + oz * c);
      // cast from inside the body; the car's own box is excluded
      const reach = ext + Math.max(0, move.dot(d)) + 0.08;
      const hit = this.physics.castRay(origin, d, reach, v.phys.collider);
      if (!hit) continue;
      const target = this.combat.targets.get(hit.collider.handle ?? hit.collider);
      if (target && target.onHit) {
        // run over zombies / dummies
        if (Math.abs(v.speed) > 4 && v.collisionCooldown <= 0) {
          target.onHit(Math.abs(v.speed) * 6, d, hit.point, 'melee');
          v.speed *= 0.93;
          v.vel.multiplyScalar(0.93);
          v.collisionCooldown = 0.12;
          this.combat.hitMarkerTimer = 0.2;
        }
        continue;
      }
      const pen = ext + 0.08 - hit.toi;
      const into = move.dot(d);
      if (into > -0.0001) {
        move.addScaledVector(d, -into); // slide along
        const vin = v.vel.dot(d);
        if (vin > 0) {
          v.vel.addScaledVector(d, -vin * 1.25); // small bounce
          v.speed *= 0.55;
          v.lastImpact = Math.max(v.lastImpact || 0, vin);
          if (vin > 5) v.health = Math.max(0, v.health - (vin - 5) * 1.6);
          if (vin > 6 && v.collisionCooldown <= 0) {
            v.collisionCooldown = 0.3;
            this.combat.audio.thud();
            this.sys_shake = 0.25 + Math.min(0.6, vin / 25);
          }
        }
      }
      if (pen > 0) move.addScaledVector(d, -pen * 0.5);
      hitAny = true;
    }
    void hitAny;
    // sweep in short steps (never more than ~0.6 m at once), resolving against the static data after each one
    const steps = Math.max(1, Math.ceil(Math.hypot(move.x, move.z) / 0.6));
    for (let st = 0; st < steps; st++) {
      v.pos.x += move.x / steps;
      v.pos.z += move.z / steps;
      this.resolveStatic(v);
    }
    // world bounds
    // map edge (the real map bounds, not the old 77 m test-yard)
    if (v.pos.x < MAP_BOUNDS.minX || v.pos.x > MAP_BOUNDS.maxX) {
      v.pos.x = Math.min(MAP_BOUNDS.maxX, Math.max(MAP_BOUNDS.minX, v.pos.x));
      v.vel.x *= -0.3;
      v.speed *= 0.5;
    }
    if (v.pos.z < MAP_BOUNDS.minZ || v.pos.z > MAP_BOUNDS.maxZ) {
      v.pos.z = Math.min(MAP_BOUNDS.maxZ, Math.max(MAP_BOUNDS.minZ, v.pos.z));
      v.vel.z *= -0.3;
      v.speed *= 0.5;
    }
    // keep speed consistent with the velocity along the heading
    v.speed = v.vel.dot(this._v.set(Math.sin(v.yaw), 0, Math.cos(v.yaw)));
    void vF;
  }

  /** Engine-independent car-vs-building resolution: 3 circles along the body against every nearby static box. */
  resolveStatic(v) {
    const city = this.getCity ? this.getCity() : this.city;
    if (!city || !city.blockersNear || v.bike) return;
    const he = v.he, s = Math.sin(v.yaw), c = Math.cos(v.yaw);
    const rad = he.x + 0.04, off = Math.max(0, he.z - he.x);
    for (const oz of [off, 0, -off]) {
      let px = v.pos.x + oz * s, pz = v.pos.z + oz * c;
      for (const [sx, sy, sz, hw, hh, hd, ry] of city.blockersNear(px, pz, rad)) {
        const cs = Math.cos(ry || 0), sn = Math.sin(ry || 0);
        const rx = px - sx, rz = pz - sz;
        const lx = rx * cs - rz * sn, lz = rx * sn + rz * cs; // world -> box local
        const qx = Math.max(-hw, Math.min(hw, lx)), qz = Math.max(-hd, Math.min(hd, lz));
        let nx = lx - qx, nz = lz - qz, d = Math.hypot(nx, nz), pen;
        if (d > 1e-6) { if (d >= rad) continue; pen = rad - d; nx /= d; nz /= d; }
        else { // centre inside the box: leave through the nearest face
          const ex = hw - Math.abs(lx), ez = hd - Math.abs(lz);
          if (ex < ez) { nx = Math.sign(lx) || 1; nz = 0; pen = ex + rad; } else { nx = 0; nz = Math.sign(lz) || 1; pen = ez + rad; }
        }
        const wx = nx * cs + nz * sn, wz = -nx * sn + nz * cs; // normal local -> world
        v.pos.x += wx * pen; v.pos.z += wz * pen; px += wx * pen; pz += wz * pen;
        const vin = v.vel.x * wx + v.vel.z * wz;
        if (vin < 0) { v.vel.x -= wx * vin * 1.25; v.vel.z -= wz * vin * 1.25; v.speed *= 0.6; if (-vin > 5 && v.collisionCooldown <= 0) { v.collisionCooldown = 0.3; v.lastImpact = Math.max(v.lastImpact || 0, -vin); v.health = Math.max(0, v.health - (-vin - 5) * 1.6); this.combat.audio.thud(); this.sys_shake = 0.25 + Math.min(0.6, -vin / 25); } }
      }
    }
  }

  // ------------------------------------------------------------------ enter / exit
  beginEnter(v) {
    const h = this.hero;
    this.active = v;
    this.mode = 'entering';
    this.t = 0;
    this.enterStart.copy(h.position);
    h.setExternalControl(true);
    h.setFirstPerson(false);
    this.cameraController.mode = 'THIRD_PERSON';
    h.hideCollider = false;
    v.driver = true;
  }

  stepEnter(dt) {
    const h = this.hero;
    const v = this.active;
    this.t += dt;
    const door = v.doorWorld;
    const walkT = 0.9;
    if (this.t < walkT) {
      const k = smooth(this.t / walkT);
      h.position.lerpVectors(this.enterStart, door, k);
      const dx = door.x - this.enterStart.x;
      const dz = door.z - this.enterStart.z;
      if (Math.hypot(dx, dz) > 0.1) h.yaw = Math.atan2(dx, dz);
      this.walkAnim(dt, Math.min(2.2, Math.hypot(dx, dz) / walkT));
    } else {
      // turn to face the vehicle and sink into the seat
      const k = smooth(clamp((this.t - walkT) / 0.8, 0, 1));
      h.position.copy(door);
      const seatW = v.model.seat.getWorldPosition(this._v);
      const sit = this._v2.set(seatW.x, 0, seatW.z);
      h.position.lerp(sit, k);
      h.yaw += wrap(v.yaw - h.yaw) * Math.min(1, dt * 9);
      this.walkAnim(dt, 0);
      this.sitBlend = k;
      if (this.t >= walkT + 0.8) {
        this.finishEnter();
        return;
      }
    }
    h.rootGroup.position.copy(h.position);
    h.rootGroup.rotation.y = h.yaw;
    h.prevPosition.copy(h.position);
    h.renderPosition.copy(h.position);
    h.prevYaw = h.yaw;
  }

  walkAnim(dt, speed) {
    const h = this.hero;
    if (!h.animController) return;
    h.animController.update(dt, {
      horizontalSpeed: speed,
      airTime: 0,
      verticalVelocity: 0,
      isCrouching: false,
      isSprinting: false,
      justJumped: false,
      yawDelta: 0
    });
  }

  finishEnter() {
    const h = this.hero;
    const v = this.active;
    this.mode = 'driving';
    this.sitBlend = 1;
    // parent the rider to the vehicle so everything stays rigidly attached
    v.group.attach(h.rootGroup);
    const seat = v.model.seat;
    const sp = new THREE.Vector3();
    seat.updateWorldMatrix(true, false);
    sp.copy(seat.position);
    if (seat.parent !== v.group) {
      // seat lives in the body group; convert to vehicle space
      sp.copy(v.group.worldToLocal(seat.getWorldPosition(new THREE.Vector3())));
    }
    this.seatLocal = sp;
    h.rootGroup.position.set(sp.x, sp.y - 0.96 + (v.bike ? 0.02 : 0.1), sp.z);
    h.rootGroup.rotation.set(0, 0, 0);
    h.hideCollider = true;
    v.driver = true;
    this.engine.start();
    if (this.speedBox) this.speedBox.classList.remove('hidden');
    // hand over the camera to the vehicle
    this.cameraController.yaw = v.yaw + Math.PI;
    this.cameraController.pitch = 0.22;
  }

  beginExit(force = false) {
    this.mode = 'exiting';
    this.t = 0;
    this.active.speed = force ? this.active.speed : this.active.speed;
    this.engine.stop();
    if (this.speedBox) this.speedBox.classList.add('hidden');
    const h = this.hero;
    const v = this.active;
    this.scene.attach(h.rootGroup);
    h.hideCollider = false;
    this.exitStart = h.rootGroup.position.clone();
    this.exitStart.y = 0;
    this.exitEnd = this.findExitPoint(v);
    h.yaw = h.rootGroup.rotation.y = v.yaw;
    this.stepBrake = true;
  }

  /** First clear spot to stand: driver door, passenger side, behind, in front. Never inside a wall. */
  findExitPoint(v) {
    const d = v.model.doorPoint;
    const he = v.he;
    const cands = [[d.x, d.z], [-d.x, d.z], [d.x * 1.8, d.z], [-d.x * 1.8, d.z], [0, -(he.z + 1.0)], [0, he.z + 1.0]];
    const s = Math.sin(v.yaw);
    const c = Math.cos(v.yaw);
    const o = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const blocked = (x, z) => {
      o.set(v.pos.x, 0.9, v.pos.z);
      dir.set(x - v.pos.x, 0, z - v.pos.z);
      const len = dir.length();
      dir.multiplyScalar(1 / Math.max(len, 1e-3));
      const h1 = this.physics.castRay(o, dir, len + 0.45, v.phys.collider);
      if (h1 && !this.combat.targets.has(h1.collider.handle ?? h1.collider)) return true;
      o.set(x, 0.9, z);
      for (const [rx, rz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        dir.set(rx, 0, rz);
        const h2 = this.physics.castRay(o, dir, 0.45, v.phys.collider);
        if (h2 && !this.combat.targets.has(h2.collider.handle ?? h2.collider)) return true;
      }
      return false;
    };
    for (const [lx, lz] of cands) {
      const x = v.pos.x + lx * c + lz * s;
      const z = v.pos.z - lx * s + lz * c;
      if (!blocked(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return v.doorWorld; // boxed in on every side: fall back to the door
  }

  stepExit(dt) {
    const h = this.hero;
    const v = this.active;
    this.t += dt;
    const k = smooth(clamp(this.t / 0.7, 0, 1));
    h.position.lerpVectors(this.exitStart, this.exitEnd, k);
    h.position.y = 0;
    h.yaw = v.yaw + (Math.PI / 2) * k;
    h.rootGroup.position.copy(h.position);
    h.rootGroup.rotation.set(0, h.yaw, 0);
    h.rootGroup.updateMatrixWorld(true);
    this.walkAnim(dt, k < 1 ? 1.2 : 0);
    // restore the free-standing rest pose gradually
    h.bones.Hips.position.y += (0.96 - h.bones.Hips.position.y) * Math.min(1, dt * 12);
    v.driver = false;
    if (this.t >= 0.7) {
      h.setExternalControl(false);
      h.teleportTo(h.position.x, 0, h.position.z, h.yaw);
      h.animController?.transitionTo('idle', 0.15);
      this.mode = 'foot';
      this.active = null;
      this.cameraController.yaw = h.yaw + Math.PI;
    }
    h.prevPosition.copy(h.position);
    h.renderPosition.copy(h.position);
  }

  // ------------------------------------------------------------------ rider pose
  /** Call after hero.update each fixed step (a no-op when not riding). */
  applyPose(dt) {
    void dt;
    const v = this.active;
    if (!v) return;
    const h = this.hero;
    const b = h.bones;
    if (!b || !b.Hips) return;
    const m = v.model;

    if (this.mode === 'entering' && this.t >= 0.9) {
      // lower the hips into the seat while the legs fold
      const k = this.sitBlend || 0;
      b.Hips.position.y = 0.96 - 0.4 * k;
    }
    if (this.mode !== 'driving') return;

    h.rootGroup.updateMatrixWorld(true);
    const bike = v.bike;
    const steerVis = -v.steer;

    // torso: relaxed in a car, tucked over the tank on the bike
    setRot(b.Hips, 0, 0, 0);
    const lean = bike ? 0.95 + 0.3 * clamp(Math.abs(v.speed) / 40, 0, 1) : -0.1;
    setRot(b.Hips, bike ? 0.12 : 0, 0, 0);
    setRot(b.Spine, lean * 0.5, steerVis * 0.25, 0);
    setRot(b.Spine1, lean * 0.5, steerVis * 0.25, 0);
    setRot(b.Neck, bike ? -0.62 : 0.1, steerVis * 0.2, 0);
    setRot(b.Head, bike ? -0.38 : 0.05, steerVis * 0.2, 0);
    b.Hips.position.y = 0.96;

    const fwd = this._v.set(0, 0, 1);
    const worldFwd = fwd.clone().transformDirection(v.group.matrixWorld);
    const side = new THREE.Vector3(1, 0, 0).transformDirection(v.group.matrixWorld); // vehicle left
    v.group.updateMatrixWorld(true);

    const T = new THREE.Vector3();
    const poleKnee = (sd) => worldFwd.clone().multiplyScalar(0.8).addScaledVector(UP, 0.2).addScaledVector(side, sd * 0.5);
    const poleElbow = (sd) => side.clone().multiplyScalar(sd * 0.9).addScaledVector(UP, -0.6);

    if (bike) {
      m.pegs.L.getWorldPosition(T);
      solveTwoBone(b.LeftUpLeg, b.LeftLeg, b.LeftFoot, T, poleKnee(1), 1);
      m.pegs.R.getWorldPosition(T);
      solveTwoBone(b.RightUpLeg, b.RightLeg, b.RightFoot, T, poleKnee(-1), 1);
    } else {
      // seated: right foot on the accelerator, left foot on the rest pad
      const acc = m.pedalPoints.accel;
      const rest = m.pedalPoints.rest;
      const pedalPress = clamp(this.input.throttle, 0, 1) * 0.03;
      acc.getWorldPosition(T);
      T.y += 0.02 - pedalPress;
      solveTwoBone(b.RightUpLeg, b.RightLeg, b.RightFoot, T, poleKnee(-1), 1);
      (this.input.brake > 0 ? m.pedalPoints.brake : rest).getWorldPosition(T);
      solveTwoBone(b.LeftUpLeg, b.LeftLeg, b.LeftFoot, T, poleKnee(1), 1);
    }
    // hands on the wheel / bars
    if (m.steeringWheel) m.steeringWheel.rotation.z = (v.steer / 0.5) * 2.4;
    m.handL.getWorldPosition(T);
    solveTwoBone(b.LeftArm, b.LeftForeArm, b.LeftHand, T, poleElbow(1), 1);
    m.handR.getWorldPosition(T);
    solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, T, poleElbow(-1), 1);
    // feet flat-ish
    rotateBoneAboutAxis(b.LeftFoot, new THREE.Vector3().copy(side).negate(), -0.25);
    rotateBoneAboutAxis(b.RightFoot, new THREE.Vector3().copy(side).negate(), -0.25);
  }

  // ------------------------------------------------------------------ per frame
  updateFrame(dt, alpha) {
    for (const v of this.vehicles) {
      const px = THREE.MathUtils.lerp(v.prevPos.x, v.pos.x, alpha);
      const pz = THREE.MathUtils.lerp(v.prevPos.z, v.pos.z, alpha);
      const yaw = v.prevYaw + wrap(v.yaw - v.prevYaw) * alpha;
      v.group.position.set(px, 0, pz);
      v.group.rotation.y = yaw;

      // suspension & lean
      const tune = v.tune;
      const latG = v.yawRate * v.speed; // centripetal acceleration (m/s^2)
      const targetRoll = v.bike ? clamp(v.lean || 0, -0.85, 0.85) : clamp(-latG * tune.bodyRoll * 0.05, -0.12, 0.12);
      const targetPitch = clamp(-v.accelSm * 0.0045, -0.06, 0.06) * (v.bike ? 0.5 : 1);
      v.roll += (targetRoll - v.roll) * Math.min(1, dt * 8);
      v.pitch += (targetPitch - v.pitch) * Math.min(1, dt * 8);
      if (v.bike) {
        v.group.rotation.z = v.roll;
        v.model.bodyGroup.rotation.x = v.pitch;
      } else {
        v.model.bodyGroup.rotation.z = v.roll;
        v.model.bodyGroup.rotation.x = v.pitch;
      }

      // wheels
      v.wheelAngle += (v.speed * dt) ;
      for (const w of v.model.wheels) {
        w.spin.rotation.x = v.wheelAngle / w.radius;
        if (w.steer) {
          if (v.bike) w.pivot.rotation.y = v.steer * 0.7;
          else {
            // Ackermann: inner wheel turns more than the outer one
            const Lw = v.model.dims.wheelbase || 2.6;
            const tw = (v.model.dims.width || 1.8) * 0.82;
            const sa = Math.abs(v.steer);
            if (sa < 1e-3) w.pivot.rotation.y = v.steer;
            else {
              const R = Lw / Math.tan(sa);
              const inner = Math.atan(Lw / Math.max(0.1, R - tw / 2));
              const outer = Math.atan(Lw / (R + tw / 2));
              const isInner = (v.steer > 0) === (w.side > 0);
              w.pivot.rotation.y = Math.sign(v.steer) * (isInner ? inner : outer);
            }
          }
        }
      }

      // lights
      const braking = v.braking ? 1 : 0;
      for (const mat of v.model.brakeLights || []) mat.emissiveIntensity = 0.5 + braking * 3.0;
      for (const mat of v.model.headlights || []) mat.emissiveIntensity = v.driver ? 2.0 : 0.6;

      // tyre marks + smoke when sliding / locking up
      if (v.driver) {
        const lat = Math.abs(v.vel.x * Math.cos(v.yaw) - v.vel.z * Math.sin(v.yaw));
        const sp = Math.abs(v.speed);
        const slide = (lat > 3.0 && sp > 4) || (this.input.hand && sp > 5) || (v.braking && sp > 13) || (this.input.nitro && this.input.throttle > 0 && sp < 9 && sp > 0.5);
        if (slide) {
          v._fxT = (v._fxT || 0) - dt;
          if (v._fxT <= 0) {
            v._fxT = 0.03;
            for (const w of v.model.wheels) {
              if (w.steer) continue;
              const wp = w.spin.getWorldPosition(this._v);
              this.fx.mark(wp.x, wp.z, v.yaw + Math.atan2(v.vel.x * Math.cos(v.yaw) - v.vel.z * Math.sin(v.yaw), Math.max(0.5, sp)) * 0.0);
              if (Math.random() < 0.6) this.fx.puff(wp.x, wp.z, v.vel.x, v.vel.z);
            }
          }
        }
      }
    }

    this.fx.update(dt);
    if (this.mode === 'driving' || this.mode === 'exiting') this.driveCamera(dt);
    const v = this.active;
    if (v && this.mode === 'driving') {
      const kmh = Math.round(Math.abs(v.speed) * 3.6);
      if (this.speedEl) this.speedEl.textContent = String(kmh);
      this.engine.set(clamp(Math.abs(v.speed) / v.tune.vmax, 0, 1), this.input.throttle, v.bike);
    }

    // hint text (only claim the shared prompt when nothing else wants it)
    const prompt = this.getPrompt();
    if (this.promptEl && this.promptText) {
      if (prompt) {
        this.promptText.textContent = prompt;
        this.promptEl.classList.remove('hidden');
        this.promptOwned = true;
        const keyEl = this.promptEl.querySelector('.key-badge');
        if (keyEl) keyEl.textContent = 'Y';
      } else if (this.promptOwned) {
        this.promptOwned = false;
        const keyEl = this.promptEl.querySelector('.key-badge');
        if (keyEl) keyEl.textContent = 'E';
        this.promptEl.classList.add('hidden');
      }
    }
  }

  driveCamera(dt) {
    const v = this.active;
    if (!v) return;
    const cc = this.cameraController;
    // chase cam: swings behind the vehicle when moving, still free to look around with the mouse
    const follow = clamp(Math.abs(v.speed) / 12, 0, 1);
    const behind = v.yaw + Math.PI;
    if (this.mode === 'driving') cc.yaw += wrap(behind - cc.yaw) * Math.min(1, dt * 1.6 * follow);
    cc.pitch = clamp(cc.pitch, 0.05, 0.9);

    const target = new THREE.Vector3(v.group.position.x, (v.model.cameraHeight || 1.6) * 0.75, v.group.position.z);
    const dist = (v.bike ? 4.2 : 6.2) + clamp(Math.abs(v.speed) / v.tune.vmax, 0, 1) * 1.4;
    const dir = new THREE.Vector3(
      Math.cos(cc.pitch) * Math.sin(cc.yaw),
      Math.sin(cc.pitch),
      Math.cos(cc.pitch) * Math.cos(cc.yaw)
    ).normalize();
    let d = dist;
    const hit = this.physics.castRay(target, dir, dist + 0.3, v.phys.collider);
    if (hit) d = Math.max(1.2, hit.toi - 0.3);
    this.camera.position.copy(target).addScaledVector(dir, d);
    if (this.sys_shake) {
      this.camera.position.x += (Math.random() - 0.5) * this.sys_shake * 0.3;
      this.camera.position.y += (Math.random() - 0.5) * this.sys_shake * 0.3;
      this.sys_shake = Math.max(0, this.sys_shake - dt * 2);
    }
    this.camera.lookAt(target.x, target.y + 0.15, target.z);
    const fov = 65 + clamp(Math.abs(v.speed) / v.tune.vmax, 0, 1) * 16 + (this.input.nitro && this.input.throttle > 0 ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
  }
}
