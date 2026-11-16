import * as THREE from 'three';

/**
 * Collects primitives per material key, applies a local transform, and returns ONE merged
 * mesh per material -> a whole factory / villa compound costs ~6 draw calls.
 *   const b = new GeoBuilder(); b.box('wall', w,h,d, x,y,z, yaw); ... const group = b.finish(MATS);
 * Local frame: front = +Z.  Optional uv scale keeps textures at real-world size (metres per tile).
 */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();

function toIndexed(g) {
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(idx);
  }
  return g;
}

export class GeoBuilder {
  constructor() {
    this.buckets = new Map();
    this.base = new THREE.Matrix4(); // applied to everything (placement of the whole builder)
  }
  /** every following primitive is positioned in the frame (x, z, yaw) */
  place(x = 0, z = 0, ry = 0) {
    _e.set(0, ry, 0);
    _q.setFromEuler(_e);
    this.base.compose(_p.set(x, 0, z), _q, _s.set(1, 1, 1));
    _s.set(1, 1, 1);
    return this;
  }
  /** flat metric-UV plane lying on the ground */
  plane(key, w, d, x, y, z, ry = 0, color = null, tile = 1) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
    return this.add(key, g, x, y, z, ry, 0, 0, color);
  }
  add(key, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, color = null, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    _m.premultiply(this.base);
    const g = geo.clone();
    g.applyMatrix4(_m);
    if (color != null) {
      const c = new THREE.Color(color);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(g);
    return this;
  }
  box(key, w, h, d, x, y, z, ry = 0, color = null) {
    // metric UVs so facades / cladding textures keep a constant world scale
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv, nrm = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
      const u = uv.getX(i), v = uv.getY(i);
      if (nx > 0.5) uv.setXY(i, u * d, v * h);
      else if (ny > 0.5) uv.setXY(i, u * w, v * d);
      else uv.setXY(i, u * w, v * h);
    }
    return this.add(key, g, x, y + h / 2, z, ry, 0, 0, color);
  }
  cyl(key, rt, rb, h, x, y, z, seg = 14, color = null, ry = 0, rx = 0, rz = 0) {
    return this.add(key, new THREE.CylinderGeometry(rt, rb, h, seg), x, y + h / 2, z, ry, rx, rz, color);
  }
  sphere(key, r, x, y, z, sx = 1, sy = 1, sz = 1, color = null, seg = 16) {
    return this.add(key, new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), x, y, z, 0, 0, 0, color, sx, sy, sz);
  }
  /** triangular-prism roof along local Z: span w, rise rise, length d, resting on y */
  gable(key, w, rise, d, x, y, z, ry = 0, eave = 0.5, color = null) {
    const hw = w / 2 + eave;
    const sh = new THREE.Shape();
    sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, rise); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: d + eave * 2, bevelEnabled: false });
    g.translate(0, 0, -(d + eave * 2) / 2);
    return this.add(key, g, x, y, z, ry, 0, 0, color);
  }
  /** sawtooth roof (classic textile mill): n teeth across width w */
  sawtooth(key, w, d, n, rise, x, y, z, ry = 0, color = null) {
    const sh = new THREE.Shape();
    const tw = w / n;
    sh.moveTo(-w / 2, 0);
    for (let i = 0; i < n; i++) { sh.lineTo(-w / 2 + i * tw, rise); sh.lineTo(-w / 2 + (i + 1) * tw, 0); }
    sh.lineTo(w / 2, 0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return this.add(key, g, x, y, z, ry, 0, 0, color);
  }
  finish(MATS) {
    const grp = new THREE.Group();
    for (const [key, list] of this.buckets) {
      const P = [], N = [], U = [], C = [], I = [];
      let off = 0, anyColor = false;
      for (const g0 of list) {
        const g = toIndexed(g0);
        const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, c = g.attributes.color;
        if (c) anyColor = true;
        for (let i = 0; i < p.count; i++) {
          P.push(p.getX(i), p.getY(i), p.getZ(i));
          N.push(n.getX(i), n.getY(i), n.getZ(i));
          U.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
          if (c) C.push(c.getX(i), c.getY(i), c.getZ(i)); else C.push(1, 1, 1);
        }
        for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + off);
        off += p.count;
        g0.dispose();
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      if (anyColor) out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      out.setIndex(I);
      const mesh = new THREE.Mesh(out, MATS[key]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      grp.add(mesh);
    }
    this.buckets.clear();
    return grp;
  }
}
