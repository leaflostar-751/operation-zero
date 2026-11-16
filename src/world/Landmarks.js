import * as THREE from 'three';
import * as T from './CityTextures.js';
import { GeoBuilder } from './GeoBuilder.js';
import { makeTreeGeos, makeTreeMaterial } from './Trees.js';

/**
 * Hand-built landmark buildings. Local frame: footprint centred on the origin, front = +Z.
 * Each builder returns { group, solids:[x,y,z,hw,hh,hd,rotY] }.
 */
const HALF_PI = Math.PI / 2;
const mats = {};
const M = (k, f) => (mats[k] ||= f());
const std = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const glass = () => M('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x1b3550, metalness: 0.85, roughness: 0.07, envMapIntensity: 1.5, clearcoat: 0.6 }));
const clone = (t, rx, ry) => {
  const c = t.clone();
  c.needsUpdate = true;
  c.repeat.set(rx, ry);
  return c;
};

function add(g, geo, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.rz) m.rotation.z = opts.rz;
  m.castShadow = opts.cast !== false;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** a facade box with windows tiled per floor/bay (box faces share one texture; top gets roof colour) */
function facadeBox(g, w, h, d, floors, bays, color, x, y, z, solids, tex) {
  const t = tex || T.solidFacadeTexture(color, 6);
  const side = new THREE.MeshStandardMaterial({ map: clone(t, bays, floors), roughness: 0.85 });
  const sideZ = new THREE.MeshStandardMaterial({ map: clone(t, Math.max(1, Math.round(bays * d / w)), floors), roughness: 0.85 });
  const roof = std(0x8a8780, 0.95);
  const m = new THREE.Mesh(BOX(w, h, d), [sideZ, sideZ, roof, roof, side, side]); // +x,-x,+y,-y,+z,-z
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  if (solids) solids.push([x, y + h / 2, z, w / 2, h / 2, d / 2, 0]);
  return m;
}

function signPlate(g, text, w, h, x, y, z, bg, fg, ry = 0, emissive = 0.35) {
  const tex = T.signTexture(text, bg, fg, 512, Math.round(512 * h / w));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive, roughness: 0.6, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  g.add(m);
  return m;
}

function cornice(g, w, d, y, color = 0xd8d4c8, t = 0.5) {
  add(g, BOX(w + 0.8, t, d + 0.8), std(color, 0.9), 0, y, 0);
}

let _treeGeos = null, _treeMat = null;
function treeInst(g, positions, scale = 1, kind = 'broadleaf') {
  _treeGeos ||= makeTreeGeos();
  _treeMat ||= makeTreeMaterial();
  const geo = _treeGeos[kind] || _treeGeos.broadleaf;
  const inst = new THREE.InstancedMesh(geo, _treeMat, positions.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Euler();
  positions.forEach((p, i) => {
    const s = (0.8 + ((i * 37) % 10) / 20) * scale;
    e.set(0, (i * 2.4) % 6.28, 0); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(p[0], 0, p[1]), q, new THREE.Vector3(s, s, s));
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, c.setHSL(0, 0, 0.82 + ((i * 13) % 10) * 0.02));
  });
  inst.castShadow = true;
  g.add(inst);
  return inst;
}

function lampPosts(g, positions) {
  const pole = new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6).translate(0, 2.1, 0);
  const inst = new THREE.InstancedMesh(pole, std(0x303338, 0.5, 0.6), positions.length);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 10, 8).translate(0, 4.3, 0), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffe2a0, emissiveIntensity: 0.9 }), positions.length);
  const m4 = new THREE.Matrix4();
  positions.forEach((p, i) => { m4.makeTranslation(p[0], 0, p[1]); inst.setMatrixAt(i, m4); head.setMatrixAt(i, m4); });
  g.add(inst, head);
}

/* -------------------------------------------------------------------- hospital */
function hospital(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d, floors } = def;
  const fh = 3.6;
  const H = floors * fh;
  facadeBox(g, w, H, d, floors, Math.round(w / 5), '#eef1f4', 0, 0, 0, solids);
  facadeBox(g, 22, 9, d - 4, 2, 4, '#e6eaee', -(w / 2 + 11), 0, 0, solids);
  facadeBox(g, 22, 9, d - 4, 2, 4, '#e6eaee', w / 2 + 11, 0, 0, solids);
  add(g, BOX(w + 0.8, 0.9, d + 0.8), std(0x1f5a9e, 0.7), 0, H + 0.45, 0); // blue roof band
  add(g, BOX(w + 0.8, 0.5, 0.5), std(0xffffff), 0, H + 1.15, d / 2 + 0.2);
  // entrance canopy with columns
  add(g, BOX(16, 0.6, 9), std(0xf3f3f1), 0, 4.8, d / 2 + 4.5);
  for (const x of [-7, -2.3, 2.3, 7]) add(g, new THREE.CylinderGeometry(0.4, 0.4, 4.6, 12), std(0xf3f3f1), x, 2.3, d / 2 + 8.2);
  add(g, BOX(8, 3.6, 0.3), glass(), 0, 1.8, d / 2 + 0.1); // glass doors
  // red cross + rooftop sign
  const cross = std(0xd22b2b, 0.5); cross.emissive = new THREE.Color(0xff2020); cross.emissiveIntensity = 0.4;
  add(g, BOX(5, 1.4, 0.3), cross, w / 2 - 6, H - 3, d / 2 + 0.2);
  add(g, BOX(1.4, 5, 0.3), cross, w / 2 - 6, H - 3, d / 2 + 0.2);
  signPlate(g, def.name.toUpperCase(), Math.min(34, w * 0.6), 4.2, 0, H + 3.2, d / 2 - 0.5, '#1f5a9e', '#ffffff');
  add(g, BOX(0.4, 3, 0.4), std(0x888888), -Math.min(34, w * 0.6) / 2 + 1, H + 1.8, d / 2 - 0.6);
  add(g, BOX(0.4, 3, 0.4), std(0x888888), Math.min(34, w * 0.6) / 2 - 1, H + 1.8, d / 2 - 0.6);
  // ambulance bay yellow stripes
  for (let i = 0; i < 6; i++) add(g, BOX(0.5, 0.02, 7), std(0xf2c230), -w / 2 - 3 + i * 1.5, 0.03, d / 2 + 6, { cast: false });
  // rooftop plant
  add(g, BOX(8, 2.4, 6), std(0xb9b9b4), -w / 4, H + 1.2, -2);
  return { group: g, solids };
}

