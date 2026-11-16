// Headless boot smoke test + screenshot.  Usage:  node tests/smoke.mjs http://localhost:5173/ [out.png]
// Needs: npm i -D playwright && npx playwright install chromium   (run on the owner's PC)
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:5173/', out = process.argv[3] || 'tests/smoke.png';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
let status = 'PASS', note = '';
try {
  await p.goto(url); await p.waitForSelector('#loading-screen.fade-out', { timeout: 170000 });
  await p.waitForTimeout(3000);
  const t0 = await p.evaluate(() => window.__opzero?.hero?.position?.x);
  if (t0 === undefined) { status = 'FAIL'; note = 'hero missing'; }
  await p.screenshot({ path: out });
} catch (e) { status = 'FAIL'; note = String(e); }
if (errs.length) { status = 'FAIL'; note += ' console errors: ' + JSON.stringify(errs); }
console.log(JSON.stringify({ status, note, errors: errs.length, screenshot: out }));
await b.close(); process.exit(status === 'PASS' ? 0 : 1);
