// GOKU partner test (SIMULATED time: the partner and zombies are stepped directly, no rendering needed).
// Usage: node tests/goku_partner.mjs http://localhost:5173/
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:5173/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 400, height: 260 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(url); await p.waitForSelector('#loading-screen.fade-out', { state: 'attached', timeout: 170000 });
const res = []; const check = (n, ok, x) => { res.push(ok); console.log(ok ? 'PASS' : 'FAIL', n, x ?? ''); };
const fight = await p.evaluate(() => { const a = window.__opzero, g = a.goku; a.hero.teleportTo(-14, 0.2, 17, 0); g.placeNearHero(); const k0 = a.zombies.kills; for (let i = 0; i < 900; i++) { a.zombies.update(1 / 30); g.update(1 / 30); } return { hits: g.stats.zombieHits, kills: a.zombies.kills - k0 }; });
check('partner fights zombies', fight.hits > 0 && fight.kills > 0, JSON.stringify(fight));
const exp = await p.evaluate(() => { const a = window.__opzero, g = a.goku, city = a.world.city; window.__OZ_GOKU.command({ type: 'explore' }); let inside = 0, bad = 0; for (let i = 0; i < 6000; i++) { g.update(1 / 30); if (!Number.isFinite(g.pos.x + g.pos.y + g.pos.z) || g.pos.y < -2) bad++; if (i % 30 === 0) for (const [sx, sy, sz, hw, hh, hd, ry] of city.blockersNear(g.pos.x, g.pos.z, 0.3)) { const c = Math.cos(ry || 0), s = Math.sin(ry || 0), rx = g.pos.x - sx, rz = g.pos.z - sz, lx = rx * c - rz * s, lz = rx * s + rz * c; if (Math.abs(lx) < hw - 0.05 && Math.abs(lz) < hd - 0.05 && sy + hh > g.pos.y + 0.3 && sy - hh < g.pos.y + 1.6) { inside++; break; } } } return { walked: Math.round(g.stats.metersWalked), inside, bad, stuck: g.stats.stuckEvents }; });
check('explore: walks, never inside a solid, never out of world', exp.walked > 200 && exp.inside === 0 && exp.bad === 0, JSON.stringify(exp));
check('no page errors', errs.filter((e) => !/404/.test(e)).length === 0, JSON.stringify(errs.slice(0, 2)));
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