/* -------------------------------------------------------------------- hotel */
function hotel(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d, floors } = def;
  const fh = 3.1;
  const tex = T.curtainTexture('#7aa0c0', '#1d2c3a');
  const podW = w + 26, podD = d + 14;
  // podium
  const pod = new THREE.Mesh(BOX(podW, 9, podD), [
    new THREE.MeshStandardMaterial({ map: clone(tex, 8, 3), roughness: 0.15, metalness: 0.7 }),
    new THREE.MeshStandardMaterial({ map: clone(tex, 8, 3), roughness: 0.15, metalness: 0.7 }),
    std(0x7f7c74, 0.9), std(0x7f7c74, 0.9),
    new THREE.MeshStandardMaterial({ map: clone(tex, 10, 3), roughness: 0.15, metalness: 0.7 }),
    new THREE.MeshStandardMaterial({ map: clone(tex, 10, 3), roughness: 0.15, metalness: 0.7 })
  ]);
  pod.position.set(0, 4.5, 0);
  pod.castShadow = pod.receiveShadow = true;
  g.add(pod);
  solids.push([0, 4.5, 0, podW / 2, 4.5, podD / 2, 0]);
  // tower
  const tmat = (rx) => new THREE.MeshStandardMaterial({ map: clone(tex, rx, floors), roughness: 0.12, metalness: 0.75, envMapIntensity: 1.5 });
  const tower = new THREE.Mesh(BOX(w, floors * fh, d), [tmat(8), tmat(8), std(0x77746d, 0.9), std(0x77746d, 0.9), tmat(8), tmat(8)]);
  tower.position.set(0, 9 + (floors * fh) / 2, -2);
  tower.castShadow = tower.receiveShadow = true;
  g.add(tower);
  solids.push([0, 9 + (floors * fh) / 2, -2, w / 2, (floors * fh) / 2, d / 2, 0]);
  // vertical fins on the tower
  const fin = std(0xcfd3d6, 0.5, 0.4);
  for (let i = -3; i <= 3; i++) add(g, BOX(0.4, floors * fh, 0.9), fin, i * (w / 7), 9 + (floors * fh) / 2, d / 2 - 1.55);
  // crown
  const top = 9 + floors * fh;
  add(g, BOX(w * 0.7, 3, d * 0.7), std(0xcfd3d6, 0.5, 0.4), 0, top + 1.5, -2);
  add(g, new THREE.CylinderGeometry(0.15, 0.2, 12, 8), std(0xb0b0b0, 0.4, 0.8), 0, top + 9, -2);
  const lamp = new THREE.PointLight(0xff3030, 0.0);
  g.add(lamp);
  signPlate(g, 'MERIDIEN HOTEL', 18, 2.4, 0, top + 4.2, d / 2 - 2.5, '#1a1d24', '#e4c15a');
  // canopy and doors
  add(g, BOX(20, 0.6, 10), std(0x1a1d24, 0.5, 0.5), 0, 6.5, podD / 2 + 5);
  for (const x of [-9, 9]) add(g, new THREE.CylinderGeometry(0.35, 0.35, 6.3, 12), std(0xd6c186, 0.4, 0.7), x, 3.2, podD / 2 + 9.5);
  add(g, BOX(10, 4.5, 0.3), glass(), 0, 2.3, podD / 2 + 0.2);
  // rooftop terrace on the podium
  add(g, BOX(podW - 2, 0.3, 4), std(0x6a665e), 0, 9.15, podD / 2 - 3);
  return { group: g, solids };
}

