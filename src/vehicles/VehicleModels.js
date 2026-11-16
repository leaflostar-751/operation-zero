import * as THREE from 'three';
import { hasImportedVehicle, adaptImported } from './VehicleImporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural vehicles (generic designs, no brand marks).
 * Vehicle local frame: +Z forward, +Y up, +X = the vehicle's LEFT.
 * buildVehicle(type, { color }) -> {
 *   group, bodyGroup, wheels:[{pivot, spin, steer, radius, side}], seat, doorPoint,
 *   steeringWheel (rotor, children handL/handR), handL, handR, pedalPoints:{accel,brake,rest},
 *   pegs:{L,R}, handlebar:{L,R}, brakeLights:[mat], headlights:[mat], dims, info
 * }
 */

export const VEHICLE_INFO = {
  'apex-gt': { name: 'Apex GT', kind: 'car', blurb: 'JDM-style fastback coupe' },
  stallion: { name: 'Stallion V8', kind: 'car', blurb: 'American muscle' },
  ranger: { name: 'Ranger 4x4', kind: 'car', blurb: 'Boxy off-road SUV' },
  vortex: { name: 'Vortex R', kind: 'car', blurb: 'Wedge hypercar' },
  'sprint-r': { name: 'Sprint-R', kind: 'bike', blurb: 'Full-fairing superbike' }
};
export const VEHICLE_TYPES = Object.keys(VEHICLE_INFO);

export const PAINT = {
  red: 0xb0101a,
  white: 0xe8ebee,
  black: 0x08080a,
  blue: 0x15399a,
  yellow: 0xe5b30a,
  silver: 0x9ba1a8,
  green: 0x145a38,
  orange: 0xdb5a14,
  graphite: 0x34383d,
  purple: 0x4a1a72
};

const DEFAULT_COLOR = {
  'apex-gt': 'blue',
  stallion: 'orange',
  ranger: 'green',
  vortex: 'yellow',
  'sprint-r': 'red'
};

// ------------------------------------------------------------------ materials
function makeMaterials(colorHex) {
  const paint = new THREE.MeshPhysicalMaterial({
    name: 'car_paint',
    color: colorHex,
    metalness: 0.62,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.2
  });
  return {
    paint,
    glass: new THREE.MeshPhysicalMaterial({
      name: 'glass',
      color: 0x0b1319,
      metalness: 0.1,
      roughness: 0.05,
      transparent: true,
      opacity: 0.38,
      clearcoat: 1,
      envMapIntensity: 1.4,
      depthWrite: false
    }),
    chrome: new THREE.MeshStandardMaterial({ name: 'chrome', color: 0xdfe3e8, metalness: 1, roughness: 0.12 }),
    steel: new THREE.MeshStandardMaterial({ name: 'steel', color: 0x777d84, metalness: 0.9, roughness: 0.38 }),
    darkMetal: new THREE.MeshStandardMaterial({ name: 'dark_metal', color: 0x1b1d20, metalness: 0.85, roughness: 0.4 }),
    trim: new THREE.MeshStandardMaterial({ name: 'trim', color: 0x0c0c0e, metalness: 0.2, roughness: 0.55 }),
    plastic: new THREE.MeshStandardMaterial({ name: 'plastic', color: 0x17181a, metalness: 0.05, roughness: 0.75 }),
    rubber: new THREE.MeshStandardMaterial({ name: 'tire', color: 0x0d0d0e, metalness: 0, roughness: 0.92 }),
    leather: new THREE.MeshStandardMaterial({ name: 'leather', color: 0x201a18, metalness: 0.02, roughness: 0.62 }),
    seatAccent: new THREE.MeshStandardMaterial({ name: 'seat_accent', color: 0x6a1010, metalness: 0.02, roughness: 0.6 }),
    carbon: new THREE.MeshStandardMaterial({ name: 'carbon', color: 0x101114, metalness: 0.5, roughness: 0.32 }),
    headlight: new THREE.MeshStandardMaterial({
      name: 'headlight', color: 0xf4f8ff, emissive: 0xdfe9ff, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.15
    }),
    amber: new THREE.MeshStandardMaterial({
      name: 'amber', color: 0xff9a1a, emissive: 0xff7a00, emissiveIntensity: 0.25, roughness: 0.3
    }),
    tail: new THREE.MeshStandardMaterial({
      name: 'taillight', color: 0xb00010, emissive: 0xff0018, emissiveIntensity: 0.55, roughness: 0.25
    }),
    caliper: new THREE.MeshStandardMaterial({ name: 'caliper', color: 0xc40d12, metalness: 0.4, roughness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ name: 'plate', color: 0xdad8cf, metalness: 0, roughness: 0.5 }),
    stripe: new THREE.MeshStandardMaterial({ name: 'stripe', color: 0xf1f1ee, metalness: 0.2, roughness: 0.35 }),
    gold: new THREE.MeshStandardMaterial({ name: 'gold', color: 0xc9a227, metalness: 1, roughness: 0.28 })
  };
}

// ------------------------------------------------------------------ geometry helpers
function cleanPts(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-4) out.push(p);
  }
  return out;
}

/** Extrude a side profile ([z,y] points) across the vehicle width; result is centred on x = 0. */
function extrudeProfile(pts, width, { bevelT = 0.035, bevelS = 0.035, segs = 3, curve = 10 } = {}) {
  const shape = new THREE.Shape(cleanPts(pts).map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = Math.max(0.002, width - 2 * bevelT);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelT > 0,
    bevelThickness: bevelT,
    bevelSize: bevelS,
    bevelSegments: segs,
    curveSegments: curve,
    steps: 1
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2); // shape x -> +Z (forward), extrusion -> X
  return g;
}

/** Bend the silhouette: tumblehome above y0 and a narrowing nose / tail. Mutates positions. */
function shapeBody(geo, s) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const z = p.getZ(i);
    let f = 1;
    if (s.k && y > s.y0) {
      const t = Math.min(1, (y - s.y0) / Math.max(0.01, s.y1 - s.y0));
      f *= 1 - s.k * t * (0.6 + 0.4 * t);
    }
    if (s.nose && z > s.zNose) {
      const t = Math.min(1, (z - s.zNose) / Math.max(0.01, s.zFront - s.zNose));
      f *= 1 - s.nose * t * t;
    }
    if (s.tail && z < s.zTail) {
      const t = Math.min(1, (s.zTail - z) / Math.max(0.01, s.zTail - s.zRear));
      f *= 1 - s.tail * t * t;
    }
    p.setX(i, p.getX(i) * f);
  }
  p.needsUpdate = true;
  return geo;
}

function smoothNormals(geo, angle = 0.7) {
  geo.deleteAttribute('normal');
  if (geo.index) geo = geo.toNonIndexed();
  geo = toCreasedNormals(geo, angle);
  return geo;
}

function arcPts(zc, wr, R, yb, steps = 16) {
  const s0 = Math.asin(THREE.MathUtils.clamp((yb - wr) / R, -1, 1));
  const a0 = Math.PI - s0;
  const a1 = s0;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push([zc + R * Math.cos(a), wr + R * Math.sin(a)]);
  }
  return pts;
}

function bodyOutline(s) {
  const pts = [...s.front, ...s.rear];
  const last = s.rear[s.rear.length - 1];
  pts.push([last[0], s.yb]);
  pts.push(...arcPts(-s.wb / 2, s.wr, s.archR, s.yb));
  pts.push(...arcPts(s.wb / 2, s.wr, s.archR, s.yb));
  pts.push([s.front[0][0] - 0.04, s.yb]);
  return pts;
}

function zAtY(list, y) {
  // z of the polyline `list` at height y (first crossing)
  for (let i = 0; i < list.length - 1; i++) {
    const [z0, y0] = list[i];
    const [z1, y1] = list[i + 1];
    if ((y0 <= y && y1 >= y) || (y0 >= y && y1 <= y)) {
      const t = Math.abs(y1 - y0) < 1e-6 ? 0 : (y - y0) / (y1 - y0);
      return z0 + (z1 - z0) * t;
    }
  }
  return list[0][0];
}

/** Offset polyline into a thin strip polygon (for pillars, roof, stripes). */
function stripPoly(a, b, thick) {
  const dz = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dz, dy) || 1;
  // inward normal: towards -y for roof (left of travel when travelling rearwards): use rotate -90
  const nz = dy / len;
  const ny = -dz / len;
  const s = Math.sign(ny) <= 0 ? 1 : -1; // always point downwards-ish / inward
  return [
    [a[0], a[1]],
    [b[0], b[1]],
    [b[0] + nz * thick * s, b[1] + ny * thick * s],
    [a[0] + nz * thick * s, a[1] + ny * thick * s]
  ];
}

