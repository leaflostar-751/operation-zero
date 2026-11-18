/**
 * NavGrid: tiny on-demand A* over the STATIC collision data (City.blockersNear), independent of the physics engine.
 * Cells are evaluated lazily and cached, so there is no up-front bake and no memory cost for areas nobody walks.
 * Used by the GOKU partner (and reusable for zombies later).
 */
const OFF = 4096, K = 8192;
const key = (ix, iz) => (ix + OFF) * K + (iz + OFF);
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

function overlaps(x, z, r, [sx, , sz, hw, , hd, ry]) {
  const cs = Math.cos(ry || 0), sn = Math.sin(ry || 0), rx = x - sx, rz = z - sz;
  const lx = rx * cs - rz * sn, lz = rx * sn + rz * cs;
  const qx = Math.max(-hw, Math.min(hw, lx)), qz = Math.max(-hd, Math.min(hd, lz));
  const dx = lx - qx, dz = lz - qz;
  return dx * dx + dz * dz < r * r;
}

export class NavGrid {
  constructor(getCity, opts = {}) {
    this.getCity = getCity; this.cell = opts.cell || 1.5; this.r = opts.radius || 0.5;
    this.cache = new Map(); this.stats = { plans: 0, nodes: 0, ms: 0, fails: 0, partial: 0 };
  }
  city() { const c = this.getCity && this.getCity(); return c && c.blockersNear ? c : null; }

  /** exact test: can a circle of radius r stand at (x,z)? */
  freeAt(x, z, r = this.r) {
    const c = this.city(); if (!c) return true;
    for (const b of c.blockersNear(x, z, r)) if (overlaps(x, z, r, b)) return false;
    return true;
  }
  cellBlocked(ix, iz) {
    const k = key(ix, iz); let v = this.cache.get(k);
    if (v === undefined) {
      if (this.cache.size > 300000) this.cache.clear();
      v = !this.freeAt((ix + 0.5) * this.cell, (iz + 0.5) * this.cell, this.r + 0.3); this.cache.set(k, v);
    }
    return v;
  }
  /** straight segment free for a body of radius r? (sampled every 0.5 m) */
  lineClear(x0, z0, x1, z1, r = 0.42) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.5));
    for (let i = 1; i <= n; i++) { const t = i / n; if (!this.freeAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, r)) return false; }
    return true;
  }
  nearestFree(ix, iz, maxR) {
    if (!this.cellBlocked(ix, iz)) return [ix, iz];
    for (let R = 1; R <= maxR; R++) {
      for (let a = -R; a <= R; a++) for (const [x, z] of [[ix + a, iz - R], [ix + a, iz + R], [ix - R, iz + a], [ix + R, iz + a]]) if (!this.cellBlocked(x, z)) return [x, z];
    }
    return null;
  }

  /**
   * @returns {{pts:{x:number,z:number}[], partial:boolean, expanded:number}|null}
   * pts exclude the start; partial=true means the goal was not reached (best effort towards it).
   */
  findPath(sx, sz, tx, tz, maxNodes = 3500) {
    const t0 = performance.now(), cell = this.cell, W = 1.25;
    const six = Math.floor(sx / cell), siz = Math.floor(sz / cell);
    let gix = Math.floor(tx / cell), giz = Math.floor(tz / cell);
    const g0 = this.nearestFree(gix, giz, 8); if (!g0) { this.stats.fails++; return null; }
    gix = g0[0]; giz = g0[1];
    const gKey = key(gix, giz);
    const hf = (ix, iz) => { const dx = Math.abs(ix - gix), dz = Math.abs(iz - giz); return (dx + dz + (1.4142 - 2) * Math.min(dx, dz)) * W; };

    // binary min-heap on f
    const hf_ = [], hx = [], hz = [];
    const push = (f, ix, iz) => {
      let i = hf_.length; hf_.push(f); hx.push(ix); hz.push(iz);
      while (i > 0) { const p = (i - 1) >> 1; if (hf_[p] <= hf_[i]) break; [hf_[p], hf_[i]] = [hf_[i], hf_[p]]; [hx[p], hx[i]] = [hx[i], hx[p]]; [hz[p], hz[i]] = [hz[i], hz[p]]; i = p; }
    };
    const pop = () => {
      const out = [hf_[0], hx[0], hz[0]], lf = hf_.pop(), lx = hx.pop(), lz = hz.pop();
      if (hf_.length) {
        hf_[0] = lf; hx[0] = lx; hz[0] = lz; let i = 0; const n = hf_.length;
        for (;;) {
          let l = 2 * i + 1, r = l + 1, m = i;
          if (l < n && hf_[l] < hf_[m]) m = l; if (r < n && hf_[r] < hf_[m]) m = r; if (m === i) break;
          [hf_[m], hf_[i]] = [hf_[i], hf_[m]]; [hx[m], hx[i]] = [hx[i], hx[m]]; [hz[m], hz[i]] = [hz[i], hz[m]]; i = m;
        }
      }
      return out;
    };

    const gScore = new Map(), came = new Map(), closed = new Set();
    gScore.set(key(six, siz), 0); push(hf(six, siz), six, siz);
    let best = { h: Infinity, ix: six, iz: siz }, expanded = 0, found = false;
    while (hf_.length && expanded < maxNodes) {
      const [, ix, iz] = pop(), k = key(ix, iz);
      if (closed.has(k)) continue; closed.add(k); expanded++;
      const hh = hf(ix, iz); if (hh < best.h) best = { h: hh, ix, iz };
      if (k === gKey) { found = true; break; }
      const gc = gScore.get(k);
      for (const [dx, dz, c] of DIRS) {
        const nx = ix + dx, nz = iz + dz, nk = key(nx, nz);
        if (closed.has(nk) || this.cellBlocked(nx, nz)) continue;
        if (dx !== 0 && dz !== 0 && (this.cellBlocked(ix + dx, iz) || this.cellBlocked(ix, iz + dz))) continue; // no corner cutting
        const ng = gc + c, old = gScore.get(nk);
        if (old === undefined || ng < old) { gScore.set(nk, ng); came.set(nk, k); push(ng + hf(nx, nz), nx, nz); }
      }
    }
    // rebuild
    let cur = found ? gKey : key(best.ix, best.iz); const cells = [];
    while (cur !== undefined && cur !== key(six, siz)) { cells.push({ x: (Math.floor(cur / K) - OFF + 0.5) * cell, z: ((cur % K) - OFF + 0.5) * cell }); cur = came.get(cur); }
    cells.reverse();
    // string-pull: keep only the corners that are needed
    const P = [{ x: sx, z: sz }, ...cells], out = []; let i = 0;
    while (i < P.length - 1) {
      let j = Math.min(P.length - 1, i + 40);
      while (j > i + 1 && !this.lineClear(P[i].x, P[i].z, P[j].x, P[j].z)) j--;
      out.push(P[j]); i = j;
    }
    if (found && out.length && this.freeAt(tx, tz, 0.42) && this.lineClear(out[out.length - 1].x, out[out.length - 1].z, tx, tz)) out[out.length - 1] = { x: tx, z: tz };
    const ms = performance.now() - t0;
    this.stats.plans++; this.stats.nodes += expanded; this.stats.ms += ms; if (!found) this.stats.partial++;
    return { pts: out, partial: !found, expanded };
  }
}