/* -------------------------------------------------------------------- university */
function university(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d } = def;
  const wall = '#e9dcc0';
  // main building along the back
  const mb = { w: w, d: 16, h: 13 };
  facadeBox(g, mb.w, mb.h, mb.d, 3, Math.round(mb.w / 6), wall, 0, 0, -d / 2 + 9, solids);
  // side wings
  for (const s of [-1, 1]) facadeBox(g, 16, 10, d - 20, 2, 5, wall, s * (w / 2 - 8), 0, -2, solids);
  // arcade columns along the main block front
  const colMat = std(0xf2ece0, 0.8);
  const frontZ = -d / 2 + 9 + mb.d / 2 + 2.2;
  for (let i = -8; i <= 8; i++) {
    add(g, new THREE.CylinderGeometry(0.4, 0.45, 6, 10), colMat, i * (w / 18), 3, frontZ);
    add(g, new THREE.CylinderGeometry(0.62, 0.5, 0.5, 10), colMat, i * (w / 18), 6.2, frontZ);
  }
  add(g, BOX(w - 2, 0.9, 3.6), colMat, 0, 6.8, frontZ - 0.8);
  add(g, BOX(w - 2, 0.3, 3.8), std(0x2c6a5a, 0.6), 0, 7.4, frontZ - 0.8);
  // clock tower
  facadeBox(g, 6, 24, 6, 6, 1, '#efe2c4', 0, 0, -d / 2 + 4, solids);
  add(g, new THREE.ConeGeometry(4.6, 5, 4), std(0x2c6a5a, 0.6), 0, 26.5, -d / 2 + 4, { ry: Math.PI / 4 });
  const clk = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#f6f1e2'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.strokeStyle = '#222'; x.lineWidth = 4; x.stroke(); x.lineWidth = 5; x.beginPath(); x.moveTo(64, 64); x.lineTo(64, 24); x.moveTo(64, 64); x.lineTo(92, 74); x.stroke(); return c; })());
  const clkMat = new THREE.MeshBasicMaterial({ map: clk });
  for (const [x, z, ry] of [[0, -d / 2 + 4 + 3.05, 0], [0, -d / 2 + 4 - 3.05, Math.PI]]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(2, 24), clkMat); p.position.set(x, 20, z); p.rotation.y = ry; g.add(p);
  }
  // lawn, paths and fountain
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(w - 40, d - 30), new THREE.MeshStandardMaterial({ map: clone(T.grassTexture('#5f7a3b'), 20, 12), roughness: 1 }));
  lawn.rotation.x = -HALF_PI; lawn.position.set(0, 0.03, 8); lawn.receiveShadow = true; g.add(lawn);
  add(g, BOX(4, 0.05, d - 24), std(0xcfc9b9), 0, 0.06, 4, { cast: false });
  add(g, BOX(w - 40, 0.05, 3), std(0xcfc9b9), 0, 0.06, 6, { cast: false });
  add(g, new THREE.CylinderGeometry(3.4, 3.6, 0.7, 24), std(0xd5d1c6, 0.6), 0, 0.35, 6);
  add(g, new THREE.CylinderGeometry(2.9, 2.9, 0.5, 24), new THREE.MeshStandardMaterial({ color: 0x2c7a8c, roughness: 0.05 }), 0, 0.55, 6, { cast: false });
  add(g, new THREE.CylinderGeometry(0.3, 0.5, 2.2, 10), std(0xd5d1c6, 0.6), 0, 1.4, 6);
  const trees = []; for (let i = 0; i < 18; i++) trees.push([-w / 2 + 22 + (i % 6) * ((w - 44) / 5), d / 2 - 6 - Math.floor(i / 6) * 4]);
  treeInst(g, trees);
  // gate + boundary
  const gz = d / 2 - 0.5;
  for (const x of [-7, 7]) { add(g, BOX(2.4, 6, 2.4), std(0xe8dcc3), x, 3, gz); solids.push([x, 3, gz, 1.2, 3, 1.2, 0]); add(g, new THREE.ConeGeometry(1.8, 1.6, 4), std(0x2c6a5a), x, 6.8, gz, { ry: Math.PI / 4 }); }
  add(g, BOX(16, 1.2, 1.6), std(0xe8dcc3), 0, 6.4, gz);
  signPlate(g, 'VIRTUAL UNIVERSITY OF PAKISTAN', 14.5, 1.1, 0, 6.4, gz + 0.85, '#2c6a5a', '#ffffff');
  for (const s of [-1, 1]) { add(g, BOX(w / 2 - 8.5, 1.8, 0.6), std(0xd8ccb0), s * (w / 4 + 3.6), 0.9, gz); }
  return { group: g, solids };
}

