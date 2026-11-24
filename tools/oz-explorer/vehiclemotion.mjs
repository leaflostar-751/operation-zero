// GOKU's VEHICLE MOTION check: every car/bike is driven by the game's OWN drive() + updateFrame() code in a fixed 60 Hz loop (no render needed), in free space
// (collisions switched off while measuring, everything restored afterwards): accelerate, brake, reverse, left turn, right turn, handbrake slide.
// Measured: wheel spin direction and rolling (spin vs ground speed), front wheel steer sign / Ackermann / lock angle, body roll direction and size, nose up / down,
// wheel hub height vs ground (floating / sinking), straight-line drift, frame-to-frame speed jumps, lateral g, NaN.
// LIMITS: flat free space, no crashes / ramps / slopes / driver pose / camera (written into every report); the sandbox runs software GL (SIMULATED) but this logic does not depend on the GPU.
// Usage: node tools/oz-explorer/vehiclemotion.mjs http://localhost:4173/ --out reports/latest/vehicles
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// runs INSIDE the game page: must stay self-contained
export const measureVehicles = async () => {
  const a = window.__opzero, sys = a.vehicles, VC = a.camera.position.constructor, V = (x = 0, y = 0, z = 0) => new VC(x, y, z), DT = 1 / 60, G = 9.81;
  const deg = (r) => (r * 180) / Math.PI, r3 = (n) => Math.round(n * 1000) / 1000, med = (xs) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  const out = { vehicles: [] }, inp0 = { ...sys.input }, integ0 = sys.integrate, fx0 = sys.fx; let nan = false;
  sys.integrate = (v) => { v.pos.x += v.vel.x * DT; v.pos.z += v.vel.z * DT; v.speed = v.vel.dot(V(Math.sin(v.yaw), 0, Math.cos(v.yaw))); }; // free space: no walls
  sys.fx = { mark() {}, puff() {}, update() {} };
  for (const v of sys.vehicles) {
    const M = v.model, bike = !!v.bike, wheels = M.wheels, body = M.bodyGroup;
    const S = { pos: v.pos.clone(), prevPos: v.prevPos.clone(), yaw: v.yaw, prevYaw: v.prevYaw, vel: v.vel.clone(), speed: v.speed, steer: v.steer, roll: v.roll, pitch: v.pitch, lean: v.lean, yawRate: v.yawRate, accelSm: v.accelSm, wheelAngle: v.wheelAngle, braking: v.braking, driver: v.driver, hp: v.health,
      gy: v.group.rotation.y, gz: v.group.rotation.z, bx: body.rotation.x, bz: body.rotation.z, w: wheels.map((w) => [w.spin.rotation.x, w.pivot.rotation.y]), gp: v.group.position.clone() };
    const reset = (speed = 0, yaw = 0) => { v.pos.set(0, 0, 0); v.prevPos.copy(v.pos); v.yaw = yaw; v.prevYaw = yaw; v.vel.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(speed); v.speed = speed; v.steer = 0; v.roll = 0; v.pitch = 0; v.lean = 0; v.yawRate = 0; v.accelSm = 0; v.wheelAngle = 0; v.braking = false; v.driver = true; v.health = 100; };
    const rec = { n: 0, minHub: Infinity, maxHub: -Infinity, maxDv: 0, maxLatG: 0, maxPitchUp: -Infinity, maxPitchDown: -Infinity, maxRollOut: -Infinity, maxRollIn: -Infinity, maxSteerFront: 0, ackermann: -Infinity, spin: { fwd: [], rev: [] }, slip: [] };
    const pivots = wheels.filter((w) => w.steer);
    const hubs = () => wheels.map((w) => w.spin.getWorldPosition(V()));
    let prevR = null, hubOn = true;
    const ctl = { t: 0, b: 0, s: 0, h: false };
    const step = (note) => {
      sys.input.throttle = ctl.t; sys.input.brake = ctl.b; sys.input.steer = ctl.s; sys.input.hand = ctl.h; sys.input.nitro = false;
      const sp0 = v.speed, yaw0 = v.yaw; sys.drive(v, DT); sys.updateFrame(DT, 1); v.group.updateMatrixWorld(true);
      if (![v.pos.x, v.pos.z, v.speed, v.yaw, v.steer, v.roll, v.pitch].every(Number.isFinite)) nan = true;
      rec.n++; rec.maxDv = Math.max(rec.maxDv, Math.abs(v.speed - sp0));
      if (hubOn) { const hy = hubs().map((h, i) => h.y - wheels[i].radius); rec.minHub = Math.min(rec.minHub, ...hy); rec.maxHub = Math.max(rec.maxHub, ...hy); }
      rec.maxLatG = Math.max(rec.maxLatG, Math.abs(v.yawRate * v.speed) / G);
      // body tilt in world terms: heights of the left / right and front / rear edges of the body
      const hw = (v.model.dims.width || 1.8) / 2, hl = (v.model.dims.length || 4) / 2; body.updateWorldMatrix(true, false);
      const yL = body.localToWorld(V(hw, 0.5, 0)).y, yR = body.localToWorld(V(-hw, 0.5, 0)).y, yF = body.localToWorld(V(0, 0.5, hl)).y, yB = body.localToWorld(V(0, 0.5, -hl)).y;
      const sideTilt = deg(Math.atan2(yL - yR, 2 * hw)), noseUp = deg(Math.atan2(yF - yB, 2 * hl)); // +x is the vehicle's LEFT; sideTilt > 0 = left side up
      return { sideTilt, noseUp, yawRate: v.yawRate, speed: v.speed };
    };
    const spinProbe = (key) => { // direction + rate of the wheels' rotation between two frames (rim point relative to the hub)
      const pts = wheels.map((w) => { const h = w.spin.getWorldPosition(V()); return { h, p: w.spin.localToWorld(V(0, w.radius, 0)).sub(h) }; });
      if (prevR) { const L = V(Math.cos(v.yaw), 0, -Math.sin(v.yaw)); pts.forEach((q, i) => { const cr = prevR[i].clone().cross(q.p), ang = Math.asin(Math.min(1, cr.length() / (prevR[i].length() * q.p.length() || 1))) / DT; if (Math.abs(v.speed) > 1) rec.spin[key].push({ sign: Math.sign(cr.dot(L)) * Math.sign(v.speed), ratio: (ang * wheels[i].radius) / Math.abs(v.speed) }); }); }
      prevR = pts.map((q) => q.p);
    };
    const tiltAt = { acc: [], brk: [] };
    // A: accelerate in a straight line
    reset(); ctl.t = 1; ctl.b = 0; ctl.s = 0; ctl.h = false; let t100 = NaN;
    for (let i = 0; i < 360; i++) { const r = step(); spinProbe('fwd'); if (i > 20) tiltAt.acc.push(r.noseUp); if (!Number.isFinite(t100) && v.speed >= 27.78) t100 = (i + 1) * DT; }
    const drift = Math.abs(v.pos.x), vTop = v.speed;
    // B: full brake from there
    ctl.t = 0; ctl.b = 1; let rise = 0, maxDec = 0, spb = v.speed; prevR = null; // holding the brake after the stop reverses on purpose (one key = brake + reverse, arcade); what must NOT happen is speed RISING while the vehicle is still rolling forward
    for (let i = 0; i < 360; i++) { const r = step(); if (i > 5 && i < 40) tiltAt.brk.push(r.noseUp); if (spb > 0.5 && v.speed > spb + 1e-6) rise = Math.max(rise, v.speed - spb); maxDec = Math.max(maxDec, (spb - v.speed) / DT); spb = v.speed; }
    // C: reverse from standstill
    reset(); ctl.t = 0; ctl.b = 1; prevR = null; for (let i = 0; i < 240; i++) { step(); spinProbe('rev'); } const vRev = v.speed;
    hubOn = !bike; // a leaning bike moves its hubs by design
    // D/E: left and right turn at the same speed
    const turn = (dir, speed) => { reset(speed); ctl.t = 0.35; ctl.b = 0; ctl.s = dir; ctl.h = false; const o = { yawSign: 0, tilt: [], pivL: 0, pivR: 0, yawRate: 0 }; prevR = null;
      for (let i = 0; i < 150; i++) { const r = step(); if (i > 40) o.tilt.push(r.sideTilt); }
      o.yawRate = v.yawRate; o.yawSign = Math.sign(v.yawRate); const pv = pivots.map((w) => [w.side, deg(w.pivot.rotation.y)]); o.pivots = pv; o.steerDeg = pv.length ? Math.max(...pv.map(([, d]) => Math.abs(d))) : 0;
      const inner = pv.find(([sd]) => sd === (dir < 0 ? 1 : -1)), outer = pv.find(([sd]) => sd === (dir < 0 ? -1 : 1)); // steer input -1 = left: inner wheel is the +x (left) one
      o.ackermann = inner && outer && pv.length === 2 ? Math.abs(inner[1]) - Math.abs(outer[1]) : NaN; o.frontSign = pv.length ? Math.sign(pv[0][1]) : 0; o.lean = v.lean; o.roll = v.roll; return o; };
    const spd = Math.min(14, v.tune.vmax * 0.35), L = turn(-1, spd), Rt = turn(1, spd), LL = turn(-1, 2.5), RL = turn(1, 2.5); // LL / RL = parking speed: full lock
    // F: handbrake slide
    reset(Math.min(22, v.tune.vmax * 0.5)); ctl.t = 0; ctl.b = 0; ctl.s = 1; ctl.h = true; let slip = 0, yrMax = 0; for (let i = 0; i < 100; i++) { step(); const ang = Math.abs(Math.atan2(v.vel.dot(V(Math.cos(v.yaw), 0, -Math.sin(v.yaw))), Math.max(0.5, Math.abs(v.vel.dot(V(Math.sin(v.yaw), 0, Math.cos(v.yaw))))))); slip = Math.max(slip, deg(ang)); yrMax = Math.max(yrMax, Math.abs(v.yawRate)); }
    const mean = (xs) => (xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : NaN);
    const tiltL = mean(L.tilt), tiltR = mean(Rt.tilt); // left turn: the OUTER side is the right one, so a car that leans outward has its right side DOWN = sideTilt > 0 (left up)
    const outward = (tiltL - tiltR) / 2; // + = body leans OUTWARD in the turn (right for a car), - = leans INTO the turn (right for a bike)
    out.vehicles.push({ type: v.type, name: v.info && v.info.name, kind: bike ? 'bike' : 'car', wheelCount: wheels.length, frontSteered: pivots.length, wheelRadius: r3(wheels[0].radius), vmax: v.tune.vmax, mu: v.tune.mu,
      t100: r3(t100), topSpeedReached: r3(vTop), straightDrift: r3(drift), noseUpAccel: r3(mean(tiltAt.acc)), noseDownBrake: r3(-mean(tiltAt.brk)), brakeSpeedRise: r3(rise), maxDecelG: r3(maxDec / G), reverseSpeed: r3(vRev),
      spinSignFwd: rec.spin.fwd.length ? r3(mean(rec.spin.fwd.map((q) => (q.sign > 0 ? 1 : 0)))) : NaN, spinSignRev: rec.spin.rev.length ? r3(mean(rec.spin.rev.map((q) => (q.sign > 0 ? 1 : 0)))) : NaN, rollingRatio: r3(med(rec.spin.fwd.map((q) => q.ratio))),
      leftTurnYawSign: L.yawSign, rightTurnYawSign: Rt.yawSign, frontWheelSignMatchesTurn: L.frontSign === L.yawSign && Rt.frontSign === Rt.yawSign, steerLockDeg: r3(Math.max(LL.steerDeg, RL.steerDeg)), steerAtSpeedDeg: r3(Math.max(L.steerDeg, Rt.steerDeg)), ackermannDeg: r3(mean([LL.ackermann, RL.ackermann].filter(Number.isFinite))),
      rollOutwardDeg: r3(outward), rollSymmetry: r3(Math.abs(Math.abs(tiltL) - Math.abs(tiltR))), maxLateralG: r3(rec.maxLatG), hubHeightErrorMin: r3(rec.minHub), hubHeightErrorMax: r3(rec.maxHub), maxSpeedStepPerFrame: r3(rec.maxDv), handbrakeSlipDeg: r3(slip), handbrakeYawRateMax: r3(yrMax), nan });
    // restore everything
    v.pos.copy(S.pos); v.prevPos.copy(S.prevPos); v.yaw = S.yaw; v.prevYaw = S.prevYaw; v.vel.copy(S.vel); v.speed = S.speed; v.steer = S.steer; v.roll = S.roll; v.pitch = S.pitch; v.lean = S.lean; v.yawRate = S.yawRate; v.accelSm = S.accelSm; v.wheelAngle = S.wheelAngle; v.braking = S.braking; v.driver = S.driver; v.health = S.hp;
    v.group.rotation.y = S.gy; v.group.rotation.z = S.gz; body.rotation.x = S.bx; body.rotation.z = S.bz; v.group.position.copy(S.gp); wheels.forEach((w, i) => { w.spin.rotation.x = S.w[i][0]; w.pivot.rotation.y = S.w[i][1]; }); v.syncPhysics();
  }
  sys.integrate = integ0; sys.fx = fx0; Object.assign(sys.input, inp0);
  return out;
};

