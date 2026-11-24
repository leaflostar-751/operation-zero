// GOKU's MOTION check: how the hero and GOKU really move (walk / run / sprint / crouch-walk) and what happens when one clip blends into the next.
// Numbers are measured by driving the game's own animation clips frame by frame INSIDE the page (read-only, restores the pose it touched):
//   knee bend (wrong way, locked), leg-bone stretching, curved legs (knee sideways off the hip-ankle line), foot skating on the ground,
//   cadence, pelvis bob, forward lean, double-support / flight phase, left-right phase, and the biggest one-frame joint jump when clips blend ("pop").
// LIMITS (written into every report): clip only - foot IK and the weapon-hold IK that overrides the arms are NOT applied; vehicles are measured by another tool.
// Usage: node tools/oz-explorer/motion.mjs http://localhost:4173/ --out reports/latest/motion [--plant]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// runs INSIDE the game page: must stay self-contained
export const measureMotion = async (opt = {}) => {
  const a = window.__opzero, VC = a.camera.position.constructor, QC = a.camera.quaternion.constructor, V = (x = 0, y = 0, z = 0) => new VC(x, y, z);
  const r3 = (n) => Math.round(n * 1000) / 1000, deg = (r) => (r * 180) / Math.PI, med = (xs) => { if (!xs.length) return NaN; const s = [...xs].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  const wp = (o) => { o.updateWorldMatrix(true, false); return V().setFromMatrixPosition(o.matrixWorld); };
  const rigs = [];
  if (a.hero && a.hero.animController && a.hero.bones && a.hero.rootGroup) rigs.push({ who: 'hero', anim: a.hero.animController, B: a.hero.bones, root: a.hero.rootGroup });
  if (a.goku && a.goku.anim && a.goku.bones && a.goku.human) rigs.push({ who: 'goku', anim: a.goku.anim, B: a.goku.bones, root: a.goku.human.group });
  const AUTH = { walk: 1.85, run: 4.2, sprint: 6.8, 'crouch-walk': 1.35 };
  const DOMAIN = { walk: [0.2, 2.5], run: [2.0, 5.2], sprint: [4.6, 7.5], 'crouch-walk': [0.25, 1.8] }; // speeds each clip is used at (copied from AnimationController.update thresholds, STATIC)
  const DT = 1 / 60, out = { rigs: [], planted: null };
  for (const rig of rigs) {
    const { anim, B, root } = rig, mixer = anim.mixer, state0 = anim.currentState, SS = (anim.constructor && anim.constructor.SYNTH_SPEEDS) || {}, synth = !!(anim.constructor && anim.constructor.synthesized);
    const R = { who: rig.who, synthesized: synth, forwardOk: false, states: [], pops: [] };
    const setState = (s, fade = 0.01) => { anim.transitionTo(s, fade); };
    setState('idle'); mixer.update(0.05); root.updateWorldMatrix(true, true);
    // forward = where the shoes point (same method as reference.mjs; people are rigid-skinned, so the foot box comes from skinned vertices)
    const footBox = (foot) => { const mn = V(Infinity, Infinity, Infinity), mx = V(-Infinity, -Infinity, -Infinity), p = V(); root.updateWorldMatrix(true, true);
      root.traverse((m) => { if (!m.isMesh || !m.geometry) return; if (m.isSkinnedMesh && m.skeleton) { const idx = m.skeleton.bones.indexOf(foot); if (idx < 0) return; const gm = m.geometry, si = gm.attributes.skinIndex, sw = gm.attributes.skinWeight, ps = gm.attributes.position;
          for (let i = 0; i < si.count; i++) { if (si.getX(i) !== idx || sw.getX(i) < 0.5) continue; p.fromBufferAttribute(ps, i); m.applyBoneTransform(i, p); p.applyMatrix4(m.matrixWorld); mn.min(p); mx.max(p); } } });
      return { mn, mx }; };
    const toe = (foot) => { const bb = footBox(foot), f = wp(foot); return V((bb.mn.x + bb.mx.x) / 2 - f.x, 0, (bb.mn.z + bb.mx.z) / 2 - f.z); };
    let fw = V(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new QC()));
    try { const t2 = toe(B.LeftFoot).add(toe(B.RightFoot)); if (t2.length() > 0.02) { fw = t2.normalize(); R.forwardOk = true; } } catch (e) { /* keep the body-forward guess */ }
    const up = V(0, 1, 0), lat = up.clone().cross(fw).normalize(), rp = wp(root);
    const head = B.Head || B.Neck || B.Spine2 || B.Spine1 || B.Spine;
    const leg = (side) => ({ hip: B[side + 'UpLeg'], kn: B[side + 'Leg'], an: B[side + 'Foot'] });
    const L = leg('Left'), Rt = leg('Right');
    const lenOf = (x, y) => wp(x).distanceTo(wp(y));
    for (const s of ['walk', 'run', 'sprint', 'crouch-walk']) {
      if (!anim.actions.has(s)) continue;
      setState(s); mixer.update(0.05); const act = anim.currentAction; if (!act) continue; act.setEffectiveTimeScale(1);
      const dur = act.getClip().duration, ref = SS[s] || AUTH[s] || 1, N = Math.max(8, Math.round((2 * dur) / DT));
      const S = { thigh: [], shin: [], reach: [], flexL: [], flexR: [], wrong: 0, bow: 0, bob: [], lean: [], zL: [], zR: [], yL: [], yR: [] };
      const thighL0 = lenOf(L.hip, L.kn), shinL0 = lenOf(L.kn, L.an), legLen = thighL0 + shinL0;
      for (let i = 0; i < N; i++) {
        mixer.update(DT); root.updateWorldMatrix(true, true);
        const P = {}; for (const k of ['hip', 'kn', 'an']) { P['L' + k] = wp(L[k]); P['R' + k] = wp(Rt[k]); }
        for (const [sd, nm] of [['L', 'flexL'], ['R', 'flexR']]) {
          const hip = P[sd + 'hip'], kn = P[sd + 'kn'], an = P[sd + 'an'], th = hip.distanceTo(kn), sh = kn.distanceTo(an), fl = deg(kn.clone().sub(hip).angleTo(an.clone().sub(kn)));
          S.thigh.push(th); S.shin.push(sh); S.reach.push(hip.distanceTo(an) / (th + sh)); S[nm].push(fl);
          const mid = hip.clone().add(an).multiplyScalar(0.5), off = kn.clone().sub(mid), fo = off.dot(fw), lo = Math.abs(off.dot(lat));
          if (fl > 8 && fo < -0.01) S.wrong = Math.max(S.wrong, fl); S.bow = Math.max(S.bow, lo);
        }
        const hp = wp(B.Hips); S.bob.push(hp.y);
        if (head) { const d = wp(head).sub(hp); S.lean.push(deg(Math.atan2(d.dot(fw), d.y))); }
        const fl = wp(L.an), fr = wp(Rt.an); S.zL.push(fl.clone().sub(rp).dot(fw)); S.zR.push(fr.clone().sub(rp).dot(fw)); S.yL.push(fl.y); S.yR.push(fr.y);
      }
      const gy = Math.min(...S.yL, ...S.yR), thr = gy + 0.04, stL = S.yL.map((y) => y <= thr), stR = S.yR.map((y) => y <= thr);
      const slideSamples = []; for (const [z, st] of [[S.zL, stL], [S.zR, stR]]) for (let i = 0; i + 1 < N; i++) if (st[i] && st[i + 1]) slideSamples.push(-(z[i + 1] - z[i]) / DT);
      const sMed = med(slideSamples), matched = (v) => Math.min(1.75, Math.max(0.55, v / ref)), resid = (v) => Math.abs(sMed * matched(v) - v) / v; // foot speed in the stance phase scales with the playback speed the game picks for ground speed v
      let flight = 0, duty = 0, both = 0; for (let i = 0; i < N; i++) { if (!stL[i] && !stR[i]) flight++; if (stL[i] && stR[i]) both++; duty += (stL[i] ? 1 : 0) + (stR[i] ? 1 : 0); }
      const peak = (z) => z.indexOf(Math.max(...z)), cyc = Math.max(1, Math.round(dur / DT)), ph = Math.abs(((peak(S.zL.slice(0, cyc)) - peak(S.zR.slice(0, cyc))) % cyc + cyc) % cyc) / cyc;
      const mean = (xs) => xs.reduce((p, q) => p + q, 0) / xs.length, spread = (xs) => (Math.max(...xs) - Math.min(...xs)) / mean(xs);
      const [lo, hi] = DOMAIN[s];
      R.states.push({ state: s, duration: r3(dur), refSpeed: r3(ref), cadence: r3((2 * 60) / dur), kneeFlexMax: r3(Math.max(...S.flexL, ...S.flexR)), kneeFlexMin: r3(Math.min(...S.flexL, ...S.flexR)), kneeWrongWay: r3(S.wrong),
        legStretch: r3(Math.max(spread(S.thigh), spread(S.shin))), reachMax: r3(Math.max(...S.reach)), bow: r3(S.bow), bob: r3(Math.max(...S.bob) - Math.min(...S.bob)), lean: r3(mean(S.lean)), duty: r3(duty / (2 * N)), flight: r3(flight / N), doubleSupport: r3(both / N), phase: r3(Math.min(ph, 1 - ph)),
        stanceFootSpeed: r3(sMed), slideRef: r3(resid(ref)), slideLow: r3(resid(lo)), slideHigh: r3(resid(hi)), domain: [lo, hi], samples: N, stanceSamples: slideSamples.length });
    }
    // blends: the biggest one-frame turn of any joint while one clip fades into the next (a "pop" is the character snapping)
    const bones = Object.keys(B).map((k) => [k, B[k]]).filter(([, b]) => b && b.quaternion), prev = new Map(), qa = new QC(), pairs = [['idle', 'walk', 0.18], ['walk', 'run', 0.18], ['run', 'sprint', 0.18], ['sprint', 'run', 0.18], ['run', 'walk', 0.18], ['walk', 'idle', 0.18], ['idle', 'jump', 0.1], ['jump', 'fall', 0.18], ['fall', 'land', 0.18], ['land', 'idle', 0.18], ['idle', 'crouch', 0.18], ['crouch', 'crouch-walk', 0.18], ['idle', 'turn', 0.18]];
    for (const [f, t, fade] of pairs) {
      if (!anim.actions.has(f) || !anim.actions.has(t)) continue;
      setState(f); mixer.update(0.3); setState(t, fade); prev.clear(); for (const [k, b] of bones) prev.set(k, b.quaternion.clone());
      let worst = 0, wb = ''; for (let i = 0; i < Math.round((fade + 0.25) / DT); i++) { mixer.update(DT); for (const [k, b] of bones) { const d = deg(2 * Math.acos(Math.min(1, Math.abs(qa.copy(prev.get(k)).dot(b.quaternion))))); if (d > worst) { worst = d; wb = k; } prev.get(k).copy(b.quaternion); } }
      R.pops.push({ from: f, to: t, maxStepDeg: r3(worst), bone: wb });
    }
    if (opt.plant && rig.who === 'hero') { // faults planted in page memory (restored): thigh 30% longer, knee bent the wrong way
      const th = B.LeftUpLeg, s0 = th.scale.clone(); setState('walk'); mixer.update(0.05); const base = lenOf(L.hip, L.kn); th.scale.multiplyScalar(1.3); root.updateWorldMatrix(true, true); const grown = lenOf(L.hip, L.kn); th.scale.copy(s0);
      out.planted = { thighBefore: r3(base), thighAfter: r3(grown), stretch: r3((grown - base) / base) };
    }
    setState('idle'); mixer.update(0.2); setState(state0 || 'idle'); mixer.update(0.05); root.updateWorldMatrix(true, true);
    out.rigs.push(R);
  }
  return out;
};