/* -------------------------------------------------------------------- park */
function park(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d } = def;
  const butterfly = def.id === 'butterfly-park';
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: clone(T.grassTexture(butterfly ? '#659141' : '#5f7a3b'), w / 6, d / 6), roughness: 1 }));
  lawn.rotation.x = -HALF_PI; lawn.position.y = 0.03; lawn.receiveShadow = true; g.add(lawn);
  const path = std(0xcfc8b6, 0.95);
  const loop = (rx, rz, th = 3) => { // oval path
    const pts = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push([Math.cos(a) * rx, Math.sin(a) * rz]); }
    for (let i = 0; i < 48; i++) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m = add(g, BOX(L + 0.3, 0.05, th), path, (a[0] + b[0]) / 2, 0.06, (a[1] + b[1]) / 2, { ry: -Math.atan2(b[1] - a[1], b[0] - a[0]), cast: false });
    }
  };
  loop(w / 2 - 12, d / 2 - 10);
  add(g, BOX(w - 8, 0.05, 3), path, 0, 0.06, 0, { cast: false });
  add(g, BOX(3, 0.05, d - 8), path, 0, 0.06, 0, { cast: false });
  // pond
  const pond = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, d) * 0.14, 32), new THREE.MeshStandardMaterial({ color: 0x2c7a8c, roughness: 0.05, metalness: 0.1 }));
  pond.rotation.x = -HALF_PI; pond.position.set(w * 0.2, 0.07, -d * 0.12); g.add(pond);
  add(g, new THREE.TorusGeometry(Math.min(w, d) * 0.14, 0.35, 8, 40), std(0xb7b1a2), w * 0.2, 0.15, -d * 0.12, { rx: HALF_PI, cast: false });
  solids.push([w * 0.2, 0.4, -d * 0.12, Math.min(w, d) * 0.14, 0.4, Math.min(w, d) * 0.14, 0]);
  // trees (deterministic scatter)
  const trees = [];
  for (let i = 0; i < 70; i++) {
    const a = i * 2.399, r = 0.15 + ((i * 53) % 100) / 100 * 0.85;
    const x = Math.cos(a) * (w / 2 - 5) * r, z = Math.sin(a) * (d / 2 - 5) * r;
    if (Math.abs(x) < 3 || Math.abs(z) < 3) continue;
    if (Math.hypot((x - w * 0.2) / (Math.min(w, d) * 0.17), (z + d * 0.12) / (Math.min(w, d) * 0.17)) < 1) continue;
    trees.push([x, z]);
  }
  treeInst(g, trees);
  // gazebo
  const gz = [-w * 0.22, d * 0.14];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(g, new THREE.CylinderGeometry(0.18, 0.18, 3.2, 8), std(0xf0ece0), gz[0] + Math.cos(a) * 3, 1.6, gz[1] + Math.sin(a) * 3); }
  add(g, new THREE.ConeGeometry(4.3, 2, 6), std(butterfly ? 0xc2331f : 0x2c6a5a), gz[0], 4.2, gz[1]);
  add(g, new THREE.CylinderGeometry(3.3, 3.3, 0.3, 6), std(0xcfc8b6), gz[0], 0.15, gz[1]);
  solids.push([gz[0], 1.6, gz[1], 0.4, 1.6, 0.4, 0]);
  // benches and lamps
  const lamps = []; for (let i = -4; i <= 4; i++) { lamps.push([i * (w / 10), 2.4]); lamps.push([i * (w / 10), -2.4]); }
  lampPosts(g, lamps);
  const benchGeo = BOX(1.8, 0.45, 0.5);
  const bi = new THREE.InstancedMesh(benchGeo, std(0x6b4a2c, 0.8), 16);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 16; i++) { m4.makeTranslation(-w / 2 + 14 + i * ((w - 28) / 15), 0.3, (i % 2 ? 1 : -1) * 4.2); bi.setMatrixAt(i, m4); }
  g.add(bi);
  if (butterfly) { // flower beds and a butterfly sculpture
    const cols = [0xe84a8a, 0xf2c230, 0xff7b2e, 0xa04fd0, 0xffffff];
    for (let i = 0; i < 24; i++) {
      const a = i * 0.9; const x = Math.cos(a) * (w * 0.3), z = Math.sin(a * 1.3) * (d * 0.3);
      add(g, new THREE.CylinderGeometry(1.6, 1.6, 0.35, 12), std(cols[i % 5], 0.9), x, 0.2, z, { cast: false });
    }
    const wingMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.25 });
    for (const s of [-1, 1]) {
      add(g, new THREE.CircleGeometry(3, 20), wingMat(0xff7b2e), s * 3.2, 7, 0, { ry: s * 0.5 }).scale.set(1, 1.3, 1);
      add(g, new THREE.CircleGeometry(2.1, 20), wingMat(0xf2c230), s * 2.6, 3.6, 0, { ry: s * 0.4 });
    }
    add(g, new THREE.CylinderGeometry(0.25, 0.25, 7, 8), std(0x222222), 0, 4.5, 0);
    add(g, new THREE.CylinderGeometry(0.6, 0.8, 1.4, 10), std(0xb7b1a2), 0, 0.7, 0);
    signPlate(g, 'BUTTERFLY PARK', 10, 1.4, 0, 3.2, d / 2 - 0.5, '#2e7d32', '#ffffff');
  } else {
    signPlate(g, 'JINNAH PARK', 9, 1.2, 0, 3.0, d / 2 - 0.5, '#2c6a5a', '#ffffff');
  }
  // entrance pylons + low perimeter wall segments
  for (const x of [-4, 4]) add(g, BOX(1.4, 3.4, 1.4), std(0xcfc8b6), x, 1.7, d / 2 - 0.5);
  add(g, BOX(w, 0.9, 0.35), std(0x9c968a), 0, 0.45, -d / 2);
  add(g, BOX(0.35, 0.9, d), std(0x9c968a), -w / 2, 0.45, 0);
  add(g, BOX(0.35, 0.9, d), std(0x9c968a), w / 2, 0.45, 0);
  for (const s of [-1, 1]) add(g, BOX(w / 2 - 5, 0.9, 0.35), std(0x9c968a), s * (w / 4 + 2.5), 0.45, d / 2);
  solids.push([0, 0.45, -d / 2, w / 2, 0.45, 0.2, 0], [-w / 2, 0.45, 0, 0.2, 0.45, d / 2, 0], [w / 2, 0.45, 0, 0.2, 0.45, d / 2, 0]);
  for (const s of [-1, 1]) solids.push([s * (w / 4 + 2.5), 0.45, d / 2, w / 4 - 2.5, 0.45, 0.2, 0]);
  return { group: g, solids };
}

/* -------------------------------------------------------------------- wedding hall */
function wedding(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d } = def;
  const H = 15;
  const wallTex = T.solidFacadeTexture('#f0e3c4', 8);
  facadeBox(g, w, H, d, 3, 8, '#f0e3c4', 0, 0, -4, solids, wallTex);
  // central entrance arch + dome
  add(g, BOX(18, H + 4, 6), std(0xe9d9aa, 0.6), 0, (H + 4) / 2, d / 2 - 4 + 1.5);
  add(g, BOX(10, 12, 6.2), glass(), 0, 6, d / 2 - 4 + 1.6);
  add(g, new THREE.CylinderGeometry(9, 9.5, 3, 24), std(0xe9d9aa, 0.6), 0, H + 1.5, -4);
  const dome = add(g, new THREE.SphereGeometry(8.6, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd4a82c, 0.3, 0.7), 0, H + 3, -4);
  add(g, new THREE.CylinderGeometry(0.2, 0.3, 5, 8), std(0xd4a82c, 0.3, 0.8), 0, H + 14, -4);
  add(g, new THREE.SphereGeometry(0.6, 12, 10), std(0xd4a82c, 0.3, 0.8), 0, H + 16.6, -4);
  // minarets
  for (const [x, z] of [[-w / 2 + 2, d / 2 - 6], [w / 2 - 2, d / 2 - 6]]) {
    add(g, new THREE.CylinderGeometry(1.1, 1.4, H + 8, 12), std(0xefe1bd, 0.6), x, (H + 8) / 2, z);
    add(g, new THREE.CylinderGeometry(1.7, 1.7, 0.5, 12), std(0xd4a82c, 0.3, 0.7), x, H + 4, z);
    add(g, new THREE.ConeGeometry(1.5, 3.5, 12), std(0xd4a82c, 0.3, 0.7), x, H + 9.7, z);
    solids.push([x, (H + 8) / 2, z, 1.4, (H + 8) / 2, 1.4, 0]);
  }
  // decorative LED strips (emissive)
  const led = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6 });
  const cols = [0xff2d95, 0x3d7bff, 0xffc23d, 0x2dff9b];
  for (let i = 0; i < 4; i++) add(g, BOX(w + 0.4, 0.25, 0.25), led(cols[i]), 0, 2.5 + i * 3.4, d / 2 - 4 + 0.15 + (i % 2 ? 0.02 : 0), { cast: false });
  for (let i = -4; i <= 4; i++) add(g, BOX(0.3, H, 0.3), led(cols[(i + 4) % 4]), i * (w / 9), H / 2, d / 2 - 4 + 0.1, { cast: false });
  signPlate(g, def.name.toUpperCase(), 22, 2.6, 0, H + 1.2, d / 2 + 0.2, '#6d1630', '#ffd86b');
  // parking lot + canopy gate
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(w + 20, 34), new THREE.MeshStandardMaterial({ map: clone(T.asphaltTexture('street'), 6, 3), roughness: 0.95 }));
  lot.rotation.x = -HALF_PI; lot.position.set(0, 0.04, d / 2 + 15); lot.receiveShadow = true; g.add(lot);
  for (let i = -8; i <= 8; i++) add(g, BOX(0.12, 0.02, 5), std(0xe8e8e2), i * 3.4, 0.06, d / 2 + 22, { cast: false });
  lampPosts(g, [[-w / 2 - 6, d / 2 + 8], [w / 2 + 6, d / 2 + 8], [-w / 4, d / 2 + 30], [w / 4, d / 2 + 30], [0, d / 2 + 30]]);
  return { group: g, solids };
}

