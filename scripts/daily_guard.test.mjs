// Logic test for daily_guard.mjs with a fake clock and fake meta files (no network).
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')), meta = path.join(dir, 'meta.json');
const guard = (now, event, out) => { try { return execFileSync('node', [path.join(here, 'daily_guard.mjs'), '--meta', meta, '--event', event], { env: { ...process.env, GUARD_NOW: now, GITHUB_OUTPUT: out || '' }, encoding: 'utf8' }).trim(); } catch (e) { return 'ERR ' + e.message; } };
const res = []; const t = (name, ok, got) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' — ' + got); };
// PKT = UTC+5. 2026-11-21 19:17 PKT = 14:17Z
let g = guard('2026-11-21T14:17:00Z', 'schedule'); t('no meta.json yet -> RUN (fail-safe)', /^RUN/.test(g), g);
fs.writeFileSync(meta, '{ broken'); g = guard('2026-11-21T14:17:00Z', 'schedule'); t('broken meta.json -> RUN, no crash', /^RUN/.test(g), g);
fs.writeFileSync(meta, JSON.stringify({ lastRunDayPKT: '2026-11-20', trigger: 'schedule', lastRun: '2026-11-20T14:20:00Z' }));
g = guard('2026-11-21T14:17:00Z', 'schedule'); t('last run was yesterday, evening slot -> RUN (last-hours fallback)', /^RUN/.test(g) && /last-hours/.test(g), g);
fs.writeFileSync(meta, JSON.stringify({ lastRunDayPKT: '2026-11-21', trigger: 'workflow_dispatch', lastRun: '2026-11-21T04:00:00Z' }));
g = guard('2026-11-21T14:17:00Z', 'schedule'); t('you already ran it today (e.g. from phone) -> SKIP', /^SKIP/.test(g), g);
g = guard('2026-11-21T16:47:00Z', 'schedule'); t('second evening slot, run exists -> SKIP', /^SKIP/.test(g), g);
g = guard('2026-11-21T14:17:00Z', 'workflow_dispatch'); t('manual run always RUNs even if today is done', /^RUN/.test(g), g);
g = guard('2026-11-21T18:30:00Z', 'schedule'); t('23:30 PKT is still the same day -> SKIP', /^SKIP/.test(g), g);
g = guard('2026-11-21T19:30:00Z', 'schedule'); t('00:30 PKT next day is a NEW day -> RUN', /^RUN/.test(g), g);
const out = path.join(dir, 'gh_output'); guard('2026-11-21T19:30:00Z', 'schedule', out); const o1 = fs.readFileSync(out, 'utf8');
guard('2026-11-21T14:17:00Z', 'schedule', out); const o2 = fs.readFileSync(out, 'utf8');
t('writes run=true / run=false to $GITHUB_OUTPUT', /run=true/.test(o1) && /run=false/.test(o2), JSON.stringify(o2));
// simulate a 5-day laptop-off stretch: every evening the guard must say RUN exactly once per day if the run records its day
let runs = 0; fs.rmSync(meta, { force: true });
for (let d = 21; d < 26; d++) for (const hhmm of ['14:17', '16:47']) { const when = `2026-11-${d}T${hhmm}:00Z`; if (/^RUN/.test(guard(when, 'schedule'))) { runs++; fs.writeFileSync(meta, JSON.stringify({ lastRunDayPKT: new Date(new Date(when).getTime() + 5 * 3600000).toISOString().slice(0, 10), trigger: 'schedule' })); } }
t('laptop off 5 days, 2 evening slots/day -> exactly 5 server runs', runs === 5, runs + ' runs');
console.log(JSON.stringify({ passed: res.filter(Boolean).length, total: res.length })); process.exit(res.every(Boolean) ? 0 : 1);
