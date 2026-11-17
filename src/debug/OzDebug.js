// OPERATION ZERO debug door (A0). Read-only inspection API for testers / the explorer / GOKU.
// Enabled ONLY with ?oz_debug=1 in the URL (never in the normal player build).
// Nothing here changes game state, except flyCamera() which moves a detached free camera view.
import * as THREE from 'three';

const r2 = (n) => Math.round(n * 100) / 100;

export function installOzDebug(app) {
  const errors = [];
  const pushErr = (kind, msg) => { if (errors.length < 200) errors.push({ t: Math.round(performance.now()), kind, msg: String(msg).slice(0, 400) }); };
  window.addEventListener('error', (e) => pushErr('error', e.message));
  window.addEventListener('unhandledrejection', (e) => pushErr('rejection', e.reason && e.reason.message || e.reason));
  const ce = console.error; console.error = (...a) => { pushErr('console.error', a.join(' ')); ce.apply(console, a); };

  // frame timing
  const ft = { ema: 16.7, worst: 0, last: performance.now() };
  const tick = () => { const n = performance.now(), d = n - ft.last; ft.last = n; ft.ema += (d - ft.ema) * 0.05; if (d > ft.worst) ft.worst = d; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  const city = () => app.world && app.world.city;
  const colliders = () => { const out = []; const c = city(); if (!c) return out; for (const ch of c.chunks.values()) for (const s of ch.solids) out.push(s); return out; };

  // all instanced trees in world space
  const trees = () => {
    const c = city(); const out = []; if (!c || !c.treeGeos) return out;
    const keys = Object.keys(c.treeGeos), m = new THREE.Matrix4(), w = new THREE.Matrix4();
    app.scene.updateMatrixWorld(true);
    app.scene.traverse((o) => {
      if (!o.isInstancedMesh) return; const k = keys.find((k2) => c.treeGeos[k2] === o.geometry); if (!k) return;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); w.multiplyMatrices(o.matrixWorld, m); const e = w.elements; out.push({ id: `tree-${k}-${out.length}`, type: 'tree:' + k, x: r2(e[12]), y: r2(e[13]), z: r2(e[14]) }); }
    });
    return out;
  };

  const supportMeshes = () => {
    const out = [];
    app.scene.traverse((o) => {
      if (o.isMesh && o.visible && o.geometry && o.material && !Array.isArray(o.material) && o.material.side !== THREE.BackSide
        && !(o.material.transparent && o.material.opacity < 0.6) && !o.isSkinnedMesh) {
        const isTree = city() && city().treeGeos && Object.values(city().treeGeos).includes(o.geometry);
        if (!isTree) out.push(o);
      }
    });
    return out;
  };

  const api = {
    version: 1,
    readOnly: true,
    /** every object of a kind: 'tree' | 'collider' | 'vehicle' | 'zombie' */
    listObjects(kind = 'tree', limit = 5000) {
      if (kind === 'tree') return trees().slice(0, limit);
      if (kind === 'collider') return colliders().slice(0, limit).map((s, i) => ({ id: 'col-' + i, type: 'collider', x: r2(s[0]), y: r2(s[1]), z: r2(s[2]), hw: r2(s[3]), hh: r2(s[4]), hd: r2(s[5]), rotY: r2(s[6] || 0) }));
      if (kind === 'vehicle') return (app.vehicles.vehicles || []).map((v, i) => ({ id: 'veh-' + i, type: 'vehicle:' + v.type, x: r2(v.pos.x), y: r2(v.pos.y), z: r2(v.pos.z), yaw: r2(v.yaw), speed: r2(v.speed) }));
      if (kind === 'zombie') return ((app.zombies && app.zombies.zombies) || []).map((z, i) => { const p = z.position || z.pos || (z.root && z.root.position) || { x: NaN, y: NaN, z: NaN }; return { id: 'zom-' + i, type: 'zombie', x: r2(p.x), y: r2(p.y), z: r2(p.z) }; });
      return [];
    },
    playerState() { const h = app.hero, p = h.position; return { x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(h.yaw), health: h.health, stamina: h.stamina, anim: h.animation && h.animation.currentState }; },
    perf() { const i = app.renderer.instance.info; return { fpsEma: r2(1000 / ft.ema), frameMsEma: r2(ft.ema), worstFrameMs: r2(ft.worst), drawCalls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, heapMB: performance.memory ? r2(performance.memory.usedJSHeapSize / 1048576) : null }; },
    errors() { return errors.slice(); },
    /** detached free camera for explorers (does not move the player) */
    flyCamera(x, y, z, yawDeg = 0, pitchDeg = -20) {
      app.debugCam = { x, y, z, yaw: yawDeg * Math.PI / 180, pitch: pitchDeg * Math.PI / 180 };
      return true;
    },
    releaseCamera() { app.debugCam = null; },
    audit: {
      /** vertical ray down from each tree base against all visible non-tree meshes. gap = base - surface below */
      floatingTrees(tol = 0.3) {
        const t = trees(), cands = supportMeshes(), rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0); rc.firstHitOnly = true;
        const bad = [];
        for (const tr of t) {
          rc.set(new THREE.Vector3(tr.x, tr.y + 60, tr.z), down);
          const h = rc.intersectObjects(cands, false).find((x) => x.point.y <= tr.y + 6);
          const gap = h ? r2(tr.y - h.point.y) : null;
          if (gap === null) bad.push({ ...tr, gap, why: 'no surface below' });
          else if (Math.abs(gap) > tol) bad.push({ ...tr, gap, why: gap > 0 ? 'FLOATING' : 'SUNK/inside' });
        }
        return { checked: t.length, tolerance: tol, findings: bad };
      },
      /** trees whose trunk is inside a blocking collider footprint */
      treesInsideColliders() {
        const cs = colliders().filter((s) => s[4] > 1.2 && (s[3] > 1.5 || s[5] > 1.5)), bad = [];
        for (const tr of trees()) for (const [sx, sy, sz, hw, hh, hd, ry] of cs) {
          const rx = tr.x - sx, rz = tr.z - sz, c = Math.cos(ry || 0), s = Math.sin(ry || 0), lx = rx * c - rz * s, lz = rx * s + rz * c;
          if (Math.abs(lx) < hw - 0.2 && Math.abs(lz) < hd - 0.2 && tr.y < sy + hh && tr.y > sy - hh) { bad.push({ ...tr, inside: [r2(sx), r2(sz)] }); break; }
        }
        return { findings: bad };
      },
      /** NaN / below-ground / out-of-bounds positions among tracked objects */
      badPositions(limit = 3000) {
        const bad = [];
        for (const k of ['tree', 'vehicle', 'zombie']) for (const o of api.listObjects(k, limit)) {
          if (![o.x, o.y, o.z].every(Number.isFinite)) bad.push({ ...o, why: 'NaN' });
          else if (o.y < -5 || Math.abs(o.x) > 5000 || Math.abs(o.z) > 5000) bad.push({ ...o, why: 'out of range' });
        }
        return { findings: bad };
      },
      all() {
        return { floatingTrees: api.audit.floatingTrees(), treesInsideColliders: api.audit.treesInsideColliders(), badPositions: api.audit.badPositions(), perf: api.perf(), errors: api.errors() };
      }
    }
  };
  window.__OZ_DEBUG = Object.freeze(api);
  console.info('[OZ_DEBUG] enabled (read-only). window.__OZ_DEBUG');
  return api;
}
