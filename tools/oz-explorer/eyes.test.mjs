// Unit test of the pixel checks with synthetic pictures (no game needed). Usage: node tools/oz-explorer/eyes.test.mjs
import { chromium } from 'playwright';
import { analyze, flagsOf } from './eyes.mjs';
const b = await chromium.launch(); const p = await b.newPage(); await p.goto('about:blank');
const make = (kind) => p.evaluate((k) => { const c = document.createElement('canvas'); c.width = 640; c.height = 400; const x = c.getContext('2d');
  if (k === 'black') { x.fillStyle = '#000'; x.fillRect(0, 0, 640, 400); }
  else if (k === 'white') { x.fillStyle = '#fff'; x.fillRect(0, 0, 640, 400); }
  else if (k === 'sky') { const g = x.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, '#6fa8ff'); g.addColorStop(1, '#bcd8ff'); x.fillStyle = g; x.fillRect(0, 0, 640, 400); }
  else { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 900; i++) { x.fillStyle = `hsl(${r() * 360},${40 + r() * 50}%,${15 + r() * 70}%)`; x.fillRect(r() * 640, r() * 400, 8 + r() * 70, 8 + r() * 50); } }
  return c.toDataURL('image/jpeg', 0.8).split(',')[1]; }, kind);
const img = { black: await make('black'), white: await make('white'), sky: await make('sky'), busy: await make('busy') };
const A = (a, bb) => p.evaluate(analyze, { a, b: bb || null });
const res = []; const t = (name, ok, got) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' — ' + got); };
const m = {}; for (const k of Object.keys(img)) m[k] = await A(img[k]);
t('black frame: too_dark + flat', flagsOf(m.black).includes('too_dark') && flagsOf(m.black).includes('flat_or_empty'), flagsOf(m.black).join(','));
t('white frame: too_bright + flat', flagsOf(m.white).includes('too_bright') && flagsOf(m.white).includes('flat_or_empty'), flagsOf(m.white).join(','));
t('empty sky gradient: flat/low detail/low contrast', ['low_detail', 'low_contrast'].every((f) => flagsOf(m.sky).includes(f)), flagsOf(m.sky).join(',') + ` entropy ${m.sky.entropy}`);
t('busy picture: no flags', flagsOf(m.busy).length === 0, JSON.stringify(m.busy));
const same = await A(img.busy, img.busy), diff = await A(img.busy, img.sky), bw = await A(img.black, img.white);
t('identical pictures: 0% changed', same.diff.changedPct === 0 && same.diff.meanAbs === 0, JSON.stringify(same.diff));
t('different pictures: big change', diff.diff.changedPct > 0.25, JSON.stringify(diff.diff));
t('black vs white: 100% changed', bw.diff.changedPct === 1, JSON.stringify(bw.diff));
console.log(JSON.stringify({ passed: res.filter(Boolean).length, total: res.length })); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
