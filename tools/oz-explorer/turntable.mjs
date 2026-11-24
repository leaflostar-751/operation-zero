// GOKU "ghoomna": walks the camera ROUND every vehicle, character and landmark (8 angles + one top view) and saves one contact sheet per subject,
// so every side of every thing can be looked at (by a person, by Claude, or by a vision model later). It also runs the pixel checks on every view.
// It never edits game code; it only moves the detached debug camera and writes under --out.
// Usage: node tools/oz-explorer/turntable.mjs <url> [--out turntable] [--only vehicles,characters,landmarks] [--landmarks meridien,vu,ashraf-palace,school-1] [--angles 8] [--names vehicle-ranger,hero] [--maxSeconds 600]
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
import { flagsOf, analyze } from './eyes.mjs';
const argv = process.argv.slice(2), url = argv[0]; if (!url || url.startsWith('--')) { console.error('usage: turntable.mjs <url> [--out dir] [--only a,b] [--landmarks id,id] [--angles 8]'); process.exit(2); }
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const OUT = String(opt('out', 'turntable')), ONLY = String(opt('only', 'vehicles,characters,landmarks')).split(','), ANG = +opt('angles', 8), LMS = String(opt('landmarks', 'meridien,vu,ashraf-palace,school-1')).split(','), NAMES = opt('names', null) ? String(opt('names')).split(',') : null, MAXS = +opt('maxSeconds', 0), T0 = Date.now(), late = []; // --maxSeconds N: do not START a new subject after N seconds (online runs must stay inside the job time limit)
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 640, height: 400 } }); const pageErrs = []; p.on('pageerror', (e) => pageErrs.push(String(e)));
await p.goto(url + (url.includes('?') ? '&' : '?') + 'oz_debug=1');
await p.waitForSelector('#loading-screen.fade-out', { state: 'attached', timeout: 170000 }); await p.waitForTimeout(2500);
const ap = await b.newPage(); // blank helper page: pixel maths + contact sheets only
// ---- subjects (what to walk round). dynamic ones (characters move) are located again for every single view
const subjects = await p.evaluate(({ only, lms }) => {
  const a = window.__opzero, S = [];
  // characters FIRST, and GOKU (the partner kills nearby zombies, run #1/sandbox: both zombie sheets were skipped "subject gone") is switched on only when his own turn comes
  if (only.includes('characters')) { S.push({ name: 'hero', ref: ['hero'], R: 3.0, ty: 0.9 }); (a.zombies.zombies || []).slice(0, 2).forEach((z, i) => S.push({ name: 'zombie-' + i, ref: ['zombie', i], R: 3.0, ty: 0.9 })); S.push({ name: 'goku', ref: ['goku'], R: 3.0, ty: 0.9 }); }
  if (only.includes('vehicles')) a.vehicles.vehicles.forEach((v, i) => { const d = v.model.dims; S.push({ name: 'vehicle-' + v.type, ref: ['vehicle', i], R: v.bike ? 3.4 : Math.max(4.6, d.length * 1.3), ty: d.height * 0.45 }); });
  if (only.includes('landmarks')) (a.world.city.landmarks || []).forEach((l, i) => { if (lms.includes(l.def.id)) { const H = l.def.floors * 3; S.push({ name: 'landmark-' + l.def.id, ref: ['landmark', i], R: Math.max(l.def.w || 20, l.def.d || 20) * 0.8 + H * 0.9 + 14, ty: H * 0.45 }); } });
  return S;
}, { only: ONLY, lms: LMS });
if (ONLY.includes('characters')) await p.evaluate(() => { const a = window.__opzero; a.hero.teleportTo(-14, 0.2, 17, 0); if (a.goku && a.goku.setEnabled) a.goku.setEnabled(false); });
const where = (ref) => p.evaluate((r) => { const a = window.__opzero; const wp = (o) => { o.updateWorldMatrix(true, false); const m = o.matrixWorld.elements; return [m[12], m[13], m[14]]; };
  if (r[0] === 'vehicle') { const v = a.vehicles.vehicles[r[1]]; return [v.pos.x, v.pos.y, v.pos.z]; }
  if (r[0] === 'hero') { const q = a.hero.position; return [q.x, q.y, q.z]; }
  if (r[0] === 'goku') { if (!a.goku.enabled) a.goku.setEnabled(true); const q = a.goku.pos; return [q.x, q.y, q.z]; } // his turn: switch him on next to the hero
  if (r[0] === 'zombie') { const z = a.zombies.zombies.filter((q) => q.state !== 'dead' && q.bones)[r[1]]; if (!z) return null; return wp(z.bones.Hips).map((v, i) => (i === 1 ? 0 : v)); } // zombies die/vanish while we walk round: null = skip
  const l = a.world.city.landmarks[r[1]]; return [l.x, 0, l.z]; }, ref);
