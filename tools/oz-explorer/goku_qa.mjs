// GOKU QA run (in-game GOKU partner + exact audits + mobile budget) -> ONE report folder + a persistent bug ledger.
// It never edits game code. It only writes under --out (default "reports").
// Usage: node tools/oz-explorer/goku_qa.mjs <url> [--sim 200] [--cells 3] [--selftest] [--out reports] [--render "SIMULATED (software GL)"]
//   --sim      seconds of SIMULATED time the partner explores (stepped directly, no rendering needed)
//   --cells    how many map cells get a performance sample (draw calls / triangles)
//   --selftest injects 2 known faults in page memory (floating tree, hole in the ground) and checks that GOKU/audits notice them
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';

const args = process.argv.slice(2); const url = args[0] && !args[0].startsWith('--') ? args[0] : 'http://localhost:5173/';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const SIM = +opt('sim', 200), CELLS = +opt('cells', 3), SELF = !!opt('selftest', false), OUT = String(opt('out', 'reports')), RENDER = String(opt('render', 'SIMULATED (software GL)'));
const BUDGET = { drawCalls: 150, triangles: 300000 }; // project target for Android (a budget, not a measurement)
const now = new Date(); const stamp = now.toISOString().replace(/[:.]/g, '-');
const run = path.join(OUT, 'goku-qa-' + stamp); fs.mkdirSync(run, { recursive: true });

const SEVERITY = { hero_out_of_world: 'Major', partner_out_of_world: 'Major', no_ground: 'Major', partner_inside_solid: 'Major', hero_long_airtime: 'Major', partner_stuck: 'Minor', partner_gave_up: 'Minor', partner_teleport: 'Minor', lag_spike: 'Minor' };
const FIX = {
  no_ground: 'a hole in the collision ground here: add/extend a ground collider or fix the chunk that should cover this spot',
  partner_inside_solid: 'a solid overlaps a walkable spot: check the collider size/position of the building or prop at this position',
  partner_stuck: 'check whether the target is reachable (fence, canal, highway barrier) and whether a collider is too big; see diagnosis',
  partner_gave_up: 'no walkable path from here to the partner target: it may sit in a closed compound, behind the highway barrier, or beyond the planner budget; check whether a player could reach it',
  partner_teleport: 'partner fell far behind the hero: check pace / path at this location',
  hero_long_airtime: 'hero stayed in the air: floating support or missing ground at this position',
  hero_out_of_world: 'hero position invalid: check spawn / fall-through at this position',
  partner_out_of_world: 'partner position invalid: check ground / collider at this position',
  lag_spike: 'a frame took very long here: check what is created or compiled at this position (SIMULATED on software GL, so only trust it on a real GPU)'
};
const r1 = (n) => Math.round(n * 10) / 10;

const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
const pageErrs = []; p.on('pageerror', (e) => pageErrs.push(String(e)));
await p.goto(url + (url.includes('?') ? '&' : '?') + 'oz_debug=1');
await p.waitForSelector('#loading-screen.fade-out', { state: 'attached', timeout: 170000 }); await p.waitForTimeout(2500);

// ---------- 1. exact audits (floating trees, trees in solids, bad positions, console errors)
const audit = await p.evaluate(() => window.__OZ_DEBUG.audit.all());
const findings = [];
const add = (f) => findings.push({ confidence: 'EXACT', ...f });
audit.floatingTrees.findings.forEach((f, i) => add({ id: 'FLOAT-' + i, source: 'audit', type: 'tree ' + f.why, position: [f.x, f.y, f.z], evidence: 'raycast gap ' + f.gap + ' m', severity: f.why === 'FLOATING' ? 'Major' : 'Minor', suggested_fix: 'snap the tree base to the surface height' }));
audit.treesInsideColliders.findings.forEach((f, i) => add({ id: 'TREE-IN-SOLID-' + i, source: 'audit', type: 'tree inside collider', position: [f.x, f.y, f.z], evidence: 'inside solid at ' + f.inside, severity: 'Minor', suggested_fix: 'reject this placement' }));
audit.badPositions.findings.forEach((f, i) => add({ id: 'BADPOS-' + i, source: 'audit', type: f.why, position: [f.x, f.y, f.z], evidence: f.id, severity: 'Major', suggested_fix: 'check the spawn of this object' }));
[...audit.errors, ...pageErrs.map((m) => ({ kind: 'pageerror', msg: m }))].filter((e) => !/404|Failed to load resource/.test(e.msg)).forEach((e, i) => add({ id: 'ERR-' + i, source: 'console', type: e.kind, position: null, evidence: e.msg, severity: 'Major', suggested_fix: 'see message' }));