// ------------------------------------------------------------------ mesh builder
class Builder {
  constructor(M) {
    this.M = M;
    this.statics = new THREE.Group();
  }
  mesh(geo, mat, x = 0, y = 0, z = 0, parent = this.statics, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(w, h, d, mat, x, y, z, r = 0.01, parent) {
    const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)) : new THREE.BoxGeometry(w, h, d);
    return this.mesh(g, mat, x, y, z, parent);
  }
  cyl(rt, rb, len, mat, x, y, z, axis = 'y', seg = 20, parent) {
    const g = new THREE.CylinderGeometry(rt, rb, len, seg);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    return this.mesh(g, mat, x, y, z, parent);
  }
  tube(points, radius, mat, seg = 24, parent) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, radius, 8, false);
    return this.mesh(g, mat, 0, 0, 0, parent);
  }
}

/** Merge the static meshes of a group by material to cut draw calls. */
function mergeStatics(root, keepNames = []) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || keepNames.includes(o.name) || o.userData.keep) return;
    let g = o.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], shadow: o.castShadow });
    buckets.get(key).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const { mat, geos, shadow } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = shadow && !mat.transparent;
    m.receiveShadow = true;
    root.add(m);
    for (const g of geos) g.dispose();
  }
}

// ------------------------------------------------------------------ wheels
function buildTire(M, R, rimR, width) {
  const wd = width / 2;
  const sw = (R - rimR) * 0.35;
  const g = 0.012;
  const prof = [
    [rimR - 0.004, -wd * 0.78],
    [rimR + sw * 0.6, -wd * 0.98],
    [R - sw * 0.9, -wd * 1.0],
    [R - 0.014, -wd * 0.9],
    [R, -wd * 0.74],
    [R, -wd * 0.46],
    [R - g, -wd * 0.4],
    [R - g, -wd * 0.2],
    [R, -wd * 0.14],
    [R, wd * 0.14],
    [R - g, wd * 0.2],
    [R - g, wd * 0.4],
    [R, wd * 0.46],
    [R, wd * 0.74],
    [R - 0.014, wd * 0.9],
    [R - sw * 0.9, wd * 1.0],
    [rimR + sw * 0.6, wd * 0.98],
    [rimR - 0.004, wd * 0.78]
  ].map(([r, a]) => new THREE.Vector2(r, a));
  let geo = new THREE.LatheGeometry(prof, 56);
  geo.rotateZ(Math.PI / 2); // axle along X
  geo = smoothNormals(geo, 0.9);
  return new THREE.Mesh(geo, M.rubber);
}

/** Wheel assembly with its face towards +X (mirror with scale.x for the right side). */
function buildWheelParts(M, o) {
  const { R, rimR, width, style = 'five', rimMat = M.chrome } = o;
  const wd = width / 2;
  const spin = new THREE.Group();
  const hub = new THREE.Group();

  const tire = buildTire(M, R, rimR, width);
  tire.castShadow = true;
  spin.add(tire);

  // barrel
  const barrel = new THREE.LatheGeometry(
    [
      [rimR - 0.012, -wd * 0.82],
      [rimR - 0.012, wd * 0.78],
      [rimR + 0.004, wd * 0.84],
      [rimR - 0.004, wd * 0.9]
    ].map(([r, a]) => new THREE.Vector2(r, a)),
    40
  );
  barrel.rotateZ(Math.PI / 2);
  spin.add(new THREE.Mesh(barrel, rimMat));
  // dark disc behind the spokes
  const back = new THREE.CircleGeometry(rimR - 0.012, 32);
  back.rotateY(Math.PI / 2);
  const backMesh = new THREE.Mesh(back, M.darkMetal);
  backMesh.position.x = wd * 0.1;
  spin.add(backMesh);

  const faceX = wd * 0.62;
  const spokeThick = 0.022;
  const addSpoke = (len, w, angle, radiusMid, tilt = 0) => {
    const g = new THREE.BoxGeometry(spokeThick, len, w);
    const m = new THREE.Mesh(g, rimMat);
    m.position.set(faceX, 0, 0);
    // rotate about the X (axle) axis
    const holder = new THREE.Group();
    holder.rotation.x = angle;
    m.position.set(faceX - Math.abs(tilt), radiusMid, 0);
    m.rotation.z = tilt;
    holder.add(m);
    spin.add(holder);
  };
  const L = rimR - 0.035;
  if (style === 'five') {
    for (let i = 0; i < 5; i++) addSpoke(L, 0.058, (i / 5) * Math.PI * 2, L / 2);
  } else if (style === 'multi10') {
    for (let i = 0; i < 10; i++) addSpoke(L, 0.022, (i / 10) * Math.PI * 2, L / 2);
  } else if (style === 'chunky6') {
    for (let i = 0; i < 6; i++) addSpoke(L, 0.075, (i / 6) * Math.PI * 2, L / 2);
    const ring = new THREE.TorusGeometry(rimR - 0.02, 0.012, 6, 36);
    ring.rotateY(Math.PI / 2);
    const rm = new THREE.Mesh(ring, M.darkMetal);
    rm.position.x = faceX + 0.01;
    spin.add(rm);
  } else if (style === 'turbine12') {
    for (let i = 0; i < 12; i++) addSpoke(L, 0.03, (i / 12) * Math.PI * 2, L / 2, 0.03);
  } else if (style === 'twin5') {
    for (let i = 0; i < 5; i++) {
      addSpoke(L, 0.024, (i / 5) * Math.PI * 2 + 0.08, L / 2);
      addSpoke(L, 0.024, (i / 5) * Math.PI * 2 - 0.08, L / 2);
    }
  }
  // hub cap + lug nuts
  const cap = new THREE.CylinderGeometry(0.045, 0.05, 0.03, 18);
  cap.rotateZ(Math.PI / 2);
  const capM = new THREE.Mesh(cap, M.darkMetal);
  capM.position.x = faceX + 0.005;
  spin.add(capM);
  if (o.lugs !== false) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const lug = new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6);
      lug.rotateZ(Math.PI / 2);
      const lm = new THREE.Mesh(lug, M.chrome);
      lm.position.set(faceX + 0.018, Math.sin(a) * 0.062, Math.cos(a) * 0.062);
      spin.add(lm);
    }
  }

  // brake disc (spins) + caliper (does not)
  const discR = rimR * (o.discScale || 0.8);
  const disc = new THREE.CylinderGeometry(discR, discR, 0.014, 40, 1);
  disc.rotateZ(Math.PI / 2);
  const discM = new THREE.Mesh(disc, M.steel);
  discM.position.x = -wd * 0.1;
  spin.add(discM);
  const discRing = new THREE.TorusGeometry(discR * 0.55, 0.01, 6, 28);
  discRing.rotateY(Math.PI / 2);
  const dr = new THREE.Mesh(discRing, M.darkMetal);
  dr.position.x = -wd * 0.1 + 0.008;
  spin.add(dr);

  const cal = new THREE.BoxGeometry(0.05, discR * 0.5, discR * 0.38);
  const calM = new THREE.Mesh(cal, M.caliper);
  const ca = o.caliperAngle ?? 0.9; // from top, towards front
  calM.position.set(-wd * 0.1, Math.cos(ca) * discR * 0.82, Math.sin(ca) * discR * 0.82);
  calM.rotation.x = -ca;
  hub.add(calM);

  return { spin, hub };
}

/** Returns { pivot, spin, steer, radius, side } positioned at (x, R, z) in `parent`. */
/** Merge all meshes below `root` into one mesh per material, in root's local space (keeps root's own transform/spin). */
function mergeLocal(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.keep || Array.isArray(o.material)) return;
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.noMergeSub) return;
    let g = o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = o.material.uuid + (o.castShadow ? 's' : 'n');
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], cast: o.castShadow });
    buckets.get(key).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const { mat, geos, cast } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = cast; m.receiveShadow = true;
    root.add(m);
    for (const g of geos) g.dispose();
  }
}

function addWheel(parent, M, o) {
  const { x, z, R, side, steer } = o;
  const pivot = new THREE.Group();
  pivot.position.set(x, R, z);
  parent.add(pivot);
  const { spin, hub } = buildWheelParts(M, o);
  spin.scale.x = side;
  hub.scale.x = side;
  pivot.add(spin, hub);
  pivot.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = m.material === M.rubber;
      m.receiveShadow = true;
    }
  });
  mergeLocal(spin);
  mergeLocal(hub);
  return { pivot, spin, steer: !!steer, radius: R, side };
}

