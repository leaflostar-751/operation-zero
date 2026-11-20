// Plumbing test for cloud/stream-server.mjs (run the server with DEBUG_STATE=1). Usage: TOKEN=... node cloud/test-client.mjs [port]
import WebSocket from 'ws';
const PORT = +(process.argv[2] || 8090), TOKEN = process.env.TOKEN, base = `http://localhost:${PORT}`, results = [];
const ok = (name, pass, evidence) => { results.push({ name, pass, evidence }); console.log((pass ? 'PASS ' : 'FAIL ') + name + ' — ' + evidence); };
const state = async () => (await fetch(`${base}/state?token=${TOKEN}`)).json();
const open = (tok) => new Promise((res) => { const w = new WebSocket(`ws://localhost:${PORT}/ws?token=${tok}`); w.on('open', () => res({ w })); w.on('unexpected-response', (_q, r) => res({ code: r.statusCode })); w.on('error', () => {}); });
const bad = await open('wrong'); ok('wrong token is rejected', bad.code === 401, 'HTTP ' + bad.code);
const a = await open(TOKEN); if (!a.w) { ok('player connects with the right token', false, 'HTTP ' + a.code); process.exit(1); }
const frames = []; let rtt = null, stats = null;
a.w.on('message', (d, isBin) => { if (isBin) frames.push(d); else { const m = JSON.parse(d.toString()); if (m.t === 'p') rtt = Date.now() - m.ts; if (m.t === 'stats') stats = m; } });
const second = await open(TOKEN); ok('a second player is refused (one player per server)', second.code === 409, 'HTTP ' + second.code);
a.w.send(JSON.stringify({ t: 'p', ts: Date.now() }));
await new Promise((r) => setTimeout(r, 6000));
const jpeg = frames.filter((f) => f[0] === 0xff && f[1] === 0xd8).length;
ok('frames arrive as JPEG pictures', frames.length >= 2 && jpeg === frames.length, `${frames.length} frames in 6 s, ${jpeg} valid JPEG, avg ${frames.length ? Math.round(frames.reduce((s, f) => s + f.length, 0) / frames.length / 1024) : 0} KB`);
ok('ping round trip works', rtt !== null, rtt + ' ms (network + server queue only)');
const s0 = await state();
a.w.send(JSON.stringify({ t: 'k', d: 1, c: 'Hack' })); // must be ignored
a.w.send(JSON.stringify({ t: 'k', d: 1, c: 'KeyW' }));
await new Promise((r) => setTimeout(r, 12000));
a.w.send(JSON.stringify({ t: 'k', d: 0, c: 'KeyW' }));
await new Promise((r) => setTimeout(r, 1500));
const s1 = await state(), moved = Math.hypot(s1.x - s0.x, s1.z - s0.z);
ok('keyboard W from the player moves the hero INSIDE the server game', moved > 0.3, `moved ${moved.toFixed(2)} m (SIMULATED: ~1 fps CPU rendering)`);
const yaw0 = s1.camYaw;
for (const [t, x, y] of [['down', 0.5, 0.5], ['move', 0.6, 0.5], ['move', 0.7, 0.5], ['move', 0.8, 0.5], ['up', 0.8, 0.5]]) { a.w.send(JSON.stringify({ t: 'm', type: t, x, y, b: 0 })); await new Promise((r) => setTimeout(r, 700)); }
await new Promise((r) => setTimeout(r, 2500));
const s2 = await state(); let dy = Math.abs(s2.camYaw - yaw0); dy = Math.min(dy, Math.PI * 2 - dy);
ok('mouse drag from the player turns the camera/hero', dy > 0.05, `camera yaw changed ${dy.toFixed(2)} rad`);
console.log('server stats (last):', JSON.stringify(stats));
a.w.close();
const h = await (await fetch(`${base}/health`)).json(); ok('server health: 0 page errors', h.errors === 0, JSON.stringify(h));
console.log(JSON.stringify({ passed: results.filter((r) => r.pass).length, total: results.length }));
process.exit(results.every((r) => r.pass) ? 0 : 1);
