import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const MAX_TILT_COS = Math.cos((38 * Math.PI) / 180);

const _q = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _delta = new THREE.Quaternion();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

/** Rotate `bone` (world space) so direction `from` becomes direction `to`. */
function rotateBoneWorld(bone, from, to) {
  _from.copy(from);
  _to.copy(to);
  if (_from.lengthSq() < 1e-10 || _to.lengthSq() < 1e-10) return;
  _from.normalize();
  _to.normalize();
  _delta.setFromUnitVectors(_from, _to);
  bone.getWorldQuaternion(_q);
  _q.premultiply(_delta); // delta * world
  setBoneWorldQuaternion(bone, _q);
}

function setBoneWorldQuaternion(bone, worldQ) {
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_qParent);
    _qParent.invert();
    bone.quaternion.copy(_qParent.multiply(worldQ));
  } else {
    bone.quaternion.copy(worldQ);
  }
}

function smoothstep(x, a, b) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Analytic two-bone foot IK.
 *
 * Each step (after the animation mixer has written the pose):
 *  1. ray-cast under both ankles into Rapier
 *  2. how much higher/lower the ground is than the capsule base = how far the foot must move,
 *     but only while the animated foot is near the ground (so swing phases are untouched)
 *  3. lower the pelvis for the lowest foot
 *  4. solve hip-knee-ankle so the ankle reaches its target (knee keeps the animated bend side)
 *  5. keep the foot's world orientation, tilted to the ground normal while planted
 *
 * With flat ground everything resolves to zero and the animation is left exactly as authored.
 */
export class FootIKSolver {
  constructor(physics, bones, options = {}) {
    this.physics = physics;
    this.bones = bones;
    this.footHeight = options.footHeight ?? 0.09; // ankle height above the sole
    this.enabled = true;
    this.pelvisShift = 0;

    const makeLeg = (side) => ({
      hip: bones[`${side}UpLeg`],
      knee: bones[`${side}Leg`],
      foot: bones[`${side}Foot`],
      shift: 0,
      weight: 0,
      normal: new THREE.Vector3(0, 1, 0),
      anim: new THREE.Vector3()
    });
    this.legs = [makeLeg('Left'), makeLeg('Right')];

    this._origin = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._P0 = new THREE.Vector3();
    this._P1 = new THREE.Vector3();
    this._P2 = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._pole = new THREE.Vector3();
    this._knee = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._footQ = new THREE.Quaternion();
    this._tilt = new THREE.Quaternion();
    this._ident = new THREE.Quaternion();
  }

  isValid() {
    return Boolean(
      this.bones.Hips && this.legs.every((l) => l.hip && l.knee && l.foot)
    );
  }

