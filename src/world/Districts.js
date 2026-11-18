import * as THREE from 'three';
import { GeoBuilder } from './GeoBuilder.js';
import * as T from './CityTextures.js';
import { px, MAP_BOUNDS } from './CityData.js';

/**
 * Procedural districts laid out on real-world block geometry:
 *   colony  : lanes (galiyan) 6 m wide every 38 m, cross lanes every ~54 m, two rows of attached houses
 *             back-to-back between lanes, 3 m front yards with boundary wall + gate + neem tree,
 *             every 4th lane is a bazaar lane of shopfronts.
 *   villa   : high-society gated plots 30 x 34 m, 8 m boulevards, 3 villa designs with portico / balcony /
 *             garage / roof slab, lawn, driveway, palms and cypress.
 *   factory : walled compounds 62 x 50 m (textile mill, steel, cement silos, warehouse, cold store, workshops,
 *             power yard) with guard hut + gate, trucks, tanks, chimneys, pipe racks.
 *   village : a few farmhouses and trees.
 * All meshes are merged / instanced, all solids are streamed through City.addSolid.
 */
const HALF_PI = Math.PI / 2;

export function generateDistricts(city, ctx) {
  const { rng, pick, ZONES, nearestOnLine, lmRects, spawn } = ctx;
  const r = rng(77123);
  const houses = [];
  const lanes = []; // {x0,z0,x1,z1}
  const walls = []; // {x,z,len,h,th,col}
  const gates = []; // {x,z,w,col}
  const trees = city.treeList;
  const extra = city.extraAabbs;

  const rej = (city.debugRej = { bounds: 0, spawn: 0, road: 0, canal: 0, minor: 0, lm: 0 });
  const free = (x, z, m = 1.5) => {
    if (x > MAP_BOUNDS.maxX || x < MAP_BOUNDS.minX || z < MAP_BOUNDS.minZ || z > MAP_BOUNDS.maxZ) { rej.bounds++; return false; }
    if (x > spawn.x0 && x < spawn.x1 && z > spawn.z0 && z < spawn.z1) { rej.spawn++; return false; }
    if (city.roadClearance(x, z).c < m) { rej.road++; return false; }
    if (city.canalClearance(x, z) < 6 + m) { rej.canal++; return false; }
    for (const mc of city.minor) if (nearestOnLine(mc.sp, x, z).d < mc.w / 2 + 6 + m) { rej.minor++; return false; }
    for (const l of lmRects) if (x > l.x0 && x < l.x1 && z > l.z0 && z < l.z1) { rej.lm++; return false; }
    return true;
  };
  const freeRect = (x0, z0, x1, z1, m = 1.5) =>
    free(x0, z0, m) && free(x1, z0, m) && free(x0, z1, m) && free(x1, z1, m) && free((x0 + x1) / 2, (z0 + z1) / 2, m);

  const palettes = [0xf2ead8, 0xe8d9a8, 0xd9e4ee, 0xefd2c8, 0xe6c3b8, 0xd8dccb, 0xf6f4ee, 0xcbb9a4, 0xb9c7d6, 0xe3a994, 0xd7c6a0];
  const signCols = [0xd9542b, 0x1c6fb0, 0x2e8b57, 0xc2331f, 0x6a3d8f, 0xe1a62f, 0x0e7c86, 0x8a1c3b];

  const laneSeg = (x0, z0, x1, z1, keepFn, lw = 6) => {
    // cut into 4 m pieces so lanes stop at main roads / canals / landmarks
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 4));
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      const ax = x0 + (x1 - x0) * a, az = z0 + (z1 - z0) * a, bx = x0 + (x1 - x0) * b, bz = z0 + (z1 - z0) * b;
      const cx = (ax + bx) / 2, cz = (az + bz) / 2;
      if (!keepFn(cx, cz)) continue;
      lanes.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz), w: lw });
    }
  };

  /* ============================================================ colony */
  // roads of the real map that already run (nearly) straight through a zone act as its lanes
  const fixedRoads = (gx0, gz0, gx1, gz1, horizontal) => {
    const out = [];
    for (const rd of city.roads) {
      if (rd.type === 'highway') continue;
      const pts = rd.sp.filter((p) => p[0] > gx0 - 4 && p[0] < gx1 + 4 && p[1] > gz0 - 4 && p[1] < gz1 + 4);
      if (pts.length < 6) continue;
      const a = horizontal ? 0 : 1, c = horizontal ? 1 : 0; // along / across
      const lo = Math.min(...pts.map((p) => p[a])), hi = Math.max(...pts.map((p) => p[a]));
      const span = horizontal ? gx1 - gx0 : gz1 - gz0;
      const mean = pts.reduce((s, p) => s + p[c], 0) / pts.length;
      const dev = Math.max(...pts.map((p) => Math.abs(p[c] - mean)));
      if (hi - lo > span * 0.45 && dev < 7) out.push({ at: mean, w: rd.w, fixed: true });
    }
    return out.sort((p, q) => p.at - q.at);
  };
  const laneSet = (lo, hi, fixed, pitch, firstOff, w) => {
    const set = [];
    const edges = [{ at: lo, w: 0, edge: true }, ...fixed, { at: hi, w: 0, edge: true }];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i].at + edges[i].w / 2, b = edges[i + 1].at - edges[i + 1].w / 2;
      if (edges[i].fixed) set.push(edges[i]);
      for (let L = a + firstOff; L + 18 <= b; L += pitch) set.push({ at: L, w, fixed: false });
    }
    const last = edges[edges.length - 2];
    if (last && last.fixed && !set.includes(last)) set.push(last);
    return set.sort((p, q) => p.at - q.at);
  };

  const colony = (zn) => {
    const [gx0, gz0] = px(zn.rect[0], zn.rect[1]), [gx1, gz1] = px(zn.rect[2], zn.rect[3]);
    const laneW = 6, pitch = 38;
    const Hs = laneSet(gz0, gz1, fixedRoads(gx0, gz0, gx1, gz1, true), pitch, 21, laneW);
    const Vs = laneSet(gx0, gx1, fixedRoads(gx0, gz0, gx1, gz1, false), 54, 26, laneW);
    const laneOK = (x, z) => free(x, z, 2.2);
    for (const L of Hs) if (!L.fixed) laneSeg(gx0, L.at, gx1, L.at, laneOK, L.w);
    for (const X of Vs) {
      if (X.fixed) continue;
      const cuts = [gz0];
      for (const L of Hs) cuts.push(L.at - L.w / 2, L.at + L.w / 2);
      cuts.push(gz1);
      for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] > cuts[i]) laneSeg(X.at, cuts[i], X.at, cuts[i + 1], laneOK, laneW);
    }
    const bounds = [gx0];
    for (const X of Vs) bounds.push(X.at - X.w / 2, X.at + X.w / 2);
    bounds.push(gx1);
    Hs.forEach((Ln, k) => {
      const L = Ln.at, lw = Ln.w;
      const bazaar = !Ln.fixed && k % 4 === 1;
      for (const side of [-1, 1]) {
        // available depth between this lane and its neighbour on that side (split evenly, 2 m back gap)
        const nb = Hs[k + side];
        const gap = nb ? Math.abs(nb.at - L) - lw / 2 - nb.w / 2 : side < 0 ? L - lw / 2 - gz0 : gz1 - (L + lw / 2);
        // thin gaps between two lanes: only the lane with the lower index builds a single full-depth row
        const depth = Math.min(15, nb ? (gap >= 32 ? (gap - 2) / 2 : gap < 24 && side > 0 ? gap : gap < 24 ? 0 : (gap - 2) / 2) : gap);
        if (depth < 8) continue;
        const pz0 = side < 0 ? L - lw / 2 - depth : L + lw / 2, pz1 = pz0 + depth;
        for (let bi = 0; bi < bounds.length; bi += 2) {
          const bx0 = bounds[bi], bx1 = bounds[bi + 1];
          let x = bx0 + 0.3;
          while (x < bx1 - 5) {
            const pw = bazaar ? pick(r, [6, 7, 8, 9]) : pick(r, [8, 10, 10, 12, 12, 14]);
            if (x + pw > bx1 + 0.2) break;
            const cx = x + pw / 2;
            x += pw;
            rej.att = (rej.att || 0) + 1;
            if (r() > zn.dens) continue;
            const set = bazaar ? 0.6 : 3;
            const hd = Math.max(6, Math.min(12, depth - set));
            const hz = side < 0 ? pz0 + hd / 2 : pz1 - hd / 2;
            const aabb = { x0: cx - pw / 2 + 0.15, x1: cx + pw / 2 - 0.15, z0: hz - hd / 2, z1: hz + hd / 2 };
            if (!freeRect(aabb.x0 - 0.4, pz0, aabb.x1 + 0.4, pz1, 0.8)) { rej.fr = (rej.fr || 0) + 1; continue; }
            const yaw = side < 0 ? 0 : 2;
            const floors = bazaar ? (r() < 0.7 ? 2 : 3) : r() < 0.12 ? 1 : r() < 0.62 ? 2 : r() < 0.94 ? 3 : 4;
            houses.push({
              x: cx, z: hz, w: pw - 0.3, d: hd, h: floors * 3, floors, yaw, variant: bazaar ? 3 : pick(r, [0, 0, 0, 1, 1, 2]), color: pick(r, palettes),
              tank: r() < 0.7, stairs: r() < 0.55, sign: bazaar ? pick(r, signCols) : null, aabb
            });
            if (!bazaar) {
              const wz = side < 0 ? pz1 + 0.18 : pz0 - 0.18;
              const gap2 = 2.8, gx = cx + (r() - 0.5) * (pw - 5);
              const wc = pick(r, [0xd8cfbb, 0xc9bfa8, 0xe3d9c3, 0xb9aa8d]);
              const w0 = cx - pw / 2, w1 = cx + pw / 2;
              if (gx - gap2 / 2 - w0 > 0.3) walls.push({ x: (w0 + gx - gap2 / 2) / 2, z: wz, len: gx - gap2 / 2 - w0, h: 1.35, th: 0.22, col: wc });
              if (w1 - (gx + gap2 / 2) > 0.3) walls.push({ x: (w1 + gx + gap2 / 2) / 2, z: wz, len: w1 - (gx + gap2 / 2), h: 1.35, th: 0.22, col: wc });
              gates.push({ x: gx, z: wz, w: gap2, col: pick(r, [0x2b3a47, 0x3b5a3b, 0x5a2b2b, 0x23282e]) });
              const tz = side < 0 ? pz1 - 1.2 : pz0 + 1.2;
              if (r() < 0.4) trees.push({ t: 'broadleaf', x: w0 + (r() < 0.5 ? 0.9 : pw - 0.9), z: tz, s: 0.55 + r() * 0.3, ry: r() * 6 });
              else if (r() < 0.5) trees.push({ t: 'shrub', x: cx + (r() - 0.5) * (pw - 3), z: tz, s: 0.8 + r() * 0.5, ry: r() * 6 });
            } else if (r() < 0.25) {
              trees.push({ t: 'broadleaf', x: cx, z: side < 0 ? pz1 + 0.4 : pz0 - 0.4, s: 0.6, ry: r() * 6 });
            }
          }
        }
      }
    });
  };

  /* ============================================================ village */
  const village = (zn) => {
    const [gx0, gz0] = px(zn.rect[0], zn.rect[1]), [gx1, gz1] = px(zn.rect[2], zn.rect[3]);
    for (let z = gz0; z < gz1; z += 34) for (let x = gx0; x < gx1; x += 34) {
      if (r() > zn.dens * 2) continue;
      const cx = x + 17 + (r() - 0.5) * 14, cz = z + 17 + (r() - 0.5) * 14;
      const w = 10 + Math.floor(r() * 4), d = 8 + Math.floor(r() * 3);
      if (!freeRect(cx - 12, cz - 12, cx + 12, cz + 12, 3)) continue;
      const yaw = Math.floor(r() * 4);
      const odd = yaw % 2 === 1;
      const hw = (odd ? d : w) / 2, hd = (odd ? w : d) / 2;
      houses.push({ x: cx, z: cz, w, d, h: 3.4, floors: 1, yaw, variant: 0, color: pick(r, palettes), tank: false, stairs: false, sign: null, aabb: { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd } });
      for (let i = 0; i < 3; i++) trees.push({ t: 'broadleaf', x: cx + (r() - 0.5) * 22, z: cz + 9 + r() * 4, s: 0.9 + r() * 0.5, ry: r() * 6 });
    }
  };


  /* ============================================================ villas */
  const villaMats = () => {
    const fm = (hex) => {
      const m = new THREE.MeshStandardMaterial({ map: T.solidFacadeTexture(hex, 2).clone(), roughness: 0.85, vertexColors: true }); // every facade box passes a tint colour
      m.map.needsUpdate = true;
      m.map.repeat.set(1 / 6, 1 / 3);
      return m;
    };
    const tile = (tex, c) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(1, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, color: c }); };
    return {
      fac0: fm('#efe8d8'), fac1: fm('#dfe6ee'), fac2: fm('#ece0c8'),
      slab: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.75 }),
      tile: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, vertexColors: true }), // pitched roofs (always tinted)
      stone: new THREE.MeshStandardMaterial({ map: T.concreteTexture('#b7b0a0'), roughness: 0.95 }),
      wallv: new THREE.MeshStandardMaterial({ color: 0xe4dccb, roughness: 0.92 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.5, metalness: 0.3 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x1f3a52, metalness: 0.8, roughness: 0.06, clearcoat: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.85 }),
      grass: tile(T.grassTexture('#4f6f34'), 0xffffff),
      drive: tile(T.concreteTexture('#9a968a'), 0xffffff),
      asphalt: tile(T.asphaltTexture('street'), 0xffffff)
    };
  };

  const villa = (zn) => {
    const [gx0, gz0] = px(zn.rect[0], zn.rect[1]), [gx1, gz1] = px(zn.rect[2], zn.rect[3]);
    const b = new GeoBuilder();
    const PW = 30, PD = 34, LW = 8, pitch = PD * 2 + LW;
    const Ls = [];
    const gates = []; // [x, z] of every plot gate, so boulevard trees never block a driveway
    for (let L = gz0 + PD + LW / 2 + 2; L + LW / 2 + PD <= gz1 + 4; L += pitch) Ls.push(L);
    const Xs = [];
    for (let X = gx0 + PW * 4 + LW / 2; X < gx1 - 20; X += PW * 4 + LW) Xs.push(X);
    const laneOK = (x, z) => free(x, z, 3);
    for (const L of Ls) laneSeg(gx0, L, gx1, L, laneOK, LW);
    for (const X of Xs) {
      const cuts = [Ls[0] - LW / 2 - PD];
      for (const L of Ls) cuts.push(L - LW / 2, L + LW / 2);
      cuts.push(Ls[Ls.length - 1] + LW / 2 + PD);
      for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] > cuts[i]) laneSeg(X, cuts[i], X, cuts[i + 1], laneOK, LW);
    }
    const bounds = [gx0];
    for (const X of Xs) bounds.push(X - LW / 2, X + LW / 2);
    bounds.push(gx1);
    const wallPieces = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      b.place(0, 0, 0);
      const ang = Math.atan2(x1 - x0, z1 - z0);
      b.box('wallv', 0.3, 2.4, len, (x0 + x1) / 2, 0, (z0 + z1) / 2, ang);
      city.addSolid((x0 + x1) / 2, 1.2, (z0 + z1) / 2, 0.15, 1.2, len / 2, ang);
    };
    Ls.forEach((L, k) => {
      for (const side of [-1, 1]) {
        for (let bi = 0; bi < bounds.length; bi += 2) {
          const bx0 = bounds[bi], bx1 = bounds[bi + 1];
          for (let px0 = bx0; px0 + PW <= bx1 + 0.5; px0 += PW) {
            const cx = px0 + PW / 2;
            const pz0 = side < 0 ? L - LW / 2 - PD : L + LW / 2, pz1 = pz0 + PD;
            if (!freeRect(px0 + 1, pz0 + 1, px0 + PW - 1, pz1 - 1, 2)) continue;
            const yaw = side < 0 ? 0 : Math.PI;
            const front = side < 0 ? pz1 : pz0; // lane edge
            // local frame: +z = front (towards the lane); origin = villa centre
            const setback = 10;
            const vz = side < 0 ? front - setback - 6.5 : front + setback + 6.5;
            const roll = r(), type = roll < 0.2 ? 0 : roll < 0.32 ? 1 : roll < 0.5 ? 2 : roll < 0.78 ? 3 : 4; // 5 designs, random per plot
            const col = Math.floor(r() * 3);
            const TINTS = [0xffffff, 0xf6e7c9, 0xecd0aa, 0xdcbd9d, 0xd2dbe0, 0xe0e8d3, 0xf2dcbd, 0xe8d6d2, 0xcfd9c2, 0xf1f1ec];
            const ROOFS = [0x8a4a2f, 0x6b3a2a, 0x59514b, 0x9c5a3c, 0x7a3b2e];
            const tint = TINTS[Math.floor(r() * TINTS.length)], roofC = ROOFS[Math.floor(r() * ROOFS.length)];
            b.place(cx, vz, yaw);
            const fac = 'fac' + col;
            const fbox = (w, h, d, x, y, z) => b.box(fac, w, h, d, x, y, z, 0, tint);
            const solidW = type === 1 ? 16 : 18, solidD = type === 1 ? 13 : 12;
            if (type === 0) { // classic: 2 floors, balcony porch, side garage
              fbox(18, 6, 12, -3, 0, 0);
              b.box('slab', 19.2, 0.35, 13.2, -3, 6, 0);
              fbox(6, 3.2, 8, 9, 0, 2); b.box('slab', 6.8, 0.3, 8.8, 9, 3.2, 2);
              b.box('dark', 4.6, 2.5, 0.12, 9, 0, 6.05);
              for (const x of [-5.5, -0.5]) b.cyl('slab', 0.3, 0.3, 3, x, 0, 8.4, 12);
              b.box('slab', 7.6, 0.3, 3.2, -3, 3.0, 7.6);
              b.box('glass', 7.4, 0.95, 0.08, -3, 3.3, 9.15);
              b.box('wood', 1.8, 2.5, 0.12, -3, 0, 6.05); b.box('slab', 2.2, 2.8, 0.1, -3, 0, 6.01);
              b.box('slab', 0.3, 0.3, 0.3, 0, 6.3, 0);
              city.addSolid(...worldSolid(cx, vz, yaw, -3, 3, 0, 9, 3, 6));
              city.addSolid(...worldSolid(cx, vz, yaw, 9, 1.6, 2, 3, 1.6, 4));
            } else if (type === 1) { // tiered: 3 floors stepped back
              fbox(16, 3, 13, 0, 0, 0); b.box('slab', 17.2, 0.3, 14.2, 0, 3, 0);
              fbox(12, 3, 10, 0, 3.3, -1.5); b.box('slab', 13.2, 0.3, 11.2, 0, 6.3, -1.5);
              fbox(8, 3, 7, 0, 6.6, -3); b.box('slab', 9.2, 0.35, 8.2, 0, 9.6, -3);
              for (const x of [-5, -1.7, 1.7, 5]) b.cyl('slab', 0.32, 0.32, 6.3, x, 0, 8.6, 14);
              b.box('slab', 13, 0.4, 4, 0, 6.3, 8.4);
              b.box('glass', 12.6, 0.95, 0.08, 0, 3.3, 5.1 + 0);
              b.box('wood', 2.4, 2.6, 0.12, 0, 0, 6.55); b.box('slab', 2.9, 2.9, 0.1, 0, 0, 6.51);
              b.box('dark', 1, 3.2, 1, -9.5, 0, 6.5); b.box('dark', 1, 3.2, 1, 9.5, 0, 6.5);
              city.addSolid(...worldSolid(cx, vz, yaw, 0, 4.8, 0, 8, 4.8, 6.5));
            } else if (type === 3) { // gabled family house: pitched tile roof, porch with gable, chimney, side garage
              fbox(14, 3.1, 11, 0, 0, 0); fbox(13.4, 3.0, 10.4, 0, 3.15, 0);
              b.box('slab', 14.6, 0.22, 11.6, 0, 3.0, 0);
              b.gable('tile', 13.4, 2.8, 10.4, 0, 6.15, 0, 0, 0.7, roofC);
              b.box('slab', 5.6, 0.28, 3.4, -3.4, 3.1, 7.2); b.gable('tile', 5.6, 1.3, 3.4, -3.4, 3.38, 7.2, 0, 0.3, roofC);
              for (const x of [-5.9, -0.9]) b.cyl('slab', 0.2, 0.22, 3.1, x, 0, 8.7, 12);
              b.box('wood', 1.7, 2.5, 0.12, -3.4, 0, 5.55); b.box('slab', 2.2, 2.8, 0.1, -3.4, 0, 5.52);
              b.box('glass', 3.2, 1.1, 0.08, 3.6, 0.9, 5.55); b.box('glass', 3.2, 1.1, 0.08, 3.6, 3.7, 5.2); b.box('glass', 2.2, 1.1, 0.08, -3.4, 3.7, 5.2);
              b.box('stone', 0.9, 2.8, 0.9, 4.5, 6.15, -2.0);
              fbox(5, 3.0, 8, 9.2, 0, 0.5); b.box('slab', 5.6, 0.25, 8.6, 9.2, 3.0, 0.5); b.box('dark', 4.2, 2.3, 0.12, 9.2, 0, 4.55);
              city.addSolid(...worldSolid(cx, vz, yaw, 0, 3.1, 0, 7, 3.1, 5.5));
              city.addSolid(...worldSolid(cx, vz, yaw, 9.2, 1.5, 0.5, 2.5, 1.5, 4));
            } else if (type === 4) { // colonnade villa: long low-pitch roof, columned porch + balcony
              fbox(17, 3.2, 11.5, 0, 0, 0); fbox(17, 3.0, 11.5, 0, 3.3, 0);
              b.box('slab', 17.6, 0.25, 12.1, 0, 3.2, 0);
              b.gable('tile', 11.5, 2.0, 17, 0, 6.3, 0, HALF_PI, 0.7, roofC);
              b.box('slab', 12, 0.3, 3.6, 0, 3.2, 7.3);
              for (let i = 0; i < 5; i++) b.cyl('slab', 0.22, 0.24, 3.2, -5 + i * 2.5, 0, 8.9, 12);
              b.box('glass', 11.6, 0.95, 0.08, 0, 3.55, 9.0);
              b.box('wood', 2.0, 2.6, 0.12, 0, 0, 5.8); b.box('slab', 2.5, 2.9, 0.1, 0, 0, 5.76);
              b.box('glass', 3, 1.2, 0.08, -5.5, 0.8, 5.8); b.box('glass', 3, 1.2, 0.08, 5.5, 0.8, 5.8);
              b.box('glass', 3, 1.2, 0.08, -5.5, 3.9, 5.8); b.box('glass', 3, 1.2, 0.08, 5.5, 3.9, 5.8);
              city.addSolid(...worldSolid(cx, vz, yaw, 0, 3.2, 0, 8.5, 3.2, 5.75));
              city.addSolid(...worldSolid(cx, vz, yaw, 0, 1.6, 7.3, 6, 1.6, 1.8));
            } else { // modern: glass strips + cantilever
              fbox(14, 3, 12, 0, 0, 0);
              fbox(16, 3, 10, 0, 3.1, 2.5); b.box('slab', 16.4, 0.4, 10.4, 0, 6.1, 2.5);
              b.box('glass', 10, 1.9, 0.1, 0, 4.0, 7.55); b.box('glass', 10, 2.2, 0.1, 0, 0.3, 6.05);
              b.box('slab', 0.45, 3.1, 0.45, -7.5, 0, 7.4); b.box('slab', 0.45, 3.1, 0.45, 7.5, 0, 7.4);
              b.box('wood', 2.0, 2.6, 0.12, 4.5, 0, 6.06);
              b.box('slab', 15.2, 0.3, 12.6, 0, 3.0, 0);
              city.addSolid(...worldSolid(cx, vz, yaw, 0, 3.05, 1.2, 8.2, 3.05, 7));
            }
            // roof furniture
            if (type <= 2) { // flat roofs: water tank, solar panels, sometimes a satellite dish
              const topY = type === 1 ? 9.95 : 6.35;
              b.cyl('dark', 0.55, 0.55, 1.3, -6 + r() * 3, topY, -3, 14);
              b.add('dark', new THREE.BoxGeometry(2.2, 0.08, 1.2), 3, topY + 0.55, -3, 0, -0.45, 0);
              b.add('dark', new THREE.BoxGeometry(2.2, 0.08, 1.2), 5.6, topY + 0.55, -3, 0, -0.45, 0);
              if (r() < 0.45) { b.cyl('dark', 0.04, 0.04, 1.0, -2, topY, 2.5, 6); b.add('slab', new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, 1.2), -2, topY + 1.15, 2.5, 0, 0.9, 0.3); }
            }
            // garden, drive, path
            b.place(cx, (pz0 + pz1) / 2, 0);
            b.plane('grass', PW - 0.6, PD - 0.6, 0, 0.03, 0, 0, null, 4);
            const sgn = side < 0 ? 1 : -1; // towards the lane
            const lx = (l) => (side < 0 ? l : -l); // villa-local x -> offset from plot centre
            const gOff = type === 0 || type === 3 ? 9 : 5;
            b.plane('drive', 4.4, 10, lx(gOff), 0.045, sgn * (PD / 2 - 5), 0, null, 3);
            b.plane('stone', 2.2, 10, lx(type === 0 ? -3 : type === 3 ? -3.4 : type === 1 || type === 4 ? 0 : 4.5), 0.048, sgn * (PD / 2 - 5), 0, null, 2);
            // boundary: front wall with gate + pillars; east side; back wall (south row)
            const wz = front;
            const gx = cx + lx(gOff), gap = 5.4;
            gates.push([gx, front]);
            wallPieces(px0, wz, gx - gap / 2, wz);
            wallPieces(gx + gap / 2, wz, px0 + PW, wz);
            b.place(0, 0, 0);
            for (const s of [-1, 1]) b.box('slab', 0.9, 3.3, 0.9, gx + s * (gap / 2 + 0.2), 0, wz);
            b.box('dark', gap - 0.6, 2.2, 0.1, gx, 0.3, wz);
            for (let i = 0; i < 6; i++) b.box('gold', 0.06, 2.0, 0.12, gx - gap / 2 + 0.5 + i * ((gap - 1) / 5), 0.4, wz);
            wallPieces(px0 + PW, pz0, px0 + PW, pz1);
            if (bi === 0 && px0 === bx0) wallPieces(px0, pz0, px0, pz1);
            if (side > 0) wallPieces(px0, pz1, px0 + PW, pz1);
            // planting
            trees.push({ t: 'palm', x: gx - gap / 2 - 1.6, z: front + (side < 0 ? -1.5 : 1.5), s: 0.9 + r() * 0.3, ry: r() * 6 });
            trees.push({ t: 'palm', x: gx + gap / 2 + 1.6, z: front + (side < 0 ? -1.5 : 1.5), s: 0.9 + r() * 0.3, ry: r() * 6 });
            for (let i = 0; i < 4; i++) trees.push({ t: 'cypress', x: px0 + 2.2 + i * (PW - 4.4) / 3, z: (side < 0 ? pz0 + 2.5 : pz1 - 2.5), s: 0.9 + r() * 0.25, ry: r() * 6 });
            trees.push({ t: 'broadleaf', x: px0 + 4 + r() * (PW - 8), z: side < 0 ? pz0 + 5 : pz1 - 5, s: 0.95 + r() * 0.35, ry: r() * 6 });
            for (let i = 0; i < 5; i++) trees.push({ t: 'shrub', x: px0 + 3 + i * 5.4, z: side < 0 ? front - 3 : front + 3, s: 0.8 + r() * 0.3, ry: r() * 6 });
            extra.push({ x0: px0, x1: px0 + PW, z0: pz0, z1: pz1 });
            void solidW; void solidD;
          }
        }
      }
    });
    const g = b.finish(villaMats());
    city.group.add(g);
    // boulevard palms along the lanes
    for (const L of Ls) for (let x = gx0 + 6; x < gx1 - 6; x += 14) if (free(x, L + LW / 2 - 0.2, 3) && free(x, L - LW / 2 + 0.2, 3)) {
      const pz = L + LW / 2 + 1.7; // inside the front yard, clear of the 0.3 m boundary wall that sits on the lane edge
      if (Xs.some((X) => Math.abs(x - X) < LW / 2 + 1.5)) continue; // not inside a cross lane
      if (gates.some((g) => Math.abs(g[0] - x) < 3.6 && Math.abs(g[1] - pz) < 4)) continue; // not in front of a gate / driveway
      trees.push({ t: 'palm', x, z: pz, s: 1.0, ry: r() * 6 });
    }
  };

  function worldSolid(cx, cz, yaw, lx, hy, lz, hw, hh, hd) {
    // local (x,z) -> world with yaw rotation; returns args for addSolid(x, y, z, hw, hh, hd, rotY)
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [cx + lx * c + lz * s, hy, cz - lx * s + lz * c, hw, hh, hd, yaw];
  }

  /* ============================================================ factories */
  const facMats = () => {
    const clad = (hex) => { const m = new THREE.MeshStandardMaterial({ map: T.corrugatedTexture(hex).clone(), roughness: 0.55, metalness: 0.45 }); m.map.needsUpdate = true; m.map.repeat.set(1 / 4, 1 / 4); return m; };
    const tile = (tex, c, rep) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rep, rep); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, color: c }); };
    const office = new THREE.MeshStandardMaterial({ map: T.solidFacadeTexture('#d9d2c0', 2).clone(), roughness: 0.85 });
    office.map.needsUpdate = true; office.map.repeat.set(1 / 6, 1 / 3);
    return {
      cladBlue: clad('#7f95a8'), cladGrey: clad('#a3a8ac'), cladSand: clad('#b9ad90'), cladGreen: clad('#7a9684'),
      roof: clad('#6e7a84'), office,
      yard: tile(T.concreteTexture('#8f8c82'), 0xffffff, 1 / 5),
      conc: tile(T.concreteTexture('#a39f94'), 0xffffff, 1 / 4),
      wall: new THREE.MeshStandardMaterial({ color: 0xb7b1a2, roughness: 0.95 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.4, metalness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.5, metalness: 0.3 }),
      red: new THREE.MeshStandardMaterial({ color: 0xc2331f, roughness: 0.6 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.7 }),
      orange: new THREE.MeshStandardMaterial({ color: 0xd6862a, roughness: 0.5, metalness: 0.3 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x6f6f72, roughness: 0.5, metalness: 0.7 }),
      rust: new THREE.MeshStandardMaterial({ color: 0x8c4a2a, roughness: 0.85, metalness: 0.4 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x1f3a52, metalness: 0.8, roughness: 0.08 }),
      glow: new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff6a1a, emissiveIntensity: 1.4 }),
      tyre: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }),
      cab: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.1, vertexColors: true })
    };
  };

  const factory = (zn) => {
    const [gx0, gz0] = px(zn.rect[0], zn.rect[1]), [gx1, gz1] = px(zn.rect[2], zn.rect[3]);
    const CW = 62, CD = 50, LW = 12;
    const names = ['AL-KARAM TEXTILE MILLS', 'GUJRANWALA STEEL', 'FAUJI CEMENT', 'PUNJAB WAREHOUSING', 'CITY COLD STORAGE', 'ALI AUTO PARTS', 'PUNJAB POWER GRID', 'MALIK FANS', 'SUPER SPORTS GOODS', 'ZAM ZAM BEVERAGES', 'FINE FLOUR MILLS', 'NADEEM ENGINEERING'];
    const kinds = ['mill', 'steel', 'cement', 'warehouse', 'cold', 'workshops', 'power'];
    const MATS = facMats();
    const placed = [];
    let n = 0;
    const laneOK = (x, z) => free(x, z, 2.5);
    const rowsZ = [];
    for (let z = gz0 + 6; z + CD <= gz1; z += CD + LW) rowsZ.push(z);
    for (const rz of rowsZ) {
      laneSeg(gx0, rz + CD + LW / 2, gx1, rz + CD + LW / 2, laneOK, LW);
      for (let x = gx0 + 6; x + CW <= gx1; ) {
        const cx = x + CW / 2, cz = rz + CD / 2;
        if (!freeRect(x, rz, x + CW, rz + CD, 2.5)) { x += 4; continue; }
        const kind = kinds[(n * 3 + (n >> 2)) % kinds.length];
        const name = names[n % names.length];
        compound(cx, cz, kind, name, MATS, n % 4);
        extra.push({ x0: x, x1: x + CW, z0: rz, z1: rz + CD });
        laneSeg(x + CW + LW / 2, rz, x + CW + LW / 2, rz + CD + LW, laneOK, LW);
        n++;
        x += CW + LW;
      }
    }
    void placed;
  };

  function truck(b, x, z, ry, col) {
    const c = new THREE.Color(col);
    b.add('cab', new THREE.BoxGeometry(2.5, 2.7, 2.3), x, 1.9, z + 4.9, ry, 0, 0, c.getHex());
    b.add('dark', new THREE.BoxGeometry(2.3, 1.0, 0.1), x, 2.6, z + 6.1, ry);
    b.add('cab', new THREE.BoxGeometry(2.6, 3.2, 9), x, 2.7, z - 0.8, ry, 0, 0, 0xe9e6de);
    b.add('dark', new THREE.BoxGeometry(2.3, 0.5, 11), x, 0.75, z, ry);
    for (const dz of [-4.5, -3.3, 4.8]) for (const sx of [-1, 1]) b.add('tyre', new THREE.CylinderGeometry(0.55, 0.55, 0.35, 14), x + sx * 1.2 * Math.cos(ry), 0.55, z + dz - sx * 1.2 * Math.sin(ry) * 0, ry, 0, HALF_PI);
  }

  function compound(cx, cz, kind, name, MATS, v) {
    const b = new GeoBuilder();
    b.place(cx, cz, 0); // all compounds face +z (south)
    const W = 62, D = 50, hw = W / 2, hd = D / 2;
    const S = (lx, ly, lz, w, h, d) => city.addSolid(cx + lx, ly, cz + lz, w, h, d, 0);
    const clad = ['cladBlue', 'cladGrey', 'cladSand', 'cladGreen'];
    const cm = clad[(v + 1) % 4], cm2 = clad[(v + 2) % 4];
    b.plane('yard', W, D, 0, 0.035, 0);
    // perimeter wall + gate (front = +z)
    const gap = 11;
    for (const s of [-1, 1]) {
      b.box('wall', hw - gap / 2, 3.0, 0.4, s * (gap / 2 + (hw - gap / 2) / 2), 0, hd); S(s * (gap / 2 + (hw - gap / 2) / 2), 1.5, hd, (hw - gap / 2) / 2, 1.5, 0.2);
      b.box('wall', 0.4, 3.0, D, s * hw, 0, 0); S(s * hw, 1.5, 0, 0.2, 1.5, hd);
      b.box('steel', 1.4, 4.4, 1.4, s * (gap / 2 + 0.7), 0, hd); S(s * (gap / 2 + 0.7), 2.2, hd, 0.7, 2.2, 0.7);
      for (let i = 0; i < 6; i++) b.box('steel', 0.06, 0.5, 0.06, s * (hw - 1 - i * 0.4), 3.0, hd); // wire posts
    }
    b.box('wall', W, 3.0, 0.4, 0, 0, -hd); S(0, 1.5, -hd, hw, 1.5, 0.2);
    for (let i = 0; i < 5; i++) b.box('dark', 0.1, 2.4, 0.1, -gap / 2 + 1 + i * 2.2, 0, hd + 0.1); // sliding gate rails
    b.box('dark', gap - 1.5, 2.2, 0.12, 0, 0.1, hd);
    b.box('conc', gap + 3, 0.5, 0.9, 0, 4.4, hd);
    // guard hut
    b.box('office', 3.2, 3.0, 3.2, -gap / 2 - 3.5, 0, hd - 3); b.box('conc', 3.8, 0.3, 3.8, -gap / 2 - 3.5, 3.0, hd - 3); S(-gap / 2 - 3.5, 1.5, hd - 3, 1.6, 1.5, 1.6);
    const HALL = (w, d, h, x, z, mat, roofKind = 'gable') => {
      b.box(mat, w, h, d, x, 0, z);
      if (roofKind === 'gable') b.gable('roof', w, Math.min(3.8, w / 8), d, x, h, z, HALF_PI, 0.4);
      else if (roofKind === 'saw') b.sawtooth('roof', w, d, Math.max(3, Math.round(w / 9)), 2.6, x, h, z);
      else b.box('conc', w + 0.5, 0.4, d + 0.5, x, h, z);
      // roller doors + high windows on the front
      const nd = Math.max(1, Math.floor(w / 14));
      for (let i = 0; i < nd; i++) b.box('dark', 5.2, 5.0, 0.2, x - w / 2 + (i + 0.5) * (w / nd), 0, z + d / 2 + 0.05);
      for (let i = 0; i < Math.floor(w / 4); i++) b.box('glass', 2.2, 0.9, 0.12, x - w / 2 + 2.4 + i * (w - 4) / Math.max(1, Math.floor(w / 4) - 1), h - 1.5, z + d / 2 + 0.05);
      S(x, h / 2, z, w / 2, h / 2, d / 2);
    };
    const tank = (x, z, r, h) => { b.cyl('metal', r, r, h, x, 0, z, 20); b.sphere('metal', r, x, h, z, 1, 0.35, 1, null, 20); b.cyl('steel', r + 0.1, r + 0.1, 0.25, x, 0, z, 20); S(x, h / 2, z, r, h / 2, r); };
    const chimney = (x, z, hgt, r) => {
      const n = 6;
      for (let i = 0; i < n; i++) b.cyl(i % 2 ? 'white' : 'red', r - (i + 1) * 0.07, r - i * 0.07, hgt / n, x, i * hgt / n, z, 16);
      S(x, hgt / 2, z, r, hgt / 2, r);
    };
    const office = (x, z, w, d, h) => { b.box('office', w, h, d, x, 0, z); b.box('conc', w + 0.6, 0.4, d + 0.6, x, h, z); S(x, h / 2, z, w / 2, h / 2, d / 2); b.box('dark', 1.8, 2.5, 0.12, x, 0, z + d / 2 + 0.03); };
    const pipes = (x0, z0, x1, z1, y) => {
      const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
      for (const dy of [0, 0.7]) b.cyl('orange', 0.22, 0.22, L, (x0 + x1) / 2, y + dy - L / 2 * 0 - 0, (z0 + z1) / 2, 10, null, a, HALF_PI, 0);
      for (let i = 0; i <= Math.floor(L / 6); i++) b.box('steel', 0.25, y, 0.25, x0 + (x1 - x0) * i / Math.max(1, Math.floor(L / 6)), 0, z0 + (z1 - z0) * i / Math.max(1, Math.floor(L / 6)));
    };
    if (kind === 'mill') {
      HALL(44, 24, 8.5, 2, -12, cm, 'saw');
      office(-22, 12, 13, 9, 7);
      chimney(22, 8, 36, 1.5); tank(14, 14, 3, 8); tank(8, 14, 3, 8);
      pipes(-6, 2, 22, 2, 3.2);
      b.box('conc', 12, 0.6, 5, 8, 4.2, 4); // loading canopy
      for (const x of [3, 13]) b.cyl('steel', 0.2, 0.2, 4.2, x, 0, 6.2, 8);
      truck(b, -18, -2, 0, 0x2b6cb0);
    } else if (kind === 'steel') {
      HALL(52, 20, 11, 0, -14, cm2, 'gable');
      b.box('steel', 52, 0.6, 1.2, 0, 8.5, -4.2); // crane gantry
      b.box('cladGrey', 10, 11, 10, 20, 0, 12); b.box('roof', 10.6, 0.5, 10.6, 20, 11, 12); S(20, 5.5, 12, 5, 5.5, 5);
      b.box('glow', 2.5, 1.2, 0.12, 20, 7, 17.1); b.box('dark', 3, 3.4, 0.14, 20, 0, 17.05);
      chimney(16, 8, 20, 0.9); chimney(24, 8, 22, 0.9);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) b.box('rust', 9, 0.5, 0.5, -22 + i * 0 - 0, 0.3 + j * 0.55, 2 + i * 1.1);
      for (let i = 0; i < 4; i++) b.cyl('steel', 1.2, 1.2, 1.4, -8 + i * 3.1, 0, 14, 16, null, 0, 0, HALF_PI * 0);
      S(-22, 1.0, 4, 4.5, 1, 3);
      truck(b, 6, 12, 0, 0xb23a2e);
    } else if (kind === 'cement') {
      for (let i = 0; i < 4; i++) { const x = -18 + i * 9; b.cyl('white', 3.4, 3.4, 22, x, 0, -14, 24); b.cyl('white', 0.6, 3.4, 3.5, x, 22, -14, 24); b.cyl('steel', 3.5, 3.5, 0.5, x, 8, -14, 24); S(x, 12, -14, 3.4, 12, 3.4); }
      b.box('steel', 38, 0.6, 1.6, -4.5, 20, -14);
      b.add('steel', new THREE.BoxGeometry(2, 1.4, 22), 22, 9, -2, 0, -0.5, 0); // conveyor gallery
      HALL(26, 16, 8, -14, 10, cm, 'gable'); HALL(18, 14, 7, 12, 14, cm2, 'gable');
      office(24, -4, 8, 7, 6);
      truck(b, -2, 16, 0, 0xd09a2a);
    } else if (kind === 'warehouse') {
      b.box(cm, 48, 10, 28, 0, 0, -8); b.box('conc', 48.6, 0.4, 28.6, 0, 10, -8); S(0, 5, -8, 24, 5, 14);
      b.box('roof', 48.6, 0.3, 28.6, 0, 10.4, -8);
      for (let i = 0; i < 6; i++) b.box('dark', 5, 4.6, 0.2, -20 + i * 8, 0.1, 6.1);
      b.box('conc', 48, 0.5, 4, 0, 5.3, 8);
      for (let i = 0; i < 7; i++) b.cyl('steel', 0.2, 0.2, 5.3, -22 + i * 7.3, 0, 9.8, 8);
      truck(b, -12, 16, 0, 0x2f7d4f); truck(b, 4, 15, 0, 0xc2331f);
      for (let i = 0; i < 6; i++) b.box(['rust', 'steel', 'orange'][i % 3], 12, 2.6, 2.45, -26 + (i % 3) * 13, (i >= 3 ? 2.6 : 0), 20 - 0, 0, null);
      S(-13, 2.6, 20, 20, 2.6, 1.3);
    } else if (kind === 'cold') {
      b.box('white', 40, 9, 22, 0, 0, -12); b.box('conc', 40.6, 0.4, 22.6, 0, 9, -12); S(0, 4.5, -12, 20, 4.5, 11);
      for (let i = 0; i < 6; i++) { b.cyl('metal', 1.4, 1.4, 0.6, -16 + i * 6.4, 9.4, -12, 18); b.cyl('dark', 1.2, 1.2, 0.1, -16 + i * 6.4, 10.0, -12, 18); }
      for (const x of [-12, 0, 12]) b.box('dark', 4.6, 4.2, 0.2, x, 0, -0.92);
      office(-22, 12, 12, 8, 7); tank(20, 14, 2.6, 8); tank(14, 14, 2.6, 8);
      truck(b, 0, 14, 0, 0x1c6fb0);
      for (let i = 0; i < 20; i++) b.box(['red', 'orange', 'white', 'steel'][i % 4], 1.0, 0.6, 0.6, 20 + (i % 5) * 1.1, Math.floor(i / 5) * 0.6, 4);
    } else if (kind === 'workshops') {
      const cols2 = [0x2b6cb0, 0xc2331f, 0x2f7d4f, 0xd09a2a, 0x6a3d8f, 0x0e7c86];
      for (let i = 0; i < 6; i++) {
        const x = -26 + i * 10.4;
        b.box(i % 2 ? 'cladSand' : 'cladGrey', 9.6, 5.5, 14, x, 0, -14); b.gable('roof', 9.6, 1.4, 14, x, 5.5, -14, HALF_PI, 0.3); S(x, 2.75, -14, 4.8, 2.75, 7);
        b.box('dark', 5.4, 4.2, 0.2, x, 0, -6.95);
        b.add('cab', new THREE.BoxGeometry(8, 1.1, 0.12), x, 5.0, -6.9, 0, 0, 0, cols2[i]);
      }
      for (let i = 0; i < 10; i++) b.cyl('tyre', 0.5, 0.5, 0.25, -20 + (i % 5) * 1.0, Math.floor(i / 5) * 0.26, 8, 14);
      for (let i = 0; i < 8; i++) b.add('rust', new THREE.BoxGeometry(1.2 + (i % 3) * 0.4, 0.5, 0.9), 10 + (i % 4) * 1.6, 0.25 + Math.floor(i / 4) * 0.5, 10, i);
      truck(b, 18, 4, 0, 0x7a5a3a);
    } else { // power yard
      for (let i = 0; i < 4; i++) {
        const x = -20 + i * 12;
        b.box('dark', 5, 4.2, 3.4, x, 0.6, -8);
        for (let k = 0; k < 6; k++) b.box('metal', 0.18, 3.2, 3.0, x - 2 + k * 0.8, 0.8, -8 + 2.4);
        for (let k = 0; k < 3; k++) b.cyl('white', 0.18, 0.12, 1.7, x - 1.4 + k * 1.4, 4.8, -8, 8);
        S(x, 2.5, -8, 2.6, 2.5, 3.5);
      }
      for (const x of [-24, 24]) { // lattice pylons
        for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) b.add('steel', new THREE.BoxGeometry(0.22, 24, 0.22), x + dx * 0.55, 12, 12 + dz * 0.55, 0, 0.02 * dz, -0.04 * dx);
        for (const y of [8, 14, 20]) { b.box('steel', 7, 0.2, 0.2, x, y, 12); b.box('steel', 0.2, 0.2, 2.2, x, y, 12); }
        S(x, 12, 12, 1.6, 12, 1.6);
      }
      office(18, 14, 12, 9, 6); tank(-4, 14, 2.4, 6);
    }
    const grp = b.finish(MATS);
    city.group.add(grp);
    // sign over the gate
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(gap + 3, 1.6), new THREE.MeshStandardMaterial({ map: T.signTexture(name, '#17304d', '#ffffff', 512, 80), roughness: 0.6, emissive: 0x111111 }));
    sg.position.set(cx, 5.4, cz + hd + 0.5);
    city.group.add(sg);
  }

  for (const zn of ZONES) {
    if (zn.type === 'colony') colony(zn);
    else if (zn.type === 'village') village(zn);
    else if (zn.type === 'villa') villa(zn);
    else if (zn.type === 'factory') factory(zn);
  }

  /* ============================================================ lane + wall meshes */
  const P = [], N = [], U = [], I = [];
  const q = (x0, z0, x1, z1) => {
    const o = P.length / 3;
    P.push(x0, 0.024, z0, x0, 0.024, z1, x1, 0.024, z1, x1, 0.024, z0);
    for (let i = 0; i < 4; i++) N.push(0, 1, 0);
    U.push(x0 / 8, z0 / 8, x0 / 8, z1 / 8, x1 / 8, z1 / 8, x1 / 8, z0 / 8);
    I.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  for (const l of lanes) {
    if (l.x1 - l.x0 >= l.z1 - l.z0) { const hw2 = l.w / 2, cz = (l.z0 + l.z1) / 2; q(l.x0, cz - hw2, l.x1, cz + hw2); }
    else { const hw2 = l.w / 2, cx2 = (l.x0 + l.x1) / 2; q(cx2 - hw2, l.z0, cx2 + hw2, l.z1); }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  lg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  lg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  lg.setIndex(I);
  const lm = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ map: T.asphaltTexture('street'), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  lm.receiveShadow = true;
  lm.renderOrder = 1;
  city.group.add(lm);
  city.stats.lanes = lanes.length;
  city.debugLanes = lanes;
  return { houses, walls, gates };
}
