// OZ explorer (A1, exact-checks version). Flies the debug camera over a grid, records per-cell perf + screenshot,
// then runs the exact audits from the debug door. Writes ONE report folder per run. It never edits game code.
// Usage: node tools/oz-explorer/explore.mjs <url> [--cell 150] [--max 40] [--shots] [--out reports]
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const args = process.argv.slice(2); const url = args[0] || 'http://localhost:5173/';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const CELL = +opt('cell', 150), MAX = +opt('max', 40), SHOTS = !!opt('shots', false), OUT = opt('out', 'reports');
const B = { minX: -1040, maxX: 1300, minZ: -500, maxZ: 760 }; // approximate map extent
const run = path.join(OUT, 'run-' + new Date().toISOString().replace(/[:.]/g, '-')); fs.mkdirSync(run, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
await p.goto(url + (url.includes('?') ? '&' : '?') + 'oz_debug=1'); await p.waitForSelector('#loading-screen.fade-out', { timeout: 170000 }); await p.waitForTimeout(2500);
const cells = []; for (let x = B.minX + CELL / 2; x < B.maxX; x += CELL) for (let z = B.minZ + CELL / 2; z < B.maxZ; z += CELL) cells.push([x, z]);
const step = Math.max(1, Math.ceil(cells.length / MAX)); const pick = cells.filter((_, i) => i % step === 0).slice(0, MAX);
const cov = [];
for (const [x, z] of pick) {
  await p.evaluate(([x, z]) => window.__OZ_DEBUG.flyCamera(x, 45, z, 0, -35), [x, z]); await p.waitForTimeout(1200);
  const perf = await p.evaluate(() => window.__OZ_DEBUG.perf());
  let shot = null; if (SHOTS) { shot = `cell_${Math.round(x)}_${Math.round(z)}.png`; await p.screenshot({ path: path.join(run, shot), timeout: 170000 }); }
  cov.push({ x: Math.round(x), z: Math.round(z), visited: true, perf, shot });
}
const audit = await p.evaluate(() => window.__OZ_DEBUG.audit.all());
const findings = [
  ...audit.floatingTrees.findings.map((f, i) => ({ id: 'FLOAT-' + i, type: f.why, position: [f.x, f.y, f.z], evidence: 'raycast gap ' + f.gap + ' m', confidence: 'EXACT', severity: f.why === 'FLOATING' ? 'Major' : 'Minor', suggested_fix: 'snap tree base to surface height' })),
  ...audit.treesInsideColliders.findings.map((f, i) => ({ id: 'TREE-IN-SOLID-' + i, type: 'tree inside collider', position: [f.x, f.y, f.z], evidence: 'inside solid at ' + f.inside, confidence: 'EXACT', severity: 'Minor', suggested_fix: 'reject placement' })),
  ...audit.badPositions.findings.map((f, i) => ({ id: 'BADPOS-' + i, type: f.why, position: [f.x, f.y, f.z], evidence: f.id, confidence: 'EXACT', severity: 'Major', suggested_fix: 'check spawn' })),
  ...audit.errors.map((e, i) => ({ id: 'ERR-' + i, type: e.kind, position: null, evidence: e.msg, confidence: 'EXACT', severity: 'Major', suggested_fix: 'see message' }))
];
const worstFrame = cov.reduce((m, c) => Math.max(m, c.perf.worstFrameMs), 0);
fs.writeFileSync(path.join(run, 'report.json'), JSON.stringify({ mode: 'EXPLORER_EXACT_CHECKS', rendering: 'LIVE if run on a real GPU, SIMULATED on software GL', cellsVisited: cov.length, cellsTotal: cells.length, coverage: cov, worstFrameMs: worstFrame, findings }, null, 1));
console.log(JSON.stringify({ run, cellsVisited: cov.length, findings: findings.length }));
await b.close();