// ---------- 2. GOKU plays: fights zombies, then explores the map by itself
const play = await p.evaluate(({ sim }) => {
  const a = window.__opzero, g = a.goku, city = a.world.city, dt = 1 / 30;
  if (!g) return { error: 'no partner in this build' };
  window.__OZ_GOKU.clearNotes();
  a.hero.teleportTo(-14, 0.2, 17, 0); g.placeNearHero(); const k0 = a.zombies.kills, h0 = g.stats.zombieHits;
  for (let i = 0; i < 900; i++) { a.zombies.update(dt); g.update(dt); }
  const fight = { hits: g.stats.zombieHits - h0, kills: a.zombies.kills - k0, simSeconds: 30 };
  window.__OZ_GOKU.command({ type: 'explore' });
  const m0 = g.stats.metersWalked; let inside = 0, bad = 0; const steps = Math.round(sim / dt);
  for (let i = 0; i < steps; i++) {
    g.update(dt); if (!Number.isFinite(g.pos.x + g.pos.y + g.pos.z) || g.pos.y < -2) bad++;
    if (i % 30 === 0) for (const [sx, sy, sz, hw, hh, hd, ry] of city.blockersNear(g.pos.x, g.pos.z, 0.3)) { const c = Math.cos(ry || 0), s = Math.sin(ry || 0), rx = g.pos.x - sx, rz = g.pos.z - sz, lx = rx * c - rz * s, lz = rx * s + rz * c; if (Math.abs(lx) < hw - 0.05 && Math.abs(lz) < hd - 0.05 && sy + hh > g.pos.y + 0.3 && sy - hh < g.pos.y + 1.6) { inside++; break; } }
  }
  const notes = window.__OZ_GOKU.notes().map((n) => {
    const free = g.nav ? g.nav.freeAt(n.x, n.z, 0.45) : null, near = city.blockersNear(n.x, n.z, 3).length;
    return { ...n, diag: { standableSpotFree: free, solidsWithin3m: near } };
  });
  return { fight, explore: { simSeconds: sim, metersWalked: Math.round(g.stats.metersWalked - m0), insideSolidSamples: inside, badPositionFrames: bad }, stats: { ...g.stats }, nav: g.nav ? { ...g.nav.stats } : null, notes };
}, { sim: SIM });
if (play.error) { console.error(play.error); await b.close(); process.exit(2); }
play.notes.forEach((n, i) => add({ id: 'GOKU-' + n.type + '-' + i, source: 'goku-partner', type: n.type, position: [n.x, n.y, n.z], evidence: n.detail + ' | diagnosis: standable spot ' + (n.diag.standableSpotFree ? 'free' : 'blocked') + ', ' + n.diag.solidsWithin3m + ' solids within 3 m', confidence: n.confidence || 'EXACT', severity: SEVERITY[n.type] || 'Minor', suggested_fix: FIX[n.type] || 'inspect this position' }));

// ---------- 3. performance budget (counts from three.js renderer.info)
const bounds = { minX: -840, maxX: 270, minZ: -330, maxZ: 330 }; const cells = [[-40, -170], [0, 20], [-440, 0], [160, -170], [-700, 100]].slice(0, Math.max(0, CELLS));
const perf = [];
for (const [x, z] of cells) {
  await p.evaluate(([x, z]) => window.__OZ_DEBUG.flyCamera(x, 45, z, 0, -35), [x, z]); await p.waitForTimeout(1500);
  const pf = await p.evaluate(() => window.__OZ_DEBUG.perf()); perf.push({ x, z, ...pf });
  if (pf.drawCalls > BUDGET.drawCalls || pf.triangles > BUDGET.triangles) add({ id: 'PERF-' + x + '_' + z, source: 'perf', type: 'over mobile budget', position: [x, 45, z], evidence: pf.drawCalls + ' draw calls (budget ' + BUDGET.drawCalls + '), ' + pf.triangles + ' triangles (budget ' + BUDGET.triangles + ')', confidence: 'EXACT', severity: 'Major', suggested_fix: 'merge/instance statics, LOD for buildings and characters, limit the shadow pass' });
}
await p.evaluate(() => window.__OZ_DEBUG.releaseCamera());

