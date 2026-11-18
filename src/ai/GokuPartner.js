// GOKU partner player (in-game). A second character that plays next to the hero:
//   follow  : keeps near the hero, helps in fights (melee), rides along when the hero drives
//   explore : walks around the map by itself (acts as a tester)
//   goto    : walks to a point given by a command
// While it plays it NOTES glitches it can detect (stuck, out of world, long airtime, lag) with exact positions.
// Navigation: walks straight when the way is clear, otherwise follows an A* path around walls/buildings (NavGrid).
// Honest limits (v1.1): invulnerable, melee only, no vehicles of its own. The real GOKU agent (Windows) is not in the browser;
// it talks to this partner through window.__OZ_GOKU (status / notes / command).
import * as THREE from 'three';
import { buildHumanoid } from '../characters/CharacterBuilder.js';
import { AnimationController } from '../characters/AnimationController.js';
import { NavGrid } from './NavGrid.js';

const STATES = [['idle', false], ['walk', false], ['run', false], ['sprint', false], ['jump', true], ['fall', false], ['land', true], ['crouch', false], ['crouch-walk', false], ['turn', false]];
const MAP = { minX: -1000, maxX: 1250, minZ: -480, maxZ: 740 };
const NOTE_KEY = 'goku_notes_v1';
const TAU = Math.PI * 2;
const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

export class GokuPartner {
  constructor({ scene, physics, hero, zombies, vehicles, getCity, assetLoader }) {
    Object.assign(this, { scene, physics, hero, zombies, vehicles, getCity, assetLoader });
    this.enabled = true; this.mode = 'follow'; this.ready = false;
    this.pos = new THREE.Vector3(2, 0, 6); this.yaw = 0; this.speed = 0; this.yawRate = 0;
    this.target = null; this.attackCd = 0; this.attackT = 0; this.hitDone = false;
    this.notesList = []; this.noteSeen = new Set(); this.lastNoteAt = {};
    this.stats = { metersWalked: 0, zombieHits: 0, stuckEvents: 0, teleports: 0, framesSeen: 0 };
    this.stuckT = 0; this.stuckRef = new THREE.Vector3(); this.detour = 0; this.detourSign = 1;
    this.airT = 0; this.t = 0; this.groundY = 0; this._down = new THREE.Vector3(0, -1, 0); this._o = new THREE.Vector3();
    this.waypoint = null; this.wpWait = 0;
    this.heroSpd = 0; this._hpx = NaN; this._hpz = NaN;
    this.nav = null; this.pathBest = Infinity; this.path = []; this.pathGoal = null; this.planT = 0; this.planCd = 0; this.noPathT = 0;
    this.stats.plans = 0; this.stats.planMs = 0; this.stats.giveUps = 0;
    try { this.notesList = JSON.parse(localStorage.getItem(NOTE_KEY) || '[]').slice(-300); this.notesList.forEach((n) => this.noteSeen.add(n.key)); } catch (_) { /* storage may be blocked */ }
  }

