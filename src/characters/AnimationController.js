import * as THREE from 'three';

export const ANIM_STATES = {
  IDLE: 'idle',
  WALK: 'walk',
  RUN: 'run',
  SPRINT: 'sprint',
  JUMP: 'jump',
  FALL: 'fall',
  LAND: 'land',
  CROUCH: 'crouch',
  CROUCH_WALK: 'crouch-walk',
  TURN: 'turn'
};

// Ground speed (m/s) each locomotion clip was authored for; playback is scaled to match
const AUTHORED_SPEEDS = {
  walk: 1.85,
  run: 4.2,
  sprint: 6.8,
  'crouch-walk': 1.35
};

const stripPrefix = (name) => name.replace(/^mixamorig:?/i, '').toLowerCase();

export class AnimationController {
  constructor(characterRoot, bonesMap) {
    this.root = characterRoot;
    this.bones = bonesMap;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = new Map();
    this.currentState = null;
    this.currentAction = null;

    this.landTimer = 0;
    this.wasAirborne = false;
    this.peakFallSpeed = 0;

    // Lookup of the skeleton's real bone names for Mixamo retargeting
    this.boneNameLookup = new Map();
    this.root.traverse((obj) => {
      if (obj.isBone) this.boneNameLookup.set(stripPrefix(obj.name), obj.name);
    });
  }

  /**
   * Retargets a Mixamo FBX/GLB clip onto this skeleton:
   *  - renames tracks to the hero's real bone names (mixamorig: / mixamorig prefixes)
   *  - drops position tracks of every bone except Hips (prevents limb stretching)
   *  - fixes cm-vs-m hip height by comparing with the hero's rest hip height
   *  - locks hip X/Z so the physics capsule alone drives world movement
   */
  registerClip(stateName, clip, loopOnce = false) {
    if (!clip) return;

    const hips = this.bones.Hips;
    const restX = hips ? hips.position.x : 0;
    const restY = hips ? hips.position.y : 0;
    const restZ = hips ? hips.position.z : 0;
    let hasHipsPosition = false;

    const validTracks = [];
    for (const track of clip.tracks) {
      const dotIdx = track.name.lastIndexOf('.');
      if (dotIdx === -1) continue;

      const rawNodeName = track.name.substring(0, dotIdx);
      const property = track.name.substring(dotIdx + 1);
      const cleanKey = stripPrefix(rawNodeName.split('|').pop());

      const targetBoneName = this.boneNameLookup.get(cleanKey);
      if (!targetBoneName) continue; // bone not in this skeleton (fingers, etc.)
      track.name = `${targetBoneName}.${property}`;

      if (property === 'scale') continue;

      if (property === 'position') {
        if (cleanKey !== 'hips') continue;
        hasHipsPosition = true;

        const values = track.values;
        let scale = 1;
        if (restY > 1e-4 && Math.abs(values[1]) > 1e-4) {
          // nearest power of ten between clip units and hero units (cm <-> m)
          scale = Math.pow(10, Math.round(Math.log10(restY / Math.abs(values[1]))));
        } else if (Math.abs(values[1]) > 10) {
          scale = 0.01;
        }
        for (let i = 0; i < values.length; i += 3) {
          values[i] = restX;
          values[i + 1] = values[i + 1] * scale;
          values[i + 2] = restZ;
        }
      }

      validTracks.push(track);
    }

    // Foot IK adjusts hip height every step; make sure the clip always rewrites it,
    // otherwise the adjustment would accumulate.
    if (hips && !hasHipsPosition) {
      validTracks.push(
        new THREE.VectorKeyframeTrack(`${hips.name}.position`, [0], [restX, restY, restZ])
      );
    }

    clip.tracks = validTracks;

    const action = this.mixer.clipAction(clip);
    if (loopOnce) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    this.actions.set(stateName, action);
  }

  transitionTo(nextState, fadeDuration = 0.18) {
    if (this.currentState === nextState) return;
    const nextAction = this.actions.get(nextState);
    if (!nextAction) return;

    const oneShot =
      nextState === ANIM_STATES.JUMP ||
      nextState === ANIM_STATES.LAND ||
      nextState === ANIM_STATES.TURN;

    nextAction.enabled = true;
    if (oneShot) nextAction.reset();
    nextAction.setEffectiveWeight(1.0);

    if (this.currentAction) {
      this.currentAction.crossFadeTo(nextAction, fadeDuration, false);
    }
    nextAction.play();

    this.currentState = nextState;
    this.currentAction = nextAction;
  }