// ------------------------------------------------------------------ car specs
const CARS = {
  'apex-gt': {
    L: 4.5, W: 1.82, wb: 2.6, wr: 0.335, tw: 0.245, rimR: 0.23, track: 1.56, yb: 0.13, archR: 0.41,
    zFront: 2.27, zRear: -2.28,
    front: [[2.25, 0.2], [2.28, 0.38], [2.23, 0.54], [2.1, 0.66], [1.85, 0.745], [1.2, 0.865], [0.62, 0.93]],
    rear: [[-0.9, 0.96], [-1.6, 0.99], [-2.05, 1.03], [-2.23, 0.99], [-2.29, 0.78], [-2.28, 0.5], [-2.21, 0.28], [-2.12, 0.17]],
    cab: [[0.58, 0.93], [-0.05, 1.27], [-0.78, 1.285], [-1.62, 0.985]],
    cabW: 0.88, cabK: 0.3, cabBase: 0.88, bodyK: 0.1, nose: 0.2, tail: 0.18, pillar: 0.07, cPillar: 0.2,
    doors: [0.5, -0.62], seatZ: -0.28, seatY: 0.36, recline: 0.3, wheelStyle: 'five', rimMat: 'chrome'
  },
  stallion: {
    L: 4.85, W: 1.95, wb: 2.75, wr: 0.355, tw: 0.285, rimR: 0.25, track: 1.65, yb: 0.15, archR: 0.43,
    zFront: 2.47, zRear: -2.42,
    front: [[2.44, 0.24], [2.47, 0.44], [2.42, 0.62], [2.34, 0.8], [2.1, 0.93], [1.0, 1.0], [0.58, 1.03]],
    rear: [[-1.15, 1.07], [-2.0, 1.09], [-2.36, 1.07], [-2.42, 0.92], [-2.42, 0.58], [-2.36, 0.32], [-2.26, 0.2]],
    cab: [[0.56, 1.02], [0.1, 1.36], [-0.62, 1.4], [-1.45, 1.08]],
    cabW: 0.86, cabK: 0.26, cabBase: 0.98, bodyK: 0.09, nose: 0.1, tail: 0.1, pillar: 0.08, cPillar: 0.22,
    doors: [0.42, -0.66], seatZ: -0.36, seatY: 0.4, recline: 0.28, wheelStyle: 'five', rimMat: 'chrome'
  },
  ranger: {
    L: 4.35, W: 1.92, wb: 2.55, wr: 0.4, tw: 0.3, rimR: 0.27, track: 1.62, yb: 0.3, archR: 0.5,
    zFront: 2.1, zRear: -2.15,
    front: [[2.08, 0.42], [2.1, 0.68], [2.08, 0.95], [2.0, 1.07], [1.4, 1.12], [0.95, 1.14]],
    rear: [[-1.88, 1.14], [-2.12, 1.14], [-2.15, 0.92], [-2.15, 0.6], [-2.1, 0.44]],
    cab: [[0.95, 1.12], [0.84, 1.8], [-1.86, 1.84], [-1.88, 1.12]],
    cabW: 0.93, cabK: 0.05, cabBase: 1.08, bodyK: 0.02, nose: 0.03, tail: 0.03, pillar: 0.09, cPillar: 0.16,
    doors: [0.7, -0.45, -1.7], seatZ: -0.2, seatY: 0.62, recline: 0.12, wheelStyle: 'chunky6', rimMat: 'darkMetal'
  },
  vortex: {
    L: 4.65, W: 2.0, wb: 2.7, wr: 0.345, tw: 0.3, rimR: 0.255, track: 1.7, yb: 0.1, archR: 0.42,
    zFront: 2.32, zRear: -2.35,
    front: [[2.28, 0.15], [2.32, 0.27], [2.22, 0.4], [1.8, 0.58], [1.3, 0.8], [0.9, 0.84], [0.45, 0.86]],
    rear: [[-1.2, 0.96], [-1.9, 0.96], [-2.25, 0.88], [-2.35, 0.65], [-2.33, 0.38], [-2.25, 0.2], [-2.15, 0.15]],
    cab: [[0.45, 0.86], [-0.1, 1.1], [-0.7, 1.13], [-1.25, 0.97]],
    cabW: 0.8, cabK: 0.34, cabBase: 0.84, bodyK: 0.12, nose: 0.3, tail: 0.2, pillar: 0.07, cPillar: 0.24,
    doors: [0.12, -0.7], seatZ: -0.12, seatY: 0.28, recline: 0.5, wheelStyle: 'turbine12', rimMat: 'darkMetal'
  }
};

// ------------------------------------------------------------------ interior
function buildInterior(B, s, out) {
  const { M } = B;
  const xd = 0.38 * Math.min(1, s.W / 1.9) + (s.W > 1.9 ? 0.02 : 0);
  const floorY = s.yb + 0.12;
  const zs = s.seatZ;

  // floor + roof liner + rear shelf
  B.box(s.W * 0.78, 0.04, s.cab[0][0] - s.cab[3][0] + 0.2, M.plastic, 0, floorY, (s.cab[0][0] + s.cab[3][0]) / 2, 0.01);

  // dashboard
  const dashY = s.cab[0][1] - 0.1;
  const dashZ = s.cab[0][0] - 0.28;
  B.box(s.W * 0.76, 0.16, 0.36, M.leather, 0, dashY, dashZ, 0.05);
  B.box(s.W * 0.7, 0.05, 0.3, M.trim, 0, dashY + 0.1, dashZ - 0.02, 0.02);
  // instrument cluster hood
  B.box(0.46, 0.1, 0.16, M.plastic, xd, dashY + 0.16, dashZ - 0.1, 0.03);
  // centre screen
  B.box(0.26, 0.15, 0.03, M.trim, 0, dashY + 0.2, dashZ - 0.1, 0.01);
  // centre console
  B.box(0.26, 0.2, 0.9, M.plastic, 0, floorY + 0.12, zs + 0.15, 0.04);
  B.box(0.07, 0.07, 0.07, M.chrome, 0, floorY + 0.28, zs + 0.2, 0.02); // shifter knob

  const seat = (x, z, accent) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    B.statics.add(g);
    B.box(0.5, 0.12, 0.52, M.leather, 0, s.seatY - 0.06, 0.0, 0.05, g);
    const back = B.box(0.5, 0.62, 0.13, M.leather, 0, s.seatY + 0.28, -0.26, 0.05, g);
    back.rotation.x = -s.recline * 0.85;
    const side1 = B.box(0.06, 0.4, 0.14, accent ? M.seatAccent : M.leather, 0.22, s.seatY + 0.28, -0.22, 0.03, g);
    side1.rotation.x = -s.recline * 0.85;
    const side2 = side1.clone();
    side2.position.x = -0.22;
    g.add(side2);
    const head = B.box(0.24, 0.2, 0.1, M.leather, 0, s.seatY + 0.66, -0.3 - Math.sin(s.recline * 0.85) * 0.2, 0.04, g);
    head.rotation.x = -s.recline * 0.85;
  };
  seat(xd, zs, true);
  seat(-xd, zs, true);
  if (s.rear !== 'none' && s.cab[3][0] < zs - 0.9 && s.rearSeat !== false) {
    B.box(0.95, 0.12, 0.45, M.leather, 0, s.seatY - 0.04, zs - 0.8, 0.05);
    B.box(0.95, 0.55, 0.12, M.leather, 0, s.seatY + 0.26, zs - 1.05, 0.05);
  }

  // steering column + wheel
  const tilt = 0.45;
  const colG = new THREE.Group();
  colG.position.set(xd, dashY + 0.05, zs + 0.52);
  B.statics.add(colG);
  B.cyl(0.025, 0.03, 0.3, M.plastic, 0, -0.05, -0.1, 'z', 10, colG);
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(xd, dashY + 0.12, zs + 0.38);
  wheelGroup.rotation.x = -tilt; // face rakes back towards the driver
  B.statics.add(wheelGroup);
  const rotor = new THREE.Group();
  rotor.name = 'steeringRotor';
  wheelGroup.add(rotor);
  wheelGroup.userData.keep = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 10, 36), M.leather);
  rim.userData.keep = true;
  const spokeG = new THREE.BoxGeometry(0.31, 0.022, 0.018);
  const sp1 = new THREE.Mesh(spokeG, M.darkMetal);
  const sp2 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.15, 0.018), M.darkMetal);
  sp2.position.y = -0.07;
  const hubM = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 16).rotateX(Math.PI / 2), M.plastic);
  for (const m of [rim, sp1, sp2, hubM]) {
    m.userData.keep = true;
    m.castShadow = true;
    rotor.add(m);
  }
  const handL = new THREE.Object3D();
  handL.position.set(0.168, 0.0, 0.0);
  const handR = new THREE.Object3D();
  handR.position.set(-0.168, 0.0, 0.0);
  rotor.add(handL, handR);
  out.steeringWheel = rotor;
  out.handL = handL;
  out.handR = handR;
  out.steeringGroup = wheelGroup;

  // pedals
  const pz = zs + 0.66;
  const accel = new THREE.Object3D();
  accel.position.set(xd - 0.12, floorY + 0.12, pz);
  const brake = new THREE.Object3D();
  brake.position.set(xd + 0.02, floorY + 0.14, pz);
  const rest = new THREE.Object3D();
  rest.position.set(xd + 0.2, floorY + 0.1, pz - 0.1);
  for (const p of [accel, brake, rest]) B.statics.add(p);
  B.box(0.07, 0.015, 0.1, M.chrome, accel.position.x, accel.position.y, accel.position.z, 0.004);
  B.box(0.07, 0.015, 0.1, M.chrome, brake.position.x, brake.position.y, brake.position.z, 0.004);
  out.pedalPoints = { accel, brake, rest };

  const seatObj = new THREE.Object3D();
  seatObj.position.set(xd, s.seatY + 0.07, zs);
  out.group.add(seatObj);
  out.seat = seatObj;
}

