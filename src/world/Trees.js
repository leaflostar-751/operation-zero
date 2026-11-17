import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Proper trees (vertex-coloured, one merged geometry each, used as InstancedMesh):
 *   broadleaf (neem / shisham): flared trunk, two limbs, 7 noise-displaced foliage clumps, ~9 m tall
 *   palm: curved ringed trunk + 11 drooping fronds, ~9 m
 *   cypress: tall narrow cone-ish ornamental, ~7 m
 *   shrub: low hedge ball, ~1.2 m
 * Foliage vertex colours darken toward the underside of each clump and jitter per vertex so the
 * crown reads as leaves instead of one smooth ball.
 */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function collect() {
  const parts = [];
  return {
    parts,
    push(geo, m4, colorFn, smooth = false) {
      let g;
      if (smooth) { // welded vertices -> smooth normals (foliage blobs and trunk look round, not faceted)
        const w = geo.clone(); w.deleteAttribute('uv'); w.deleteAttribute('normal');
        g = mergeVertices(w, 1e-3); g.computeVertexNormals(); g = g.toNonIndexed();
        g.applyMatrix4(m4);
      } else {
        g = geo.index ? geo.toNonIndexed() : geo.clone();
        g.applyMatrix4(m4);
        g.computeVertexNormals();
      }
      const p = g.attributes.position;
      const col = new Float32Array(p.count * 3);
      const c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        colorFn(c, p.getX(i), p.getY(i), p.getZ(i), i);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.deleteAttribute('uv');
      parts.push(g);
    },
    build() {
      const P = [], N = [], C = [];
      for (const g of parts) {
        const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
        for (let i = 0; i < p.count; i++) {
          P.push(p.getX(i), p.getY(i), p.getZ(i));
          N.push(n.getX(i), n.getY(i), n.getZ(i));
          C.push(c.getX(i), c.getY(i), c.getZ(i));
        }
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      return out;
    }
  };
}

const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function clump(geoR, detail, r, seed) {
  const g = new THREE.IcosahedronGeometry(geoR, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const hs = (x, y, z, k) => { const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * k) * 43758.5453; return h - Math.floor(h); };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // same displacement for coincident vertices (hash of the position), two octaves: big lumps + leaf-scale bumps
    const q = v.clone().normalize();
    const big = hs(Math.round(q.x * 2), Math.round(q.y * 2), Math.round(q.z * 2), 1) - 0.5;
    const small = hs(q.x * 7, q.y * 7, q.z * 7, 3) - 0.5;
    v.multiplyScalar(1 + big * 0.32 + small * 0.22);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/** tapered branch from (0,0,0) towards `to`; returns [geometry, matrix] */
function limb(to, r0, r1, seg = 5) {
  const len = Math.hypot(to[0], to[1], to[2]);
  const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1).translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(to[0], to[1], to[2]).normalize());
  return g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
}

const bark = (c, x, y) => c.setHSL(0.07, 0.35, 0.2 + Math.min(0.1, y * 0.01));

