#!/usr/bin/env node
// Daily guard: decides whether the server must run the GOKU QA now. Your laptop/PC is NOT needed for this.
//   node scripts/daily_guard.mjs --meta reports/meta.json --event schedule|workflow_dispatch [--tz 5]
// Rules (day = Pakistan time, UTC+5):
//   manual run (workflow_dispatch)        -> RUN  (always)
//   no meta.json / unreadable meta        -> RUN  (fail-safe: better one extra run than a missed day)
//   meta says a complete run exists today -> SKIP (someone/something already ran today)
//   otherwise                             -> RUN  (last-hours fallback: the evening cron slot catches a day without a run)
// Prints RUN or SKIP + the reason; when $GITHUB_OUTPUT exists it also writes run=true|false. Test hook: GUARD_NOW=<ISO time>.
import fs from 'node:fs';
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const metaFile = opt('meta', 'reports/meta.json'), event = opt('event', process.env.GITHUB_EVENT_NAME || 'schedule'), tz = +opt('tz', 5);
const now = process.env.GUARD_NOW ? new Date(process.env.GUARD_NOW) : new Date();
const today = new Date(now.getTime() + tz * 3600000).toISOString().slice(0, 10);
let run, why;
if (event === 'workflow_dispatch') { run = true; why = 'manual run: always runs'; }
else {
  let meta = null; try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch (_) { /* missing or broken */ }
  if (!meta || typeof meta.lastRunDayPKT !== 'string') { run = true; why = 'no readable meta.json (first run or broken file): running to be safe'; }
  else if (meta.lastRunDayPKT === today) { run = false; why = `a complete run already exists for ${today} (${meta.trigger || '?'}, ${meta.lastRun || '?'})`; }
  else { run = true; why = `no run yet for ${today} (last run day: ${meta.lastRunDayPKT}): last-hours fallback`; }
}
console.log(`${run ? 'RUN' : 'SKIP'} — ${why}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