// ------------------------------------------------------------------ car builder
function buildCar(type, colorHex) {
  const s = CARS[type];
  const M = makeMaterials(colorHex);
  const B = new Builder(M);
  const group = new THREE.Group();
  group.name = `vehicle_${type}`;
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);
  bodyGroup.add(B.statics);

  const out = { group, bodyGroup, wheels: [], info: VEHICLE_INFO[type] };
  const shapeParams = {
    y0: 0.5, y1: Math.max(...s.rear.map((p) => p[1]), ...s.front.map((p) => p[1])), k: s.bodyK,
    nose: s.nose, zNose: s.zFront - 0.9, zFront: s.zFront,
    tail: s.tail, zTail: s.zRear + 0.9, zRear: s.zRear
  };
  const roofY = Math.max(...s.cab.map((p) => p[1]));
  const cabShape = { ...shapeParams, y0: s.cabBase, y1: roofY, k: s.cabK };

  // ---- main body
  let body = extrudeProfile(bodyOutline(s), s.W, { bevelT: 0.07, bevelS: 0.05, segs: 4 });
  shapeBody(body, shapeParams);
  body = smoothNormals(body, 0.75);
  B.mesh(body, M.paint, 0, 0, 0);

  // ---- greenhouse
  const cabW = s.W * s.cabW;
  const cabPoly = [...s.cab, [s.cab[3][0], s.cabBase], [s.cab[0][0], s.cabBase]];
  let glass = extrudeProfile(cabPoly, cabW, { bevelT: 0.02, bevelS: 0.012, segs: 2 });
  shapeBody(glass, cabShape);
  glass = smoothNormals(glass, 0.8);
  B.mesh(glass, M.glass, 0, 0, 0, B.statics, false);

  // roof panel
  const [P0, P1, P2, P3] = s.cab;
  let roof = extrudeProfile(stripPoly(P1, P2, 0.06), cabW + 0.01, { bevelT: 0.015, bevelS: 0.012, segs: 2 });
  shapeBody(roof, cabShape);
  B.mesh(smoothNormals(roof, 0.9), M.paint, 0, 0, 0);

  // pillars on both sides (A, C, optional B / extra)
  const addPillar = (poly, thick = 0.035) => {
    for (const sd of [1, -1]) {
      let g = extrudeProfile(poly, thick, { bevelT: 0.008, bevelS: 0.006, segs: 1 });
      g.translate(sd * (cabW / 2 - 0.004), 0, 0);
      shapeBody(g, cabShape);
      B.mesh(smoothNormals(g, 0.9), M.paint, 0, 0, 0);
    }
  };
  addPillar(stripPoly(P0, P1, s.pillar));
  addPillar(stripPoly(P2, P3, s.cPillar));
  // B pillar(s)
  const bZ = type === 'ranger' ? s.doors[1] : (s.doors[1] + s.doors[0]) / 2 - 0.1;
  if (type !== 'vortex') {
    const topY = (P1[1] + (P2[1] - P1[1]) * THREE.MathUtils.clamp((P1[0] - bZ) / (P1[0] - P2[0]), 0, 1));
    addPillar([[bZ + 0.045, s.cabBase], [bZ + 0.045, topY], [bZ - 0.045, topY], [bZ - 0.045, s.cabBase]]);
  }
  // black A-pillar/window frame sills
  addPillar([[P3[0], s.cabBase], [P0[0], s.cabBase], [P0[0], s.cabBase + 0.05], [P3[0], s.cabBase + 0.05]], 0.04);

  // ---- door lines, handles, sills
  const dl = (zline, y0, y1) => {
    for (const sd of [1, -1]) {
      const g = new THREE.BoxGeometry(0.012, y1 - y0, 0.008);
      g.translate(sd * (s.W / 2 + 0.003), (y0 + y1) / 2, zline);
      shapeBody(g, shapeParams);
      B.mesh(g, M.trim, 0, 0, 0, B.statics, false);
    }
  };
  const beltAt = (z) => (z > s.cab[0][0] ? 0.9 : 0.93) + 0.0;
  const doorTop = s.cabBase - 0.02;
  for (const zl of s.doors) dl(zl, 0.26, doorTop);
  for (const sd of [1, -1]) {
    const zA = s.doors[0];
    const zB = s.doors[1];
    const g = new THREE.BoxGeometry(0.012, 0.008, zA - zB);
    g.translate(sd * (s.W / 2 + 0.003), 0.26, (zA + zB) / 2);
    shapeBody(g, shapeParams);
    B.mesh(g, M.trim, 0, 0, 0, B.statics, false);
    // handle
    const h = new THREE.BoxGeometry(0.025, 0.028, 0.15);
    h.translate(sd * (s.W / 2 + 0.01), doorTop - 0.14, zB + 0.18);
    shapeBody(h, shapeParams);
    B.mesh(h, M.chrome, 0, 0, 0, B.statics, false);
    // side skirt
    const sk = new THREE.BoxGeometry(0.05, 0.07, zA - zB + 0.4);
    sk.translate(sd * (s.W / 2 - 0.005), s.yb + 0.04, (zA + zB) / 2);
    shapeBody(sk, shapeParams);
    B.mesh(sk, M.trim, 0, 0, 0, B.statics, false);
  }

  // ---- mirrors
  for (const sd of [1, -1]) {
    const mz = P0[0] - 0.12;
    const my = P0[1] + 0.06;
    const mx = sd * (cabW / 2 * (1 - s.cabK * 0.15) + 0.12);
    B.cyl(0.012, 0.012, 0.14, M.trim, sd * (cabW / 2 * 0.98 + 0.04), my - 0.015, mz, 'x', 8);
    const mm = B.box(0.07, 0.11, 0.17, M.paint, mx, my, mz - 0.04, 0.03);
    mm.rotation.y = sd * 0.15;
    B.box(0.005, 0.085, 0.14, M.glass, mx - sd * 0.03, my, mz - 0.045, 0.002).rotation.y = sd * 0.15;
  }

  // ---- front end: lights, grille, splitter, plates
  const frontZ = (y) => zAtY(s.front, y);
  const hlY = type === 'ranger' ? 0.88 : type === 'stallion' ? 0.7 : type === 'vortex' ? 0.5 : 0.63;
  out.headlights = [M.headlight];
  const nf = (z) => 1 - s.nose * Math.pow(Math.max(0, (z - shapeParams.zNose) / (s.zFront - shapeParams.zNose)), 2);
  const hlZ = frontZ(hlY) - 0.004;
  const slope = Math.atan2(
    s.front[Math.min(s.front.length - 1, 3)][0] - s.front[2][0],
    s.front[3][1] - s.front[2][1]
  );
  for (const sd of [1, -1]) {
    if (type === 'ranger') {
      const hx = sd * 0.68 * nf(hlZ);
      B.cyl(0.115, 0.115, 0.05, M.chrome, hx, hlY, hlZ - 0.01, 'z', 24);
      B.cyl(0.095, 0.095, 0.06, M.headlight, hx, hlY, hlZ - 0.005, 'z', 24);
      B.cyl(0.04, 0.04, 0.05, M.amber, hx, hlY - 0.2, hlZ - 0.02, 'z', 12); // indicator
    } else if (type === 'apex-gt') {
      const hx = sd * 0.62 * nf(hlZ);
      const h1 = B.box(0.36, 0.06, 0.06, M.headlight, hx, hlY + 0.0, hlZ - 0.03, 0.02);
      h1.rotation.set(0.3, sd * -0.18, sd * 0.05);
      B.box(0.38, 0.09, 0.04, M.trim, hx, hlY, hlZ - 0.05, 0.02).rotation.set(0.3, sd * -0.18, sd * 0.05);
      B.box(0.2, 0.02, 0.05, M.amber, hx + sd * 0.1, hlY - 0.08, hlZ - 0.02, 0.006);
    } else if (type === 'stallion') {
      const hx = sd * 0.72 * nf(hlZ);
      B.cyl(0.1, 0.1, 0.06, M.chrome, hx, hlY, hlZ - 0.01, 'z', 24);
      B.cyl(0.082, 0.082, 0.07, M.headlight, hx, hlY, hlZ - 0.005, 'z', 24);
      B.cyl(0.1, 0.1, 0.06, M.chrome, hx + sd * 0.23, hlY, hlZ - 0.005, 'z', 24);
      B.cyl(0.08, 0.08, 0.07, M.headlight, hx + sd * 0.23, hlY, hlZ, 'z', 24);
    } else {
      const hx = sd * 0.62 * nf(hlZ);
      const h1 = B.box(0.46, 0.035, 0.05, M.headlight, hx, hlY + 0.03, hlZ - 0.05, 0.01);
      h1.rotation.set(0.6, sd * -0.32, 0);
      B.box(0.5, 0.06, 0.04, M.trim, hx, hlY + 0.03, hlZ - 0.06, 0.01).rotation.set(0.6, sd * -0.32, 0);
    }
  }
  // grille / intakes
  const gY = type === 'ranger' ? 0.75 : 0.36;
  const gZ = frontZ(gY) - 0.015;
  if (type === 'ranger') {
    B.box(0.95, 0.3, 0.05, M.trim, 0, gY + 0.02, gZ, 0.01);
    for (let i = 0; i < 7; i++) B.box(0.035, 0.26, 0.04, M.chrome, -0.36 + i * 0.12, gY + 0.02, gZ - 0.03, 0.005);
  } else if (type === 'stallion') {
    B.box(1.1, 0.2, 0.05, M.trim, 0, 0.62, frontZ(0.62) - 0.02, 0.01);
    for (let i = 0; i < 4; i++) B.box(1.04, 0.012, 0.04, M.chrome, 0, 0.55 + i * 0.045, frontZ(0.62) - 0.04, 0.003);
    B.box(1.25, 0.12, 0.05, M.trim, 0, 0.33, frontZ(0.33) - 0.02, 0.01);
  } else {
    B.box(type === 'vortex' ? 1.15 : 1.0, 0.16, 0.05, M.trim, 0, gY + 0.02, gZ, 0.01);
    for (let i = 0; i < 5; i++) {
      B.box(type === 'vortex' ? 1.1 : 0.95, 0.008, 0.04, M.darkMetal, 0, gY - 0.04 + i * 0.03, gZ - 0.02, 0.002);
    }
    for (const sd of [1, -1]) B.box(0.26, 0.1, 0.05, M.trim, sd * 0.68 * nf(gZ), gY, gZ + 0.005, 0.01); // lower side intakes
  }
  // splitter / bumper lip
  B.box(s.W * (type === 'ranger' ? 0.86 : 0.9) * 0.92, 0.04, 0.2, M.carbon, 0, s.yb + 0.04, s.front[0][0] - 0.06, 0.01);

  // plates
  B.box(0.52, 0.11, 0.012, M.plate, 0, type === 'ranger' ? 0.55 : 0.3, frontZ(type === 'ranger' ? 0.55 : 0.3) - 0.012, 0.003);
  B.box(0.52, 0.11, 0.012, M.plate, 0, 0.58, zAtY([...s.rear].reverse(), 0.58) - 0.008, 0.003);

  // ---- rear: tail lights + exhaust + diffuser
  out.brakeLights = [M.tail];
  const rearList = s.rear;
  const rz = (y) => zAtY(rearList, y) - 0.012;
  const tlY = type === 'ranger' ? 0.9 : type === 'stallion' ? 0.78 : 0.82;
  for (const sd of [1, -1]) {
    const tx = sd * (s.W / 2 - 0.34) * (1 - s.tail * 0.15);
    if (type === 'stallion') {
      B.box(0.3, 0.3, 0.04, M.tail, sd * 0.62, 0.78, rz(0.78) + 0.005, 0.02);
      B.box(0.31, 0.02, 0.05, M.chrome, sd * 0.62, 0.94, rz(0.9), 0.004);
    } else if (type === 'ranger') {
      B.box(0.14, 0.34, 0.04, M.tail, sd * (s.W / 2 - 0.12), 0.95, rz(0.95) + 0.005, 0.02);
    } else if (type === 'vortex') {
      B.box(0.5, 0.045, 0.05, M.tail, sd * 0.42, 0.76, rz(0.76) + 0.005, 0.015);
      B.box(0.07, 0.07, 0.05, M.tail, sd * 0.78, 0.66, rz(0.66) + 0.005, 0.015);
    } else {
      B.box(0.36, 0.1, 0.04, M.tail, tx, tlY, rz(tlY) + 0.005, 0.02).rotation.y = sd * -0.1;
    }
  }
  if (type === 'apex-gt') B.box(1.0, 0.025, 0.04, M.tail, 0, tlY - 0.02, rz(tlY) + 0.01, 0.008);
  // exhausts
  const exX = type === 'apex-gt' ? 0.55 : type === 'stallion' ? 0.62 : 0.3;
  const exY = type === 'vortex' ? 0.5 : 0.27;
  const exZ = zAtY(rearList, exY) - 0.05;
  const nEx = type === 'ranger' ? 1 : 2;
  for (let i = 0; i < nEx; i++) {
    const x = nEx === 1 ? 0.6 : (i === 0 ? 1 : -1) * exX;
    const cyl = B.cyl(0.05, 0.055, 0.2, M.chrome, x, exY, exZ + 0.02, 'z', 20);
    B.cyl(0.04, 0.04, 0.21, M.darkMetal, x, exY, exZ + 0.02, 'z', 14);
    if (type === 'vortex') cyl.scale.set(1.2, 1.2, 1);
    if (type === 'stallion') {
      B.cyl(0.05, 0.055, 0.2, M.chrome, x + (i === 0 ? 0.14 : -0.14), exY, exZ + 0.02, 'z', 20);
    }
  }
  // diffuser fins
  if (type === 'vortex' || type === 'apex-gt') {
    const dz = s.rear[s.rear.length - 1][0] + 0.15;
    B.box(s.W * 0.7, 0.04, 0.3, M.carbon, 0, s.yb + 0.06, dz, 0.01);
    const fins = type === 'vortex' ? 9 : 5;
    for (let i = 0; i < fins; i++) B.box(0.014, 0.12, 0.3, M.carbon, (i - (fins - 1) / 2) * 0.14, s.yb + 0.12, dz - 0.0, 0.003);
  }

  // ---- type specific details
  const hoodTopZ = (z) => {
    const f = s.front;
    for (let i = 0; i < f.length - 1; i++) {
      if ((f[i][0] >= z && f[i + 1][0] <= z) || (f[i][0] <= z && f[i + 1][0] >= z)) {
        const t = (z - f[i][0]) / (f[i + 1][0] - f[i][0] || 1);
        return f[i][1] + (f[i + 1][1] - f[i][1]) * t;
      }
    }
    return f[f.length - 1][1];
  };

  if (type === 'apex-gt') {
    // ducktail spoiler + hood vents + fender vent
    B.box(s.W * 0.78, 0.035, 0.22, M.paint, 0, 1.055, -2.1, 0.012).rotation.x = 0.28;
    for (const sd of [1, -1]) {
      const vx = sd * 0.42;
      for (let i = 0; i < 4; i++) B.box(0.2, 0.01, 0.025, M.trim, vx, hoodTopZ(1.35) + 0.004, 1.2 + i * 0.05, 0.002);
      B.box(0.12, 0.05, 0.03, M.trim, sd * (s.W / 2 + 0.002), 0.55, 1.05, 0.004);
      B.box(0.05, 0.12, 0.1, M.trim, sd * (s.W / 2 - 0.04), 0.5, 1.7, 0.01); // tow hook cover
    }
  } else if (type === 'stallion') {
    // hood scoop
    const sc = extrudeProfile([[1.5, 0.99], [1.42, 1.07], [1.05, 1.1], [0.92, 0.995]], 0.55, { bevelT: 0.04, bevelS: 0.03, segs: 3 });
    B.mesh(smoothNormals(sc, 0.8), M.paint, 0, 0, 0);
    B.box(0.45, 0.012, 0.18, M.trim, 0, 1.075, 1.42, 0.004);
    // racing stripes (two) on hood, roof, deck
    for (const sx of [0.13, -0.13]) {
      const pts = [];
      const hood = [s.front[s.front.length - 1], s.front[s.front.length - 2], s.front[s.front.length - 3], s.front[s.front.length - 4]];
      const h0 = [2.1, 0.935];
      const g1 = extrudeProfile(
        [[2.1, 0.931], [0.6, 1.034], [0.6, 1.04], [2.1, 0.937]].map(([z, y]) => [z, y + 0.004]),
        0.17, { bevelT: 0, bevelS: 0, segs: 1 }
      );
      g1.translate(sx, 0, 0);
      B.mesh(g1, M.stripe, 0, 0, 0, B.statics, false);
      const gDeck = extrudeProfile([[-1.15, 1.073], [-2.36, 1.073], [-2.36, 1.079], [-1.15, 1.079]], 0.17, { bevelT: 0, bevelS: 0, segs: 1 });
      gDeck.translate(sx, 0, 0);
      B.mesh(gDeck, M.stripe, 0, 0, 0, B.statics, false);
      const gRoof = extrudeProfile(
        [[0.1, 1.364], [-0.62, 1.404], [-0.62, 1.41], [0.1, 1.37]],
        0.17, { bevelT: 0, bevelS: 0, segs: 1 }
      );
      gRoof.translate(sx, 0, 0);
      shapeBody(gRoof, cabShape);
      B.mesh(gRoof, M.stripe, 0, 0, 0, B.statics, false);
      void pts; void h0;
    }
    // rear spoiler lip + fuel cap
    B.box(s.W * 0.7, 0.03, 0.14, M.paint, 0, 1.105, -2.34, 0.01);
    B.cyl(0.05, 0.05, 0.015, M.chrome, 0.7, 1.08, -2.0, 'y', 16);
    // chrome bumpers
    B.box(s.W * 0.84, 0.07, 0.07, M.chrome, 0, 0.3, s.front[0][0] - 0.01, 0.025);
    B.box(s.W * 0.84, 0.07, 0.07, M.chrome, 0, 0.3, s.rear[s.rear.length - 1][0] - 0.03, 0.025);
  } else if (type === 'ranger') {
    // flared arches
    for (const zc of [s.wb / 2, -s.wb / 2]) {
      for (const sd of [1, -1]) {
        const ring = new THREE.Shape();
        const ro = s.archR + 0.07;
        const ri = s.archR + 0.005;
        const a0 = 0.1;
        const a1 = Math.PI - 0.1;
        ring.absarc(0, 0, ro, a0, a1, false);
        ring.absarc(0, 0, ri, a1, a0, true);
        const g = new THREE.ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 18 });
        g.rotateY(-Math.PI / 2);
        g.translate(0.05, 0, 0);
        const m = B.mesh(g, M.plastic, sd * (s.W / 2 + 0.01 + 0.04), s.wr, zc);
        if (sd < 0) m.scale.x = -1;
      }
    }
    // front bumper + bull bar
    B.box(s.W * 0.96, 0.22, 0.14, M.plastic, 0, 0.5, 2.1, 0.04);
    B.tube([[-0.72, 0.4, 2.2], [-0.72, 0.8, 2.22], [-0.3, 1.0, 2.2], [0.3, 1.0, 2.2], [0.72, 0.8, 2.22], [0.72, 0.4, 2.2]], 0.03, M.darkMetal, 36);
    B.tube([[-0.5, 0.58, 2.2], [0.5, 0.58, 2.2]], 0.026, M.darkMetal, 4);
    // winch
    B.box(0.38, 0.12, 0.14, M.darkMetal, 0, 0.5, 2.22, 0.02);
    // roof rack
    const rackY = roofY + 0.07;
    for (const sd of [1, -1]) B.tube([[sd * 0.74, rackY, 0.7], [sd * 0.74, rackY, -1.75]], 0.018, M.darkMetal, 4);
    for (let i = 0; i < 5; i++) B.tube([[-0.74, rackY, 0.6 - i * 0.5], [0.74, rackY, 0.6 - i * 0.5]], 0.016, M.darkMetal, 4);
    for (const z of [0.6, -0.4, -1.4]) for (const sd of [1, -1]) B.box(0.04, 0.07, 0.04, M.darkMetal, sd * 0.74, rackY - 0.04, z, 0.005);
    B.box(0.62, 0.22, 0.42, M.darkMetal, 0.2, rackY + 0.12, -0.6, 0.03); // cargo box
    // snorkel
    B.tube([[-0.9, 0.8, 0.95], [-0.97, 1.1, 0.95], [-0.97, 1.85, 0.92], [-0.9, 1.97, 0.9]], 0.035, M.plastic, 16);
    // spare wheel on tail gate
    const spare = addWheel(B.statics, M, { x: 0, z: 0, R: s.wr, rimR: s.rimR, width: s.tw, style: s.wheelStyle, rimMat: M[s.rimMat], side: 1, lugs: false });
    spare.pivot.position.set(0, 0.95, -2.32);
    spare.pivot.rotation.y = Math.PI / 2;
    spare.pivot.userData.keep = false;
    // tail gate hinge
    B.box(0.06, 0.12, 0.05, M.darkMetal, 0.88, 1.2, -2.17, 0.01);
    // side steps
    for (const sd of [1, -1]) B.box(0.18, 0.04, 1.6, M.plastic, sd * (s.W / 2 + 0.03), 0.4, -0.05, 0.015);
    // hood louvres + hinges
    for (const sd of [1, -1]) B.box(0.05, 0.03, 0.08, M.darkMetal, sd * 0.6, 1.14, 0.95, 0.005);
  } else if (type === 'vortex') {
    // side intakes
    for (const sd of [1, -1]) {
      const intake = extrudeProfile([[-0.15, 0.35], [-1.05, 0.52], [-1.15, 0.78], [-0.4, 0.8]], 0.1, { bevelT: 0.02, bevelS: 0.02, segs: 2 });
      intake.translate(sd * (s.W / 2 - 0.03), 0, 0);
      shapeBody(intake, shapeParams);
      B.mesh(intake, M.trim, 0, 0, 0, B.statics, false);
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.BoxGeometry(0.03, 0.012, 0.8);
        fin.rotateX(0.22);
        fin.translate(sd * (s.W / 2 - 0.0), 0.46 + i * 0.07, -0.65);
        shapeBody(fin, shapeParams);
        B.mesh(fin, M.carbon, 0, 0, 0, B.statics, false);
      }
      // front canards
      B.box(0.3, 0.012, 0.22, M.carbon, sd * 0.82, 0.2, 2.15, 0.003).rotation.z = sd * -0.1;
      // engine cover louvres
      for (let i = 0; i < 6; i++) B.box(0.34, 0.01, 0.03, M.trim, sd * 0.34, 0.965, -1.35 - i * 0.12, 0.002);
    }
    // rear wing
    const wingProfile = [[0.16, 0.0], [0.1, 0.045], [-0.1, 0.05], [-0.22, 0.02], [-0.12, 0.0]];
    const wing = extrudeProfile(wingProfile, 1.85, { bevelT: 0.01, bevelS: 0.008, segs: 2 });
    B.mesh(wing, M.carbon, 0, 1.2, -2.15, B.statics);
    for (const sd of [1, -1]) {
      B.box(0.02, 0.16, 0.42, M.carbon, sd * 0.93, 1.2, -2.15, 0.006); // endplate
      B.box(0.05, 0.28, 0.1, M.darkMetal, sd * 0.4, 1.05, -2.1, 0.012); // stanchion
    }
    // front splitter extension + hood vents
    B.box(s.W * 0.82, 0.02, 0.35, M.carbon, 0, 0.1, 2.3, 0.006);
    for (let i = 0; i < 5; i++) B.box(0.3, 0.008, 0.035, M.trim, 0, 0.745 + i * 0.012, 1.1 - i * 0.04, 0.002);
  }

  // ---- wheels + arch liners
  const xs = s.track / 2;
  const mkW = (x, z, side, steer) => addWheel(group, M, {
    x, z, R: s.wr, rimR: s.rimR, width: s.tw, style: s.wheelStyle, rimMat: M[s.rimMat], side, steer, lugs: true
  });
  out.wheels.push(mkW(xs, s.wb / 2, 1, true), mkW(-xs, s.wb / 2, -1, true), mkW(xs, -s.wb / 2, 1, false), mkW(-xs, -s.wb / 2, -1, false));
  for (const zc of [s.wb / 2, -s.wb / 2]) {
    const liner = new THREE.CylinderGeometry(s.archR - 0.02, s.archR - 0.02, s.W - 0.1, 24, 1, true, -0.5, Math.PI + 1.0);
    liner.rotateZ(Math.PI / 2);
    const lm = B.mesh(liner, M.trim, 0, s.wr, zc, B.statics, false);
    lm.material = M.trim;
    // make it visible from inside
    lm.userData.keep = false;
    for (const sd of [1, -1]) {
      const inner = B.box(0.02, s.archR * 1.5, s.archR * 1.6, M.trim, sd * (s.track / 2 - s.tw / 2 - 0.05), s.wr + 0.05, zc, 0.005);
      inner.userData.keep = false;
    }
  }
  // underbody
  B.box(s.W * 0.8, 0.04, s.zFront - s.zRear - 0.6, M.trim, 0, s.yb + 0.02, (s.zFront + s.zRear) / 2, 0.01);

  // ---- interior
  const seatReserved = { group, W: s.W };
  Object.assign(s, { rear: s.rear });
  buildInterior(B, { ...s, rear: undefined, cab: s.cab }, out);
  // ground contact marker shadow-catcher is skipped (scene shadows handle it)

  // ---- merge statics (everything except named moving parts)
  // keep the steering rotor and the spare wheel pivots out of the merge
  const keepers = [];
  B.statics.traverse((o) => {
    if (o.name === 'steeringRotor') keepers.push(o);
  });
  // detach moving pieces, merge the rest, re-attach
  const holders = keepers.map((k) => ({ k, p: k.parent }));
  for (const h of holders) h.p.remove(h.k);
  // steering group wrapper: also detach its parent group so it is not merged empty
  const wheelGroup = out.steeringGroup;
  const wgParent = wheelGroup.parent;
  wgParent.remove(wheelGroup);
  wheelGroup.add(...holders.map((h) => h.k));
  const spare = [];
  B.statics.children.slice().forEach((c) => {
    if (c.userData && c.userData.spare) spare.push(c);
  });
  mergeStatics(B.statics);
  bodyGroup.add(wheelGroup);

  // dims + collider extents
  const height = Math.max(roofY, type === 'ranger' ? 2.05 : 0) + (type === 'vortex' ? 0.1 : 0.02);
  out.dims = {
    length: s.zFront - s.zRear,
    width: s.W,
    height,
    wheelRadius: s.wr,
    wheelbase: s.wb,
    zCenter: (s.zFront + s.zRear) / 2,
    halfExtents: { x: s.W / 2 - 0.02, y: height / 2, z: (s.zFront - s.zRear) / 2 - 0.05 }
  };
  const doorZ = out.seat.position.z;
  out.doorPoint = new THREE.Vector3(s.W / 2 + 0.85, 0, doorZ);
  out.cameraHeight = height + 0.45;
  void seatReserved;
  return out;
}