  /**
   * @param {number} dt
   * @param {{isGrounded:boolean, baseY:number, yaw:number, excludeCollider:any}} ctx
   *        baseY = world Y of the capsule bottom (the ground the character stands on)
   */
  update(dt, ctx) {
    if (!this.enabled || !this.isValid()) return;
    const { isGrounded, baseY, yaw, excludeCollider } = ctx;
    const k = 1 - Math.exp(-dt * 14);

    // 1+2: sample animated ankle positions and the ground below them
    for (const leg of this.legs) {
      leg.foot.getWorldPosition(leg.anim);

      let targetShift = 0;
      let targetWeight = 0;
      let nx = 0;
      let ny = 1;
      let nz = 0;

      if (isGrounded) {
        this._origin.set(leg.anim.x, Math.max(leg.anim.y, baseY) + 0.5, leg.anim.z);
        const hit = this.physics.castRay(this._origin, DOWN, 1.4, excludeCollider);
        if (hit) {
          const ankleAboveGround = leg.anim.y - (hit.point.y + this.footHeight);
          targetWeight = 1 - smoothstep(ankleAboveGround, 0.04, 0.3);
          targetShift = THREE.MathUtils.clamp(hit.point.y - baseY, -0.4, 0.4) * targetWeight;
          if (hit.normal.y >= MAX_TILT_COS) {
            nx = hit.normal.x;
            ny = hit.normal.y;
            nz = hit.normal.z;
          }
        }
      }

      leg.shift += (targetShift - leg.shift) * k;
      leg.weight += (targetWeight - leg.weight) * k;
      leg.normal.x += (nx - leg.normal.x) * k;
      leg.normal.y += (ny - leg.normal.y) * k;
      leg.normal.z += (nz - leg.normal.z) * k;
      leg.normal.normalize();
    }

    // 3: pelvis follows the lowest foot (never rises)
    const lowest = Math.min(0, this.legs[0].shift, this.legs[1].shift);
    this.pelvisShift += (lowest * 0.7 - this.pelvisShift) * k;

    const negligible =
      Math.abs(this.legs[0].shift) < 0.002 &&
      Math.abs(this.legs[1].shift) < 0.002 &&
      Math.abs(this.pelvisShift) < 0.002 &&
      this.legs[0].weight < 0.02 &&
      this.legs[1].weight < 0.02;
    if (negligible) return; // leave the animation untouched

    if (Math.abs(this.pelvisShift) > 1e-5) {
      const parent = this.bones.Hips.parent;
      const sy = parent ? parent.getWorldScale(this._scale).y || 1 : 1;
      this.bones.Hips.position.y += this.pelvisShift / sy;
    }

    this._fwd.set(Math.sin(yaw), 0, Math.cos(yaw));

    // 4+5: per leg
    for (const leg of this.legs) {
      this._target.copy(leg.anim);
      this._target.y += leg.shift;
      this.solveLeg(leg, this._target);
    }
  }

  solveLeg(leg, target) {
    const { hip, knee, foot } = leg;
    const P0 = this._P0;
    const P1 = this._P1;
    const P2 = this._P2;

    hip.getWorldPosition(P0);
    knee.getWorldPosition(P1);
    foot.getWorldPosition(P2);
    foot.getWorldQuaternion(this._footQ); // remember orientation before the leg moves

    const L1 = P0.distanceTo(P1);
    const L2 = P1.distanceTo(P2);
    if (L1 < 1e-4 || L2 < 1e-4) return;

    this._dir.subVectors(target, P0);
    const dist = THREE.MathUtils.clamp(this._dir.length(), 0.05, (L1 + L2) * 0.999);
    this._dir.normalize();

    // law of cosines: distance along the hip->target axis and height of the knee off it
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));

    // knee keeps bending to the same side as in the animation
    this._pole.subVectors(P1, P0);
    this._pole.addScaledVector(this._dir, -this._pole.dot(this._dir));
    if (this._pole.lengthSq() < 1e-6) {
      this._pole.copy(this._fwd);
      this._pole.addScaledVector(this._dir, -this._pole.dot(this._dir));
    }
    this._pole.normalize();

    this._knee.copy(P0).addScaledVector(this._dir, a).addScaledVector(this._pole, h);

    // rotate thigh: old hip->knee  =>  new hip->knee
    _from.subVectors(P1, P0);
    _to.subVectors(this._knee, P0);
    rotateBoneWorld(hip, _from, _to);

    // rotate shin: (knee->ankle after thigh moved)  =>  (knee->reachable ankle)
    knee.getWorldPosition(P1);
    foot.getWorldPosition(P2);
    const reachable = this._dir.multiplyScalar(dist).add(P0); // hip + dir * dist
    _from.subVectors(P2, P1);
    _to.subVectors(reachable, P1);
    rotateBoneWorld(knee, _from, _to);

    // foot: restore animated world orientation, then tilt to the ground while planted
    _q.copy(this._footQ);
    if (leg.weight > 0.02) {
      this._tilt.setFromUnitVectors(UP, leg.normal);
      this._tilt.slerp(this._ident, 1 - Math.min(1, leg.weight) * 0.8);
      _q.premultiply(this._tilt);
    }
    setBoneWorldQuaternion(foot, _q);
  }
}
