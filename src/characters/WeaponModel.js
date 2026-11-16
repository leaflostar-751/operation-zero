import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Procedural assault rifle (about 0.85 m). Local frame: +Z = muzzle direction, +Y = up,
 * origin = centre of the pistol grip (where the firing hand holds it).
 * Returns { group, muzzle, gripR, gripL, magazine, stockPoint, sightPoint, length }.
 */
export function buildRifle() {
  const group = new THREE.Group();
  group.name = 'rifle';

  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.38, metalness: 0.9 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.45, metalness: 0.85 });
  const polymer = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.78, metalness: 0.05 });
  const tan = new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.7, metalness: 0.08 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x103040,
    roughness: 0.05,
    metalness: 0.2,
    emissive: 0x0a2a40,
    emissiveIntensity: 0.6
  });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const rbox = (w, h, d, r = 0.006) => new RoundedBoxGeometry(w, h, d, 3, r);
  const cyl = (rt, rb, len, seg = 20) => new THREE.CylinderGeometry(rt, rb, len, seg);

  // receiver (upper + lower)
  add(rbox(0.045, 0.062, 0.34), metal, 0, 0.075, 0.12);
  add(rbox(0.04, 0.052, 0.17), darkMetal, 0, 0.018, 0.1);
  // top rail + ejection port detail
  add(rbox(0.026, 0.01, 0.36), darkMetal, 0, 0.113, 0.12, 0, 0, 0);
  add(rbox(0.006, 0.026, 0.07), darkMetal, 0.023, 0.082, 0.14);
  // charging handle
  add(rbox(0.026, 0.012, 0.03), darkMetal, 0, 0.12, -0.02);

  // handguard + barrel + muzzle device
  add(rbox(0.05, 0.056, 0.26), polymer, 0, 0.066, 0.4);
  for (let i = 0; i < 5; i++) {
    add(rbox(0.054, 0.006, 0.012), darkMetal, 0, 0.098, 0.3 + i * 0.045);
  }
  add(cyl(0.0085, 0.0085, 0.2), darkMetal, 0, 0.07, 0.62, Math.PI / 2, 0, 0);
  add(cyl(0.015, 0.015, 0.075, 16), darkMetal, 0, 0.07, 0.72, Math.PI / 2, 0, 0); // suppressor
  // front sight
  add(rbox(0.008, 0.04, 0.012), darkMetal, 0, 0.125, 0.52);

  // pistol grip + trigger guard
  add(rbox(0.032, 0.105, 0.045), polymer, 0, -0.04, -0.012, 0.28, 0, 0);
  add(rbox(0.012, 0.01, 0.085), darkMetal, 0, -0.012, 0.075);
  add(rbox(0.01, 0.034, 0.012), darkMetal, 0, -0.026, 0.115);

  // stock
  add(rbox(0.04, 0.045, 0.16), polymer, 0, 0.06, -0.15);
  add(rbox(0.045, 0.1, 0.03), polymer, 0, 0.045, -0.245, -0.12, 0, 0);

  // magazine (curved look via slight tilt)
  const magazine = new THREE.Group();
  magazine.position.set(0, -0.012, 0.16);
  group.add(magazine);
  add(rbox(0.032, 0.14, 0.05), polymer, 0, -0.07, 0, 0.12, 0, 0, magazine);
  add(rbox(0.034, 0.012, 0.052), darkMetal, 0, -0.145, -0.012, 0.12, 0, 0, magazine);

  // foregrip
  add(rbox(0.026, 0.07, 0.03), polymer, 0, -0.006, 0.34, 0.1, 0, 0);

  // red-dot / holo optic
  add(rbox(0.036, 0.012, 0.07), darkMetal, 0, 0.125, 0.1);
  add(rbox(0.04, 0.05, 0.07), darkMetal, 0, 0.158, 0.1);
  add(new THREE.PlaneGeometry(0.03, 0.034), glass, 0, 0.16, 0.136);
  add(new THREE.PlaneGeometry(0.03, 0.034), glass, 0, 0.16, 0.064, 0, Math.PI, 0);

  // sling swivel / tan accent
  add(rbox(0.02, 0.02, 0.05), tan, 0.027, 0.07, 0.3);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.07, 0.765);
  group.add(muzzle);

  const gripR = new THREE.Object3D(); // palm of the firing hand
  gripR.position.set(0, -0.03, -0.01);
  group.add(gripR);

  const gripL = new THREE.Object3D(); // palm of the support hand
  gripL.position.set(0, 0.0, 0.36);
  group.add(gripL);

  const stockPoint = new THREE.Object3D(); // shoulder contact
  stockPoint.position.set(0, 0.04, -0.26);
  group.add(stockPoint);

  const sightPoint = new THREE.Object3D(); // where the eye lines up when aiming
  sightPoint.position.set(0, 0.16, -0.1);
  group.add(sightPoint);

  return { group, muzzle, gripR, gripL, magazine, stockPoint, sightPoint, length: 0.85 };
}
