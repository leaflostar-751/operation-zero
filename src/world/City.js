import { mergeStaticMeshes } from './MergeStatic.js';
import * as THREE from 'three';
import { ROADS, CANAL, BRIDGES, MINOR_CANALS, ZONES, LANDMARKS, MAP_BOUNDS, px } from './CityData.js';
import * as T from './CityTextures.js';
import { buildLandmark } from './Landmarks.js';
import { generateDistricts } from './Districts.js';
import { makeTreeGeos, makeTreeMaterial, buildTreeInstances } from './Trees.js';

const CHUNK = 250;
const HALF_PI = Math.PI / 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

function smooth(pts, step = 6) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
  const n = Math.max(2, Math.ceil(curve.getLength() / step));
  return curve.getSpacedPoints(n).map((v) => [v.x, v.z]);
}

/** distance from point to polyline + nearest point */
const yawOf = (b) => (b.yawRad !== undefined ? b.yawRad : b.yaw * (Math.PI / 2));

function nearestOnLine(sp, x, z) {
  let best = 1e12, bx = 0, bz = 0;
  for (let i = 0; i < sp.length - 1; i++) {
    const ax = sp[i][0], az = sp[i][1], dx = sp[i + 1][0] - ax, dz = sp[i + 1][1] - az;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const qx = ax + dx * t, qz = az + dz * t;
    const d = (x - qx) * (x - qx) + (z - qz) * (z - qz);
    if (d < best) { best = d; bx = qx; bz = qz; }
  }
  return { d: Math.sqrt(best), x: bx, z: bz };
}

/** ribbon along a smoothed polyline: lateral offset `off`, width `w`, height y */
function stripGeometry(sp, off, w, y, tile) {
  const pos = [], uv = [], idx = [], nor = [];
  let dist = 0;
  for (let i = 0; i < sp.length; i++) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(sp.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    const nx = -tz, nz = tx;
    const cx = sp[i][0] + nx * off, cz = sp[i][1] + nz * off;
    pos.push(cx - nx * w / 2, y, cz - nz * w / 2, cx + nx * w / 2, y, cz + nz * w / 2);
    nor.push(0, 1, 0, 0, 1, 0);
    uv.push(0, dist / tile, 1, dist / tile);
    if (i < sp.length - 1) dist += Math.hypot(sp[i + 1][0] - sp[i][0], sp[i + 1][1] - sp[i][1]);
    if (i < sp.length - 1) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** split a polyline into runs where keep(point) is true */
function runs(sp, keep) {
  const out = [];
  let cur = [];
  for (const p of sp) {
    if (keep(p)) cur.push(p);
    else { if (cur.length > 2) out.push(cur); cur = []; }
  }
  if (cur.length > 2) out.push(cur);
  return out;
}

function patchFacade(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSc;\nvarying vec3 vNO;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vNO = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSc;\nvarying vec3 vNO;')
      .replace('#include <map_fragment>', `
        float wM = abs(vNO.x) > 0.5 ? vSc.z : vSc.x;
        float hM = vMapUv.y * vSc.y;
        float fl = floor(hM / 3.0 + 0.0001);
        float row = fl < 0.5 ? 0.0 : 1.0;
        vec2 uvC = vec2(vMapUv.x * wM / 5.0, hM / 6.0);
        vec2 uvS = vec2(fract(uvC.x), (row + fract(hM / 3.0)) * 0.5);
        vec4 sampledDiffuseColor = textureGrad(map, uvS, dFdx(uvC) * vec2(1.0, 1.0), dFdy(uvC) * vec2(1.0, 1.0));
        if (abs(vNO.y) > 0.5) sampledDiffuseColor = vec4(0.52, 0.5, 0.47, 1.0);
        diffuseColor *= sampledDiffuseColor;`);
  };
  mat.customProgramCacheKey = () => 'facade_v1';
}

function mergeGeos(list) {
  const P = [], N = [], U = [], I = [];
  let off = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      P.push(p.getX(i), p.getY(i), p.getZ(i));
      N.push(n.getX(i), n.getY(i), n.getZ(i));
      U.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + off);
    else for (let i = 0; i < p.count; i++) I.push(off + i);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  out.setIndex(I);
  return out;
}
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