// ---------- 4. self-test: does GOKU / the audit notice faults that we plant on purpose? (memory only, never saved)
let selfTest = null;
if (SELF) {
  selfTest = await p.evaluate(() => {
    const a = window.__opzero, g = a.goku, out = []; const Mat4 = a.camera.matrix.constructor;
    // (a) floating tree: lift one tree instance by 1.5 m, expect the floating-tree audit to flag exactly it
    let inst = null; const city = a.world.city; const geos = Object.values(city.treeGeos);
    a.scene.traverse((o) => { if (!inst && o.isInstancedMesh && o.count > 0 && geos.includes(o.geometry)) inst = o; });
    if (inst) {
      const mm = new Mat4(); inst.getMatrixAt(0, mm); const orig = mm.clone();
      const tx = mm.elements[12], tz = mm.elements[14]; mm.elements[13] += 1.5; inst.setMatrixAt(0, mm); inst.instanceMatrix.needsUpdate = true;
      const res = window.__OZ_DEBUG.audit.floatingTrees(0.3); const hit = res.findings.find((f) => Math.abs(f.x - tx) < 0.05 && Math.abs(f.z - tz) < 0.05);
      out.push({ name: 'planted floating tree (+1.5 m) is detected by the audit', ok: !!hit && hit.why === 'FLOATING' && Math.abs(hit.gap - 1.5) < 0.2, evidence: hit ? 'gap ' + hit.gap + ' m at ' + [hit.x, hit.z] : 'not found' });
      inst.setMatrixAt(0, orig); inst.instanceMatrix.needsUpdate = true;
    } else out.push({ name: 'planted floating tree', ok: false, evidence: 'no tree instance found' });
    // (b) hole in the ground: ray casts return nothing in a 5 m circle, the partner must note "no_ground" there
    const hx = 40, hz = 40, orig = a.physics.castRay.bind(a.physics);
    a.physics.castRay = (o, d, len) => (Math.hypot(o.x - hx, o.z - hz) < 5 ? null : orig(o, d, len));
    window.__OZ_GOKU.clearNotes(); window.__OZ_GOKU.command({ type: 'hold' }); g.pos.set(hx, 0, hz);
    for (let i = 0; i < 150; i++) g.update(1 / 30);
    const n = window.__OZ_GOKU.notes().find((q) => q.type === 'no_ground' && Math.hypot(q.x - hx, q.z - hz) < 6);
    out.push({ name: 'planted hole in the ground is noted by GOKU as no_ground', ok: !!n, evidence: n ? JSON.stringify({ x: n.x, z: n.z, confidence: n.confidence }) : 'no note' });
    a.physics.castRay = orig; window.__OZ_GOKU.clearNotes();
    return out;
  });
}

// ---------- 5. persistent bug ledger (open -> not_seen_latest; it NEVER claims "fixed" by itself)
const ledgerFile = path.join(OUT, 'ledger.json'); let ledger = []; try { ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')); } catch (_) { /* first run */ }
const keyOf = (f) => f.type + '@' + (f.position ? f.position.map((v, i) => (i === 1 ? '' : Math.round(v / 6))).join(',') : 'none') + (f.source === 'console' ? ':' + String(f.evidence).slice(0, 40) : '');
const seen = new Set();
for (const f of findings) {
  const k = keyOf(f); seen.add(k); let e = ledger.find((x) => x.key === k);
  if (!e) ledger.push(e = { key: k, first_seen: now.toISOString(), runs_seen: 0, status: 'open' });
  Object.assign(e, { last_seen: now.toISOString(), severity: f.severity, source: f.source, type: f.type, position: f.position, evidence: f.evidence, suggested_fix: f.suggested_fix, status: 'open' }); e.runs_seen++;
}
// Only checks that are repeatable can say "not seen": the audits and the performance cells that were really sampled this run.
// GOKU's own walk is random, so NOT meeting a spot again proves nothing and those entries stay open.
const sampled = new Set(perf.map((q) => q.x + ',' + q.z));
const repeatable = (e) => e.source === 'audit' || e.source === 'console' || (e.source === 'perf' && e.position && sampled.has(e.position[0] + ',' + e.position[2]));
for (const e of ledger) if (!seen.has(e.key) && e.status === 'open' && repeatable(e)) e.status = 'not_seen_latest';
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1));

