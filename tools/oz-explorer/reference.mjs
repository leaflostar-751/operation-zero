// GOKU's real-world reference check: measures what the game really contains (vehicle dimensions, character skeleton proportions,
// joint bending of GOKU's own animation clips, building storey heights) and compares it with goku_knowledge/references.json.
// measure() runs INSIDE the game page (read-only, restores everything it touches), so it must stay self-contained.
export const measure = async (opt = {}) => {
  const a = window.__opzero, VC = a.camera.position.constructor, V = (x = 0, y = 0, z = 0) => new VC(x, y, z);
  const r3 = (n) => Math.round(n * 1000) / 1000, deg = (r) => (r * 180) / Math.PI;
  const out = { vehicles: [], humans: [], joints: [], buildings: null, landmarks: [], feet: [], forwardOk: false };
  const veh = (v) => { const d = v.model.dims; return { type: v.type, name: v.info && v.info.name, kind: v.info && v.info.kind, length: r3(d.length), width: r3(d.width), height: r3(d.height), wheelRadius: r3(d.wheelRadius), wheelbase: r3(d.wheelbase) }; };
  for (const v of a.vehicles.vehicles) out.vehicles.push(veh(v));
  const wp = (o) => { o.updateWorldMatrix(true, false); return V().setFromMatrixPosition(o.matrixWorld); };
  const bbox = (root) => { root.updateWorldMatrix(true, true); const mn = V(Infinity, Infinity, Infinity), mx = V(-Infinity, -Infinity, -Infinity), p = V();
    root.traverse((m) => { if (!m.isMesh || !m.geometry) return; const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox; if (!bb) return;
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { p.set(x, y, z).applyMatrix4(m.matrixWorld); mn.min(p); mx.max(p); } });
    return { mn, mx }; };
  const human = (who, root, B) => {
    const bb = bbox(root), H = bb.mx.y - bb.mn.y, P = {}; for (const k of Object.keys(B)) P[k] = wp(B[k]); const d = (p, q) => p.distanceTo(q);
    // limb lengths = sum of the bone segments (does NOT change when the arm/leg is bent, unlike the straight distance shoulder-wrist)
    const aL = d(P.LeftArm, P.LeftForeArm) + d(P.LeftForeArm, P.LeftHand), aR = d(P.RightArm, P.RightForeArm) + d(P.RightForeArm, P.RightHand);
    const lL = d(P.LeftUpLeg, P.LeftLeg) + d(P.LeftLeg, P.LeftFoot), lR = d(P.RightUpLeg, P.RightLeg) + d(P.RightLeg, P.RightFoot);
    return { who, height: r3(H), legRatio: r3((lL + lR) / 2 / H), armRatio: r3((aL + aR) / 2 / H), shoulderRatio: r3(d(P.LeftArm, P.RightArm) / H), armAsym: r3(Math.abs(aL - aR) / ((aL + aR) / 2)), legAsym: r3(Math.abs(lL - lR) / ((lL + lR) / 2)) };
  };
  const g = a.goku;
  if (a.hero && a.hero.rootGroup && a.hero.bones) out.humans.push(human('hero', a.hero.rootGroup, a.hero.bones));
  let gokuDone = false; // GOKU is measured in its idle pose (set below) so a bent leg never fakes a wrong proportion
  ((a.zombies && a.zombies.zombies) || []).slice(0, 6).forEach((z, i) => { if (z.bones && (z.human || z.root)) out.humans.push(human('zombie' + i, (z.human && z.human.group) || z.root, z.bones)); });
  // joints: drive GOKU's own animation clips and read where the knees / elbows go ("forward" = where the shoes point)
  let legBend = null, armBend = null;
  if (g && g.anim && g.bones && g.anim.mixer && g.human) {
    const B = g.bones, root = g.human.group, mixer = g.anim.mixer, state0 = g.anim.currentState; let fw = V(0, 0, 1);
    g.anim.transitionTo('idle', 0.01); mixer.update(0.05); root.updateWorldMatrix(true, true);
    const toe = (foot) => { const bb = bbox(foot), f = wp(foot); return V((bb.mn.x + bb.mx.x) / 2 - f.x, 0, (bb.mn.z + bb.mx.z) / 2 - f.z); };
    const t2 = toe(B.LeftFoot).add(toe(B.RightFoot)); out.forwardOk = t2.length() > 0.02; if (out.forwardOk) fw = t2.normalize();
    legBend = (side) => { const hip = wp(B[side + 'UpLeg']), kn = wp(B[side + 'Leg']), an = wp(B[side + 'Foot']); const fl = deg(kn.clone().sub(hip).angleTo(an.clone().sub(kn))); const off = kn.clone().sub(hip.clone().add(an).multiplyScalar(0.5)).dot(fw); return { fl, off, wrong: fl > 8 && off < -0.01 }; };
    armBend = (side) => { const sh = wp(B[side + 'Arm']), el = wp(B[side + 'ForeArm']), wr = wp(B[side + 'Hand']); const fl = deg(el.clone().sub(sh).angleTo(wr.clone().sub(el))); const off = el.clone().sub(sh.clone().add(wr).multiplyScalar(0.5)).dot(fw); return { fl, off, wrong: fl > 8 && off > 0.01 }; };
    for (const s of ['idle', 'walk', 'run', 'sprint', 'crouch', 'crouch-walk', 'jump', 'fall', 'land', 'turn']) {
      if (!g.anim.actions.has(s)) continue; g.anim.transitionTo(s, 0.01); let kM = 0, eM = 0, kW = 0, eW = 0;
      for (let i = 0; i < 40; i++) { mixer.update(1 / 30); root.updateWorldMatrix(true, true);
        for (const side of ['Left', 'Right']) { const k = legBend(side), e = armBend(side); kM = Math.max(kM, k.fl); eM = Math.max(eM, e.fl); if (k.wrong) kW = Math.max(kW, k.fl); if (e.wrong) eW = Math.max(eW, e.fl); } }
      out.joints.push({ state: s, kneeFlexMax: r3(kM), kneeWrongWay: r3(kW), elbowFlexMax: r3(eM), elbowWrongWay: r3(eW) });
    }
    g.anim.transitionTo('idle', 0.01); mixer.update(0.2); root.updateWorldMatrix(true, true); out.humans.push(human('goku', root, B)); gokuDone = true;
    g.anim.transitionTo(state0 || 'idle', 0.01); mixer.update(0.05);
    if (opt.plant) { // planted faults (page memory only, restored): a knee bent both ways, a 2.6 m hero, a car with 0.9 m wheels
      const L = B.LeftLeg, r0 = L.rotation.x, res = {}; g.anim.transitionTo('idle', 0.01); mixer.update(0.05);
      L.rotation.x = r0 + 1.0; root.updateWorldMatrix(true, true); res.kneePlus = legBend('Left'); L.rotation.x = r0 - 1.0; root.updateWorldMatrix(true, true); res.kneeMinus = legBend('Left'); L.rotation.x = r0; root.updateWorldMatrix(true, true);
      const hr = a.hero.rootGroup, s0 = hr.scale.x; hr.scale.setScalar(s0 * 1.45); res.tallHero = human('hero-planted', hr, a.hero.bones); hr.scale.setScalar(s0);
      const v0 = a.vehicles.vehicles[0], w0 = v0.model.dims.wheelRadius; v0.model.dims.wheelRadius = 0.9; res.bigWheel = veh(v0); v0.model.dims.wheelRadius = w0;
      out.planted = res;
    }
  }
  if (!gokuDone && g && g.human && g.bones) out.humans.push(human('goku', g.human.group, g.bones));
  // feet vs ground: the lowest foot/toe bone must sit within a few cm of the ground the character stands on (floating / sunk check). Moving, jumping, falling and dead characters are skipped
  const feetOf = (who, B, groundY) => { let lo = Infinity; for (const [n, bn] of Object.entries(B || {})) if (/Foot|Toe/i.test(n) && bn && bn.updateWorldMatrix) lo = Math.min(lo, wp(bn).y); if (Number.isFinite(lo)) out.feet.push({ who, lowestFootClearance: r3(lo - groundY) }); };
  if (a.hero && a.hero.bones && a.hero.isGrounded !== false && a.hero.position) feetOf('hero', a.hero.bones, a.hero.position.y);
  if (g && g.bones && g.pos) feetOf('goku', g.bones, g.pos.y);
  ((a.zombies && a.zombies.zombies) || []).slice(0, 6).forEach((z, i) => { if (z.bones && z.root && ['idle', 'wander', 'chase', 'attack'].includes(z.state)) feetOf('zombie' + i, z.bones, z.root.position.y); });
  const bl = (a.world.city.buildingList || []).filter((b) => b.floors > 0);
  if (bl.length) { const st = bl.map((b) => b.h / b.floors); out.buildings = { count: bl.length, storeyMin: r3(Math.min(...st)), storeyMax: r3(Math.max(...st)), floorsMax: Math.max(...bl.map((b) => b.floors)) }; }
  for (const lm of a.world.city.landmarks || []) { const def = lm.def || {}; if (!(def.floors >= 2) || !lm.group) continue; const bb = bbox(lm.group), H = bb.mx.y - bb.mn.y; if (Number.isFinite(H)) out.landmarks.push({ id: def.id, kind: def.kind, floors: def.floors, height: r3(H), storey: r3(H / def.floors) }); }
  return out;
};

