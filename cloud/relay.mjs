#!/usr/bin/env node
// Daily RELAY across free GPU services: tells you which service to use now, how many free hours are left, and what comes next.
// It does NOT start anything and has no passwords/keys: it only keeps a time log (cloud/relay.state.json, private, not committed).
//   node cloud/relay.mjs plan | status | next | start <id> | stop | exhausted <id> | add <id> "<name>" <day|week|month|total> <hours|?> <dailyCap>
// Test hooks: RELAY_NOW=<ISO time>  RELAY_STATE=<file>  RELAY_CONFIG=<file>
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = process.env.RELAY_CONFIG || path.join(here, 'relay.config.json'), statePath = process.env.RELAY_STATE || path.join(here, 'relay.state.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { sessions: [], exhausted: {} };
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 1));
const now = () => (process.env.RELAY_NOW ? new Date(process.env.RELAY_NOW) : new Date());
const TZ = (cfg.tzOffsetHours ?? 5) * 3600000, local = (d) => new Date(d.getTime() + TZ);
const dayStart = (d) => { const l = local(d); return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - TZ); };
const windowOf = (period, d) => {
  const ds = dayStart(d);
  if (period === 'day') return [ds, new Date(ds.getTime() + 864e5)];
  if (period === 'week') { const ws = new Date(ds.getTime() - ((local(d).getUTCDay() + 6) % 7) * 864e5); return [ws, new Date(ws.getTime() + 7 * 864e5)]; }
  if (period === 'month') { const l = local(d); return [new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - TZ), new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + 1, 1) - TZ)]; }
  return [new Date(0), new Date(8.64e15)];
};
const used = (id, [a, b]) => state.sessions.filter((s) => s.id === id).reduce((sum, s) => { const en = s.end ? new Date(s.end) : now(); return sum + Math.max(0, Math.min(en, b) - Math.max(new Date(s.start), a)) / 36e5; }, 0);
const calc = (s) => {
  const n = now(), pu = used(s.id, windowOf(s.period, n)), du = used(s.id, windowOf('day', n));
  const periodLeft = s.hours == null ? Infinity : Math.max(0, s.hours - pu), dayLeft = Math.max(0, Math.min((s.dailyCap ?? Infinity) - du, periodLeft));
  const ex = state.exhausted[s.id] === dayStart(n).toISOString(), streamOk = s.canStream !== 'no';
  return { s, pu, du, periodLeft, dayLeft, ex, usable: streamOk && !ex && dayLeft > 0.01 };
};
const h = (x) => (Number.isFinite(x) ? x.toFixed(1) + ' h' : '?');
const svc = (id) => cfg.services.find((s) => s.id === id);
const next = () => {
  const c = cfg.services.map(calc).find((x) => x.usable);
  if (c) console.log(`NEXT: ${c.s.id} — ${c.s.name} — aaj ${h(c.dayLeft)} baqi`);
  else console.log('NEXT: none — aaj ki sab free limits khatam. Kal tak intezar, ya mujhe naya service batayein (relay.mjs add ...).');
};
const [cmd, a1, a2, a3, a4, a5] = process.argv.slice(2);
if (cmd === 'plan') {
  console.log('Roz ka sequence (pehle upar wala, limit khatam to agla):');
  let total = 0, n = 0;
  for (const s of cfg.services) {
    if (s.canStream === 'no') { console.log(`  ✗  ${s.id.padEnd(9)} ${s.name} — istemal NAHI: ${s.verified}`); continue; }
    n++; total += s.dailyCap ?? 0;
    console.log(`  ${n}. ${s.id.padEnd(9)} ${s.name} — roz ${h(s.dailyCap)} (kul ${h(s.hours)}/${s.period}) — stream: ${s.canStream} — ${s.verified}`);
  }
  console.log(`Roz ka kul (agar sab chalein): ${h(total)}`);
} else if (cmd === 'status') {
  for (const s of cfg.services) { const c = calc(s); console.log(`${s.id.padEnd(9)} aaj ${h(c.du)} use, aaj baqi ${h(c.dayLeft)} | ${s.period}: ${h(c.pu)} use, baqi ${h(c.periodLeft)}${c.ex ? ' | AAJ KHATAM (aap ne bataya)' : ''}${s.canStream === 'no' ? ' | band' : ''}`); }
  next();
} else if (cmd === 'next') next();
else if (cmd === 'start') {
  const s = svc(a1); if (!s) { console.error('unknown service'); process.exit(2); }
  if (state.sessions.some((x) => !x.end)) { console.error('pehle `stop` karein: ek session khula hai'); process.exit(2); }
  const c = calc(s); if (!c.usable) { console.error(`${s.id} abhi usable nahi (band / aaj khatam / limit poori)`); process.exit(2); }
  state.sessions.push({ id: s.id, start: now().toISOString() }); save(); console.log(`START ${s.id}: aaj ${h(c.dayLeft)} baqi — khatam hone par \`stop\` zaroor karein`);
} else if (cmd === 'stop') {
  const o = state.sessions.find((x) => !x.end); if (!o) { console.error('koi session khula nahi'); process.exit(2); }
  o.end = now().toISOString(); save(); console.log(`STOP ${o.id}: ${((new Date(o.end) - new Date(o.start)) / 36e5).toFixed(2)} h use hue`); next();
} else if (cmd === 'exhausted') {
  if (!svc(a1)) { console.error('unknown service'); process.exit(2); }
  state.exhausted[a1] = dayStart(now()).toISOString(); save(); console.log(`${a1}: aaj ke liye khatam mark`); next();
} else if (cmd === 'add') {
  if (!a1 || !a2 || !['day', 'week', 'month', 'total'].includes(a3)) { console.error('usage: add <id> "<name>" <day|week|month|total> <hours|?> <dailyCap>'); process.exit(2); }
  cfg.services.push({ id: a1, name: a2, period: a3, hours: a4 === '?' ? null : +a4, dailyCap: +a5 || 1, canStream: 'unknown', verified: 'added by the user: check its terms before use' });
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2)); console.log('added ' + a1);
} else { console.log('usage: plan | status | next | start <id> | stop | exhausted <id> | add <id> "<name>" <period> <hours|?> <dailyCap>'); process.exit(cmd ? 2 : 0); }