// ------------------------------------------------------------------ bike
function buildBike(colorHex) {
  const M = makeMaterials(colorHex);
  const B = new Builder(M);
  const group = new THREE.Group();
  group.name = 'vehicle_sprint-r';
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);
  bodyGroup.add(B.statics);
  const out = { group, bodyGroup, wheels: [], info: VEHICLE_INFO['sprint-r'] };

  const Rr = 0.31, Rf = 0.3;
  const zr = -0.7, zf = 0.72;

  // rear wheel (in bodyGroup so it leans)
  const rear = addWheel(bodyGroup, M, { x: 0, z: zr, R: Rr, rimR: 0.215, width: 0.19, style: 'twin5', rimMat: M.darkMetal, side: 1, steer: false, lugs: false, discScale: 0.7, caliperAngle: -0.6 });
  rear.pivot.traverse((m) => { if (m.isMesh && m.material === M.chrome) m.material = M.steel; });
  out.wheels.push(rear);

  // front steering assembly: tilted by the fork rake, wheel + fork + bars inside
  const rake = 0.44; // ~25 degrees
  const headPos = new THREE.Vector3(0, 0.87, 0.44);
  const steer = new THREE.Group();
  steer.position.copy(headPos);
  steer.rotation.set(rake, 0, 0);
  bodyGroup.add(steer);
  // fork axis in steer-local frame is -Y
  const axleLocal = new THREE.Vector3(0, -(headPos.y - Rf) / Math.cos(rake), 0); // along the fork
  const frontWheelPivot = new THREE.Group();
  frontWheelPivot.position.copy(axleLocal);
  steer.add(frontWheelPivot);
  // The wheel is built through addWheel at origin, then re-parented into the fork frame; undo rake so the axle stays horizontal
  const fw = addWheel(frontWheelPivot, M, { x: 0, z: 0, R: Rf, rimR: 0.215, width: 0.125, style: 'twin5', rimMat: M.darkMetal, side: 1, steer: false, lugs: false, discScale: 0.75, caliperAngle: 0.5 });
  fw.pivot.position.set(0, 0, 0);
  fw.pivot.rotation.x = -rake;
  // double discs
  const disc2 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 36).rotateZ(Math.PI / 2), M.steel);
  disc2.position.x = -0.045;
  fw.spin.add(disc2);
  // the fork-frame is what steers: expose the steer group as the wheel pivot (rotation.y about the fork axis)
  out.wheels.push({ pivot: steer, spin: fw.spin, steer: true, radius: Rf, side: 1 });

  // fork tubes (gold) + triple clamp
  for (const sd of [1, -1]) {
    B.cyl(0.021, 0.021, 0.44, M.gold, sd * 0.085, -0.2, 0, 'y', 12, steer);
    B.cyl(0.027, 0.027, 0.25, M.darkMetal, sd * 0.085, -0.05, 0, 'y', 12, steer);
    B.cyl(0.03, 0.03, 0.12, M.darkMetal, sd * 0.085, -0.46, 0, 'x', 10, steer).scale.set(1, 1, 1);
    // front disc caliper mount + axle
    B.cyl(0.014, 0.014, 0.06, M.darkMetal, sd * 0.085, axleLocal.y, 0, 'x', 10, steer);
  }
  B.box(0.22, 0.035, 0.09, M.darkMetal, 0, 0.02, 0, 0.01, steer);
  B.box(0.2, 0.03, 0.08, M.darkMetal, 0, -0.1, 0, 0.01, steer);
  // front fender
  const fen = new THREE.CylinderGeometry(Rf + 0.03, Rf + 0.03, 0.11, 24, 1, true, -0.9, 2.2);
  fen.rotateZ(Math.PI / 2);
  const fenM = B.mesh(fen, M.paint, 0, axleLocal.y, 0, steer);
  fenM.material = M.paint.clone();
  fenM.material.side = THREE.DoubleSide;
  fenM.rotation.x = 0;
  fenM.rotation.x = -rake;
  fenM.position.y = axleLocal.y;
  // handlebars (clip-ons)
  const handL = new THREE.Object3D();
  const handR = new THREE.Object3D();
  for (const sd of [1, -1]) {
    const bar = B.tube([[sd * 0.08, 0.04, 0.0], [sd * 0.2, 0.06, -0.01], [sd * 0.3, 0.07, -0.0], [sd * 0.34, 0.07, -0.08]], 0.013, M.darkMetal, 16, steer);
    B.cyl(0.02, 0.02, 0.12, M.plastic, sd * 0.31, 0.07, -0.1, 'x', 10, steer);
    B.box(0.02, 0.05, 0.02, M.darkMetal, sd * 0.2, 0.0, -0.01, 0.004, steer);
    // lever
    B.tube([[sd * 0.29, 0.065, 0.02], [sd * 0.3, 0.06, 0.12]], 0.007, M.steel, 4, steer);
    void bar;
  }
  handL.position.set(0.31, 0.075, -0.1);
  handR.position.set(-0.31, 0.075, -0.1);
  steer.add(handL, handR);
  // instrument pod
  B.box(0.16, 0.06, 0.1, M.trim, 0, 0.1, -0.02, 0.02, steer);
  B.box(0.1, 0.002, 0.07, M.headlight, 0, 0.131, -0.02, 0.0, steer);
  // steering-linked headlight/mirror stays on the fairing (below)

  // frame (twin spar) + engine
  for (const sd of [1, -1]) {
    B.tube([[sd * 0.1, 0.85, 0.36], [sd * 0.13, 0.78, 0.0], [sd * 0.12, 0.6, -0.25], [sd * 0.1, 0.42, -0.3]], 0.03, M.steel, 20, bodyGroup);
    // swingarm
    B.tube([[sd * 0.095, 0.42, -0.28], [sd * 0.1, 0.34, -0.5], [sd * 0.09, Rr, zr]], 0.026, M.steel, 12, bodyGroup);
    B.box(0.03, 0.05, 0.05, M.darkMetal, sd * 0.09, Rr, zr, 0.006, bodyGroup);
    // rear-set / peg
    B.tube([[sd * 0.1, 0.45, -0.22], [sd * 0.2, 0.42, -0.32]], 0.012, M.darkMetal, 4, bodyGroup);
    B.cyl(0.012, 0.012, 0.07, M.chrome, sd * 0.225, 0.42, -0.32, 'x', 8, bodyGroup);
  }
  B.box(0.3, 0.3, 0.42, M.darkMetal, 0, 0.45, 0.0, 0.04, bodyGroup); // engine
  B.box(0.28, 0.16, 0.2, M.steel, 0, 0.33, -0.1, 0.03, bodyGroup); // gearbox
  for (let i = 0; i < 4; i++) B.cyl(0.04, 0.04, 0.17, M.darkMetal, 0, 0.62, 0.12 - i * 0.075, 'x', 12, bodyGroup); // cylinder heads
  // radiator
  B.box(0.26, 0.26, 0.05, M.darkMetal, 0, 0.5, 0.26, 0.01, bodyGroup);
  // rear shock + linkage
  B.cyl(0.02, 0.02, 0.34, M.gold, 0, 0.52, -0.42, 'y', 10, bodyGroup).rotation.x = 0.55;
  // chain + sprockets
  B.cyl(0.07, 0.07, 0.02, M.steel, 0.095, 0.4, -0.29, 'x', 18, bodyGroup);
  B.cyl(0.13, 0.13, 0.02, M.steel, 0.12, Rr, zr, 'x', 20, bodyGroup);
  B.box(0.012, 0.012, 0.44, M.darkMetal, 0.12, 0.36, -0.5, 0.002, bodyGroup).rotation.x = 0.1;
  // exhaust (titanium) along the right side, up-swept tail
  B.tube([[-0.1, 0.28, 0.18], [-0.17, 0.25, -0.1], [-0.2, 0.3, -0.5], [-0.2, 0.46, -0.88]], 0.05, M.steel, 24, bodyGroup);
  B.cyl(0.058, 0.052, 0.3, M.chrome, -0.2, 0.52, -0.98, 'z', 18, bodyGroup).rotation.x = -0.25;
  B.cyl(0.04, 0.04, 0.32, M.darkMetal, -0.2, 0.52, -0.98, 'z', 14, bodyGroup).rotation.x = -0.25;
  B.tube([[0.1, 0.3, 0.18], [0.1, 0.27, -0.15]], 0.04, M.steel, 8, bodyGroup);

  // fuel tank
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.36, 10, 20).rotateX(Math.PI / 2), M.paint);
  tank.scale.set(1.0, 0.82, 1);
  tank.position.set(0, 0.93, 0.2);
  tank.rotation.x = -0.08;
  tank.castShadow = true;
  B.statics.add(tank);
  // tank knee pads
  for (const sd of [1, -1]) B.box(0.03, 0.14, 0.2, M.plastic, sd * 0.145, 0.88, 0.12, 0.012, bodyGroup);

  // fairing: nose + windscreen + belly pan
  const nose = extrudeProfile([[0.34, 0.6], [0.58, 0.58], [0.84, 0.72], [0.82, 0.9], [0.62, 1.04], [0.4, 1.12], [0.36, 0.95]], 0.3, { bevelT: 0.08, bevelS: 0.05, segs: 4 });
  shapeBody(nose, { y0: 0.6, y1: 1.1, k: 0.28, nose: 0.55, zNose: 0.55, zFront: 0.9 });
  B.mesh(smoothNormals(nose, 0.8), M.paint, 0, 0, 0, bodyGroup);
  const screen = extrudeProfile([[0.4, 1.1], [0.5, 1.28], [0.62, 1.32], [0.56, 1.1]], 0.2, { bevelT: 0.006, bevelS: 0.004, segs: 1 });
  shapeBody(screen, { y0: 1.0, y1: 1.3, k: 0.3 });
  B.mesh(screen, M.glass, 0, 0, 0, B.statics, false);
  const belly = extrudeProfile([[0.58, 0.32], [0.4, 0.26], [-0.18, 0.24], [-0.22, 0.36], [0.1, 0.5], [0.46, 0.55]], 0.32, { bevelT: 0.07, bevelS: 0.05, segs: 3 });
  shapeBody(belly, { y0: 0.25, y1: 0.55, k: 0.2 });
  B.mesh(smoothNormals(belly, 0.8), M.paint, 0, 0, 0, bodyGroup);
  // side fairing panels
  for (const sd of [1, -1]) {
    const side = extrudeProfile([[0.52, 0.5], [0.3, 0.85], [0.0, 0.88], [-0.05, 0.62], [0.15, 0.4]], 0.03, { bevelT: 0.01, bevelS: 0.012, segs: 2 });
    side.translate(sd * 0.17, 0, 0);
    B.mesh(smoothNormals(side, 0.8), M.paint, 0, 0, 0, bodyGroup);
  }
  // headlights (twin LED) + DRL + intakes
  out.headlights = [M.headlight];
  for (const sd of [1, -1]) {
    const hl = B.box(0.12, 0.06, 0.05, M.headlight, sd * 0.1, 0.8, 0.83, 0.02, bodyGroup);
    hl.rotation.set(-0.4, sd * -0.25, 0);
    B.box(0.14, 0.02, 0.04, M.amber, sd * 0.2, 0.74, 0.74, 0.006, bodyGroup);
  }
  B.box(0.1, 0.09, 0.04, M.trim, 0, 0.72, 0.83, 0.02, bodyGroup).rotation.x = -0.45; // central air intake
  // mirrors
  for (const sd of [1, -1]) {
    B.tube([[sd * 0.2, 1.0, 0.5], [sd * 0.3, 1.06, 0.46]], 0.01, M.darkMetal, 4, bodyGroup);
    B.box(0.08, 0.05, 0.03, M.paint, sd * 0.34, 1.08, 0.44, 0.012, bodyGroup);
  }

  // seat + tail unit
  B.box(0.24, 0.08, 0.34, M.leather, 0, 0.8, -0.16, 0.03, bodyGroup); // rider seat
  const tail = extrudeProfile([[-0.2, 0.74], [-0.4, 0.84], [-0.78, 0.98], [-0.96, 0.96], [-0.96, 0.84], [-0.7, 0.72], [-0.3, 0.7]], 0.2, { bevelT: 0.05, bevelS: 0.035, segs: 3 });
  shapeBody(tail, { y0: 0.7, y1: 1.0, k: 0.2, tail: 0.5, zTail: -0.55, zRear: -0.98 });
  B.mesh(smoothNormals(tail, 0.8), M.paint, 0, 0, 0, bodyGroup);
  B.box(0.22, 0.05, 0.1, M.leather, 0, 0.9, -0.62, 0.02, bodyGroup).rotation.x = 0.08; // pillion cowl
  out.brakeLights = [M.tail];
  B.box(0.16, 0.025, 0.03, M.tail, 0, 0.9, -0.975, 0.008, bodyGroup);
  B.box(0.03, 0.03, 0.035, M.amber, 0.09, 0.84, -0.98, 0.008, bodyGroup);
  B.box(0.03, 0.03, 0.035, M.amber, -0.09, 0.84, -0.98, 0.008, bodyGroup);
  // rear fender + plate hanger
  B.box(0.2, 0.025, 0.28, M.plastic, 0, 0.5, -1.0, 0.01, bodyGroup).rotation.x = -0.5;
  B.box(0.16, 0.1, 0.01, M.plate, 0, 0.47, -1.12, 0.003, bodyGroup).rotation.x = 0.25;

  // seat / pegs / bars as rider anchors
  const seat = new THREE.Object3D();
  seat.position.set(0, 0.86, -0.2);
  bodyGroup.add(seat);
  out.seat = seat;
  const pegL = new THREE.Object3D();
  pegL.position.set(0.225, 0.43, -0.32);
  const pegR = new THREE.Object3D();
  pegR.position.set(-0.225, 0.43, -0.32);
  bodyGroup.add(pegL, pegR);
  out.pegs = { L: pegL, R: pegR };
  out.handlebar = { L: handL, R: handR };
  out.handL = handL;
  out.handR = handR;
  out.pedalPoints = null;
  out.steeringWheel = null;

  // merge statics into few draw calls
  const steerChildren = steer.children.slice();
  mergeStatics(B.statics);
  void steerChildren;
  // the steering assembly's own fork meshes were added into `steer` (not statics): merge them in place
  frontWheelPivot.userData.noMergeSub = true;
  steer.children.forEach((c) => { if (c.isGroup && c.children.length && c !== frontWheelPivot) c.userData.noMergeSub = true; });
  mergeLocal(steer);

  out.dims = {
    length: 2.15, width: 0.8, height: 1.3, wheelRadius: Rr, wheelbase: zf - zr, zCenter: 0.0,
    halfExtents: { x: 0.28, y: 0.6, z: 1.0 }
  };
  out.doorPoint = new THREE.Vector3(0.95, 0, -0.1);
  out.cameraHeight = 1.7;
  return out;
}

function mergeStaticsSteer(steer) {
  // merge only meshes that are not part of the wheel assembly (those hang under frontWheelPivot)
  const movers = [];
  steer.traverse((o) => {
    if (o.isGroup && o !== steer && o.children.some((c) => c.isGroup)) movers.push(o);
  });
}

// ------------------------------------------------------------------ public API
export function buildVehicle(type, opts = {}) {
  if (!VEHICLE_INFO[type]) throw new Error(`Unknown vehicle type: ${type}`);
  let color = opts.color ?? DEFAULT_COLOR[type];
  if (typeof color === 'string') color = PAINT[color] ?? color;
  const out = hasImportedVehicle(type)
    ? adaptImported(type, opts.color !== undefined ? color : undefined)
    : type === 'sprint-r' ? buildBike(color) : buildCar(type, color);
  out.type = type;
  out.kind = VEHICLE_INFO[type].kind;
  out.group.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = true;
    }
  });
  return out;
}

export function countTriangles(root) {
  let t = 0;
  root.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry;
      t += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return Math.round(t);
}
