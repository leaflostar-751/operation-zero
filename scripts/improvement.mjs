#!/usr/bin/env node
// Cumulative improvement files. "Improvement N" contains improvements 1..N and REPLACES improvement N-1 (the old file is deleted).
//   node scripts/improvement.mjs add game|goku "<title>" --status PASS --changed "a.js,b.js" --evidence "..." [--commit abc123] [--unverified "..."] [--date YYYY-MM-DD] [--root improvements]
//   node scripts/improvement.mjs list game|goku [--root improvements]
//   node scripts/improvement.mjs check [--root improvements]       (one file per area, numbers 1..N with no gaps, file name = highest number)
// Files: <root>/game/improve-game-<N>.md   <root>/goku/goku-<N>.md   (newest entry first; older entries are copied byte-for-byte, never rewritten)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
export const AREAS = { game: { dir: 'game', prefix: 'improve-game', title: 'Improve game' }, goku: { dir: 'goku', prefix: 'goku', title: 'Goku' } };
const STATUS = ['PASS', 'PARTIAL', 'FAIL', 'BLOCKED', 'UNVERIFIED', 'NOT_IMPLEMENTED', 'NOT_POSSIBLE'];
const ENTRY = /^## Improvement (\d+) — /m;

export function listFiles(root, area) { // numbered files of one area, e.g. improve-game-9.md
  const a = AREAS[area], d = path.join(root, a.dir); if (!fs.existsSync(d)) return [];
  const re = new RegExp('^' + a.prefix + '-(\\d+)\\.md$');
  return fs.readdirSync(d).map((f) => ({ f, m: re.exec(f) })).filter((x) => x.m).map((x) => ({ n: +x.m[1], file: path.join(d, x.f) })).sort((p, q) => p.n - q.n);
}
export function parseEntries(text) { // -> [{ n, raw }] in file order (newest first)
  const parts = text.split(/^(?=## Improvement \d+ — )/m).filter((p) => ENTRY.test(p));
  return parts.map((raw) => ({ n: +ENTRY.exec(raw)[1], raw: raw.replace(/\s+$/, '') }));
}
export function readArea(root, area) {
  const files = listFiles(root, area); if (!files.length) return { n: 0, entries: [], files };
  const top = files[files.length - 1]; return { n: top.n, entries: parseEntries(fs.readFileSync(top.file, 'utf8')), files };
}
export function problems(root, area) { // [] = healthy
  const out = [], { n, entries, files } = readArea(root, area);
  if (files.length > 1) out.push(`${area}: ${files.length} numbered files (${files.map((x) => path.basename(x.file)).join(', ')}) — must be exactly one`);
  if (!files.length) return out;
  const nums = entries.map((e) => e.n); const want = Array.from({ length: n }, (_, i) => n - i);
  if (JSON.stringify(nums) !== JSON.stringify(want)) out.push(`${area}: file says ${n} but entries are [${nums.join(',')}] (expected ${want.join(',')})`);
  return out;
}
const one = (s) => String(s ?? '').replace(/\s*\n\s*/g, ' ').trim();
function render(area, n, entries) {
  const a = AREAS[area];
  return [`# ${a.title} ${n} — improvements 1 to ${n} (cumulative)`, '', `This file replaces "${a.title} ${n - 1}". Everything done so far is listed here, newest first. Older entries are copied unchanged.`, '', entries.map((e) => e.raw).join('\n\n'), ''].join('\n');
}
export function addEntry(root, area, title, o = {}) {
  const pr = problems(root, area); if (pr.length) throw new Error('refusing to add: ' + pr.join('; '));
  if (o.status && !STATUS.includes(o.status)) throw new Error('status must be one of ' + STATUS.join('/'));
  const cur = readArea(root, area), n = cur.n + 1;
  const raw = [`## Improvement ${n} — ${one(title)}`, `- Date: ${o.date || new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10)}`, `- Status: ${o.status || 'UNVERIFIED'}`,
    `- Changed: ${one(o.changed) || '-'}`, `- Evidence: ${one(o.evidence) || '-'}`, `- Commit/tag: ${one(o.commit) || '-'}`, `- Not verified: ${one(o.unverified) || '-'}`].join('\n');
  const entries = [{ n, raw }, ...cur.entries]; const a = AREAS[area], dir = path.join(root, a.dir); fs.mkdirSync(dir, { recursive: true });
  const next = path.join(dir, `${a.prefix}-${n}.md`); fs.writeFileSync(next + '.tmp', render(area, n, entries)); fs.renameSync(next + '.tmp', next);
  for (const f of cur.files) if (f.file !== next) fs.rmSync(f.file); // the old file is REPLACED
  return { n, file: next };
}
// old tree -> new tree: every old entry must still be there, byte for byte (used before the reports branch is replaced)
export function mustContain(oldRoot, newRoot) {
  const bad = [];
  for (const area of Object.keys(AREAS)) {
    const o = readArea(oldRoot, area); if (!o.n) continue; const nw = readArea(newRoot, area);
    if (nw.n < o.n) { bad.push(`${area}: new file is ${nw.n}, old was ${o.n} (it must never go back)`); continue; }
    for (const e of o.entries) { const f = nw.entries.find((x) => x.n === e.n); if (!f) bad.push(`${area}: improvement ${e.n} is missing in the new file`); else if (f.raw !== e.raw) bad.push(`${area}: improvement ${e.n} was changed`); }
  }
  return bad;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
  const root = opt('root', 'improvements'), [cmd, area, title] = argv;
  try {
    if (cmd === 'add') { if (!AREAS[area] || !title) throw new Error('usage: add game|goku "<title>" --status PASS --changed ... --evidence ...'); const r = addEntry(root, area, title, { status: opt('status'), changed: opt('changed'), evidence: opt('evidence'), commit: opt('commit'), unverified: opt('unverified'), date: opt('date') }); console.log(`${AREAS[area].title} ${r.n}: ${r.file} (contains 1..${r.n}; older file removed)`); }
    else if (cmd === 'list') { const { n, entries } = readArea(root, area); console.log(`${area}: ${n} improvements`); for (const e of entries) console.log(e.raw.split('\n')[0].replace('## ', '')); }
    else if (cmd === 'check') { const bad = Object.keys(AREAS).flatMap((a) => problems(root, a)); if (bad.length) { console.error(bad.join('\n')); process.exit(1); } console.log('OK ' + Object.keys(AREAS).map((a) => `${a}=${readArea(root, a).n}`).join(' ')); }
    else { console.error('usage: add | list | check'); process.exit(2); }
  } catch (e) { console.error('ERROR: ' + e.message); process.exit(2); }
}