/* -------------------------------------------------------------------- industrial */
function industrial(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d } = def;
  const conc = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: clone(T.concreteTexture('#8a877c'), w / 8, d / 8), roughness: 1 }));
  conc.rotation.x = -HALF_PI; conc.position.y = 0.03; conc.receiveShadow = true; g.add(conc);
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.55, metalness: 0.5 });
  const roofM = new THREE.MeshStandardMaterial({ color: 0x6d7a85, roughness: 0.5, metalness: 0.55 });
  const shed = (sx, sz, sw, sd, sh, col) => {
    add(g, BOX(sw, sh, sd), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.4 }), sx, sh / 2, sz);
    const shape = new THREE.Shape(); shape.moveTo(-sw / 2, 0); shape.lineTo(sw / 2, 0); shape.lineTo(0, 3.4); shape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: sd, bevelEnabled: false }), roofM);
    roof.position.set(sx, sh, sz - sd / 2); roof.castShadow = true; g.add(roof);
    add(g, BOX(8, 6, 0.3), std(0x2b3a47, 0.5, 0.3), sx, 3, sz + sd / 2 + 0.1); // roller door
    for (let i = 0; i < 6; i++) add(g, BOX(1.6, 0.9, 0.2), glass(), sx - sw / 2 + 5 + i * ((sw - 10) / 5), sh - 1.4, sz + sd / 2 + 0.1);
    solids.push([sx, sh / 2, sz, sw / 2, sh / 2, sd / 2, 0]);
  };
  shed(-w / 2 + 28, -d / 2 + 30, 40, 50, 9, 0x8fa0ae);
  shed(-w / 2 + 28, d / 2 - 28, 40, 44, 8, 0xa8a398);
  shed(w / 2 - 30, -d / 2 + 30, 44, 50, 10, 0x7f93a3);
  shed(w / 2 - 28, d / 2 - 25, 40, 36, 8, 0xb0a99a);
  // chimneys with red/white bands
  for (const [x, z] of [[0, -10], [12, -14]]) {
    for (let i = 0; i < 6; i++) add(g, new THREE.CylinderGeometry(1.8 - i * 0.08, 1.9 - i * 0.08, 6, 14), std(i % 2 ? 0xf2f2f2 : 0xc2331f, 0.7), x, 3 + i * 6, z);
    solids.push([x, 18, z, 2, 18, 2, 0]);
  }
  // tanks
  for (const [x, z] of [[-6, 20], [6, 20], [18, 20]]) { add(g, new THREE.CylinderGeometry(4, 4, 9, 20), metal, x, 4.5, z); add(g, new THREE.SphereGeometry(4, 20, 8, 0, 6.3, 0, 1.57), metal, x, 9, z); solids.push([x, 4.5, z, 4, 4.5, 4, 0]); }
  // containers
  const ccol = [0xb23a2e, 0x2c5fa3, 0x2f7d4f, 0xd09a2a, 0x7a5a3a];
  const ci = new THREE.InstancedMesh(BOX(12, 2.6, 2.45), std(0xffffff, 0.6, 0.3), 36);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < 36; i++) { const row = i % 4, lv = Math.floor(i / 12) % 3, col = Math.floor((i % 12) / 4); m4.makeTranslation(-w / 2 + 20 + col * 13, 1.3 + lv * 2.6, 6 + row * 3.0 + (i >= 12 ? 14 : 0)); ci.setMatrixAt(i, m4); ci.setColorAt(i, c.setHex(ccol[(i * 7) % 5])); }
  ci.castShadow = true; g.add(ci);
  solids.push([-w / 2 + 33, 3.9, 12, 20, 3.9, 6, 0]);
  // perimeter wall with gate
  add(g, BOX(w, 3, 0.4), std(0xb7b1a2), 0, 1.5, -d / 2);
  add(g, BOX(0.4, 3, d), std(0xb7b1a2), -w / 2, 1.5, 0);
  add(g, BOX(0.4, 3, d), std(0xb7b1a2), w / 2, 1.5, 0);
  for (const s of [-1, 1]) add(g, BOX(w / 2 - 6, 3, 0.4), std(0xb7b1a2), s * (w / 4 + 3), 1.5, d / 2);
  solids.push([0, 1.5, -d / 2, w / 2, 1.5, 0.25, 0], [-w / 2, 1.5, 0, 0.25, 1.5, d / 2, 0], [w / 2, 1.5, 0, 0.25, 1.5, d / 2, 0]);
  for (const s of [-1, 1]) solids.push([s * (w / 4 + 3), 1.5, d / 2, w / 4 - 3, 1.5, 0.25, 0]);
  for (const x of [-5.5, 5.5]) add(g, BOX(1.6, 5, 1.6), std(0x6f6a5e), x, 2.5, d / 2);
  signPlate(g, 'MARKAZ-E-SANAT', 12, 1.6, 0, 5.8, d / 2 + 0.2, '#1f3b57', '#ffffff');
  return { group: g, solids };
}

