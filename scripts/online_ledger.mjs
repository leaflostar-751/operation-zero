#!/usr/bin/env node
// GOKU's online scoreboard: how many minutes GOKU really ran on the server, how many runs, and what he did (daily / deep / gate).
//   node scripts/online_ledger.mjs add --dir reports --minutes 15.5 --mode daily --run 45245695382 [--day 2026-11-24]
// Writes reports/online.json (cumulative, kept between runs because the reports folder is restored from the `reports` branch) and reports/ONLINE.md.
// HONEST: minutes are wall-clock minutes of the QA job; "fixes written by GOKU himself" stays 0 (NOT_IMPLEMENTED), fixes are written by Claude and VERIFIED by GOKU.
import fs from 'node:fs';
import path from 'node:path';
const argv = process.argv.slice(2), cmd = argv[0], opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
export function addRun(data, { minutes, mode, run, day }) {
  const d = data && data.version === 1 ? data : { version: 1, totalMinutes: 0, runs: 0, byMode: {}, days: {}, history: [] };
  const m = Math.max(0, Number(minutes) || 0), md = ['daily', 'deep', 'gate', 'manual'].includes(mode) ? mode : 'manual';
  if (run && d.history.some((h) => String(h.run) === String(run))) return d; // same run twice: never double count
  d.totalMinutes = Math.round((d.totalMinutes + m) * 10) / 10; d.runs += 1;
  d.byMode[md] = { runs: ((d.byMode[md] || {}).runs || 0) + 1, minutes: Math.round((((d.byMode[md] || {}).minutes || 0) + m) * 10) / 10 };
  const k = day || new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
  d.days[k] = { runs: ((d.days[k] || {}).runs || 0) + 1, minutes: Math.round((((d.days[k] || {}).minutes || 0) + m) * 10) / 10 };
  d.history.push({ run: run || null, mode: md, minutes: m, day: k }); if (d.history.length > 200) d.history = d.history.slice(-200);
  return d;
}
export function markdown(d) {
  const L = ['# GOKU online scoreboard (server minutes, honest)', '', `**Total online: ${d.totalMinutes} min (${(d.totalMinutes / 60).toFixed(2)} h) in ${d.runs} run(s).**`, '',
    '| Kind | Runs | Minutes |', '|---|---|---|', ...Object.entries(d.byMode).map(([k, v]) => `| ${k} | ${v.runs} | ${v.minutes} |`), '', '| Day (Pakistan) | Runs | Minutes |', '|---|---|---|',
    ...Object.entries(d.days).sort().reverse().slice(0, 30).map(([k, v]) => `| ${k} | ${v.runs} | ${v.minutes} |`), '',
    'Minutes = wall-clock time of the server job. This counts WORK on the server, not idle hours.', 'Fixes written by GOKU himself: **0** (NOT_IMPLEMENTED: he cannot edit code). Fixes are written by Claude on a branch and VERIFIED by GOKU with the same test before/after.', ''];
  return L.join('\n');
}
if (process.argv[1] && process.argv[1].endsWith('online_ledger.mjs') && cmd === 'add') {
  const dir = opt('dir', 'reports'), f = path.join(dir, 'online.json'); let cur = null; try { cur = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { /* first run */ }
  const d = addRun(cur, { minutes: opt('minutes', 0), mode: opt('mode', 'manual'), run: opt('run', ''), day: opt('day', '') });
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 1)); fs.writeFileSync(path.join(dir, 'ONLINE.md'), markdown(d));
  console.log(`online total ${d.totalMinutes} min in ${d.runs} run(s)`);
}