// ---------- 6. write the report
const bySev = (s) => findings.filter((f) => f.severity === s).length;
const report = { tool: 'goku_qa', time: now.toISOString(), url, rendering: RENDER, budget: BUDGET, play: { fight: play.fight, explore: play.explore, stats: play.stats, nav: play.nav }, perf, selfTest, summary: { findings: findings.length, major: bySev('Major'), minor: bySev('Minor'), ledgerOpen: ledger.filter((x) => x.status === 'open').length }, findings,
  not_verified: ['real GPU frame rate (software GL here)', 'real Rapier physics if this run used the preview stub', 'partner only walks/fights: no driving, invulnerable', 'the Windows GOKU agent is NOT part of this run'] };
fs.writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 1));
const md = [];
md.push(`# GOKU QA report — ${now.toISOString()}`, '', `Rendering: **${RENDER}**. Counts (draw calls, triangles) are STATIC counts from three.js; walking/fighting is SIMULATED time.`, '');
md.push(`## What GOKU did`, `- Fought zombies: ${play.fight.hits} hits, ${play.fight.kills} kills in ${play.fight.simSeconds} simulated s.`, `- Explored by itself: ${play.explore.metersWalked} m in ${play.explore.simSeconds} simulated s; inside-solid samples ${play.explore.insideSolidSamples}; bad positions ${play.explore.badPositionFrames}; stuck events ${play.stats.stuckEvents}; path plans ${play.nav ? play.nav.plans : 'n/a'}.`, `- Ran exact audits on ${audit.floatingTrees.checked} trees; console errors ${audit.errors.length + pageErrs.length}.`, '');
if (selfTest) { md.push(`## Self-test (faults planted on purpose, memory only)`); for (const t of selfTest) md.push(`- ${t.ok ? 'PASS' : 'FAIL'} — ${t.name} (${t.evidence})`); md.push(''); }
md.push(`## Bug summary`, `Major ${bySev('Major')} · Minor ${bySev('Minor')} · open in ledger ${report.summary.ledgerOpen}`, '', `| ID | Severity | Type | Position (x,y,z) | Evidence | Confidence |`, `|---|---|---|---|---|---|`);
for (const f of findings.slice(0, 60)) md.push(`| ${f.id} | ${f.severity} | ${f.type} | ${f.position ? f.position.map(r1).join(', ') : '-'} | ${String(f.evidence).replace(/\|/g, '/').slice(0, 140)} | ${f.confidence} |`);
if (findings.length > 60) md.push(`| … | | | | ${findings.length - 60} more in report.json | |`);
md.push('', `## Performance samples (budget ${BUDGET.drawCalls} draw calls / ${BUDGET.triangles} triangles)`, `| Cell (x,z) | Draw calls | Triangles | Geometries | Textures |`, `|---|---|---|---|---|`);
for (const q of perf) md.push(`| ${q.x}, ${q.z} | ${q.drawCalls} | ${q.triangles} | ${q.geometries} | ${q.textures} |`);
md.push('', `## NOT verified`, ...report.not_verified.map((x) => `- ${x}`), '');
fs.writeFileSync(path.join(run, 'REPORT.md'), md.join('\n'));
const lm = ['# Bug ledger (all runs)', '', 'status: open = seen in the latest run · not_seen_latest = not seen last time (maybe fixed, needs a human to confirm) · fixed = set by a person only', '', '| Status | Severity | Type | Position | First seen | Last seen | Runs |', '|---|---|---|---|---|---|---|'];
for (const e of ledger.slice().sort((a, c) => (a.status === 'open' ? 0 : 1) - (c.status === 'open' ? 0 : 1))) lm.push(`| ${e.status} | ${e.severity} | ${e.type} | ${e.position ? e.position.map(r1).join(', ') : '-'} | ${e.first_seen.slice(0, 10)} | ${e.last_seen.slice(0, 10)} | ${e.runs_seen} |`);
fs.writeFileSync(path.join(OUT, 'LEDGER.md'), lm.join('\n') + '\n');
console.log(JSON.stringify({ run, findings: findings.length, major: bySev('Major'), minor: bySev('Minor'), selfTest: selfTest ? selfTest.map((t) => (t.ok ? 'PASS ' : 'FAIL ') + t.name) : null, fight: play.fight, walked: play.explore.metersWalked, stuck: play.stats.stuckEvents }));
await b.close();
process.exit(selfTest && selfTest.some((t) => !t.ok) ? 1 : 0);