/* -------------------------------------------------------------------- farm */
function farm(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d } = def;
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: clone(T.fieldTexture('plough'), 8, 6), roughness: 1 }));
  yard.rotation.x = -HALF_PI; yard.position.y = 0.03; yard.receiveShadow = true; g.add(yard);
  const barn = (x, z, bw, bd, col) => {
    add(g, BOX(bw, 6, bd), std(col, 0.7), x, 3, z);
    const shape = new THREE.Shape(); shape.moveTo(-bw / 2, 0); shape.lineTo(bw / 2, 0); shape.lineTo(0, 3.2); shape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: bd, bevelEnabled: false }), std(0x6d7b88, 0.5, 0.5));
    roof.position.set(x, 6, z - bd / 2); roof.castShadow = true; g.add(roof);
    add(g, BOX(5, 4.4, 0.3), std(0x4a3524, 0.8), x, 2.2, z + bd / 2 + 0.1);
    solids.push([x, 3, z, bw / 2, 3, bd / 2, 0]);
  };
  barn(-w / 2 + 22, -d / 2 + 18, 30, 22, 0xb5382b);
  barn(-w / 2 + 22, d / 2 - 18, 30, 18, 0xc9bda3);
  barn(w / 2 - 20, -d / 2 + 20, 26, 20, 0xb5382b);
  for (const x of [w / 2 - 10, w / 2 - 20]) { add(g, new THREE.CylinderGeometry(3, 3, 14, 18), std(0xb9c0c6, 0.4, 0.6), x, 7, d / 2 - 14); add(g, new THREE.SphereGeometry(3, 18, 8, 0, 6.3, 0, 1.57), std(0xb9c0c6, 0.4, 0.6), x, 14, d / 2 - 14); solids.push([x, 7, d / 2 - 14, 3, 7, 3, 0]); }
  const hay = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.1, 1.4, 14).rotateZ(HALF_PI), std(0xc8b360, 1), 14);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 14; i++) { m4.makeTranslation(-4 + (i % 5) * 2.4, 1.1 + Math.floor(i / 10) * 2, 6 + Math.floor(i / 5) * 2.2); hay.setMatrixAt(i, m4); }
  g.add(hay);
  // fence
  for (let i = 0; i <= 24; i++) { const x = -w / 2 + (i * w) / 24; add(g, BOX(0.15, 1.3, 0.15), std(0x6b4a2c), x, 0.65, d / 2); }
  add(g, BOX(w, 0.1, 0.1), std(0x6b4a2c), 0, 1.1, d / 2); add(g, BOX(w, 0.1, 0.1), std(0x6b4a2c), 0, 0.6, d / 2);
  signPlate(g, 'SOLO DAIRY FARM', 9, 1.3, 0, 3.2, d / 2 - 0.2, '#f5f1e6', '#1f5a2f');
  return { group: g, solids };
}

/* -------------------------------------------------------------------- gate */
function gate(def) {
  const g = new THREE.Group(), solids = [];
  const span = def.span || 20;
  for (const s of [-1, 1]) {
    add(g, BOX(3.2, 10, 3.2), std(0xcfc3a4, 0.7), s * (span / 2 + 1.6), 5, 0);
    add(g, BOX(3.8, 0.6, 3.8), std(0x8a7d5c, 0.7), s * (span / 2 + 1.6), 10.3, 0);
    solids.push([s * (span / 2 + 1.6), 5, 0, 1.6, 5, 1.6, 0]);
  }
  add(g, BOX(span + 6.4, 2.6, 2.4), std(0xcfc3a4, 0.7), 0, 9, 0);
  add(g, BOX(span + 7, 0.5, 2.9), std(0x8a7d5c, 0.7), 0, 10.55, 0);
  for (const z of [1.3, -1.3]) signPlate(g, 'MASTER CITY', span - 2, 2.0, 0, 9, z, '#14202f', '#e4c15a', z < 0 ? Math.PI : 0);
  return { group: g, solids };
}

/* -------------------------------------------------------------------- shop / restaurant */
function shop(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d, floors } = def;
  const h = floors * 3.6;
  const col = def.color || '#c2331f';
  facadeBox(g, w, h, d, floors, Math.max(2, Math.round(w / 4)), '#efe7d6', 0, 0, 0, solids);
  add(g, BOX(w + 0.4, 0.4, d + 0.4), std(0xcfc7b8), 0, h + 0.2, 0);
  // shop front: glass + door + awning + sign
  add(g, BOX(w - 1.2, 3.0, 0.25), new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffd88a, emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.2 }), 0, 1.7, d / 2 + 0.08);
  add(g, BOX(1.2, 2.5, 0.3), std(0x2b2b2b, 0.5), w / 2 - 1.8, 1.25, d / 2 + 0.16);
  const awn = add(g, BOX(w + 0.6, 0.15, 2.0), std(new THREE.Color(col).getHex(), 0.8), 0, 3.5, d / 2 + 1.0, { rx: 0.25 });
  for (let i = 0; i < Math.floor(w / 1.2); i++) add(g, BOX(0.6, 0.17, 2.02), std(0xf4f1e8, 0.8), -w / 2 + 0.6 + i * 1.2, 3.5, d / 2 + 1.0, { rx: 0.25, cast: false });
  signPlate(g, def.name.toUpperCase(), w - 1, 1.3, 0, 4.7, d / 2 + 0.2, col, '#ffffff');
  // rooftop terrace (restaurant)
  if (/rooftop/i.test(def.name) || def.id === 'pind') {
    add(g, BOX(w - 1, 1.0, 0.2), std(0x6b4a2c), 0, h + 0.9, d / 2 - 0.5);
    for (let i = 0; i < 8; i++) add(g, new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffe2a0, emissiveIntensity: 1.2 }), -w / 2 + 1 + i * ((w - 2) / 7), h + 2.6, d / 2 - 0.5, { cast: false });
    for (const x of [-3, 0, 3]) { add(g, new THREE.CylinderGeometry(0.7, 0.7, 0.08, 12), std(0xf0ece0), x, h + 1.4, 0); add(g, new THREE.CylinderGeometry(0.05, 0.05, 1, 6), std(0x444444), x, h + 0.9, 0); }
  }
  return { group: g, solids };
}