// node side: rows of "game value vs typical real-world range"
export function compareMotion(m, refs) {
  const rows = [], num = Number.isFinite, M = refs.motion; if (!M) return rows;
  const add = (subject, what, game, range, basis, sev = 'Minor') => rows.push({ domain: 'motion', subject, what, game, range, basis, severity: sev, verdict: !num(game) ? 'NO_DATA' : game < range[0] || game > range[1] ? 'OUT_OF_RANGE' : 'IN_RANGE' });
  for (const r of m.rigs || []) {
    for (const st of r.states) {
      const P = M.perState[st.state], who = `${r.who} ${st.state}`; if (!P) continue;
      for (const [k, label, sev] of [['cadence', 'steps per minute', 'Minor'], ['kneeFlexMax', 'knee bend max (deg)', 'Minor'], ['bob', 'pelvis up-down travel (m)', 'Minor'], ['lean', 'trunk lean forward (deg)', 'Minor'], ['duty', 'share of time a foot is on the ground', 'Minor'], ['flight', 'share of time BOTH feet are in the air', 'Minor']]) add(who, label, st[k], P[k], M.basis, sev);
      add(who, 'knee bend min (deg, negative = hyper-extended)', st.kneeFlexMin, P.kneeFlexMin || M.kneeFlexMin, M.basis);
      add(who, 'knee bent the WRONG way (deg)', st.kneeWrongWay, [0, M.wrongWayDegreesTolerance], M.basis, 'Major');
      add(who, 'leg bone length change over the cycle (fraction)', st.legStretch, [0, M.legStretchMax], M.basis + ' (a rigid bone must not change length)', 'Major');
      add(who, 'hip-ankle / leg length (1.0 = knee locked straight)', st.reachMax, [0, M.reachMax], M.basis);
      add(who, 'knee sideways off the hip-ankle line (m) = curved / bow / knock-knee', st.bow, [0, M.bowMax], M.basis);
      add(who, 'left-right foot phase (0.5 = opposite)', st.phase, M.phase, M.basis);
      if (num(st.slideRef)) add(who, `foot skating at the clip's own speed ${st.refSpeed} m/s (fraction)`, st.slideRef, [0, M.slideRefMax], M.basis + ' (clip only, no foot IK)', 'Major');
      if (num(st.slideLow)) add(who, `foot skating at the slowest speed this clip is used (${st.domain[0]} m/s)`, st.slideLow, [0, M.slideEdgeMax], M.basis + ' (clip only, no foot IK)');
      if (num(st.slideHigh)) add(who, `foot skating at the fastest speed this clip is used (${st.domain[1]} m/s)`, st.slideHigh, [0, M.slideEdgeMax], M.basis + ' (clip only, no foot IK)');
    }
    for (const p of r.pops) add(`${r.who} blend ${p.from} -> ${p.to}`, `biggest one-frame joint turn (deg, bone ${p.bone})`, p.maxStepDeg, [0, M.popMaxDegPerStep], M.basis + ' (60 steps/s)', 'Major');
  }
  return rows;
}

