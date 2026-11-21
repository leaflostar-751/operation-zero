// Tests: improvement N contains 1..N, replaces N-1, never loses or edits an old entry.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { addEntry, readArea, listFiles, problems, mustContain } from './improvement.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)); const T = fs.mkdtempSync(path.join(os.tmpdir(), 'impr-')); const R = path.join(T, 'improvements');
const res = []; const t = (name, ok, got) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' — ' + got); };
for (let i = 1; i <= 10; i++) addEntry(R, 'game', 'game change ' + i, { status: 'PASS', changed: 'src/a' + i + '.js', evidence: 'test ' + i, date: '2026-11-' + String(10 + i) });
addEntry(R, 'goku', 'goku change 1', { status: 'PARTIAL' });
const g = readArea(R, 'game'), files = listFiles(R, 'game').map((x) => path.basename(x.file));
t('after 10 improvements there is ONE file: improve-game-10.md', files.length === 1 && files[0] === 'improve-game-10.md', files.join(','));
t('improvement 10 contains improvements 1..10, newest first', JSON.stringify(g.entries.map((e) => e.n)) === JSON.stringify([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]), g.entries.map((e) => e.n).join(','));
t('goku list is separate: goku-1.md', listFiles(R, 'goku').length === 1 && readArea(R, 'goku').n === 1, 'goku=' + readArea(R, 'goku').n);
const before = fs.readFileSync(path.join(R, 'game', 'improve-game-10.md'), 'utf8'); const snap = path.join(T, 'old'); fs.cpSync(R, snap, { recursive: true });
addEntry(R, 'game', 'game change 11', { status: 'PASS' });
t('improvement 11 replaces 10 (10 is gone) and still holds 1..11', !fs.existsSync(path.join(R, 'game', 'improve-game-10.md')) && readArea(R, 'game').entries.length === 11, listFiles(R, 'game').map((x) => path.basename(x.file)).join(','));
t('old entries are byte-for-byte unchanged', mustContain(snap, R).length === 0, 'mustContain ok');
t('healthy folder has no problems', problems(R, 'game').length === 0 && problems(R, 'goku').length === 0, 'ok');
// a bad replacement must be caught
const bad = path.join(T, 'bad'); fs.cpSync(R, bad, { recursive: true }); const f = listFiles(bad, 'game')[0].file; fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('test 3', 'EDITED'));
t('an edited old entry is detected', mustContain(snap, bad).some((x) => /improvement 3 was changed/.test(x)), mustContain(snap, bad).join(';'));
const lost = path.join(T, 'lost'); fs.mkdirSync(path.join(lost, 'game'), { recursive: true }); fs.writeFileSync(path.join(lost, 'game', 'improve-game-11.md'), '## Improvement 11 — only the delta\n- Date: x\n');
t('a file holding only the newest delta (1..10 lost) is detected', mustContain(snap, lost).some((x) => /improvement 10 is missing/.test(x)), mustContain(snap, lost).length + ' problems');
t('cannot go back to a lower number', mustContain(R, snap).some((x) => /never go back/.test(x)), 'refused');
let msg = ''; try { fs.writeFileSync(path.join(R, 'game', 'improve-game-3.md'), '## Improvement 3 — stray\n'); addEntry(R, 'game', 'x'); } catch (e) { msg = e.message; }
t('two numbered files in one folder -> adding is refused', /must be exactly one/.test(msg), msg.slice(0, 80));
let rc = 0; try { execFileSync('node', [path.join(here, 'improvement.mjs'), 'check', '--root', R], { stdio: 'pipe' }); } catch (e) { rc = e.status; }
t('CLI check fails (exit 1) on that broken folder', rc === 1, 'exit ' + rc);
console.log(JSON.stringify({ passed: res.filter(Boolean).length, total: res.length })); process.exit(res.every(Boolean) ? 0 : 1);