const deg = (r) => (r * 180) / Math.PI;
const manifest = [];
for (const S of subjects) {
  if (NAMES && !NAMES.includes(S.name)) continue;
  if (MAXS && (Date.now() - T0) / 1000 > MAXS) { late.push(S.name); console.log(S.name + ' -> NOT_DONE (time budget ' + MAXS + ' s used up)'); continue; }
  const tiles = [];
  for (let k = 0; k <= ANG; k++) {
    const top = k === ANG, c = await where(S.ref); if (!c) { tiles.length = 0; break; } const tx = c[0], ty = c[1] + S.ty, tz = c[2];
    const el = (14 * Math.PI) / 180, az = (k * 2 * Math.PI) / ANG;
    const cam = top ? [tx, ty + S.R * 1.7, tz + 0.01] : [tx + S.R * Math.cos(el) * Math.sin(az), ty + S.R * Math.sin(el), tz + S.R * Math.cos(el) * Math.cos(az)];
    const fx = tx - cam[0], fy = ty - cam[1], fz = tz - cam[2], yaw = deg(Math.atan2(fx, fz)), pitch = deg(Math.atan2(fy, Math.hypot(fx, fz)));
    await p.evaluate(([x, y, z, yw, pt]) => window.__OZ_DEBUG.flyCamera(x, y, z, yw, pt), [cam[0], cam[1], cam[2], yaw, pitch]); await p.waitForTimeout(2300);
    const buf = await p.screenshot({ type: 'jpeg', quality: 72, timeout: 120000 }); const m = await ap.evaluate(analyze, { a: buf.toString('base64'), b: null });
    tiles.push({ label: top ? 'top' : Math.round((k * 360) / ANG) + ' deg', b64: buf.toString('base64'), m, flags: flagsOf(m) });
  }
  if (!tiles.length) { console.log(S.name + ' -> SKIPPED (subject gone: dead/removed while walking round)'); manifest.push({ subject: S.name, sheet: null, skipped: true, views: [] }); continue; }
  const sheet = await ap.evaluate(async (t) => { const cols = 3, rows = Math.ceil(t.length / cols), W = 320, H = 200, c = document.createElement('canvas'); c.width = cols * W; c.height = rows * H; const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < t.length; i++) { const img = new Image(); await new Promise((ok) => { img.onload = ok; img.src = 'data:image/jpeg;base64,' + t[i].b64; }); const gx = (i % cols) * W, gy = Math.floor(i / cols) * H; x.drawImage(img, gx, gy, W, H); x.font = '700 13px sans-serif'; x.lineWidth = 3; x.strokeStyle = '#000'; x.fillStyle = '#fff'; x.strokeText(t[i].label, gx + 6, gy + 16); x.fillText(t[i].label, gx + 6, gy + 16); }
    return c.toDataURL('image/jpeg', 0.82).split(',')[1]; }, tiles.map((q) => ({ label: q.label, b64: q.b64 })));
  const file = String(manifest.length + 1).padStart(2, '0') + '_' + S.name + '.jpg'; fs.writeFileSync(path.join(OUT, file), Buffer.from(sheet, 'base64'));
  manifest.push({ subject: S.name, sheet: file, views: tiles.map((q) => ({ view: q.label, flags: q.flags, entropy: q.m.entropy, edges: q.m.edgeDensity, contrast: q.m.contrast, brightness: q.m.lumaMean })) });
  console.log(S.name + ' -> ' + file + ' flags: ' + (tiles.flatMap((q) => q.flags.map((f) => q.label + ':' + f)).join(' ') || 'none'));
}
await p.evaluate(() => window.__OZ_DEBUG.releaseCamera());
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ time: new Date().toISOString(), views: ANG + 1, pageErrors: pageErrs, notDoneBecauseOfTimeBudget: late, manifest }, null, 1));
const md = ['# Turntable (har taraf se dekha)', '', `Har cheez ke gird ${ANG} angle + 1 top view. Pixel flags sirf "is tasveer ko dekho" hain (heuristic), bug ka faisla nahi. Software GL (SIMULATED).`, '', ...(late.length ? [`NOT_DONE (time budget): ${late.join(', ')}`, ''] : []), '| Subject | Contact sheet | Flagged views |', '|---|---|---|', ...manifest.map((m) => m.skipped ? `| ${m.subject} | (skipped - subject gone) | - |` : `| ${m.subject} | ![](${m.sheet}) | ${m.views.filter((v) => v.flags.length).map((v) => v.view + ': ' + v.flags.join('/')).join('; ') || '-'} |`), ''];
fs.writeFileSync(path.join(OUT, 'TURNTABLE.md'), md.join('\n')); await b.close();