export function summarizeMotion(rows) { const s = { IN_RANGE: 0, OUT_OF_RANGE: 0, NO_DATA: 0, major: 0, minor: 0 }; for (const r of rows) { s[r.verdict]++; if (r.verdict === 'OUT_OF_RANGE') s[r.severity === 'Major' ? 'major' : 'minor']++; } return s; }

export function motionMarkdown(m, rows, meta = {}) {
  const sum = summarizeMotion(rows), md = [`# Motion check (how the hero and GOKU really move)`, '', `Run ${meta.time || ''}. ${meta.render || 'SIMULATED (software GL)'}. ${rows.length} measurements: ${sum.IN_RANGE} in typical range, ${sum.OUT_OF_RANGE} outside (${sum.major} Major, ${sum.minor} Minor), ${sum.NO_DATA} no data.`, '',
    'Outside a range means "go and look at the pictures", not "bug": ranges are typical adult values (textbook biomechanics, ESTIMATE).', '',
    '**LIMITS:** clip only (the game also applies foot IK, and a weapon-hold IK that overrides the arms: NOT applied here); animation clips are procedural ("synthesized"); software GL; arms/hands, face, clothes clipping and vehicles are NOT in this report.', '',
    '| Who / clip | Measurement | Game | Typical range | Verdict |', '|---|---|---|---|---|'];
  for (const r of rows) md.push(`| ${r.subject} | ${r.what} | ${r.game} | ${r.range[0]}..${r.range[1]} | ${r.verdict}${r.verdict === 'OUT_OF_RANGE' ? ' (' + r.severity + ')' : ''} |`);
  md.push('', '## Raw numbers per clip', '```json', JSON.stringify(m.rigs.map((r) => ({ who: r.who, synthesized: r.synthesized, forwardOk: r.forwardOk, states: r.states, pops: r.pops })), null, 1), '```', '');
  return md.join('\n');
}