  /**
   * @param info.horizontalSpeed smoothed ground speed (m/s)
   * @param info.airTime         seconds continuously not grounded (debounced; autostep on
   *                             stairs flickers `grounded` for a frame or two)
   */
  update(dt, info) {
    const {
      horizontalSpeed,
      airTime,
      verticalVelocity,
      isCrouching,
      isSprinting,
      justJumped,
      yawDelta,
      forwardSpeed = horizontalSpeed
    } = info;

    if (this.landTimer > 0) this.landTimer -= dt;

    const airborne = justJumped || airTime > 0.12;
    const cur = this.currentState;
    let target;

    if (airborne) {
      this.wasAirborne = true;
      this.peakFallSpeed = Math.max(this.peakFallSpeed, -verticalVelocity);
      target = verticalVelocity > 1.0 ? ANIM_STATES.JUMP : ANIM_STATES.FALL;
    } else {
      if (this.wasAirborne) {
        // just touched down: only play the landing for a real fall, not a hop off a stair
        this.wasAirborne = false;
        if (this.peakFallSpeed > 3.5) this.landTimer = 0.3;
        this.peakFallSpeed = 0;
      }

      if (this.landTimer > 0 && horizontalSpeed < 1.5) {
        target = ANIM_STATES.LAND;
      } else if (isCrouching) {
        const thr = cur === ANIM_STATES.CROUCH_WALK ? 0.1 : 0.25;
        target = horizontalSpeed > thr ? ANIM_STATES.CROUCH_WALK : ANIM_STATES.CROUCH;
      } else if (isSprinting && horizontalSpeed > (cur === ANIM_STATES.SPRINT ? 4.6 : 5.2)) {
        target = ANIM_STATES.SPRINT;
      } else if (horizontalSpeed > (cur === ANIM_STATES.RUN ? 2.0 : 2.5)) {
        target = ANIM_STATES.RUN;
      } else if (horizontalSpeed > (cur === ANIM_STATES.WALK ? 0.1 : 0.2)) {
        target = ANIM_STATES.WALK;
      } else if (Math.abs(yawDelta) > 1.0) {
        target = ANIM_STATES.TURN;
      } else {
        target = ANIM_STATES.IDLE;
      }
    }

    this.transitionTo(target, target === ANIM_STATES.JUMP ? 0.1 : 0.18);

    // Speed-matched playback so feet never skate
    if (this.currentAction) {
      const ref = (AnimationController.synthesized && AnimationController.SYNTH_SPEEDS[this.currentState]) || AUTHORED_SPEEDS[this.currentState];
      if (ref) {
        const matched = THREE.MathUtils.clamp(horizontalSpeed / ref, 0.55, 1.75);
        // moving backwards relative to the body: play the walk/run clip in reverse so the legs
        // swing the right way (fixes the documented backward aim-strafe foot skating)
        const backwards = forwardSpeed < -0.35 * Math.max(horizontalSpeed, 0.01) && horizontalSpeed > 0.3
          && (this.currentState === ANIM_STATES.WALK || this.currentState === ANIM_STATES.RUN || this.currentState === ANIM_STATES.SPRINT);
        this.currentAction.setEffectiveTimeScale(backwards ? -matched : matched);
      } else {
        this.currentAction.setEffectiveTimeScale(1.0);
      }
    }

    this.mixer.update(dt);
  }

  /**
   * Procedural keyframes on the Mixamo-named skeleton, used only for animation files that
   * are not present yet. Rotations are absolute, so they are meant for the built-in
   * fallback rig (identity rest pose), not for a real Mixamo T-pose hero.
   */
  static createSynthesizedMixamoClips(bones) {
    AnimationController.synthesized = true;
    const clips = {};
    const fps = 30;

    const buildLoopClip = (name, duration, poseFn) => {
      const steps = Math.max(2, Math.floor(duration * fps));
      const times = [];
      for (let i = 0; i <= steps; i++) {
        times.push((i / steps) * duration);
      }

      const boneRotations = {};
      const hipsY = [];

      for (const t of times) {
        const phase = (t / duration) * Math.PI * 2;
        const pose = poseFn(phase);
        hipsY.push(pose.hipsY ?? 0.96);

        for (const [boneKey, eulerArr] of Object.entries(pose.rotations)) {
          if (!boneRotations[boneKey]) boneRotations[boneKey] = [];
          const q = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(eulerArr[0], eulerArr[1], eulerArr[2])
          );
          boneRotations[boneKey].push(q.x, q.y, q.z, q.w);
        }
      }

      const tracks = [];
      if (bones.Hips) {
        const posValues = [];
        for (const y of hipsY) {
          posValues.push(bones.Hips.position.x, y, bones.Hips.position.z);
        }
        tracks.push(new THREE.VectorKeyframeTrack(`${bones.Hips.name}.position`, times, posValues));
      }

      for (const [boneKey, quatValues] of Object.entries(boneRotations)) {
        const bone = bones[boneKey];
        if (bone) {
          tracks.push(
            new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, quatValues)
          );
        }
      }

