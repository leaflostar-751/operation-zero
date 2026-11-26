#!/usr/bin/env node
// Builds the pull-request comment of GOKU's gate from the files the gate job wrote:  node scripts/gate_summary.mjs <dir>
//   <dir>/unit.txt  (lines: "<file>: <last line of the unit test>"), <dir>/tests.txt (game tests), <dir>/motion/motion.json, <dir>/vehicles/vehicles.json
import fs from 'node:fs';
import path from 'node:path';
export function summarize(dir) {
  const rd = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch (_) { return null; } };
  const js = (f) => { try { return JSON.parse(rd(f)); } catch (_) { return null; } };
  const L = ['## GOKU gate (GitHub server: real Rapier physics, software GL = SIMULATED render)', ''];
  const unit = rd('unit.txt'), tests = rd('tests.txt'), mo = js('motion/motion.json'), ve = js('vehicles/vehicles.json');
  let bad = 0;
  const unitLines = unit ? unit.split('\n').filter(Boolean) : [];
  const unitFail = unitLines.filter((l) => { const m = l.match(/"passed":(\d+),"total":(\d+)/); return !m || m[1] !== m[2]; });
  bad += unitFail.length;
  L.push('| Check | Result |', '|---|---|', `| unit tests | ${unit === null ? 'NOT RUN' : unitFail.length ? 'FAIL: ' + unitFail.map((l) => l.split(':')[0]).join(', ') : `PASS (${unitLines.length} files)`} |`);
  if (tests === null) L.push('| game tests | NOT RUN |');
  else { const lines = tests.split('\n'), f = lines.filter((l) => /^FAIL\b/.test(l)), p = lines.filter((l) => /^PASS\b/.test(l)), u = lines.filter((l) => /^UNVERIFIED\b/.test(l)); bad += f.length;
    L.push(`| game tests (smoke, A0, partner, zombie pressure) | ${p.length} PASS, ${f.length} FAIL, ${u.length} UNVERIFIED |`); for (const l of f) L.push(`| ↳ ${l.slice(0, 110).replace(/\|/g, '/')} | FAIL |`); }
  const row = (name, o) => { if (!o) { L.push(`| ${name} | NOT RUN |`); return; } const s = o.summary || {}; L.push(`| ${name} | ${(o.rows || []).length} measurements: ${s.IN_RANGE} in range, ${s.major} Major, ${s.minor} Minor outside |`); };
  row('motion (hero + GOKU gait)', mo); row('vehicles (all-direction driving)', ve);
  const majors = [...((mo && mo.rows) || []), ...((ve && ve.rows) || [])].filter((r) => r.verdict === 'OUT_OF_RANGE' && r.severity === 'Major');
  if (majors.length) { L.push('', '**Major findings (look at these):**'); for (const r of majors.slice(0, 10)) L.push(`- ${r.subject}: ${r.what} = ${r.game} (typical ${r.range[0]}..${r.range[1]})`); if (majors.length > 10) L.push(`- ... and ${majors.length - 10} more (see the run's artifact)`); }
  L.push('', bad ? `**GATE: FAIL** (${bad} failing check${bad > 1 ? 's' : ''}). Do not merge until this is explained.` : '**GATE: PASS** for the checks above. UNVERIFIED: real GPU/phone fps, a person looking at the pictures. Merge is the owner\'s decision.', '');
  return { text: L.join('\n'), bad };
}
if (process.argv[1] && process.argv[1].endsWith('gate_summary.mjs')) { const r = summarize(process.argv[2] || 'gate'); process.stdout.write(r.text); }