// node side
export function compareVehicles(m, refs) {
  const rows = [], num = Number.isFinite, R = refs.vehicleMotion; if (!R) return rows;
  const add = (v, what, game, range, sev = 'Minor', basis = R.basis) => rows.push({ domain: 'vehicle-motion', subject: `${v.name || v.type} (${v.kind})`, what, game, range, basis, severity: sev, verdict: !num(game) ? 'NO_DATA' : game < range[0] || game > range[1] ? 'OUT_OF_RANGE' : 'IN_RANGE' });
  for (const v of m.vehicles || []) {
    const bike = v.kind === 'bike', K = bike ? R.bike : R.car, one = [1, 1];
    add(v, 'any NaN / broken number while driving (0 = none)', v.nan ? 1 : 0, [0, 0], 'Major');
    add(v, 'wheels turn the right way when going FORWARD (share of samples)', v.spinSignFwd, one, 'Major');
    add(v, 'wheels turn the right way when going in REVERSE (share of samples)', v.spinSignRev, one, 'Major');
    add(v, 'wheel spin vs ground speed (1.0 = rolls without slipping)', v.rollingRatio, R.rollingRatio);
    add(v, 'left input turns the vehicle left, right input turns it right (1 = yes)', v.leftTurnYawSign === 1 && v.rightTurnYawSign === -1 ? 1 : 0, one, 'Major');
    add(v, 'front wheel(s) point the way the vehicle turns (1 = yes)', v.frontWheelSignMatchesTurn ? 1 : 0, one, 'Major');
    add(v, 'front wheel steer angle at full lock, parking speed (deg)', v.steerLockDeg, K.steerLockDeg);
    add(v, 'front wheel steer angle at 14 m/s (deg): less lock at speed', v.steerAtSpeedDeg, [1, 35]);
    if (!bike && v.frontSteered === 2) add(v, 'Ackermann: inner wheel turns more than the outer by (deg)', v.ackermannDeg, R.ackermannDeg);
    add(v, bike ? 'lean INTO the turn (deg, + = into the turn)' : 'body roll OUTWARD in a turn (deg, + = outward like a real car, - = leans into the turn like a bike)', bike ? -v.rollOutwardDeg : v.rollOutwardDeg, K.rollDeg, bike ? 'Minor' : 'Major');
    add(v, 'roll left-turn vs right-turn size difference (deg)', v.rollSymmetry, [0, R.rollSymmetryMax]);
    add(v, 'nose UP when accelerating (deg)', v.noseUpAccel, K.noseUpAccel);
    add(v, 'nose DOWN when braking (deg)', v.noseDownBrake, K.noseDownBrake);
    add(v, 'lowest wheel hub minus wheel radius = wheel sunk into the ground (m)', v.hubHeightErrorMin, [-R.hubTol, R.hubTol], 'Major');
    add(v, 'highest wheel hub minus wheel radius = wheel floating (m)', v.hubHeightErrorMax, [-R.hubTol, R.hubTol], 'Major');
    add(v, 'straight line drift with no steering after 6 s (m)', v.straightDrift, [0, R.driftMax], 'Major');
    add(v, 'speed RISES while braking and still rolling forward (m/s)', v.brakeSpeedRise, [0, 0.01], 'Major');
    add(v, 'strongest braking (g)', v.maxDecelG, [0, R.brakeG], 'Minor');
    add(v, 'biggest speed jump in one 1/60 s frame (m/s)', v.maxSpeedStepPerFrame, [0, R.speedStepMax], 'Major');
    add(v, 'sideways acceleration in turns (g)', v.maxLateralG, [0, (v.mu || 1) * R.latGFactor]);
    add(v, 'handbrake slide angle (deg)', v.handbrakeSlipDeg, K.slipDeg);
  }
  return rows;
}
export function summarizeVehicles(rows) { const s = { IN_RANGE: 0, OUT_OF_RANGE: 0, NO_DATA: 0, major: 0, minor: 0 }; for (const r of rows) { s[r.verdict]++; if (r.verdict === 'OUT_OF_RANGE') s[r.severity === 'Major' ? 'major' : 'minor']++; } return s; }
export function vehiclesMarkdown(m, rows, meta = {}) {
  const sum = summarizeVehicles(rows), md = ['# Vehicle motion check (driving forward, reverse, turning, braking, handbrake)', '', `Run ${meta.time || ''}. ${rows.length} measurements: ${sum.IN_RANGE} in typical range, ${sum.OUT_OF_RANGE} outside (${sum.major} Major, ${sum.minor} Minor), ${sum.NO_DATA} no data.`, '',
    'The game\'s own drive() and updateFrame() ran in a 60 Hz loop in free space (collisions off while measuring). **LIMITS:** flat free space only - NO crashes, ramps, slopes, curbs, driver pose, camera, doors or suspension per wheel; ranges are typical values for a class (ESTIMATE).', '',
    '| Vehicle | Measurement | Game | Typical range | Verdict |', '|---|---|---|---|---|'];
  for (const r of rows) md.push(`| ${r.subject} | ${r.what} | ${r.game} | ${r.range[0]}..${r.range[1]} | ${r.verdict}${r.verdict === 'OUT_OF_RANGE' ? ' (' + r.severity + ')' : ''} |`);
  md.push('', '## Raw numbers', '```json', JSON.stringify(m.vehicles, null, 1), '```', ''); return md.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const arg = process.argv.slice(2), url = arg.find((x) => /^https?:/.test(x)) || 'http://localhost:5173/', oi = arg.indexOf('--out'), OUT = oi >= 0 ? arg[oi + 1] : 'reports/vehicles';
  const refs = JSON.parse(fs.readFileSync(new URL('../../goku_knowledge/references.json', import.meta.url), 'utf8'));
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage({ viewport: { width: 640, height: 400 } }); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'oz_debug=1'); await p.waitForSelector('#loading-screen.fade-out', { state: 'attached', timeout: 170000 }); await p.waitForTimeout(2500);
  const m = await p.evaluate(measureVehicles); await b.close();
  const rows = compareVehicles(m, refs); fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'vehicles.json'), JSON.stringify({ time: new Date().toISOString(), summary: summarizeVehicles(rows), rows, raw: m, pageErrors: errs }, null, 1));
  fs.writeFileSync(path.join(OUT, 'VEHICLES.md'), vehiclesMarkdown(m, rows, { time: new Date().toISOString() }));
  console.log(JSON.stringify({ status: errs.length ? 'FAIL' : 'DONE', measurements: rows.length, ...summarizeVehicles(rows), pageErrors: errs.length }));
  for (const r of rows.filter((x) => x.verdict === 'OUT_OF_RANGE')) console.log(`${r.severity.toUpperCase()} ${r.subject} | ${r.what}: ${r.game} (typical ${r.range[0]}..${r.range[1]})`);
}
