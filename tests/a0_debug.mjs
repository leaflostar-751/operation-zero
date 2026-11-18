// A0 test: the debug door lists objects and cannot change the game.
// Usage: node tests/a0_debug.mjs http://localhost:5173/ [report.json]
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://localhost:5173/', out = process.argv[3] || 'reports/a0_audit.json';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const results = []; const check = (name, ok, extra) => { results.push({ name, ok: !!ok, extra }); console.log(ok ? 'PASS' : 'FAIL', name, extra ?? ''); };
async function load(url) {
  const p = await b.newPage({ viewport: { width: 640, height: 400 } });
  await p.goto(url); await p.waitForSelector('#loading-screen.fade-out', { state: 'attached', timeout: 170000 }); await p.waitForTimeout(2500); return p;
}
// 1) without the flag the door must not exist
let p = await load(base);
check('door absent without ?oz_debug', await p.evaluate(() => typeof window.__OZ_DEBUG === 'undefined'));
await p.close();
// 2) with the flag
p = await load(base + (base.includes('?') ? '&' : '?') + 'oz_debug=1');
check('door present with flag', await p.evaluate(() => typeof window.__OZ_DEBUG === 'object'));
const snap = () => p.evaluate(() => { const a = window.__opzero; let n = 0; a.scene.traverse(() => n++); return JSON.stringify({ hero: a.hero.position.toArray(), cam: a.camera.position.toArray(), nodes: n, health: a.hero.health, col: window.__OZ_DEBUG ? window.__OZ_DEBUG.listObjects('collider').length : 0 }); });
const before = await snap();
const lists = await p.evaluate(() => { const d = window.__OZ_DEBUG; return { trees: d.listObjects('tree').length, colliders: d.listObjects('collider').length, vehicles: d.listObjects('vehicle').length, zombies: d.listObjects('zombie').length, player: d.playerState(), perf: d.perf() }; });
check('lists objects', lists.trees > 0 && lists.colliders > 0 && lists.vehicles > 0, JSON.stringify({ trees: lists.trees, colliders: lists.colliders, vehicles: lists.vehicles, zombies: lists.zombies }));
const audit = await p.evaluate(() => window.__OZ_DEBUG.audit.all());
const after = await snap();
check('read-only: state unchanged after all queries + audit', before === after, before === after ? '' : before + ' != ' + after);
check('door object is frozen', await p.evaluate(() => { try { window.__OZ_DEBUG.listObjects = null; } catch (e) { /* strict */ } return typeof window.__OZ_DEBUG.listObjects === 'function'; }));
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(out, JSON.stringify({ lists, audit: { floatingTrees: { checked: audit.floatingTrees.checked, count: audit.floatingTrees.findings.length, worst: audit.floatingTrees.findings.slice(0, 30) }, treesInsideColliders: { count: audit.treesInsideColliders.findings.length, worst: audit.treesInsideColliders.findings.slice(0, 30) }, badPositions: audit.badPositions.findings.length, errors: audit.errors } }, null, 1));
console.log('report ->', out);
const fail = results.filter((r) => !r.ok).length; console.log(JSON.stringify({ status: fail ? 'FAIL' : 'PASS', failed: fail }));
await b.close(); process.exit(fail ? 1 : 0);