      return new THREE.AnimationClip(name, duration, tracks);
    };

    clips.idle = buildLoopClip('idle', 2.4, (p) => ({
      hipsY: 0.96 + Math.sin(p) * 0.012,
      rotations: {
        Spine: [0.03 + Math.sin(p) * 0.02, 0, 0],
        LeftArm: [0.05, 0, 0.14],
        RightArm: [0.05, 0, -0.14],
        LeftUpLeg: [-0.04, 0, 0],
        RightUpLeg: [-0.04, 0, 0],
        LeftLeg: [0.08, 0, 0],
        RightLeg: [0.08, 0, 0]
      }
    }));

    // ---- physically grounded gait --------------------------------------------------------------
    // Foot targets are laid out in hip space (stance: foot slides back at ground speed, swing: lifted arc)
    // and solved with a 2-bone IK, so a stance foot always touches the ground and the legs never split.
    const L1 = 0.43, L2 = 0.42, ANKLE = 0.05, HIP_OFF = 0.06; // matches the built-in rig
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const legIK = (xf, yd) => {
      const D = clamp(Math.hypot(xf, yd), 0.2, (L1 + L2) * 0.999);
      const phi = Math.atan2(xf, yd);
      const beta = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
      const k = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
      return { t: phi + beta, k }; // t: thigh angle forward of vertical, k: knee flexion
    };
    const ease = (s) => s * s * (3 - 2 * s);
    const gait = (c) => (p) => {
      const u0 = p / (Math.PI * 2);
      const uPeak = c.peak === 'flight' ? (c.duty + 0.5) / 2 : c.duty / 2;
      const Hj = c.Hbase + c.bob * Math.cos(4 * Math.PI * (u0 - uPeak));
      const leg = (u) => {
        u = ((u % 1) + 1) % 1;
        let x, lift = 0;
        if (u < c.duty) x = c.xf + (c.xb - c.xf) * (u / c.duty);
        else { const sw = (u - c.duty) / (1 - c.duty); x = c.xb + (c.xf - c.xb) * ease(sw); lift = c.lift * Math.sin(Math.PI * sw); }
        const ik = legIK(x, Hj - ANKLE - lift);
        return { x, ...ik };
      };
      const Lg = leg(u0), Rg = leg(u0 + 0.5);
      const amp = (c.xf - c.xb) / 2;
      const rot = {
        Spine: [c.lean, Math.sin(p) * c.twist, 0],
        LeftUpLeg: [-Lg.t, 0, 0], RightUpLeg: [-Rg.t, 0, 0],
        LeftLeg: [Lg.k, 0, 0], RightLeg: [Rg.k, 0, 0],
        LeftFoot: [(Lg.t - Lg.k) * 0.85, 0, 0], RightFoot: [(Rg.t - Rg.k) * 0.85, 0, 0],
        // arms counter-swing: forward when the opposite leg is forward
        LeftArm: [c.arm * (Lg.x - (c.xf + c.xb) / 2) / amp, 0, c.armZ], RightArm: [c.arm * (Rg.x - (c.xf + c.xb) / 2) / amp, 0, -c.armZ]
      };
      if (c.fore) { rot.LeftForeArm = [-c.fore, 0, 0]; rot.RightForeArm = [-c.fore, 0, 0]; }
      return { hipsY: Hj + HIP_OFF, rotations: rot };
    };
    // reference ground speed of each clip = stance travel / stance time (used by the speed matcher)
    const GAITS = {
      walk:   { duration: 0.95, duty: 0.62, xf: 0.40, xb: -0.46, lift: 0.09, Hbase: 0.845, bob: 0.028, peak: 'stance', lean: 0.05, twist: 0.06, arm: 0.30, armZ: 0.12 },
      run:    { duration: 0.72, duty: 0.38, xf: 0.32, xb: -0.50, lift: 0.26, Hbase: 0.800, bob: 0.035, peak: 'flight', lean: 0.16, twist: 0.10, arm: 0.65, armZ: 0.10, fore: 0.65 },
      sprint: { duration: 0.56, duty: 0.33, xf: 0.38, xb: -0.60, lift: 0.32, Hbase: 0.770, bob: 0.040, peak: 'flight', lean: 0.26, twist: 0.14, arm: 0.85, armZ: 0.08, fore: 0.85 }
    };
    for (const [name, c] of Object.entries(GAITS)) {
      clips[name] = buildLoopClip(name, c.duration, gait(c));
      AnimationController.SYNTH_SPEEDS[name] = (c.xf - c.xb) / (c.duty * c.duration);
    }

    clips.crouch = buildLoopClip('crouch', 1.8, (p) => ({
      hipsY: 0.66 + Math.sin(p) * 0.01,
      rotations: {
        Spine: [0.32, 0, 0],
        LeftUpLeg: [-0.78, 0, 0],
        RightUpLeg: [-0.78, 0, 0],
        LeftLeg: [1.35, 0, 0],
        RightLeg: [1.35, 0, 0],
        LeftFoot: [-0.45, 0, 0],
        RightFoot: [-0.45, 0, 0],
        LeftArm: [0.2, 0, 0.18],
        RightArm: [0.2, 0, -0.18]
      }
    }));

    clips['crouch-walk'] = buildLoopClip('crouch-walk', 0.95, (p) => ({
      hipsY: 0.66 + Math.abs(Math.cos(p)) * 0.02,
      rotations: {
        Spine: [0.34, Math.sin(p) * 0.07, 0],
        LeftUpLeg: [-0.65 + Math.sin(p) * 0.35, 0, 0],
        RightUpLeg: [-0.65 - Math.sin(p) * 0.35, 0, 0],
        LeftLeg: [1.15 + Math.max(0, -Math.cos(p)) * 0.35, 0, 0],
        RightLeg: [1.15 + Math.max(0, Math.cos(p)) * 0.35, 0, 0],
        LeftArm: [-Math.sin(p) * 0.25, 0, 0.18],
        RightArm: [Math.sin(p) * 0.25, 0, -0.18]
      }
    }));

    clips.jump = buildLoopClip('jump', 0.55, () => ({
      hipsY: 1.04,
      rotations: {
        Spine: [-0.08, 0, 0],
        LeftUpLeg: [-0.45, 0, 0],
        RightUpLeg: [-0.25, 0, 0],
        LeftLeg: [0.65, 0, 0],
        RightLeg: [0.35, 0, 0],
        LeftArm: [-0.55, 0, 0.22],
        RightArm: [-0.55, 0, -0.22]
      }
    }));

    clips.fall = buildLoopClip('fall', 0.8, (p) => ({
      hipsY: 1.0,
      rotations: {
        Spine: [0.1, 0, 0],
        LeftUpLeg: [-0.32 + Math.sin(p) * 0.08, 0, 0.06],
        RightUpLeg: [-0.22 - Math.sin(p) * 0.08, 0, -0.06],
        LeftLeg: [0.55, 0, 0],
        RightLeg: [0.45, 0, 0],
        LeftArm: [-0.35, 0, 0.42],
        RightArm: [-0.35, 0, -0.42]
      }
    }));

    clips.land = buildLoopClip('land', 0.35, (p) => ({
      hipsY: 0.78 + (p / (Math.PI * 2)) * 0.18,
      rotations: {
        Spine: [0.22, 0, 0],
        LeftUpLeg: [-0.55, 0, 0],
        RightUpLeg: [-0.55, 0, 0],
        LeftLeg: [0.95, 0, 0],
        RightLeg: [0.95, 0, 0],
        LeftArm: [0.18, 0, 0.2],
        RightArm: [0.18, 0, -0.2]
      }
    }));

    clips.turn = buildLoopClip('turn', 0.6, (p) => ({
      hipsY: 0.95,
      rotations: {
        Spine: [0.04, Math.sin(p) * 0.12, 0],
        LeftUpLeg: [Math.sin(p) * 0.22, 0, 0],
        RightUpLeg: [-Math.sin(p) * 0.22, 0, 0],
        LeftLeg: [0.25, 0, 0],
        RightLeg: [0.25, 0, 0]
      }
    }));

    return clips;
  }
}
AnimationController.SYNTH_SPEEDS = {};
AnimationController.synthesized = false;