export class City {
  constructor(scene, physics, tierConfig, renderer) {
    this.scene = scene;
    this.physics = physics;
    this.tier = tierConfig;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this.roads = ROADS.map((r) => ({ ...r, sp: smooth(r.pts, 6) }));
    this.canal = { ...CANAL, sp: smooth(CANAL.pts, 8) };
    this.minor = MINOR_CANALS.map((c) => ({ ...c, sp: smooth(c.pts, 8) }));
    this.chunks = new Map(); // key -> {solids, entries, active}
    this.landmarks = [];
    this.treeList = [];
    this.extraAabbs = [];
    this.waterTex = null;
    this.stats = { buildings: 0, solids: 0 };
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  /* ------------------------------------------------------------ helpers */
  roadClearance(x, z) {
    let best = 1e9, which = null, np = null;
    for (const r of this.roads) {
      const n = nearestOnLine(r.sp, x, z);
      const c = n.d - r.w / 2;
      if (c < best) { best = c; which = r; np = n; }
    }
    return { c: best, road: which, np };
  }
  canalClearance(x, z) {
    return nearestOnLine(this.canal.sp, x, z).d - this.canal.w / 2;
  }
  addSolid(x, y, z, hw, hh, hd, rotY = 0) {
    const key = `${Math.floor(x / CHUNK)}_${Math.floor(z / CHUNK)}`;
    let ch = this.chunks.get(key);
    if (!ch) { ch = { solids: [], entries: null, cx: (Math.floor(x / CHUNK) + 0.5) * CHUNK, cz: (Math.floor(z / CHUNK) + 0.5) * CHUNK }; this.chunks.set(key, ch); }
    ch.solids.push([x, y, z, hw, hh, hd, rotY]);
    this._bk = null; // spatial hash is rebuilt lazily
    this.stats.solids++;
  }

  /* ------------------------------------------------------------ build */
  build() {
    const t0 = performance.now();
    this.buildGround();
    this.buildRoads();
    this.buildRoadDetails();
    this.buildCanal();
    this.placeLandmarks();
    this.buildBuildings();
    this.buildFields();
    this.buildStreetFurniture();
    this.buildLandmarkMeshes();
    this.stats.merge = mergeStaticMeshes(this.group, 120);
    this.stats.ms = Math.round(performance.now() - t0);
  }

  buildGround() {
    const mat = new THREE.MeshStandardMaterial({ map: T.concreteTexture('#a39b86'), color: 0xd9c8a4, roughness: 1, metalness: 0 });
    mat.map.repeat.set(250, 170);
    // large-scale colour variation (dry dirt, dust, grass-tinted soil) sampled by world position, so the ground is not one flat tile
    const mc = document.createElement('canvas'); mc.width = mc.height = 256;
    const mx = mc.getContext('2d'); const img = mx.createImageData(256, 256);
    const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
    const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const g = (i, j) => hash(((xi + i) % 16 + 16) % 16, ((yi + j) % 16 + 16) % 16);
      return (g(0, 0) * (1 - u) + g(1, 0) * u) * (1 - v) + (g(0, 1) * (1 - u) + g(1, 1) * u) * v; };
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const nx = x / 16, ny = y / 16;
      const n = vnoise(nx, ny) * 0.55 + vnoise(nx * 2, ny * 2) * 0.3 + vnoise(nx * 4, ny * 4) * 0.15;
      const g = Math.min(1, Math.max(0, (n - 0.5) * 3.2)); // green patches where noise is high
      const i = (y * 256 + x) * 4;
      img.data[i] = 255 * (0.78 + 0.34 * n - 0.22 * g); img.data[i + 1] = 255 * (0.78 + 0.34 * n + 0.04 * g); img.data[i + 2] = 255 * (0.74 + 0.3 * n - 0.3 * g); img.data[i + 3] = 255;
    }
    mx.putImageData(img, 0, 0);
    const macro = new THREE.CanvasTexture(mc); macro.wrapS = macro.wrapT = THREE.RepeatWrapping; macro.colorSpace = THREE.SRGBColorSpace; macro.anisotropy = 4;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMacro = { value: macro };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMacro; varying vec3 vWp;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n  vec3 mc1 = texture2D(uMacro, vWp.xz * 0.0011).rgb; vec3 mc2 = texture2D(uMacro, vWp.xz * 0.012 + 0.37).rgb;\n  diffuseColor.rgb *= mc1 * mc2 * 1.55;');
    };
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1000), mat);
    g.rotation.x = -HALF_PI;
    g.position.set(-290, -0.04, 0);
    g.receiveShadow = true;
    this.group.add(g);
  }

  buildRoads() {
    const lane = { highway: 'highway', main: 'main', street: 'street' };
    const pave = new THREE.MeshStandardMaterial({ map: T.pavementTexture(), roughness: 0.95 });
    pave.map.repeat.set(1, 1);
    const median = new THREE.MeshStandardMaterial({ map: T.grassTexture('#6c7f45'), roughness: 1 });
    const kerb = new THREE.MeshStandardMaterial({ color: 0xb7b3a8, roughness: 0.9 });
    const layer = { highway: 0, main: 1, street: 2 };
    const near = (r) => (p) => {
      for (const o of this.roads) {
        if (o === r) continue;
        const n = nearestOnLine(o.sp, p[0], p[1]);
        if (n.d < o.w / 2 + 2.5) return false;
      }
      return true;
    };
    for (const r of this.roads) {
      const tile = 12;
      const mk = (cwOff, cw, kind, y) => {
        const am = new THREE.MeshStandardMaterial({ map: T.asphaltTexture(kind), roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -(3 - layer[r.type]), polygonOffsetUnits: -(3 - layer[r.type]) });
        const m = new THREE.Mesh(stripGeometry(r.sp, cwOff, cw, y, tile), am);
        m.receiveShadow = true;
        m.renderOrder = 2 - layer[r.type];
        this.group.add(m);
      };
      if (r.type === 'highway') {
        const med = 3.2;
        const cw = (r.w - med) / 2;
        mk(-(med / 2 + cw / 2), cw, 'highway', 0.02);
        mk(+(med / 2 + cw / 2), cw, 'highway', 0.02);
        for (const run of runs(r.sp, near(r))) {
          const m = new THREE.Mesh(stripGeometry(run, 0, med, 0.16, 8), median);
          m.receiveShadow = true;
          this.group.add(m);
          for (const s of [-1, 1]) { // kerb faces of the median
            const k = new THREE.Mesh(stripGeometry(run, s * (med / 2 + 0.15), 0.3, 0.17, 4), kerb);
            this.group.add(k);
          }
        }
        for (const s of [-1, 1]) for (const run of runs(r.sp, near(r))) {
          const p = new THREE.Mesh(stripGeometry(run, s * (r.w / 2 + 1.4), 2.8, 0.05, 6), pave);
          p.receiveShadow = true;
          this.group.add(p);
        }
      } else {
        mk(0, r.w, lane[r.type], 0.02);
        const sw = r.type === 'main' ? 2.4 : 1.8;
        for (const s of [-1, 1]) for (const run of runs(r.sp, near(r))) {
          const p = new THREE.Mesh(stripGeometry(run, s * (r.w / 2 + sw / 2), sw, 0.05, 6), pave);
          p.receiveShadow = true;
          this.group.add(p);
        }
      }
    }
  }

  /**
   * Road details (all decals, no collision): zebra crossings on the arms of every at-grade junction of main/street roads,
   * and manhole covers scattered along the lanes. One InstancedMesh each -> 2 extra draw calls.
   */
  buildRoadDetails() {
    const R = this.roads, J = [];
    const segInter = (a, b, c, d) => {
      const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1];
      const den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return null;
      const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
      return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a[0] + rx * t, z: a[1] + rz * t, ax: rx, az: rz, bx: sx, bz: sz } : null;
    };
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const A = R[i], B = R[j];
      for (let a = 0; a < A.sp.length - 1; a++) for (let b = 0; b < B.sp.length - 1; b++) {
        const h = segInter(A.sp[a], A.sp[a + 1], B.sp[b], B.sp[b + 1]);
        if (h && !J.some((q) => q.A === A && q.B === B && Math.hypot(q.x - h.x, q.z - h.z) < 20)) J.push({ ...h, A, B });
      }
    }
    const onAny = (x, z, skip, margin) => { for (const o of R) { if (o === skip) continue; if (nearestOnLine(o.sp, x, z).d < o.w / 2 + margin) return true; } return false; };
    const stripes = [];
    for (const j of J) for (const [road, other, dx, dz] of [[j.A, j.B, j.ax, j.az], [j.B, j.A, j.bx, j.bz]]) {
      if (road.type === 'highway') continue;
      const l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, nx = -uz, nz = ux;
      for (const side of [-1, 1]) {
        const dist = other.w / 2 + 3.4, cx = j.x + ux * side * dist, cz = j.z + uz * side * dist;
        if (nearestOnLine(road.sp, cx, cz).d > 1.2) continue;      // road curves away here
        if (onAny(cx, cz, road, 1.0)) continue;                    // a third road is too close
        if (this.canalClearance && this.canalClearance(cx, cz) < 6) continue; // not on a canal bridge
        const n = Math.floor((road.w - 1.6) / 0.95), yaw = Math.atan2(ux, uz);
        for (let k = 0; k < n; k++) { const lat = (k - (n - 1) / 2) * 0.95; stripes.push([cx + nx * lat, cz + nz * lat, yaw]); }
      }
    }
    const rr = (() => { let sd = 9137; return () => { sd = (sd * 1664525 + 1013904223) % 4294967296; return sd / 4294967296; }; })();
    if (stripes.length) {
      const geo = new THREE.BoxGeometry(0.5, 0.02, 3.2);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
      const im = new THREE.InstancedMesh(geo, mat, stripes.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      stripes.forEach(([x, z, yaw], i) => {
        m4.compose(new THREE.Vector3(x, 0.035, z), q.setFromAxisAngle(up, yaw), new THREE.Vector3(1, 1, 0.9 + rr() * 0.12));
        im.setMatrixAt(i, m4); const g = 0.78 + rr() * 0.2; im.setColorAt(i, c.setRGB(g, g * 0.99, g * 0.94)); // worn paint
      });
      im.receiveShadow = true; im.renderOrder = 6; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
      this.group.add(im);
    }
    // manholes: every 55-95 m along every road, inside a lane
    const holes = [];
    for (const road of R) {
      let acc = 30 + rr() * 40;
      for (let i = 0; i < road.sp.length - 1; i++) {
        const a = road.sp[i], b = road.sp[i + 1], sl = Math.hypot(b[0] - a[0], b[1] - a[1]); if (sl < 1e-6) continue;
        acc -= sl;
        if (acc <= 0) {
          acc = 55 + rr() * 40; const ux = (b[0] - a[0]) / sl, uz = (b[1] - a[1]) / sl;
          const lane = (rr() < 0.5 ? -1 : 1) * (road.type === 'highway' ? road.w * 0.25 : road.w * 0.22) + (rr() - 0.5) * 0.8;
          const x = a[0] - uz * lane, z = a[1] + ux * lane;
          if (onAny(x, z, road, 1.5)) continue;
          holes.push([x, z]);
        }
      }
    }
    if (holes.length) {
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.55, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 }));
      const li = new THREE.InstancedMesh(lid.geometry, lid.material, holes.length), ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 6, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5b5e60, roughness: 0.7, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 }));
      const ri = new THREE.InstancedMesh(ring.geometry, ring.material, holes.length), m4 = new THREE.Matrix4();
      holes.forEach(([x, z], i) => { m4.makeTranslation(x, 0.04, z); li.setMatrixAt(i, m4); ri.setMatrixAt(i, m4); });
      for (const m of [li, ri]) { m.receiveShadow = true; m.renderOrder = 7; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); this.group.add(m); }
    }
    this.junctions = J.map((j) => ({ x: +j.x.toFixed(1), z: +j.z.toFixed(1), a: j.A.name, b: j.B.name }));
    this.stats.crosswalks = stripes.length; this.stats.manholes = holes.length; this.stats.junctions = J.length;
  }

  buildCanal() {
    const c = this.canal;
    this.waterTex = T.waterNormal();
    this.waterTex.repeat.set(1, 1);
    const wmat = new THREE.MeshPhysicalMaterial({
      color: 0x2c7a8c, roughness: 0.06, metalness: 0.0, transmission: 0, clearcoat: 1, clearcoatRoughness: 0.05,
      normalMap: this.waterTex, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 1.6,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const geo = stripGeometry(c.sp, 0, c.w, 0.02, 14);
    const w = new THREE.Mesh(geo, wmat);
    w.renderOrder = 1;
    this.group.add(w);
    for (const mc of this.minor) {
      const m = new THREE.Mesh(stripGeometry(mc.sp, 0, mc.w, 0.02, 6), wmat);
      this.group.add(m);
      const bank = new THREE.Mesh(stripGeometry(mc.sp, 0, mc.w + 2.4, 0.015, 8), new THREE.MeshStandardMaterial({ map: T.concreteTexture('#7f7c72'), roughness: 1 }));
      this.group.add(bank);
    }
    // concrete banks + parapet wall (instanced boxes), open at the bridges
    const bankMat = new THREE.MeshStandardMaterial({ map: T.concreteTexture('#8d8a80'), roughness: 0.95 });
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(stripGeometry(c.sp, s * (c.w / 2 + 3.5), 7, 0.03, 10), bankMat);
      m.receiveShadow = true;
      this.group.add(m);
    }
    const wallGeo = box(1, 1, 1).translate(0, 0.5, 0);
    const segs = [];
    const step = 9;
    for (const s of [-1, 1]) {
      for (let i = 0; i < c.sp.length - 1; i++) {
        const a = c.sp[i], b = c.sp[i + 1];
        let tx = b[0] - a[0], tz = b[1] - a[1];
        const L = Math.hypot(tx, tz);
        tx /= L; tz /= L;
        const nx = -tz, nz = tx;
        const mx = (a[0] + b[0]) / 2 + nx * s * (c.w / 2 + 0.3), mz = (a[1] + b[1]) / 2 + nz * s * (c.w / 2 + 0.3);
        let skip = false;
        for (const br of BRIDGES) {
          if (Math.hypot(mx - br.at[0], mz - br.at[1]) < 16) skip = true;
        }
        for (const r of this.roads) { if (r.type !== 'highway' && r.name !== 'Khwaja Gharib Nawaz Rd') continue; if (nearestOnLine(r.sp, mx, mz).d < r.w / 2 + 2) skip = true; }
        if (skip) continue;
        segs.push({ x: mx, z: mz, len: L + 0.15, yaw: Math.atan2(tx, tz) });
      }
    }
    const wi = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ map: T.concreteTexture('#a39f94'), roughness: 0.9 }), segs.length);
    segs.forEach((sgm, i) => {
      this._e.set(0, sgm.yaw, 0);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p.set(sgm.x, 0, sgm.z), this._q, this._s.set(0.5, 1.1, sgm.len));
      wi.setMatrixAt(i, this._m);
      this.addSolid(sgm.x, 0.55, sgm.z, 0.25, 0.55, sgm.len / 2, sgm.yaw);
    });
    wi.castShadow = true;
    wi.receiveShadow = true;
    this.group.add(wi);

    // bridge deck over the canal
    for (const br of BRIDGES) {
      const road = this.roads.find((r) => r.name === 'Khwaja Gharib Nawaz Rd');
      const run = road.sp.filter((p) => Math.hypot(p[0] - br.at[0], p[1] - br.at[1]) < br.len / 2 + 12);
      if (run.length > 2) {
        const deck = new THREE.Mesh(
          stripGeometry(run, 0, road.w + 3.2, 0.045, 12),
          new THREE.MeshStandardMaterial({ map: T.asphaltTexture('deck'), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })
        );
        deck.renderOrder = 5;
        this.group.add(deck);
        const rail = new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.8 });
        const first = run[0], last = run[run.length - 1];
        const dx = last[0] - first[0], dz = last[1] - first[1];
        const L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
        const nx = -dz / L, nz = dx / L, mx = (first[0] + last[0]) / 2, mz = (first[1] + last[1]) / 2;
        for (const s of [-1, 1]) {
          const rx = mx + nx * s * (road.w / 2 + 1.6), rz = mz + nz * s * (road.w / 2 + 1.6);
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, L), rail);
          m.position.set(rx, 0.5, rz);
          m.rotation.y = yaw;
          m.castShadow = true;
          this.group.add(m);
          this.addSolid(rx, 0.5, rz, 0.2, 0.5, L / 2, yaw);
          for (let k = -4; k <= 4; k++) { // balusters + lamp posts
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), rail);
            post.position.set(rx + (dx / L) * k * (L / 9), 0.7, rz + (dz / L) * k * (L / 9));
            this.group.add(post);
          }
        }
        // arch ribs under the deck (visual)
        const ribMat = new THREE.MeshStandardMaterial({ map: T.concreteTexture('#8d8a80'), roughness: 1 });
        for (let k = -2; k <= 2; k++) {
          const px0 = mx + (dx / L) * k * 14, pz0 = mz + (dz / L) * k * 14;
          const pier = new THREE.Mesh(new THREE.BoxGeometry(road.w + 2, 0.5, 1.4), ribMat);
          pier.position.set(px0, 0.0, pz0);
          pier.rotation.y = yaw + HALF_PI;
          this.group.add(pier);
        }
        br.yaw = yaw;
        br.road = road;
      }
    }
  }

  /* ------------------------------------------------------------ landmarks */
  placeLandmarks() {
    for (const l of LANDMARKS) {
      let [x, z] = l.at;
      let yaw = l.yaw || 0;
      if (l.kind !== 'gate') {
        const ext = (Math.max(l.w, l.d) / 2) * 0.9;
        for (let it = 0; it < 40; it++) {
          const rc = this.roadClearance(x, z);
          const cc = this.canalClearance(x, z);
          const need = ext + 5 + (rc.road ? rc.road.w / 2 : 0);
          const dRoad = rc.c + (rc.road ? rc.road.w / 2 : 0);
          let moved = false;
          if (rc.road && dRoad < need) {
            let dx = x - rc.np.x, dz = z - rc.np.z;
            let L = Math.hypot(dx, dz);
            if (L < 0.5) { dx = 1; dz = 0; L = 1; }
            const push = need - dRoad + 1;
            x += (dx / L) * push; z += (dz / L) * push; moved = true;
          }
          if (cc < ext + 12) {
            const n = nearestOnLine(this.canal.sp, x, z);
            let dx = x - n.x, dz = z - n.z, L = Math.hypot(dx, dz) || 1;
            const push = ext + 12 - cc;
            x += (dx / L) * push; z += (dz / L) * push; moved = true;
          }
          if (!moved) break;
        }
        const rc = this.roadClearance(x, z);
        if (rc.np) {
          const ang = Math.atan2(rc.np.x - x, rc.np.z - z);
          yaw = Math.round(ang / HALF_PI) * HALF_PI;
        }
      } else {
        // gate spans the road: its local X axis points across the road
        const road = this.roads.find((q) => q.name === 'Khwaja Gharib Nawaz Rd');
        const n = nearestOnLine(road.sp, x, z);
        x = n.x; z = n.z;
        const i = road.sp.findIndex((p) => Math.hypot(p[0] - n.x, p[1] - n.z) < 8);
        const a = road.sp[Math.max(0, i - 1)], b = road.sp[Math.min(road.sp.length - 1, i + 1)];
        yaw = Math.atan2(b[0] - a[0], b[1] - a[1]) + HALF_PI * 0; // local +z along the road, arch spans x
        l.span = road.w + 6;
      }
      this.landmarks.push({ def: l, x, z, yaw });
    }
  }

  buildLandmarkMeshes() {
    for (const lm of this.landmarks) {
      const res = buildLandmark(lm.def, { renderer: this.renderer, rng: rng(lm.def.id.length * 131 + 7) });
      if (!res) continue;
      res.group.position.set(lm.x, 0, lm.z);
      res.group.rotation.y = lm.yaw;
      this.group.add(res.group);
      // solids are in landmark-local coordinates -> rotate into world
      const c = Math.cos(lm.yaw), s = Math.sin(lm.yaw);
      for (const [lx, ly, lz, hw, hh, hd, ry] of res.solids || []) {
        const wx = lm.x + lx * c + lz * s, wz = lm.z - lx * s + lz * c;
        this.addSolid(wx, ly, wz, hw, hh, hd, lm.yaw + (ry || 0));
      }
      lm.group = res.group;
    }
  }

  /* ------------------------------------------------------------ buildings */
  buildBuildings() {
    const r = rng(20261106);
    const placed = new Map(); // 16 m hash of AABBs
    const H = 16;
    const hit = (b) => {
      for (let gx = Math.floor((b.x0 - 2) / H); gx <= Math.floor((b.x1 + 2) / H); gx++)
        for (let gz = Math.floor((b.z0 - 2) / H); gz <= Math.floor((b.z1 + 2) / H); gz++) {
          const l = placed.get(gx + ',' + gz);
          if (!l) continue;
          for (const o of l) if (b.x0 < o.x1 + 1.2 && b.x1 > o.x0 - 1.2 && b.z0 < o.z1 + 1.2 && b.z1 > o.z0 - 1.2) return true;
        }
      return false;
    };
    const put = (b) => {
      for (let gx = Math.floor(b.x0 / H); gx <= Math.floor(b.x1 / H); gx++)
        for (let gz = Math.floor(b.z0 / H); gz <= Math.floor(b.z1 / H); gz++) {
          const k = gx + ',' + gz;
          if (!placed.has(k)) placed.set(k, []);
          placed.get(k).push(b);
        }
    };
    const lmRects = this.landmarks.map((l) => {
      const park = l.def.kind === 'park' || l.def.kind === 'farm';
      const e = (l.def.kind === 'hospital' ? l.def.w / 2 + 24 : Math.max(l.def.w, l.def.d) / 2) + (park ? 3 : 4);
      return { x0: l.x - e, x1: l.x + e, z0: l.z - e, z1: l.z + e };
    });
    for (const lr of lmRects) put(lr);
    const spawn = { x0: -75, x1: 75, z0: -65, z1: 75 }; // proving ground stays empty
    const dres = generateDistricts(this, { rng, pick, ZONES, nearestOnLine, lmRects, spawn });
    const list = dres.houses;
    this.alignFrontage(list, dres, lmRects, spawn);
    // boundary walls + gates (instanced)
    {
      const wg = box(1, 1, 1).translate(0, 0.5, 0);
      const wi = new THREE.InstancedMesh(wg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93 }), dres.walls.length);
      const c0 = new THREE.Color();
      dres.walls.forEach((w, i) => {
        this._q.identity();
        this._m.compose(this._p.set(w.x, 0, w.z), this._q, this._s.set(w.len, w.h, w.th));
        wi.setMatrixAt(i, this._m);
        wi.setColorAt(i, c0.setHex(w.col));
        this.addSolid(w.x, w.h / 2, w.z, w.len / 2, w.h / 2, w.th / 2, 0);
      });
      wi.castShadow = true; wi.receiveShadow = true;
      wi.computeBoundingSphere();
      this.group.add(wi);
      const gi = new THREE.InstancedMesh(wg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.4 }), dres.gates.length);
      dres.gates.forEach((g, i) => {
        this._q.identity();
        this._m.compose(this._p.set(g.x, 0.05, g.z), this._q, this._s.set(g.w, 1.5, 0.07));
        gi.setMatrixAt(i, this._m);
        gi.setColorAt(i, c0.setHex(g.col));
      });
      gi.computeBoundingSphere();
      this.group.add(gi);
    }
    this.buildingList = list;
    this.stats.buildings = list.length;
    this.stats.walls = dres.walls.length;
    // ---- chunked instanced meshes
    const byChunk = new Map();
    for (const b of list) {
      const k = `${Math.floor(b.x / CHUNK)}_${Math.floor(b.z / CHUNK)}`;
      if (!byChunk.has(k)) byChunk.set(k, []);
      byChunk.get(k).push(b);
      if (b.yawRad !== undefined) this.addSolid(b.x, b.h / 2, b.z, b.w / 2, b.h / 2, b.d / 2, b.yawRad);
      else this.addSolid(b.x, b.h / 2, b.z, (Math.abs(b.yaw) % 2 ? b.d : b.w) / 2, b.h / 2, (Math.abs(b.yaw) % 2 ? b.w : b.d) / 2, 0);
    }
    const bodyGeo = box(1, 1, 1).translate(0, 0.5, 0);
    const t = 0.014;
    const ringGeo = mergeGeos([box(1, 1, t, 0, 0.5, 0.5 - t / 2), box(1, 1, t, 0, 0.5, -0.5 + t / 2), box(t, 1, 1 - 2 * t, 0.5 - t / 2, 0.5, 0), box(t, 1, 1 - 2 * t, -0.5 + t / 2, 0.5, 0)]);
    const tankGeo = mergeGeos([box(1.0, 0.5, 1.0, 0, 0.25, 0), new THREE.CylinderGeometry(0.55, 0.55, 1.2, 14).translate(0, 1.1, 0)]);
    const stairGeo = box(2.4, 2.7, 2.6, 0, 1.35, 0);
    const mats = [0, 1, 2, 3].map((v) => {
      const m = new THREE.MeshStandardMaterial({ map: T.facadeTexture(v), roughness: 0.88, metalness: 0 });
      patchFacade(m);
      return m;
    });
    const parapetMat = new THREE.MeshStandardMaterial({ color: 0xcfc9bb, roughness: 0.95 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x242d38, roughness: 0.45, metalness: 0.2 });
    const stairMat = new THREE.MeshStandardMaterial({ color: 0xbfb9ab, roughness: 0.95 });
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x111111 });
    const c = new THREE.Color();
    for (const [key, arr] of byChunk) {
      const grp = new THREE.Group();
      const mk = (geo, mat, n) => {
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.castShadow = true;
        m.receiveShadow = true;
        grp.add(m);
        return m;
      };
      const per = [[], [], [], []];
      for (const b of arr) per[b.variant].push(b);
      for (let v = 0; v < 4; v++) {
        const bs = per[v];
        if (!bs.length) continue;
        const body = mk(bodyGeo, mats[v], bs.length);
        const ring = mk(ringGeo, parapetMat, bs.length);
        bs.forEach((b, i) => {
          this._e.set(0, yawOf(b), 0);
          this._q.setFromEuler(this._e);
          this._m.compose(this._p.set(b.x, 0, b.z), this._q, this._s.set(b.w, b.h, b.d));
          body.setMatrixAt(i, this._m);
          body.setColorAt(i, c.setHex(b.color));
          this._m.compose(this._p.set(b.x, b.h, b.z), this._q, this._s.set(b.w, 0.95, b.d));
          ring.setMatrixAt(i, this._m);
          ring.setColorAt(i, c.setHex(b.color).multiplyScalar(0.92));
        });
        body.instanceMatrix.needsUpdate = true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;
      }
      const tanks = arr.filter((b) => b.tank), stairs = arr.filter((b) => b.stairs), signs = arr.filter((b) => b.sign);
      if (tanks.length) {
        const m = mk(tankGeo, tankMat, tanks.length);
        tanks.forEach((b, i) => {
          this._e.set(0, yawOf(b), 0);
          this._q.setFromEuler(this._e);
          const ox = (b.w / 2 - 1.2) * (i % 2 ? 1 : -1), oz = -(b.d / 2 - 1.4);
          const wx = b.x + ox * Math.cos(yawOf(b)) + oz * Math.sin(yawOf(b)), wz = b.z - ox * Math.sin(yawOf(b)) + oz * Math.cos(yawOf(b));
          this._m.compose(this._p.set(wx, b.h, wz), this._q, this._s.set(1, 1, 1));
          m.setMatrixAt(i, this._m);
        });
      }
      if (stairs.length) {
        const m = mk(stairGeo, stairMat, stairs.length);
        stairs.forEach((b, i) => {
          this._e.set(0, yawOf(b), 0);
          this._q.setFromEuler(this._e);
          const ox = (b.w / 2 - 1.6) * (i % 2 ? -1 : 1), oz = b.d / 2 - 2.0;
          const wx = b.x + ox * Math.cos(yawOf(b)) + oz * Math.sin(yawOf(b)), wz = b.z - ox * Math.sin(yawOf(b)) + oz * Math.cos(yawOf(b));
          this._m.compose(this._p.set(wx, b.h, wz), this._q, this._s.set(1, 1, 1));
          m.setMatrixAt(i, this._m);
          m.setColorAt(i, c.setHex(b.color).multiplyScalar(0.9));
        });
      }
      if (signs.length) {
        const m = mk(box(1, 1, 1), signMat, signs.length);
        signs.forEach((b, i) => {
          this._e.set(0, yawOf(b), 0);
          this._q.setFromEuler(this._e);
          const oz = b.d / 2 + 0.1;
          const wx = b.x + oz * Math.sin(yawOf(b)), wz = b.z + oz * Math.cos(yawOf(b));
          this._m.compose(this._p.set(wx, 3.55, wz), this._q, this._s.set(b.w * 0.8, 0.8, 0.12));
          m.setMatrixAt(i, this._m);
          m.setColorAt(i, c.setHex(b.sign));
        });
      }
      for (const m of grp.children) { m.computeBoundingSphere?.(); m.computeBoundingBox?.(); }
      this.group.add(grp);
    }
  }

  /**
   * Houses generated on the lane grid are axis-aligned, so along diagonal / curved public roads they form a
   * saw-tooth. Here the zone next to every diagonal road is cleared and refilled with houses rotated to the
   * road tangent (continuous yaw), front door towards the road. Rotated colliders use addSolid(rotY).
   */
  alignFrontage(list, dres, lmRects, spawn) {
    const DEG = Math.PI / 180;
    const BAND = 16;   // metres on each side that are re-laid
    const segs = [];
    for (const rd of this.roads) {
      if (rd.type === 'highway') continue;
      let acc = 0, start = 0;
      for (let i = 1; i < rd.sp.length; i++) {
        const dx = rd.sp[i][0] - rd.sp[i - 1][0], dz = rd.sp[i][1] - rd.sp[i - 1][1];
        const a = Math.atan2(dx, dz);
        const dev = Math.abs(((a % HALF_PI) + HALF_PI) % HALF_PI);
        const d2 = Math.min(dev, HALF_PI - dev);
        if (d2 > 8 * DEG) segs.push({ rd, i, a, mx: (rd.sp[i][0] + rd.sp[i - 1][0]) / 2, mz: (rd.sp[i][1] + rd.sp[i - 1][1]) / 2, len: Math.hypot(dx, dz) });
      }
    }
    if (!segs.length) { this.stats.frontageRemoved = 0; this.stats.frontageAdded = 0; return; }
    const nearDiag = (x, z, m) => segs.some((g) => Math.hypot(g.mx - x, g.mz - z) < g.len / 2 + m && nearestOnLine(g.rd.sp, x, z).d < g.rd.w / 2 + m);
    // 1) clear axis-aligned houses/walls/gates in the band
    let removed = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (nearDiag(b.x, b.z, BAND) || nearDiag(b.aabb.x0, b.aabb.z0, BAND) || nearDiag(b.aabb.x1, b.aabb.z1, BAND)) { list.splice(i, 1); removed++; }
    }
    dres.walls = dres.walls.filter((w) => !nearDiag(w.x, w.z, BAND));
    dres.gates = dres.gates.filter((g) => !nearDiag(g.x, g.z, BAND));
    // 2) lay rotated houses along each diagonal segment run
    const rr = rng(8675309);
    const palette = [0xf2ead8, 0xe8d9a8, 0xd9e4ee, 0xefd2c8, 0xe6c3b8, 0xd8dccb, 0xf6f4ee, 0xcbb9a4];
    let added = 0;
    const occupied = list.map((b) => b.aabb);
    const overlapsAny = (a) => {
      for (const o of occupied) if (a.x0 < o.x1 + 1 && a.x1 > o.x0 - 1 && a.z0 < o.z1 + 1 && a.z1 > o.z0 - 1) return true;
      return false;
    };
    // only residential zones (colony / village / villa) get houses; factories and open land stay as they are
    const resRects = ZONES.filter((z) => z.type !== 'factory').map((z) => { const [a, b] = px(z.rect[0], z.rect[1]), [c2, d] = px(z.rect[2], z.rect[3]); return [a, b, c2, d]; });
    const inResidential = (x, z) => resRects.some((r2) => x > r2[0] && x < r2[2] && z > r2[1] && z < r2[3]);
    const walkers = new Map();
    for (const g of segs) { if (!walkers.has(g.rd)) walkers.set(g.rd, []); walkers.get(g.rd).push(g); }
    for (const [rd, gl] of walkers) {
      let carry = 0;
      for (const g of gl) {
        const tx = Math.sin(g.a), tz = Math.cos(g.a), nx = tz, nz = -tx;
        let t = carry;
        while (t < g.len) {
          const pw = [9, 10, 11, 12][Math.floor(rr() * 4)] , hd = 9 + Math.floor(rr() * 3);
          const px0 = g.mx - tx * (g.len / 2 - t - pw / 2), pz0 = g.mz - tz * (g.len / 2 - t - pw / 2);
          t += pw + 0.4;
          for (const side of [-1, 1]) {
            if (rr() > 0.9) continue;
            const off = rd.w / 2 + 4.5 + hd / 2;
            const cx = px0 + nx * side * off, cz = pz0 + nz * side * off;
            const hw = Math.abs(tx) * pw / 2 + Math.abs(nx) * hd / 2 * 1, hz = Math.abs(tz) * pw / 2 + Math.abs(nz) * hd / 2;
            const aabb = { x0: cx - (Math.abs(tx) * pw + Math.abs(nx) * hd) / 2, x1: cx + (Math.abs(tx) * pw + Math.abs(nx) * hd) / 2, z0: cz - (Math.abs(tz) * pw + Math.abs(nz) * hd) / 2, z1: cz + (Math.abs(tz) * pw + Math.abs(nz) * hd) / 2 };
            void hw; void hz;
            // every corner and the centre must be clear of other roads, the canal, landmarks, the spawn yard and other houses
            const ok = [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]].every(([cxs, czs]) => {
              const wx = cx + tx * cxs * pw / 2 + nx * czs * hd / 2, wz = cz + tz * cxs * pw / 2 + nz * czs * hd / 2;
              if (wx > MAP_BOUNDS.maxX || wx < MAP_BOUNDS.minX || wz < MAP_BOUNDS.minZ || wz > MAP_BOUNDS.maxZ) return false;
              if (wx > spawn.x0 && wx < spawn.x1 && wz > spawn.z0 && wz < spawn.z1) return false;
              const rc = this.roadClearance(wx, wz);
              if (rc.c < (rc.road === rd ? 3.2 : 2.5)) return false;
              if (this.canalClearance(wx, wz) < 8) return false;
              for (const mc of this.minor) if (nearestOnLine(mc.sp, wx, wz).d < mc.w / 2 + 8) return false;
              for (const l of lmRects) if (wx > l.x0 && wx < l.x1 && wz > l.z0 && wz < l.z1) return false;
              return inResidential(wx, wz);
            });
            if (!ok || overlapsAny(aabb)) continue;
            const floors = rr() < 0.15 ? 1 : rr() < 0.6 ? 2 : 3;
            list.push({
              x: cx, z: cz, w: pw - 0.3, d: hd, h: floors * 3, floors, yaw: 0,
              // local +z (the front) must point at the road: -side * n
              yawRad: Math.atan2(-nx * side, -nz * side),
              variant: [0, 0, 0, 1, 1, 2][Math.floor(rr() * 6)], color: palette[Math.floor(rr() * palette.length)],
              tank: rr() < 0.7, stairs: rr() < 0.5, sign: null, aabb
            });
            occupied.push(aabb);
            added++;
          }
        }
        carry = t - g.len;
      }
    }
    this.stats.frontageRemoved = removed;
    this.stats.frontageAdded = added;
  }

  /* ------------------------------------------------------------ fields (east farmland) */
  buildFields() {
    const r = rng(555);
    const [gx0, gz0] = px(940, 215), [gx1, gz1] = px(1400, 740);
    const kinds = ['wheat', 'green', 'plough'];
    for (let z = gz0; z < gz1; z += 70) {
      for (let x = gx0; x < gx1; x += 70) {
        const cx = x + 35, cz = z + 35;
        if (cx > -90 && cx < 90 && cz > -80 && cz < 90) continue; // spawn, park, farm road area
        if (this.roadClearance(cx, cz).c < 40) continue;
        if (this.hitsBuilding(cx, cz) || this.hitsBuilding(cx + 26, cz + 26) || this.hitsBuilding(cx - 26, cz - 26) || this.hitsBuilding(cx + 26, cz - 26) || this.hitsBuilding(cx - 26, cz + 26)) continue;
        if (this.landmarks.some((l) => Math.abs(l.x - cx) < l.def.w / 2 + 40 && Math.abs(l.z - cz) < l.def.d / 2 + 40)) continue;
        if (r() < 0.2) continue;
        const k = pick(r, kinds);
        const mat = new THREE.MeshStandardMaterial({ map: T.fieldTexture(k), roughness: 1 });
        mat.map = mat.map.clone();
        mat.map.needsUpdate = true;
        mat.map.repeat.set(10, 10);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(62, 62), mat);
        m.rotation.x = -HALF_PI;
        m.position.set(cx, 0.01, cz);
        m.receiveShadow = true;
        this.group.add(m);
      }
    }
  }

  /* ------------------------------------------------------------ street furniture */
  buildStreetFurniture() {
    const r = rng(8080);
    // electric poles + wires along main and street roads
    const poleGeo = mergeGeos([new THREE.CylinderGeometry(0.1, 0.15, 9, 8).translate(0, 4.5, 0), box(2.2, 0.1, 0.12, 0, 8.4, 0), box(1.4, 0.1, 0.12, 0, 7.5, 0)]);
    const poles = [];
    const wire = [];
    for (const rd of this.roads) {
      if (rd.type === 'highway') continue;
      const side = rd.w / 2 + 2.9;
      let acc = 0, prev = null;
      for (let i = 1; i < rd.sp.length; i++) {
        acc += Math.hypot(rd.sp[i][0] - rd.sp[i - 1][0], rd.sp[i][1] - rd.sp[i - 1][1]);
        if (acc < 36) continue;
        acc = 0;
        const a = rd.sp[i - 1], b = rd.sp[i];
        let tx = b[0] - a[0], tz = b[1] - a[1];
        const L = Math.hypot(tx, tz) || 1;
        tx /= L; tz /= L;
        const x = b[0] - tz * side, z = b[1] + tx * side;
        if (this.roadClearance(x, z).c < rd.w / 2 - 0.2 && false) continue;
        if (this.canalClearance(x, z) < 2) { prev = null; continue; }
        poles.push([x, z, Math.atan2(tx, tz)]);
        if (prev && Math.hypot(x - prev[0], z - prev[1]) < 48) for (const h of [8.4, 8.4, 7.5]) {
          // hanging cable: 6 short segments with a sag in the middle
          let lx = prev[0], ly = h - 0.15, lz = prev[1];
          for (let k = 1; k <= 6; k++) { const t = k / 6, nx = prev[0] + (x - prev[0]) * t, nz = prev[1] + (z - prev[1]) * t, ny = h - 0.15 - 0.9 * 4 * t * (1 - t); wire.push(lx, ly, lz, nx, ny, nz); lx = nx; ly = ny; lz = nz; }
        }
        prev = [x, z];
        void r;
      }
    }
    const pi = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x6d6a63, roughness: 0.9 }), poles.length);
    poles.forEach((p, i) => {
      this._e.set(0, p[2] + HALF_PI, 0);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p.set(p[0], 0, p[1]), this._q, this._s.set(1, 1, 1));
      pi.setMatrixAt(i, this._m);
      this.addSolid(p[0], 2, p[1], 0.15, 2, 0.15, 0);
    });
    pi.castShadow = true;
    this.group.add(pi);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    this.group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x15171a })));
    // street lamps on highway medians
    const lampGeo = mergeGeos([new THREE.CylinderGeometry(0.1, 0.14, 9, 8).translate(0, 4.5, 0), box(0.12, 0.12, 3.2, 0, 9, 1.4), box(0.5, 0.18, 0.9, 0, 8.9, 2.8)]);
    const lamps = [];
    for (const rd of this.roads) {
      if (rd.type !== 'highway') continue;
      let acc = 0;
      for (let i = 1; i < rd.sp.length; i++) {
        acc += Math.hypot(rd.sp[i][0] - rd.sp[i - 1][0], rd.sp[i][1] - rd.sp[i - 1][1]);
        if (acc < 42) continue;
        acc = 0;
        const a = rd.sp[i - 1], b = rd.sp[i];
        const tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
        if (this.roads.some((o) => o !== rd && nearestOnLine(o.sp, b[0], b[1]).d < o.w / 2 + 6)) continue;
        if (this.canalClearance(b[0], b[1]) < 3) continue;
        lamps.push([b[0], b[1], Math.atan2(tx / L, tz / L)]);
      }
    }
    const li = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.6, metalness: 0.5 }), lamps.length);
    lamps.forEach((p, i) => {
      this._e.set(0, p[2] + (i % 2 ? Math.PI : 0) + HALF_PI, 0);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p.set(p[0], 0.16, p[1]), this._q, this._s.set(1, 1, 1));
      li.setMatrixAt(i, this._m);
    });
    li.castShadow = true;
    this.group.add(li);
    // night look: glowing lamp heads + soft light pools on the road (driven by WeatherSystem, no real lights = cheap)
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffd49a, emissiveIntensity: 0 });
    const bulb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.06, 0.74).translate(0, 8.78, 2.8), this.lampMat, lamps.length);
    const pc = document.createElement('canvas'); pc.width = pc.height = 128;
    const px = pc.getContext('2d'); const gr = px.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,214,150,0.85)'); gr.addColorStop(0.45, 'rgba(255,190,110,0.30)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
    px.fillStyle = gr; px.fillRect(0, 0, 128, 128);
    const poolTex = new THREE.CanvasTexture(pc); poolTex.colorSpace = THREE.SRGBColorSpace;
    this.lampPoolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(15, 15).rotateX(-Math.PI / 2).translate(0, 0.1, 2.8), this.lampPoolMat, lamps.length);
    const lm = new THREE.Matrix4();
    for (let i = 0; i < lamps.length; i++) { li.getMatrixAt(i, lm); bulb.setMatrixAt(i, lm); pool.setMatrixAt(i, lm); }
    bulb.frustumCulled = pool.frustumCulled = false;
    pool.renderOrder = 5; pool.visible = false; this.lampPool = pool;
    this.group.add(bulb, pool);
    // roadside trees (plus every district tree) -> proper instanced broadleaf / palm / cypress / shrub
    const rr = rng(4242);
    for (const rd of this.roads) {
      let acc = 0;
      for (let i = 1; i < rd.sp.length; i++) {
        acc += Math.hypot(rd.sp[i][0] - rd.sp[i - 1][0], rd.sp[i][1] - rd.sp[i - 1][1]);
        if (acc < (rd.type === 'highway' ? 16 : 22)) continue;
        acc = 0;
        const a = rd.sp[i - 1], b = rd.sp[i];
        const tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
        const nx = -tz / L, nz = tx / L;
        const sides = rd.type === 'highway' ? [0] : [rr() < 0.5 ? -1 : 1];
        for (const s of sides) {
          const off = rd.type === 'highway' ? 0 : s * (rd.w / 2 + 3.4);
          const x = b[0] + nx * off, z = b[1] + nz * off;
          if (this.roads.some((o) => o !== rd && nearestOnLine(o.sp, x, z).d < o.w / 2 + 5)) continue;
          if (this.canalClearance(x, z) < 8) continue;
          if (x > -50 && x < 70 && z > -50 && z < 70) continue;
          if (this.landmarks.some((l) => Math.abs(l.x - x) < l.def.w / 2 + 4 && Math.abs(l.z - z) < l.def.d / 2 + 4)) continue;
          if (this.hitsBuilding(x, z)) continue;
          this.treeList.push({ t: rd.type === 'highway' ? (rr() < 0.7 ? 'palm' : 'shrub') : 'broadleaf', x, z, s: rd.type === 'highway' ? 0.9 + rr() * 0.3 : 0.85 + rr() * 0.4, ry: rr() * 6.28 });
        }
      }
    }
    this.sanitizeTrees();
    const treePos = this.treeList;
    this.treeGeos = makeTreeGeos();
    this.treeGeosLo = makeTreeGeos(1);
    this.treeLod = buildTreeInstances(treePos, this.treeGeos, makeTreeMaterial(), this.group, { solid: (x, z, h) => this.addSolid(x, 1.5, z, h, 1.5, h, 0), geosLo: this.treeGeosLo });
    this.stats.trees = treePos.length;
    this.stats.poles = poles.length;
  }

  /** Push every tree out of walls / buildings (circle vs box), or drop it if it cannot be moved cleanly. */
  sanitizeTrees() {
    const keep = []; let moved = 0, dropped = 0;
    for (const t of this.treeList) {
      const rad = t.t === 'shrub' ? 0.75 : 0.65;
      let x = t.x, z = t.z, ok = true;
      for (let it = 0; it < 5; it++) {
        let worst = null;
        for (const [sx, , sz, hw, , hd, ry] of this.blockersNear(x, z, rad)) {
          const cs = Math.cos(ry || 0), sn = Math.sin(ry || 0), rx = x - sx, rz = z - sz;
          const lx = rx * cs - rz * sn, lz = rx * sn + rz * cs;
          const qx = Math.max(-hw, Math.min(hw, lx)), qz = Math.max(-hd, Math.min(hd, lz));
          let nx = lx - qx, nz = lz - qz, d = Math.hypot(nx, nz), pen;
          if (d > 1e-6) { if (d >= rad) continue; pen = rad - d; nx /= d; nz /= d; }
          else { const ex = hw - Math.abs(lx), ez = hd - Math.abs(lz); if (ex < ez) { nx = Math.sign(lx) || 1; nz = 0; pen = ex + rad; } else { nx = 0; nz = Math.sign(lz) || 1; pen = ez + rad; } }
          if (!worst || pen > worst.pen) worst = { pen, wx: nx * cs + nz * sn, wz: -nx * sn + nz * cs };
        }
        if (!worst) break;
        x += worst.wx * (worst.pen + 0.05); z += worst.wz * (worst.pen + 0.05);
        if (it === 4) ok = false;
      }
      if (ok && Math.hypot(x - t.x, z - t.z) > 3.0) ok = false; // moved too far = not a clean fix
      if (ok && (x !== t.x || z !== t.z) && this.roadClearance && this.roadClearance(x, z).c < 0.8) ok = false; // would land on a road
      if (!ok) { dropped++; continue; }
      if (x !== t.x || z !== t.z) { t.x = x; t.z = z; moved++; }
      keep.push(t);
    }
    this.treeList = keep; this.stats.treesMoved = moved; this.stats.treesDropped = dropped;
  }

  hitsBuilding(x, z) {
    // coarse: checks the placed list through a lazily built hash
    if (!this._bh) {
      this._bh = new Map();
      for (const b of [...this.buildingList, ...this.extraAabbs.map((a) => ({ aabb: a }))]) {
        for (let gx = Math.floor(b.aabb.x0 / 16); gx <= Math.floor(b.aabb.x1 / 16); gx++)
          for (let gz = Math.floor(b.aabb.z0 / 16); gz <= Math.floor(b.aabb.z1 / 16); gz++) {
            const k = gx + ',' + gz;
            if (!this._bh.has(k)) this._bh.set(k, []);
            this._bh.get(k).push(b.aabb);
          }
      }
    }
    const l = this._bh.get(Math.floor(x / 16) + ',' + Math.floor(z / 16));
    if (!l) return false;
    return l.some((a) => x > a.x0 - 1.5 && x < a.x1 + 1.5 && z > a.z0 - 1.5 && z < a.z1 + 1.5);
  }

  /* ------------------------------------------------------------ streaming */
  update(dt, focus) {
    if (this.waterTex) { this.waterTex.offset.y += dt * 0.012; this.waterTex.offset.x += dt * 0.004; }
    if (this.treeLod && focus && ((this._tlT = (this._tlT || 0) - dt) <= 0)) { this._tlT = 0.25; this.treeLod.update(focus.x, focus.z); }
    if (!this.physics.ready || !focus) return;
    for (const [key, ch] of this.chunks) {
      const d = Math.hypot(ch.cx - focus.x, ch.cz - focus.z);
      if (!ch.entries && d < CHUNK * 1.25) {
        ch.entries = ch.solids.map(([x, y, z, hw, hh, hd, ry]) => this.physics.createFixedBox(x, y, z, hw, hh, hd, ry ? new THREE.Euler(0, ry, 0) : null)).filter(Boolean);
      } else if (ch.entries && d > CHUNK * 1.9) {
        for (const e of ch.entries) this.physics.removeEntry(e);
        ch.entries = null;
      }
    }
  }

  /** Static blocking boxes (buildings, walls, poles, trees...) near a point, from the DATA (independent of the physics engine).
   *  Used by vehicles as a second, engine-independent safety net so a car can never end up inside a building. */
  blockersNear(x, z, r) {
    if (!this._bk) {
      this._bk = new Map();
      for (const ch of this.chunks.values()) for (const sd of ch.solids) {
        const [sx, sy, sz, hw, hh, hd] = sd;
        if (sy + hh < 0.35 || sy - hh > 1.1) continue; // does not block a car body
        const rad = Math.hypot(hw, hd) + 2.6; // margin >= largest query radius so corner queries never miss
        for (let i = Math.floor((sx - rad) / 12); i <= Math.floor((sx + rad) / 12); i++) for (let j = Math.floor((sz - rad) / 12); j <= Math.floor((sz + rad) / 12); j++) {
          const k = i + ',' + j; let l = this._bk.get(k); if (!l) this._bk.set(k, (l = [])); l.push(sd);
        }
      }
    }
    return this._bk.get(Math.floor(x / 12) + ',' + Math.floor(z / 12)) || [];
  }

  /** force-load colliders around a point (used before spawning there) */
  prime(x, z) {
    this.update(0, { x, z });
  }
}