export function makeTreeGeos() {
  const out = {};

  // ---- broadleaf: buttress roots, tapering trunk, 5 limbs, each limb ends inside a foliage cluster
  {
    const t = collect();
    const barkC = (c, x, y, z, vi) => { const j = Math.abs((Math.sin(vi * 7.13) * 4375.5) % 1); c.setHSL(0.07, 0.3 + j * 0.1, 0.13 + Math.min(0.1, y * 0.012) + j * 0.05); };
    // trunk in 4 stacked segments (radius 0.5 -> 0.26), slightly offset so it is not a perfect pole
    const rad = [0.52, 0.42, 0.34, 0.28, 0.24];
    for (let i = 0; i < 4; i++) {
      const h = 1.1;
      t.push(new THREE.CylinderGeometry(rad[i + 1], rad[i], h + 0.06, 9, 1), M4(0.05 * i, 0.55 + i * 1.05, 0.03 * i * (i % 2 ? 1 : -1)), barkC, true);
    }
    // root flare: 4 wedges that sink into the ground
    for (let k = 0; k < 4; k++) {
      const a = k * 1.57 + 0.4;
      t.push(limb([Math.cos(a) * 0.95, -0.38, Math.sin(a) * 0.95], 0.2, 0.06).rotateX(0), M4(0, 0.35, 0, 1, 1, 1, 0, 0, 0), barkC, true);
    }
    // limbs from the top of the trunk (y~4.4) to the cluster centres
    const base = [0.15, 4.3, 0];
    const clusters = [
      [0.1, 6.9, 0.0, 2.1], [2.2, 6.0, 0.6, 1.7], [-2.2, 5.9, -0.5, 1.7], [0.5, 5.7, 2.3, 1.6], [-0.5, 6.0, -2.3, 1.6]
    ];
    clusters.forEach(([x, y, z, r], i) => {
      const to = [x - base[0], (y - r * 0.55) - base[1], z - base[2]];
      t.push(limb(to, 0.2 - i * 0.012, 0.07), M4(base[0], base[1], base[2]), barkC, true);
      // second tier of twigs inside the cluster
      t.push(limb([Math.sign(x || 1) * 0.7, 1.0, Math.sign(z || 1) * 0.5], 0.07, 0.03), M4(x, y - r * 0.7, z), barkC, true);
    });
    // foliage: big clusters made of 3 overlapping lumps each + a few outlying lumps
    let n = 0;
    const lump = (x, y, z, r) => {
      const g = clump(1, 1, r, n * 17 + 3);
      const ph = n++;
      t.push(g, M4(x, y, z, r, r * 0.8, r), (c, px, py, pz, vi) => {
        const rel = Math.min(1, Math.max(0, (py - (y - r * 0.8)) / (r * 1.6)));
        const j = Math.abs((Math.sin(vi * 12.9898 + ph) * 43758.5453) % 1);
        const patch = Math.abs(Math.sin(px * 1.7 + pz * 1.3 + ph)); // sunlit / shaded leaf patches
        c.setHSL(0.235 + j * 0.05 + patch * 0.02, 0.45 + patch * 0.1, 0.09 + rel * 0.22 + j * 0.05 + patch * 0.03);
      }, true);
    };
    for (const [x, y, z, r] of clusters) {
      lump(x, y, z, r);
      lump(x + r * 0.55, y - r * 0.25, z + r * 0.35, r * 0.7);
    }
    lump(0.8, 8.0, -0.4, 1.3);
    out.broadleaf = t.build();
  }
  // ---- palm
  {
    const t = collect();
    const segs = 18;
    for (let i = 0; i < segs; i++) {
      const y0 = (i / segs) * 7.6, bend = 0.06 * (i / 2) * (i / 2) * 0.12;
      const rr = 0.2 - (i / segs) * 0.07 + (i === 0 ? 0.08 : 0) + (i % 2 ? 0.022 : 0); // ringed trunk with root flare
      const seg = new THREE.CylinderGeometry(rr * 0.93, rr + 0.012, 7.6 / segs + 0.04, 10);
      t.push(seg, M4(bend, y0 + 0.21, 0, 1, 1, 1, 0, 0, -0.03 * (i / 2)), (c, x, y, z, vi) => c.setHSL(0.075, 0.42, (i % 2 ? 0.27 : 0.22) + ((vi * 7) % 5) * 0.008), true);
    }
    const top = [0.46, 7.95, 0];
    for (let f = 0; f < 13; f++) {
      const a = (f / 13) * Math.PI * 2;
      const frond = new THREE.BoxGeometry(0.5, 0.05, 3.4, 1, 1, 6);
      const p = frond.attributes.position;
      for (let i = 0; i < p.count; i++) { // taper + droop along the length
        const z = p.getZ(i) / 3.4 + 0.5;
        p.setX(i, p.getX(i) * (1 - z * 0.85));
        p.setY(i, p.getY(i) - z * z * 1.3);
        p.setZ(i, p.getZ(i) + 1.7);
      }
      t.push(frond, M4(top[0], top[1], top[2], 1, 1, 1, -0.28 - (f % 3) * 0.12, a, 0), (c, x, y, z, vi) => c.setHSL(0.27, 0.5, 0.2 + (f % 2) * 0.05 + (vi % 3) * 0.015));
    }
    for (let k = 0; k < 4; k++) t.push(new THREE.IcosahedronGeometry(0.17, 1), M4(top[0] + Math.cos(k * 1.57) * 0.22, 7.8, Math.sin(k * 1.57) * 0.22), (c) => c.setHSL(0.09, 0.5, 0.2), true);
    out.palm = t.build();
  }
  // ---- cypress / ornamental conifer
  {
    const t = collect();
    t.push(new THREE.CylinderGeometry(0.1, 0.2, 1.2, 6), M4(0, 0.6, 0), bark);
    for (let i = 0; i < 5; i++) {
      const r = 1.25 - i * 0.2, h = 2.4;
      t.push(new THREE.ConeGeometry(r, h, 9, 1), M4(0, 1.2 + i * 1.15, 0), (c, x, y, z, vi) => c.setHSL(0.33, 0.5, 0.12 + i * 0.02 + (vi % 4) * 0.008));
    }
    out.cypress = t.build();
  }
  // ---- shrub
  {
    const t = collect();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 6.28;
      t.push(clump(1, 1, 1, i * 5 + 1), M4(Math.cos(a) * 0.5, 0.55, Math.sin(a) * 0.5, 0.75, 0.6, 0.75), (c, x, y, z, vi) => c.setHSL(0.27 + (vi % 5) * 0.006, 0.5, 0.17 + y * 0.12));
    }
    out.shrub = t.build();
  }
  return out;
}

export function makeTreeMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
}

/** place instanced trees: list of {t:'broadleaf'|'palm'|'cypress'|'shrub', x, z, s, ry} */
export function buildTreeInstances(list, geos, mat, group, hooks = {}) {
  const by = {};
  for (const t of list) (by[t.t] ||= []).push(t);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (const k of Object.keys(by)) {
    const arr = by[k];
    const inst = new THREE.InstancedMesh(geos[k], mat, arr.length);
    arr.forEach((t, i) => {
      e.set(0, t.ry || 0, 0); q.setFromEuler(e);
      const sc = t.s || 1;
      m.compose(p.set(t.x, 0, t.z), q, s.set(sc, sc * (0.92 + ((i * 7) % 5) * 0.035), sc));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, c.setHSL(0, 0, 0.82 + ((i * 13) % 10) * 0.02));
      if (hooks.solid && k !== 'shrub') hooks.solid(t.x, t.z, k === 'palm' ? 0.3 : 0.4);
    });
    inst.castShadow = k !== 'shrub';
    inst.receiveShadow = false;
    inst.computeBoundingSphere();
    group.add(inst);
  }
}
