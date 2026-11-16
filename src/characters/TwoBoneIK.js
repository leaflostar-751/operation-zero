import * as THREE from 'three';

const _q = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _delta = new THREE.Quaternion();
const _ident = new THREE.Quaternion();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _P0 = new THREE.Vector3();
const _P1 = new THREE.Vector3();
const _P2 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _reach = new THREE.Vector3();

export function setBoneWorldQuaternion(bone, worldQ) {
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_qParent);
    _qParent.invert();
    bone.quaternion.copy(_qParent.multiply(worldQ));
  } else {
    bone.quaternion.copy(worldQ);
  }
}

/** Rotate `bone` in world space so direction `from` becomes direction `to` (scaled by weight 0..1). */
export function rotateBoneWorld(bone, from, to, weight = 1) {
  _from.copy(from);
  _to.copy(to);
  if (_from.lengthSq() < 1e-10 || _to.lengthSq() < 1e-10) return;
  _from.normalize();
  _to.normalize();
  _delta.setFromUnitVectors(_from, _to);
  if (weight < 1) _delta.slerp(_ident, 1 - weight);
  bone.getWorldQuaternion(_q);
  _q.premultiply(_delta);
  setBoneWorldQuaternion(bone, _q);
}

/** Rotate `bone` about a world axis by `angle` radians. */
export function rotateBoneAboutAxis(bone, axis, angle) {
  if (Math.abs(angle) < 1e-6) return;
  _delta.setFromAxisAngle(axis, angle);
  bone.getWorldQuaternion(_q);
  _q.premultiply(_delta);
  setBoneWorldQuaternion(bone, _q);
}

/**
 * Analytic two-bone IK in world space (arms and legs).
 * upper = shoulder/hip, mid = elbow/knee, end = wrist/ankle.
 * `poleDir` (world vector) says which way the elbow/knee should bend; if null the bend side
 * of the current pose is kept.
 * `weight` blends from the current pose (0) to the solved pose (1).
 * @returns {boolean} true if the target was reachable without stretching
 */
export function solveTwoBone(upper, mid, end, target, poleDir = null, weight = 1) {
  if (weight <= 1e-4) return true;

  upper.getWorldPosition(_P0);
  mid.getWorldPosition(_P1);
  end.getWorldPosition(_P2);

  const L1 = _P0.distanceTo(_P1);
  const L2 = _P1.distanceTo(_P2);
  if (L1 < 1e-4 || L2 < 1e-4) return true;

  // blend the target with the current end position for partial weights
  _reach.copy(_P2).lerp(target, Math.min(1, weight));

  _dir.subVectors(_reach, _P0);
  const rawDist = _dir.length();
  const maxReach = (L1 + L2) * 0.999;
  const dist = THREE.MathUtils.clamp(rawDist, Math.abs(L1 - L2) + 0.02, maxReach);
  _dir.normalize();

  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));

  if (poleDir) {
    _pole.copy(poleDir);
  } else {
    _pole.subVectors(_P1, _P0);
  }
  _pole.addScaledVector(_dir, -_pole.dot(_dir));
  if (_pole.lengthSq() < 1e-6) {
    _pole.set(0, -1, 0).addScaledVector(_dir, _dir.y); // any perpendicular, biased downward
  }
  _pole.normalize();

  _knee.copy(_P0).addScaledVector(_dir, a).addScaledVector(_pole, h);

  _from.subVectors(_P1, _P0);
  _to.subVectors(_knee, _P0);
  rotateBoneWorld(upper, _from, _to);

  mid.getWorldPosition(_P1);
  end.getWorldPosition(_P2);
  _to.copy(_dir).multiplyScalar(dist).add(_P0); // reachable end position
  _from.subVectors(_P2, _P1);
  _to.sub(_P1);
  rotateBoneWorld(mid, _from, _to);

  return rawDist <= maxReach;
}