/* -------------------------------------------------------------------- shared material set for GeoBuilder landmarks */
const LMATS = () => M('lm', () => ({
  cream: new THREE.MeshStandardMaterial({ color: 0xe9e1cd, roughness: 0.88 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.7 }),
  stone: new THREE.MeshStandardMaterial({ map: T.concreteTexture('#b6ae9c'), roughness: 0.95 }),
  dome: new THREE.MeshStandardMaterial({ color: 0x2f7a57, roughness: 0.4, metalness: 0.55 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9b24a, roughness: 0.3, metalness: 0.85 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.5, metalness: 0.2 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x20384f, metalness: 0.8, roughness: 0.08, clearcoat: 0.6 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc2331f, roughness: 0.6 }),
  grass: new THREE.MeshStandardMaterial({ map: T.grassTexture('#5f7a3b'), roughness: 1 }),
  asphalt: new THREE.MeshStandardMaterial({ map: T.asphaltTexture('street'), roughness: 0.92 }),
  brick: new THREE.MeshStandardMaterial({ color: 0xa6563a, roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.5, metalness: 0.6 })
}));

function groundPlane(g, mat, w, d, y = 0.04, tile = 6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.material = mat.clone();
  if (mat.map) { m.material.map = mat.map.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(w / tile, d / tile); }
  m.rotation.x = -HALF_PI; m.position.y = y; m.receiveShadow = true;
  g.add(m);
  return m;
}

/* -------------------------------------------------------------------- mosque */
function mosque(def) {
  const g = new THREE.Group(), solids = [];
  const b = new GeoBuilder();
  const { w, d } = def;
  groundPlane(g, LMATS().stone, w, d, 0.04, 5);
  const hw = 14, hd = 12, hh = 8; // prayer hall
  b.box('cream', hw, hh, hd, 0, 0, -d / 2 + hd / 2 + 2);
  const cz = -d / 2 + hd / 2 + 2;
  b.box('white', hw + 0.6, 0.5, hd + 0.6, 0, hh, cz);
  // arcade across the front (columns + arches as slabs)
  for (let i = -3; i <= 3; i++) b.cyl('white', 0.28, 0.28, 4.2, i * 2.0, 0, cz + hd / 2 + 2.2, 10);
  b.box('white', 14.5, 0.5, 3.2, 0, 4.2, cz + hd / 2 + 1.7);
  b.box('dark', 11, 3.6, 0.2, 0, 0, cz + hd / 2 + 0.05);
  for (const x of [-5.2, 5.2]) b.box('glass', 1.4, 3.2, 0.2, x, 2.2, cz + hd / 2 + 0.06);
  // main dome on a drum
  b.cyl('white', 4.2, 4.4, 1.8, 0, hh + 0.5, cz, 20);
  b.sphere('dome', 4.4, 0, hh + 2.3, cz, 1, 0.95, 1, null, 24);
  b.cyl('gold', 0.14, 0.2, 2.2, 0, hh + 6.1, cz, 8);
  b.sphere('gold', 0.4, 0, hh + 8.3, cz, 1, 1, 1, null, 10);
  // four small corner domes
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.cyl('white', 1.3, 1.4, 0.9, sx * 5.6, hh + 0.5, cz + sz * 4.4, 12);
    b.sphere('dome', 1.35, sx * 5.6, hh + 1.4, cz + sz * 4.4, 1, 1, 1, null, 14);
  }
  // two minarets: square base, shafts, balcony, cap
  for (const sx of [-1, 1]) {
    const mx = sx * (hw / 2 + 2.5), mz = cz + hd / 2 - 1;
    b.box('white', 2.2, 5, 2.2, mx, 0, mz);
    b.cyl('cream', 0.85, 1.0, 12, mx, 5, mz, 14);
    b.cyl('white', 1.45, 1.45, 0.5, mx, 15.5, mz, 16);
    b.cyl('cream', 0.7, 0.8, 4, mx, 17, mz, 14);
    b.cyl('dome', 0.1, 1.0, 2.6, mx, 21, mz, 12);
    b.cyl('gold', 0.05, 0.08, 1.4, mx, 23.4, mz, 6);
    solids.push([mx, 11, mz, 1.1, 11, 1.1, 0]);
  }
  solids.push([0, hh / 2, cz, hw / 2, hh / 2, hd / 2, 0]);
  // courtyard wall with gate
  const wz = d / 2 - 0.1;
  for (const s of [-1, 1]) {
    b.box('stone', w / 2 - 3, 2.2, 0.4, s * (w / 4 + 1.5), 0, wz);
    solids.push([s * (w / 4 + 1.5), 1.1, wz, w / 4 - 1.5, 1.1, 0.2, 0]);
    b.box('stone', 0.4, 2.2, d, s * w / 2, 0, 0);
    solids.push([s * w / 2, 1.1, 0, 0.2, 1.1, d / 2, 0]);
  }
  b.box('stone', w, 2.2, 0.4, 0, 0, -d / 2); solids.push([0, 1.1, -d / 2, w / 2, 1.1, 0.2, 0]);
  for (const x of [-3, 3]) { b.box('white', 1.2, 4.2, 1.2, x, 0, wz); b.sphere('dome', 0.7, x, 4.4, wz, 1, 1, 1, null, 10); }
  b.box('gold', 6, 0.5, 0.3, 0, 4.0, wz);
  g.add(b.finish(LMATS()));
  // ablution pool in the courtyard
  const pool = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 3), new THREE.MeshStandardMaterial({ color: 0x3b8fa0, roughness: 0.1, metalness: 0.1 }));
  pool.position.set(0, 0.1, d / 2 - 7); g.add(pool);
  treeInst(g, [[-w / 2 + 3, d / 2 - 4], [w / 2 - 3, d / 2 - 4], [-w / 2 + 3, -2], [w / 2 - 3, -2]], 0.8, 'cypress');
  signPlate(g, def.name.toUpperCase(), 5, 0.9, 0, 3.5, wz + 0.3, '#14532d', '#f4e7b0');
  return { group: g, solids };
}

