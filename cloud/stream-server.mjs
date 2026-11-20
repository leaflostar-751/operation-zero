// CLOUD PLAY (prototype): the game runs INSIDE this server (headless Chromium); a player only receives pictures and sends keys/mouse.
// So the player's laptop/phone does no game processing. One server process = one player (one game instance).
//   node cloud/stream-server.mjs          env: GAME_URL (http://localhost:4173/) PORT (8090) W H QUALITY TOKEN GPU=1 AUTO_SHUTDOWN=1 IDLE_MIN=10 DEBUG_STATE=1
// Status: plumbing PASS (SIMULATED on a CPU-only sandbox). Real GPU speed / latency: UNVERIFIED. Not for public use before HTTPS (see cloud/README.md).
import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { exec } from 'node:child_process'; import { fileURLToPath } from 'node:url';

const env = process.env, here = path.dirname(fileURLToPath(import.meta.url));
const GAME_URL = env.GAME_URL || 'http://localhost:4173/', PORT = +(env.PORT || 8090), W = +(env.W || 1280), H = +(env.H || 720), QUALITY = +(env.QUALITY || 60);
const TOKEN = env.TOKEN || crypto.randomBytes(12).toString('hex'), IDLE_MS = +(env.IDLE_MIN || 10) * 60000, DEBUG_STATE = env.DEBUG_STATE === '1';
const KEYS = /^(Key[A-Z]|Digit\d|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Tab|Enter|Escape|Backspace|F\d{1,2})$/; // only these may be pressed remotely

const gpuArgs = env.GPU === '1' ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=gl-egl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
const browser = await chromium.launch({ args: [...gpuArgs, '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.goto(GAME_URL + (DEBUG_STATE ? (GAME_URL.includes('?') ? '&' : '?') + 'oz_debug=1' : ''));
await page.waitForSelector('#loading-screen.fade-out', { state: 'attached', timeout: 170000 });
const cdp = await page.context().newCDPSession(page);

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, clients: wss.clients.size, errors: errors.length })); }
  if (u.pathname === '/state' && DEBUG_STATE && u.searchParams.get('token') === TOKEN) { // tests only
    return page.evaluate(() => { const h = window.__opzero.hero; const c = window.__opzero.cameraController; return { x: h.position.x, y: h.position.y, z: h.position.z, yaw: h.yaw, camYaw: c ? c.yaw : null }; }).then((s) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(s)); }).catch(() => { res.writeHead(503); res.end('page not ready'); });
  }
  if (u.pathname === '/' || u.pathname === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(here, 'viewer', 'index.html'))); }
  res.writeHead(404); res.end('not found');
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
let player = null, lastSeen = Date.now(), sent = 0, bytes = 0;
server.on('upgrade', (req, sock, head) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/ws' || u.searchParams.get('token') !== TOKEN) { sock.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return sock.destroy(); }
  if (player && player.readyState === 1) { sock.write('HTTP/1.1 409 Conflict\r\n\r\n'); return sock.destroy(); } // one player per server
  wss.handleUpgrade(req, sock, head, (ws) => { player = ws; wss.emit('connection', ws); });
});
wss.on('connection', (ws) => {
  lastSeen = Date.now(); console.log('[cloud] player connected');
  const held = new Set();
  ws.on('message', async (raw) => {
    lastSeen = Date.now(); let m; try { m = JSON.parse(raw.toString()); } catch (_) { return; }
    try {
      if (m.t === 'k' && KEYS.test(m.c)) { if (m.d) { held.add(m.c); await page.keyboard.down(m.c); } else { held.delete(m.c); await page.keyboard.up(m.c); } }
      else if (m.t === 'm' && Number.isFinite(m.x) && Number.isFinite(m.y)) {
        const x = Math.max(0, Math.min(1, m.x)) * W, y = Math.max(0, Math.min(1, m.y)) * H, b = ['left', 'middle', 'right'][m.b | 0] || 'left';
        if (m.type === 'move') await page.mouse.move(x, y); else if (m.type === 'down') { await page.mouse.move(x, y); await page.mouse.down({ button: b }); } else if (m.type === 'up') await page.mouse.up({ button: b });
      } else if (m.t === 'p') ws.send(JSON.stringify({ t: 'p', ts: m.ts }));
    } catch (_) { /* page closing */ }
  });
  ws.on('close', async () => { console.log('[cloud] player left'); lastSeen = Date.now(); player = null; for (const c of held) await page.keyboard.up(c).catch(() => {}); });
});

cdp.on('Page.screencastFrame', (f) => {
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  if (!player || player.readyState !== 1 || player.bufferedAmount > 1_000_000) return; // slow client: drop the frame instead of building a queue
  const buf = Buffer.from(f.data, 'base64'); player.send(buf); sent++; bytes += buf.length;
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: QUALITY, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
setInterval(() => { if (player && player.readyState === 1) player.send(JSON.stringify({ t: 'stats', fps: sent, kbps: Math.round(bytes * 8 / 1000) })); sent = 0; bytes = 0; }, 1000);

// idle guard: when nobody plays for IDLE_MIN minutes the server stops itself (with AUTO_SHUTDOWN=1 the whole machine powers off, so the bill stops)
setInterval(() => {
  if (player && player.readyState === 1) return;
  if (Date.now() - lastSeen > IDLE_MS) { console.log('[cloud] idle limit reached'); if (env.AUTO_SHUTDOWN === '1') exec('sudo shutdown -h now'); process.exit(3); }
}, 5000);

server.listen(PORT, () => console.log(`[cloud] ready  http://localhost:${PORT}/?token=${TOKEN}   (game: ${GAME_URL}, ${W}x${H}, GPU=${env.GPU === '1' ? 'on' : 'off'})`));