// node side: rows of "game value vs real-world range"
export function compare(m, refs) {
  const rows = []; const num = Number.isFinite;
  const add = (domain, subject, what, game, range, basis, sev = 'Minor') => rows.push({ domain, subject, what, game, range, basis, severity: sev, verdict: !num(game) ? 'NO_DATA' : game < range[0] || game > range[1] ? 'OUT_OF_RANGE' : 'IN_RANGE' });
  for (const v of m.vehicles || []) {
    const cls = refs.vehicleClassOf[v.type], c = refs.vehicleClasses[cls]; if (!c) { add('vehicle', v.name || v.type, 'class', NaN, [0, 0], 'no reference class for this vehicle'); continue; }
    for (const k of ['length', 'width', 'height', 'wheelbase', 'wheelRadius']) add('vehicle', `${v.name} (${cls})`, `${k} (m)`, v[k], c[k], refs.basis.vehicle);
    for (const mdl of (refs.models || []).filter((x) => x.type === v.type)) for (const k of ['length', 'width', 'height', 'wheelbase', 'wheelRadius']) if (Number.isFinite(mdl[k])) add('vehicle-vs-real-model', `${v.name} vs ${mdl.realName}`, `${k} (m)`, v[k], [+(mdl[k] * 0.97).toFixed(3), +(mdl[k] * 1.03).toFixed(3)], 'exact real model spec, +-3% (' + (mdl.source || 'source not given') + ')');
    const R = refs.vehicleRatios[v.kind === 'bike' ? 'bike' : 'car'];
    for (const [k, [n, d]] of Object.entries({ 'wheelbase/length': ['wheelbase', 'length'], 'width/length': ['width', 'length'], 'height/length': ['height', 'length'] })) add('vehicle', `${v.name} (${cls})`, k, +(v[n] / v[d]).toFixed(3), R[k], refs.basis.vehicle);
  }
  const H = refs.human;
  for (const h of m.humans || []) {
    if (h.who === 'hero' || h.who === 'goku') for (const k of ['height', 'legRatio', 'armRatio', 'shoulderRatio']) add('human', h.who, k, h[k], H[k], refs.basis.human);
    for (const k of ['armAsym', 'legAsym']) add('human', h.who, k + ' (left vs right limb length)', h[k], [0, H.asymmetryMax], refs.basis.human);
  }
  for (const j of m.joints || []) {
    add('joints', 'GOKU clip ' + j.state, 'knee flexion max (deg)', j.kneeFlexMax, [0, refs.joints.kneeFlexMax], refs.basis.joints);
    add('joints', 'GOKU clip ' + j.state, 'elbow flexion max (deg)', j.elbowFlexMax, [0, refs.joints.elbowFlexMax], refs.basis.joints);
    add('joints', 'GOKU clip ' + j.state, 'knee bent the WRONG way (deg)', j.kneeWrongWay, [0, refs.joints.wrongWayDegreesTolerance], refs.basis.joints, 'Major');
    add('joints', 'GOKU clip ' + j.state, 'elbow bent the WRONG way (deg)', j.elbowWrongWay, [0, refs.joints.wrongWayDegreesTolerance], refs.basis.joints, 'Major');
  }
  for (const f of m.feet || []) add('ground-contact', f.who, 'lowest foot above ground (m)', f.lowestFootClearance, refs.groundContact.lowestFootClearance, refs.basis.ground, 'Major');
  if (m.buildings) { add('building', `${m.buildings.count} houses/blocks`, 'storey height min (m)', m.buildings.storeyMin, refs.building.storeyHeight, refs.basis.building); add('building', `${m.buildings.count} houses/blocks`, 'storey height max (m)', m.buildings.storeyMax, refs.building.storeyHeight, refs.basis.building); }
  for (const l of m.landmarks || []) { add('building', `${l.id} (${l.kind}, ${l.floors} floors)`, 'storey height APPROX (m)', l.storey, refs.building.landmarkStoreyApprox, refs.basis.building); rows[rows.length - 1].approx = true; }
  return rows;
}
export const summarize = (rows) => { const s = {}; for (const r of rows) { const d = (s[r.domain] = s[r.domain] || { IN_RANGE: 0, OUT_OF_RANGE: 0, NO_DATA: 0 }); d[r.verdict]++; } return s; };
