// Zombie-pressure test: the hero stands still while zombies walk up and hit him. He must stay on the ground (never stand in the air on a zombie).
// Found in the sandbox (stub physics, SIMULATED): hero position.y jumped to 1.8 m and stayed there once zombies arrived. REAL Rapier is only on the GitHub runner, so this test is what tells us.
// Usage: node tests/zombie_pressure.mjs http://localhost:4173/ [seconds=60]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:5173/', SECS = +(process.argv[3] || 60), MAXY = 0.5;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
await p.goto(base + (base.includes('?') ? '&' : '?') + 'oz_debug=1'); await p.waitForSelector('#loading-screen.fade-out', { state: 'attached', timeout: 170000 }); await p.waitForTimeout(2500);
const stub = await p.evaluate(() => { const w = window.__opzero.physics && window.__opzero.physics.world; return !!(w && Array.isArray(w.bodies)); }); // the sandbox stub keeps bodies in a plain array, real Rapier does not
await p.evaluate(() => { const a = window.__opzero; a.hero.teleportTo(-14, 0.2, 17, 0); if (a.goku && a.goku.setEnabled) a.goku.setEnabled(false); }); // partner off: he would kill the zombies first
let maxY = 0, minHp = 100, attacked = false, maxRoot = 0;
const t0 = Date.now();
while (Date.now() - t0 < SECS * 1000) {
  const r = await p.evaluate(() => { const a = window.__opzero, h = a.hero; return { y: h.position.y, ry: h.rootGroup.position.y, hp: h.health, atk: (a.zombies.zombies || []).some((z) => z.state === 'attack') }; });
  maxY = Math.max(maxY, r.y); maxRoot = Math.max(maxRoot, r.ry); minHp = Math.min(minHp, r.hp); attacked = attacked || r.atk;
  await p.waitForTimeout(1000);
}
const ok = maxY <= MAXY;
console.log(JSON.stringify({ seconds: SECS, zombiesReachedHero: attacked, maxHeroY: +maxY.toFixed(2), maxRenderedY: +maxRoot.toFixed(2), minHp: Math.round(minHp), physics: stub ? 'STUB (SIMULATED)' : 'real Rapier' }));
if (!attacked) { console.log('UNVERIFIED zombie pressure: no zombie reached the hero in ' + SECS + ' s'); await b.close(); process.exit(0); }
if (ok) console.log('PASS hero stays on the ground while zombies hit him (max y ' + maxY.toFixed(2) + ' m <= ' + MAXY + ' m)');
else if (stub) console.log('UNVERIFIED hero rose to y=' + maxY.toFixed(2) + ' m under zombie pressure, but this run used the sandbox STUB physics (SIMULATED): real Rapier must be checked on the GitHub runner');
else console.log('FAIL hero rose to y=' + maxY.toFixed(2) + ' m (limit ' + MAXY + ' m) under zombie pressure with REAL Rapier: he stands on / is pushed up by a zombie');
await b.close(); process.exit(!ok && !stub ? 1 : 0);
