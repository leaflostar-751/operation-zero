#!/usr/bin/env node
// Data-loss guard for REPLACE mode. Before the reports branch is replaced by a single new commit, the NEW content must still hold
// everything the OLD content had: improvement entries (byte for byte), ledger bugs, the GOKU trend and the daily calendar.
//   node scripts/verify_cumulative.mjs <old_dir> <new_dir>      exit 0 = safe to replace, exit 3 = REFUSE (nothing is pushed)
import fs from 'node:fs'; import path from 'node:path';
import { mustContain } from './improvement.mjs';
const [oldDir, newDir] = process.argv.slice(2);
if (!oldDir || !newDir) { console.error('usage: verify_cumulative.mjs <old_dir> <new_dir>'); process.exit(2); }
const rd = (d, f) => { try { return JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch (_) { return undefined; } };
const bad = [];
bad.push(...mustContain(path.join(oldDir, 'improvements'), path.join(newDir, 'improvements')));
const oL = rd(oldDir, 'ledger.json'), nL = rd(newDir, 'ledger.json');
if (Array.isArray(oL) && oL.length) { if (!Array.isArray(nL)) bad.push('ledger.json is missing in the new content'); else { const keys = new Set(nL.map((e) => e.key)); const lost = oL.filter((e) => !keys.has(e.key)); if (lost.length) bad.push(`ledger.json lost ${lost.length} bug entries`); } }
const oT = rd(oldDir, 'latest/goku/trend.json'), nT = rd(newDir, 'latest/goku/trend.json');
if (Array.isArray(oT) && oT.length) { if (!Array.isArray(nT)) bad.push('latest/goku/trend.json is missing in the new content'); else if (nT.length < Math.min(oT.length, 30)) bad.push(`GOKU trend shrank from ${oT.length} to ${nT.length} runs`); }
const oM = rd(oldDir, 'meta.json'), nM = rd(newDir, 'meta.json');
if (oM && oM.runNumber) { if (!nM) bad.push('meta.json is missing in the new content'); else { if ((nM.runNumber || 0) < oM.runNumber) bad.push(`meta.runNumber went back from ${oM.runNumber} to ${nM.runNumber}`); const od = Object.keys(oM.days || {}).length; if (Object.keys(nM.days || {}).length < Math.min(od, 60)) bad.push('the daily calendar in meta.json shrank'); } }
if (bad.length) { console.error('REFUSED (data would be lost):\n - ' + bad.join('\n - ')); process.exit(3); }
console.log('cumulative check OK: nothing is lost by replacing');