  async init() {
    const built = buildHumanoid({ outfit: 'survivor', seed: 7 });
    this.assetLoader.applyCharacterPBRMaterials(built.group);
    this.human = built; this.bones = built.bones;
    this.group = new THREE.Group(); this.group.add(built.group); this.scene.add(this.group);
    this.anim = new AnimationController(built.group, built.bones);
    const clips = AnimationController.createSynthesizedMixamoClips(built.bones);
    for (const [s, once] of STATES) this.anim.registerClip(s, clips[s], once);
    this.anim.transitionTo('idle', 0.01);
    // name tag
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.font = '700 38px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(8,16,24,0.55)'; g.fillRect(60, 8, 136, 48);
    g.fillStyle = '#7cf0b4'; g.fillText('GOKU', 128, 46);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); this.tag.scale.set(1.1, 0.28, 1); this.tag.position.y = 2.15; this.tag.renderOrder = 998;
    this.group.add(this.tag);
    this.placeNearHero();
    this.ready = true;
    // chip shown only in the developer HUD (F1)
    this.chip = document.createElement('div'); this.chip.id = 'goku-chip'; document.body.appendChild(this.chip);
  }

  // ------------------------------------------------------------------ notes
  note(type, detail, pos = this.pos) {
    const key = `${type}:${Math.round(pos.x / 6)}:${Math.round(pos.z / 6)}`;
    const now = performance.now();
    if (this.noteSeen.has(key) || now - (this.lastNoteAt[type] || -1e9) < 3000) return;
    this.noteSeen.add(key); this.lastNoteAt[type] = now;
    this.notesList.push({ key, type, detail, x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), z: +pos.z.toFixed(1), t: new Date().toISOString(), confidence: 'EXACT' });
    if (this.notesList.length > 300) this.notesList.shift();
    try { localStorage.setItem(NOTE_KEY, JSON.stringify(this.notesList)); } catch (_) { /* ignore */ }
  }

  // ------------------------------------------------------------------ helpers
  placeNearHero() {
    const h = this.hero.position, a = this.hero.yaw + 2.4;
    this.pos.set(h.x + Math.sin(a) * 2.5, 0, h.z + Math.cos(a) * 2.5); this.speed = 0; this.groundSnap(true); this.resetNav();
  }
  groundSnap(force = false) {
    this._o.set(this.pos.x, this.pos.y + 2.5, this.pos.z);
    const hit = this.physics.castRay(this._o, this._down, 6);
    if (hit) { this.groundY = hit.point.y; this.hasGround = true; } else { this.hasGround = false; this.groundY = 0; }
    // follow ground smoothly (steps/slopes) but never snap more than a step per frame
    this.pos.y += THREE.MathUtils.clamp(this.groundY - this.pos.y, -0.35, 0.35); if (force) this.pos.y = this.groundY;
  }
  resolveStatic() {
    const city = this.getCity && this.getCity(); if (!city || !city.blockersNear) return 0; let pushed = 0; const rad = 0.36;
    for (const [sx, sy, sz, hw, hh, hd, ry] of city.blockersNear(this.pos.x, this.pos.z, rad)) {
      if (sy + hh < this.pos.y + 0.3 || sy - hh > this.pos.y + 1.6) continue;
      const cs = Math.cos(ry || 0), sn = Math.sin(ry || 0), rx = this.pos.x - sx, rz = this.pos.z - sz;
      const lx = rx * cs - rz * sn, lz = rx * sn + rz * cs, qx = Math.max(-hw, Math.min(hw, lx)), qz = Math.max(-hd, Math.min(hd, lz));
      let nx = lx - qx, nz = lz - qz, d = Math.hypot(nx, nz), pen;
      if (d > 1e-6) { if (d >= rad) continue; pen = rad - d; nx /= d; nz /= d; }
      else { const ex = hw - Math.abs(lx), ez = hd - Math.abs(lz); if (ex < ez) { nx = Math.sign(lx) || 1; nz = 0; pen = ex + rad; } else { nx = 0; nz = Math.sign(lz) || 1; pen = ez + rad; } }
      this.pos.x += (nx * cs + nz * sn) * pen; this.pos.z += (-nx * sn + nz * cs) * pen; pushed += pen;
    }
    return pushed;
  }
  resetNav() { this.path.length = 0; this.pathGoal = null; this.pathBest = Infinity; this.noPathT = 0; this.planT = 0; this.planCd = 0; this.stuckT = 0; this.detour = 0; }
  /** random waypoint on a free spot (so explore never aims into a wall) */
  pickWaypoint() {
    const nav = this.nav || (this.nav = new NavGrid(this.getCity));
    this.pathBest = Infinity;
    for (let i = 0; i < 12; i++) {
      let x, z;
      if (Math.random() < 0.7) { const a = Math.random() * TAU, d = 50 + Math.random() * 130; x = this.pos.x + Math.sin(a) * d; z = this.pos.z + Math.cos(a) * d; } // local trip
      else { x = THREE.MathUtils.lerp(MAP.minX, MAP.maxX, Math.random()); z = THREE.MathUtils.lerp(MAP.minZ, MAP.maxZ, Math.random()); }
      x = THREE.MathUtils.clamp(x, MAP.minX + 5, MAP.maxX - 5); z = THREE.MathUtils.clamp(z, MAP.minZ + 5, MAP.maxZ - 5);
      if (nav.freeAt(x, z, 0.8)) return { x, z };
    }
    return { x: this.pos.x + (Math.random() - 0.5) * 80, z: this.pos.z + (Math.random() - 0.5) * 80 };
  }
  /** Where to steer this frame: the target itself if the way is clear, else the next corner of an A* path. */
  pathStep(tx, tz, dt) {
    const nav = this.nav || (this.nav = new NavGrid(this.getCity));
    this.planT -= dt; this.planCd -= dt;
    const px = this.pos.x, pz = this.pos.z, d = Math.hypot(tx - px, tz - pz);
    if (d < 2.5 || nav.lineClear(px, pz, tx, tz)) { this.path.length = 0; this.noPathT = 0; this.pathGoal = null; return { x: tx, z: tz }; }
    const moved = !this.pathGoal || Math.hypot(this.pathGoal.x - tx, this.pathGoal.z - tz) > 4;
    if ((moved && this.planCd <= 0) || !this.path.length && this.planCd <= 0 || this.planT <= 0) {
      const t0 = performance.now(); const r = nav.findPath(px, pz, tx, tz);
      this.stats.plans++; this.stats.planMs += performance.now() - t0; this.planT = 2.5; this.planCd = 0.8; this.pathGoal = { x: tx, z: tz };
      if (r && r.pts.length) {
        this.path = r.pts;
        const end = r.pts[r.pts.length - 1], endD = Math.hypot(end.x - tx, end.z - tz);
        if (!r.partial || endD < this.pathBest - 3) this.noPathT = 0; else this.noPathT += 0.8; // partial path that makes no progress = unreachable
        this.pathBest = Math.min(this.pathBest, endD);
      } else { this.path.length = 0; this.noPathT += 0.8; } // counts planning rounds, not frames
    }
    while (this.path.length && Math.hypot(this.path[0].x - px, this.path[0].z - pz) < 1.0) this.path.shift();
    if (this.noPathT > 6) return { x: tx, z: tz, giveUp: true };
    return this.path.length ? this.path[0] : { x: tx, z: tz };
  }
  nearestZombie() {
    let best = null, bd = 18; const list = (this.zombies && this.zombies.zombies) || [];
    for (const z of list) { if (!z.pos || z.state === 'dead') continue; const d = Math.hypot(z.pos.x - this.pos.x, z.pos.z - this.pos.z); if (d < bd && Math.hypot(z.pos.x - this.hero.position.x, z.pos.z - this.hero.position.z) < 26) { bd = d; best = z; } }
    return best;
  }

  // ------------------------------------------------------------------ command API (used by the real GOKU)
  command(c = {}) {
    if (c.type === 'follow' || c.type === 'explore' || c.type === 'hold') { this.mode = c.type; this.waypoint = null; this.resetNav(); }
    else if (c.type === 'goto' && Number.isFinite(c.x) && Number.isFinite(c.z)) { this.mode = 'goto'; this.waypoint = { x: c.x, z: c.z }; this.resetNav(); }
    else if (c.type === 'enable') this.setEnabled(!!c.value);
    else return { ok: false, error: 'unknown command' };
    return { ok: true, mode: this.mode };
  }
  setEnabled(v) { this.enabled = !!v; if (this.group) this.group.visible = this.enabled; if (this.enabled) this.placeNearHero(); }
  status() { return { enabled: this.enabled, mode: this.mode, x: +this.pos.x.toFixed(1), z: +this.pos.z.toFixed(1), anim: this.anim && this.anim.currentState, notes: this.notesList.length, stats: { ...this.stats }, nav: this.nav ? { ...this.nav.stats, cells: this.nav.cache.size } : null }; }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    if (!this.ready) return;
    if (!this.enabled) { if (this.chip) this.chip.textContent = ''; return; }
    this.rawDt = dt; dt = Math.min(dt, 0.1); this.t += dt; this.stats.framesSeen++;
    const hero = this.hero, hp = hero.position;
    if (Number.isFinite(this._hpx)) { const hs = Math.min(12, Math.hypot(hp.x - this._hpx, hp.z - this._hpz) / Math.max(dt, 1e-4)); this.heroSpd += (hs - this.heroSpd) * Math.min(1, dt * 4); }
    this._hpx = hp.x; this._hpz = hp.z;
    if (![hp.x, hp.y, hp.z].every(Number.isFinite) || hp.y < -3) this.note('hero_out_of_world', 'hero position invalid or below the world', hp.x === hp.x ? hp : this.pos);
    if (hero.airTime > 2.5 && hp.y > 0.6) this.note('hero_long_airtime', 'hero airborne > 2.5 s (floating or falling)', hp);
    if (this.rawDt > 0.2) this.note('lag_spike', `frame took ${Math.round(this.rawDt * 1000)} ms`, hp);

    const inCar = this.vehicles && this.vehicles.mode !== 'foot';
    if (inCar) { this.group.visible = false; this.pos.set(hp.x, hp.y, hp.z); this.wasInCar = true; return; }
    if (this.wasInCar) { this.wasInCar = false; this.group.visible = true; this.placeNearHero(); }

    // ---- decide where to go
    let tx = this.pos.x, tz = this.pos.z, want = 0, attack = false, zt = null;
    if (this.attackCd > 0) this.attackCd -= dt;
    const dHero = Math.hypot(hp.x - this.pos.x, hp.z - this.pos.z);
    if (this.mode === 'follow') {
      zt = this.nearestZombie();
      if (zt) {
        tx = zt.pos.x; tz = zt.pos.z; const d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
        if (d < 1.7) { attack = true; want = 0; } else want = 4.3;
      } else {
        const a = hero.yaw + 2.4; tx = hp.x + Math.sin(a) * 3.2; tz = hp.z + Math.cos(a) * 3.2; const d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
        // match the hero's pace and close the gap smoothly (hero run 4.2, sprint 6.8 m/s)
        want = d < 0.8 ? 0 : Math.min(7.4, Math.max(1.7, this.heroSpd + (d - 2.5) * 1.1));
      }
      if (dHero > 45) { this.stats.teleports++; this.note('partner_teleport', 'partner was >45 m behind and was teleported back'); this.placeNearHero(); }
    } else if (this.mode === 'explore' || this.mode === 'goto') {
      if (!this.waypoint || Math.hypot(this.waypoint.x - this.pos.x, this.waypoint.z - this.pos.z) < 2.5) {
        if (this.mode === 'goto') { this.mode = 'hold'; this.waypoint = null; }
        else { this.waypoint = this.pickWaypoint(); this.resetNav(); }
      }
      if (this.waypoint) { tx = this.waypoint.x; tz = this.waypoint.z; want = 4.2; }
    } // 'hold': stand still

    // ---- steer (with a detour when stuck against something)
    let gx = tx, gz = tz;
    if (!attack && this.mode !== 'hold') { const st = this.pathStep(tx, tz, dt); gx = st.x; gz = st.z; if (st.giveUp) { if (this.mode === 'follow') { this.stats.teleports++; this.note('partner_teleport', 'no walkable path to the hero for 6 s, teleported'); this.placeNearHero(); } else { this.stats.giveUps++; this.note('partner_gave_up', 'no walkable path to the target, picked a new one'); this.waypoint = null; } this.path.length = 0; this.noPathT = 0; } }
    let dx = gx - this.pos.x, dz = gz - this.pos.z; const dist = Math.hypot(dx, dz);
    let desiredYaw = dist > 0.05 ? Math.atan2(dx, dz) : this.yaw;
    if (attack && zt) desiredYaw = Math.atan2(zt.pos.x - this.pos.x, zt.pos.z - this.pos.z);
    if (this.detour > 0) { this.detour -= dt; desiredYaw += this.detourSign * 1.2; want = Math.max(want, 1.7); }
    const dy = wrap(desiredYaw - this.yaw); const turn = THREE.MathUtils.clamp(dy, -9 * dt, 9 * dt); this.yaw += turn; this.yawRate = turn / dt;
    const align = Math.max(0, Math.cos(dy)); // slow down while turning
    const targetSpeed = want * (0.35 + 0.65 * align);
    this.speed += THREE.MathUtils.clamp(targetSpeed - this.speed, -14 * dt, 9 * dt);

    const px = this.pos.x, pz = this.pos.z;
    this.pos.x += Math.sin(this.yaw) * this.speed * dt; this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    const pushed = this.resolveStatic();
    this.groundSnap();
    const moved = Math.hypot(this.pos.x - px, this.pos.z - pz); this.stats.metersWalked += moved;
    const realSpeed = moved / Math.max(dt, 1e-4);

    // ---- glitch watch: wants to move but does not
    if (want > 1.5 && !attack) {
      if (this.stuckT === 0) this.stuckRef.copy(this.pos);
      this.stuckT += dt;
      if (this.stuckT > 1.2 && this.pos.distanceTo(this.stuckRef) < 0.5) {
        this.stats.stuckEvents++; this.note('partner_stuck', 'partner cannot make progress (blocked or trapped)'); this.detour = 1.6; this.detourSign = Math.random() < 0.5 ? -1 : 1; this.stuckT = 0; this.planT = 0; this.planCd = 0; this.path.length = 0;
        if (this.stats.stuckEvents % 4 === 0) { this.stats.teleports++; if (this.mode === 'follow') { this.note('partner_teleport', 'stuck 4 times, teleported to hero'); this.placeNearHero(); } else { this.note('partner_gave_up', 'stuck 4 times at this spot, picked a new target'); this.waypoint = null; } }
      } else if (this.pos.distanceTo(this.stuckRef) >= 0.5) this.stuckT = 0;
    } else this.stuckT = 0;
    if (pushed > 0.25) this.note('partner_inside_solid', `pushed out of a solid by ${pushed.toFixed(2)} m`);
    if (!Number.isFinite(this.pos.x + this.pos.y + this.pos.z) || this.pos.y < -3) { this.note('partner_out_of_world', 'partner position invalid'); this.placeNearHero(); }
    if (!this.hasGround) { this.airT += dt; if (this.airT > 1.5) { this.note('no_ground', 'nothing to stand on here (hole in the world?)'); this.airT = 0; this.pos.y = 0; } } else this.airT = 0;

    // ---- attack
    if (attack && this.attackCd <= 0 && zt) { this.attackCd = 0.95; this.attackT = 0.5; this.hitDone = false; }
    if (this.attackT > 0) {
      this.attackT -= dt;
      if (!this.hitDone && this.attackT < 0.3 && zt && zt.state !== 'dead') {
        this.hitDone = true; this.stats.zombieHits++;
        const dir = new THREE.Vector3(zt.pos.x - this.pos.x, 0, zt.pos.z - this.pos.z).normalize();
        zt.onHit(24, dir, new THREE.Vector3(zt.pos.x, 1.2, zt.pos.z), 'melee');
      }
    }

    // ---- pose
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    this.anim.update(dt, { horizontalSpeed: realSpeed, airTime: 0, verticalVelocity: 0, isCrouching: false, isSprinting: this.speed > 5.2, justJumped: false, yawDelta: this.yawRate * dt, forwardSpeed: realSpeed });
    if (this.attackT > 0) { // simple strike: right arm swings forward and down
      const k = Math.sin(Math.min(1, (0.5 - this.attackT) / 0.5) * Math.PI);
      this.bones.RightArm.rotateX(-1.6 * k); this.bones.RightForeArm.rotateX(-0.5 * k); this.bones.Spine.rotateY(-0.25 * k);
    }
    if (this.chip) this.chip.textContent = `GOKU ${this.mode} · notes ${this.notesList.length} · stuck ${this.stats.stuckEvents}`;
  }
}

export function installGokuApi(partner) {
  window.__OZ_GOKU = Object.freeze({
    status: () => partner.status(), notes: () => partner.notesList.map((n) => ({ ...n })),
    clearNotes: () => { partner.notesList.length = 0; partner.noteSeen.clear(); try { localStorage.removeItem(NOTE_KEY); } catch (_) { /* ignore */ } },
    command: (c) => partner.command(c), setEnabled: (v) => partner.setEnabled(v)
  });
}
