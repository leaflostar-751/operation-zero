// "Who owns the draw calls?" — breaks the real renderer counts of the running game down by the scene tree, so a performance fix can be aimed and then re-measured.
// Usage: node tools/oz-explorer/drawcalls.mjs <url> [--out drawcalls]   (writes drawcalls.json + DRAWCALLS.md; numbers are LIVE counts, fps on software GL is NOT a result)
import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path';
const args = process.argv.slice(2), url = args[0] || 'http://localhost:4173/', opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; }, OUT = String(opt('out', 'drawcalls'));
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
await p.goto(url + (url.includes('?') ? '&' : '?') + 'oz_debug=1');
await p.waitForSelector('#loading-screen.fade-out', { state: 'attached', timeout: 170000 }); await p.waitForTimeout(4000);
const r = await p.evaluate(async () => {
  const a = window.__opzero, R = a.renderer.instance; await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
  const perf = window.__OZ_DEBUG.perf(); const lights = []; a.scene.traverse((o) => { if (o.isLight) lights.push({ type: o.type, castShadow: !!o.castShadow, shadowMap: o.castShadow && o.shadow ? o.shadow.mapSize.x : null }); });
  const vis = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const tri = (m) => { const g = m.geometry; if (!g) return 0; const n = (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3; return n * (m.isInstancedMesh ? m.count : 1); };
  const count = (o) => { let meshes = 0, instanced = 0, casters = 0, tris = 0; o.traverse((m) => { if (m.isMesh && vis(m)) { meshes++; if (m.isInstancedMesh) instanced++; if (m.castShadow) casters++; tris += tri(m); } }); return { meshes, instanced, casters, tris: Math.round(tris) }; };
  // per-pass accounting: what the MAIN camera and the SUN SHADOW camera actually draw (objects inside each frustum)
  const T = await import('three'); const sun = a.world.sunLight, shCam = sun && sun.shadow && sun.shadow.camera; a.camera.updateMatrixWorld(true); if (shCam) shCam.updateMatrixWorld(true);
  const mkFr = (cam) => { const f = new T.Frustum(); f.setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); return f; };
  const frMain = mkFr(a.camera), frShadow = shCam && sun.castShadow ? mkFr(shCam) : null;
  const passCount = (root) => { let main = 0, shadow = 0, shadowTris = 0, mainTris = 0; root.traverse((m) => { if (!m.isMesh || !vis(m)) return; if (frMain.intersectsObject(m)) { main++; mainTris += tri(m); } if (frShadow && m.castShadow && frShadow.intersectsObject(m)) { shadow++; shadowTris += tri(m); } }); return { main, shadow, mainTris: Math.round(mainTris), shadowTris: Math.round(shadowTris) }; };
  const passAgg = new Map(); for (const c of a.scene.children) { const nm = c.name || (c.type === 'Mesh' ? '(loose mesh)' : '(unnamed ' + c.type + ')'); const k = passCount(c); const e = passAgg.get(nm) || { name: nm, main: 0, shadow: 0, mainTris: 0, shadowTris: 0 }; for (const f of ['main', 'shadow', 'mainTris', 'shadowTris']) e[f] += k[f]; passAgg.set(nm, e); }
  const passes = [...passAgg.values()].filter((x) => x.main || x.shadow).sort((x, y) => y.shadow + y.main - x.shadow - x.main);
  const owners = a.scene.children.map((c) => ({ name: c.name || (c.type === 'Mesh' ? '(loose mesh)' : '(unnamed ' + c.type + ')'), ...count(c) })).filter((x) => x.meshes > 0);
  const agg = new Map(); for (const o of owners) { const e = agg.get(o.name) || { name: o.name, objects: 0, meshes: 0, instanced: 0, casters: 0, tris: 0 }; e.objects++; for (const k of ['meshes', 'instanced', 'casters', 'tris']) e[k] += o[k]; agg.set(o.name, e); }
  const mats = new Set(), looks = new Set(); a.scene.traverse((m) => { if (!m.isMesh) return; for (const x of Array.isArray(m.material) ? m.material : [m.material]) { mats.add(x.uuid); looks.add([x.type, x.color && x.color.getHex(), x.roughness, x.metalness].join('|')); } });
  return { perf, lights, shadowMapEnabled: R.shadowMap.enabled, pixelRatio: R.getPixelRatio(), programs: R.info.programs ? R.info.programs.length : null, materialObjects: mats.size, materialLooksUpperBoundOfSharing: looks.size, passes, owners: [...agg.values()].sort((x, y) => y.meshes - x.meshes) };
});
await b.close();
fs.writeFileSync(path.join(OUT, 'drawcalls.json'), JSON.stringify(r, null, 1));
const md = ['# Who owns the draw calls (LIVE counts, spawn view, software GL)', '', `draw calls **${r.perf.drawCalls}**, triangles **${r.perf.triangles}**, geometries ${r.perf.geometries}, textures ${r.perf.textures}, shader programs ${r.programs}. Mobile budget ~150 calls / 300k triangles. fps on software GL is not a result.`, '', `Materials: ${r.materialObjects} objects; ${r.materialLooksUpperBoundOfSharing} distinct (type,colour,roughness,metalness) = upper bound of how many could be shared (emissive/vertex colours/maps are not in this key).`, `Lights: ${r.lights.map((l) => l.type + (l.castShadow ? '(shadow ' + l.shadowMap + ')' : '')).join(', ')}`, '', '## Per pass (objects inside each camera frustum; instanced = 1 draw)', '', '| Owner | main-camera draws | main tris | sun-shadow draws | shadow tris |', '|---|---|---|---|---|', ...r.passes.slice(0, 25).map((o) => `| ${o.name} | ${o.main} | ${o.mainTris} | ${o.shadow} | ${o.shadowTris} |`), '', '## Whole scene tree (not frustum-limited)', '', '| Owner | objects | meshes | instanced | shadow casters | triangles |', '|---|---|---|---|---|---|', ...r.owners.slice(0, 25).map((o) => `| ${o.name} | ${o.objects} | ${o.meshes} | ${o.instanced} | ${o.casters} | ${o.tris} |`), ''];
fs.writeFileSync(path.join(OUT, 'DRAWCALLS.md'), md.join('\n'));
console.log(md.slice(0, 6).join('\n'));