/* -------------------------------------------------------------------- school */
function school(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d } = def;
  const b = new GeoBuilder();
  groundPlane(g, LMATS().stone, w, d, 0.04, 5);
  const bh = def.floors * 3.6;
  // U-shaped block around a quad: back wing + two side wings
  const wing = (bw, bd, x, z) => {
    facadeBox(g, bw, bh, bd, def.floors, Math.max(2, Math.round(bw / 4.5)), '#e9dfc4', x, 0, z, solids);
    b.box('red', bw + 0.6, 0.5, bd + 0.6, x, bh, z);
  };
  wing(w - 2, 10, 0, -d / 2 + 6);
  wing(10, d - 12, -w / 2 + 6, 0);
  wing(10, d - 12, w / 2 - 6, 0);
  // assembly quad: basketball court + flagpole
  b.box('dark', 0.15, 10, 0.15, 0, 0.04, 2); // flagpole
  b.box('white', 2.2, 1.3, 0.05, 1.2, 8.4, 2);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ color: 0x3a6d9a, roughness: 0.8 }));
  court.rotation.x = -HALF_PI; court.position.set(0, 0.07, 6); g.add(court);
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  lines.rotation.x = -HALF_PI; lines.position.set(0, 0.08, 6); g.add(lines);
  for (const sx of [-1, 1]) { b.box('dark', 0.1, 3.2, 0.1, sx * 7.2, 0.04, 6); b.box('white', 0.1, 1.0, 1.4, sx * 7.2, 3.0, 6); }
  // boundary wall (front opening for the gate)
  const wz = d / 2;
  for (const s of [-1, 1]) {
    b.box('brick', w / 2 - 3, 2.4, 0.4, s * (w / 4 + 1.5), 0, wz); solids.push([s * (w / 4 + 1.5), 1.2, wz, w / 4 - 1.5, 1.2, 0.2, 0]);
    b.box('brick', 0.4, 2.4, d, s * w / 2, 0, 0); solids.push([s * w / 2, 1.2, 0, 0.2, 1.2, d / 2, 0]);
  }
  b.box('brick', w, 2.4, 0.4, 0, 0, -d / 2); solids.push([0, 1.2, -d / 2, w / 2, 1.2, 0.2, 0]);
  for (const x of [-3.2, 3.2]) b.box('white', 1.0, 3.6, 1.0, x, 0, wz);
  g.add(b.finish(LMATS()));
  signPlate(g, def.name.toUpperCase(), 8, 1.0, 0, 3.4, wz + 0.1, '#1e3a8a', '#ffffff');
  treeInst(g, [[-w / 2 + 3, d / 2 - 3], [w / 2 - 3, d / 2 - 3], [-6, 10], [6, 10], [-w / 2 + 3, 0], [w / 2 - 3, 0]], 0.9);
  return { group: g, solids };
}

/* -------------------------------------------------------------------- petrol station */
function petrol(def) {
  const g = new THREE.Group(), solids = [];
  const { w, d } = def;
  const b = new GeoBuilder();
  groundPlane(g, LMATS().asphalt, w, d, 0.04, 8);
  // canopy on 4 columns, 2 pump islands, little shop
  b.box('white', 18, 0.7, 11, 0, 5.2, 2);
  b.box('red', 18.2, 0.35, 11.2, 0, 5.0, 2);
  b.box('red', 18.2, 0.5, 0.2, 0, 5.5, 7.6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.cyl('white', 0.3, 0.3, 5.2, sx * 7, 0, 2 + sz * 4, 10); solids.push([sx * 7, 2.6, 2 + sz * 4, 0.3, 2.6, 0.3, 0]); }
  for (const x of [-3.5, 3.5]) {
    b.box('stone', 1.1, 0.25, 6.5, x, 0.04, 2);
    for (const z of [0, 4]) { b.box('red', 0.7, 1.7, 0.5, x, 0.28, z); b.box('dark', 0.55, 0.45, 0.04, x, 1.2, z + 0.26); solids.push([x, 0.9, z, 0.4, 0.9, 0.3, 0]); }
  }
  facadeBox(g, 12, 4.2, 6, 1, 4, '#efe7d6', 0, 0, -d / 2 + 4, solids);
  b.box('red', 12.6, 0.5, 6.6, 0, 4.2, -d / 2 + 4);
  b.box('glass', 9, 2.6, 0.15, 0, 0.5, -d / 2 + 7.05);
  // price pylon
  b.box('dark', 0.5, 7, 0.5, -w / 2 + 1.5, 0, d / 2 - 1); b.box('red', 2.2, 1.8, 0.4, -w / 2 + 1.5, 7, d / 2 - 1);
  solids.push([-w / 2 + 1.5, 3.5, d / 2 - 1, 0.3, 3.5, 0.3, 0]);
  g.add(b.finish(LMATS()));
  signPlate(g, def.name.toUpperCase(), 7, 1.2, 0, 4.6, -d / 2 + 7.2, '#c2331f', '#ffffff');
  return { group: g, solids };
}

const BUILDERS = { hospital, hotel, university, park, wedding, industrial, farm, gate, shop, mosque, school, petrol };
export function buildLandmark(def) {
  const f = BUILDERS[def.kind];
  return f ? f(def) : null;
}