// command line
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const arg = process.argv.slice(2), url = arg.find((x) => /^https?:/.test(x)) || 'http://localhost:5173/', oi = arg.indexOf('--out'), OUT = oi >= 0 ? arg[oi + 1] : 'reports/motion', PLANT = arg.includes('--plant');
  const refs = JSON.parse(fs.readFileSync(new URL('../../goku_knowledge/references.json', import.meta.url), 'utf8'));
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'oz_debug=1'); await p.waitForSelector('#loading-screen.fade-out', { state: 'attached', timeout: 170000 }); await p.waitForTimeout(2500);
  const m = await p.evaluate(measureMotion, { plant: PLANT }); await b.close();
  const rows = compareMotion(m, refs); fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'motion.json'), JSON.stringify({ time: new Date().toISOString(), summary: summarizeMotion(rows), rows, raw: m, pageErrors: errs }, null, 1));
  fs.writeFileSync(path.join(OUT, 'MOTION.md'), motionMarkdown(m, rows, { time: new Date().toISOString() }));
  const s = summarizeMotion(rows); console.log(JSON.stringify({ status: errs.length ? 'FAIL' : 'DONE', measurements: rows.length, ...s, pageErrors: errs.length, planted: m.planted }));
  for (const r of rows.filter((x) => x.verdict === 'OUT_OF_RANGE')) console.log(`${r.severity.toUpperCase()} ${r.subject} | ${r.what}: ${r.game} (typical ${r.range[0]}..${r.range[1]})`);
}
