// Logic test for relay.mjs with a fake clock (no network, no accounts).
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), st = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-')), 'state.json');
const run = (t, ...a) => { try { return execFileSync('node', [path.join(here, 'relay.mjs'), ...a], { env: { ...process.env, RELAY_NOW: t, RELAY_STATE: st }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return 'ERR ' + (e.stderr || e.message); } };
const res = []; const ok = (n, p, e) => { res.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + ' — ' + String(e).trim().split('\n').pop()); };
// PKT = UTC+5. Monday 2026-11-23 10:00 PKT = 05:00Z
ok('plan skips Colab and starts with modal', /1\. modal/.test(run('2026-11-23T05:00:00Z', 'plan')) && /✗  colab/.test(run('2026-11-23T05:00:00Z', 'plan')), 'plan ok');
ok('first service is modal', /NEXT: modal/.test(run('2026-11-23T05:00:00Z', 'next')), run('2026-11-23T05:00:00Z', 'next'));
run('2026-11-23T05:00:00Z', 'start', 'modal'); const s1 = run('2026-11-23T06:36:00Z', 'stop');
ok('after 1.6 h modal is used up for today -> kaggle next', /1\.60 h/.test(s1) && /NEXT: kaggle/.test(s1), s1);
ok('cannot start modal again today', /ERR/.test(run('2026-11-23T06:40:00Z', 'start', 'modal')), 'refused');
run('2026-11-23T06:40:00Z', 'start', 'kaggle'); const s2 = run('2026-11-23T11:00:00Z', 'stop');
ok('after 4.3 h kaggle -> lightning next', /NEXT: lightning/.test(s2), s2);
const s3 = run('2026-11-23T11:05:00Z', 'exhausted', 'lightning');
ok('user says lightning limit reached -> nothing left today', /NEXT: none/.test(s3), s3);
const d2 = run('2026-11-24T05:00:00Z', 'next');
ok('next day (PKT) the sequence restarts at modal', /NEXT: modal/.test(d2), d2);
const st2 = run('2026-11-24T05:00:00Z', 'status');
ok('weekly kaggle quota remembers yesterday (30 - 4.3 = ~25.7 h)', /kaggle.*week: 4\.\d h use, baqi 25\.\d h/.test(st2), (st2.match(/kaggle.*/) || [''])[0]);
const w2 = run('2026-11-30T05:00:00Z', 'status');
ok('new week (next Monday) resets kaggle', /kaggle.*week: 0\.0 h use, baqi 30\.0 h/.test(w2), (w2.match(/kaggle.*/) || [''])[0]);
const mid = run('2026-11-23T18:50:00Z', 'status'); // 23:50 PKT same day, still "today"
ok('11:50 pm PKT still counts as the same day', /modal\s+aaj 1\.6 h use/.test(mid), (mid.match(/modal.*/) || [''])[0]);
const nd = run('2026-11-23T19:10:00Z', 'status'); // 00:10 PKT next day
ok('after midnight PKT the day resets', /modal\s+aaj 0\.0 h use/.test(nd), (nd.match(/modal.*/) || [''])[0]);
console.log(JSON.stringify({ passed: res.filter(Boolean).length, total: res.length })); process.exit(res.every(Boolean) ? 0 : 1);
