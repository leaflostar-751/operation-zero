import * as THREE from 'three';
import { AnimationController } from './AnimationController.js';
import { FootIKSolver } from './FootIKSolver.js';
import { buildHumanoid, OUTFIT_IDS, OUTFITS } from './CharacterBuilder.js';
import { rotateBoneAboutAxis } from './TwoBoneIK.js';

const HERO_HEIGHT = 1.8;

const ANIM_SPECS = [
  { state: 'idle', files: ['idle'], once: false },
  { state: 'walk', files: ['walk'], once: false },
  { state: 'run', files: ['run'], once: false },
  { state: 'sprint', files: ['sprint'], once: false },
  { state: 'jump', files: ['jump'], once: true },
  { state: 'fall', files: ['fall'], once: false },
  { state: 'land', files: ['land'], once: true },
  { state: 'crouch', files: ['crouch'], once: false },
  { state: 'crouch-walk', files: ['crouch-walk', 'crouch_walk'], once: false },
  { state: 'turn', files: ['turn'], once: false }
];

export class CharacterController {
  constructor(scene, physics, assetLoader, tierConfig) {
    this.scene = scene;
    this.physics = physics;
    this.assetLoader = assetLoader;
    this.tierConfig = tierConfig;

    this.spawnPoint = new THREE.Vector3(0, 0, 4);
    this.position = this.spawnPoint.clone(); // simulation position of the capsule bottom
    this.prevPosition = this.position.clone();
    this.renderPosition = this.position.clone(); // interpolated for smooth drawing
    this.velocity = new THREE.Vector3();
    this.verticalVelocity = 0;
    this.yaw = 0;
    this.prevYaw = 0;

    this.isGrounded = true;
    this.airTime = 0;
    this.isCrouching = false;
    this.isSprinting = false;
    this.smoothedSpeed = 0;

    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.maxStamina = 100;

    this.capsuleRadius = 0.34;
    this.standingHalfHeight = 0.56; // 2 * (0.56 + 0.34) = 1.80 m
    this.crouchingHalfHeight = 0.28; // 2 * (0.28 + 0.34) = 1.24 m
    this.activeHalfHeight = this.standingHalfHeight;

    this.rootGroup = new THREE.Group();
    this.rootGroup.position.copy(this.position);
    this.scene.add(this.rootGroup);

    this.bones = {};
    this.animController = null;
    this.footIK = null;
    this.usingFallbackRig = false;
    this.externalControl = false;
    this.outfitId = 'operator';
    this.pickupT = 0;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._rayOrigin = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  async init() {
    this.setupPhysicsCapsule();
    await this.loadHeroAndAnimations();
  }

  setupPhysicsCapsule() {
    const RAPIER = this.physics.RAPIER;
    const world = this.physics.world;

    const centerOffset = this.standingHalfHeight + this.capsuleRadius;
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      this.position.x,
      this.position.y + centerOffset,
      this.position.z
    );
    this.rigidBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.capsule(this.standingHalfHeight, this.capsuleRadius).setFriction(0.1);
    this.collider = world.createCollider(colliderDesc, this.rigidBody);

    // Kinematic character controller: slopes, stairs (autostep), snap-to-ground
    this.kcc = world.createCharacterController(0.01);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    this.kcc.setMinSlopeSlideAngle((50 * Math.PI) / 180);
    this.kcc.enableAutostep(0.38, 0.2, true);
    this.kcc.enableSnapToGround(0.3);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
  }

  /** Crouch / stand: resizes the capsule while keeping the feet exactly where they are. */
  setCrouchState(wantCrouch) {
    if (wantCrouch === this.isCrouching) return;

    // Standing up: make sure there is headroom (ray from the top of the crouched capsule)
    if (!wantCrouch) {
      this._rayOrigin.set(
        this.position.x,
        this.position.y + 2 * (this.crouchingHalfHeight + this.capsuleRadius),
        this.position.z
      );
      const clearance = 2 * (this.standingHalfHeight + this.capsuleRadius) -
        2 * (this.crouchingHalfHeight + this.capsuleRadius) + 0.05;
      const hit = this.physics.castRay(this._rayOrigin, this._up, clearance, this.collider);
      if (hit) return;
    }

    const RAPIER = this.physics.RAPIER;
    const shift = this.standingHalfHeight - this.crouchingHalfHeight;
    const body = this.rigidBody;
    const t = body.translation();

    this.isCrouching = wantCrouch;
    this.activeHalfHeight = wantCrouch ? this.crouchingHalfHeight : this.standingHalfHeight;

    // capsule centre moves so the bottom stays on the ground
    const newY = t.y + (wantCrouch ? -shift : shift);
    body.setTranslation({ x: t.x, y: newY, z: t.z }, true);
    body.setNextKinematicTranslation({ x: t.x, y: newY, z: t.z });

    this.physics.world.removeCollider(this.collider, false);
    const colliderDesc = RAPIER.ColliderDesc.capsule(this.activeHalfHeight, this.capsuleRadius).setFriction(0.1);
    this.collider = this.physics.world.createCollider(colliderDesc, body);
  }

  async loadHeroAndAnimations() {
    let modelRoot = await this.assetLoader.loadCharacterModel('/assets/characters/hero');

    if (modelRoot) {
      this.extractMixamoBones(modelRoot);
      if (!this.bones.Hips || !this.bones.LeftFoot || !this.bones.RightFoot) {
        console.warn(
          '[Hero] hero model has no Mixamo-style skeleton (Hips / feet not found). Using the built-in hero instead.'
        );
        modelRoot = null;
        this.bones = {};
      }
    }

    if (modelRoot) {
      this.assetLoader.applyCharacterPBRMaterials(modelRoot);
    } else {
      const built = buildHumanoid({ outfit: this.outfitId, seed: 1 });
      this.assetLoader.applyCharacterPBRMaterials(built.group);
      modelRoot = built.group;
      this.bones = built.bones;
      this.humanoid = built;
      this.usingFallbackRig = true;
    }

    // holder lets us normalise size/grounding without touching animation targets
    this.modelHolder = new THREE.Group();
    this.modelHolder.add(modelRoot);
    this.rootGroup.add(this.modelHolder);
    this.modelRoot = modelRoot;
    this.normaliseModel();

    this.animController = new AnimationController(this.modelRoot, this.bones);
    const synthesizedClips = AnimationController.createSynthesizedMixamoClips(this.bones);

    const missing = [];
    for (const spec of ANIM_SPECS) {
      const candidatePaths = spec.files.map((f) => `/assets/characters/animations/${f}`);
      const loadedClip = await this.assetLoader.loadAnimationClip(candidatePaths, spec.state);
      if (!loadedClip) missing.push(spec.state);
      this.animController.registerClip(spec.state, loadedClip || synthesizedClips[spec.state], spec.once);
    }
    if (missing.length) {
      console.info('[Hero] animation files not found, using built-in motion for:', missing.join(', '));
      if (!this.usingFallbackRig) {
        console.warn(
          '[Hero] a real hero model needs all 10 Mixamo animations; built-in motion is only valid for the built-in hero.'
        );
      }
    }

    this.animController.transitionTo('idle', 0.01);

    // measure ankle height above the sole from the bind pose
    this.rootGroup.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    this.bones.LeftFoot.getWorldPosition(v);
    const footHeight = THREE.MathUtils.clamp(v.y - this.rootGroup.position.y, 0.03, 0.2);
    this.footIK = new FootIKSolver(this.physics, this.bones, { footHeight });
  }

  /** Scale the model to 1.8 m and put its soles on y = 0 (fixes cm FBX exports etc.). */
  normaliseModel() {
    if (this.usingFallbackRig) return;
    this.rootGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    const height = box.max.y - box.min.y;
    if (!isFinite(height) || height < 1e-3) return;

    const scale = HERO_HEIGHT / height;
    if (Math.abs(scale - 1) > 0.05) this.modelHolder.scale.setScalar(scale);

    this.rootGroup.updateMatrixWorld(true);
    box.setFromObject(this.modelRoot);
    const minY = box.min.y - this.rootGroup.position.y;
    if (Math.abs(minY) > 0.02) this.modelHolder.position.y -= minY;
  }

  extractMixamoBones(root) {
    const map = {
      Hips: ['hips', 'pelvis'],
      Spine: ['spine', 'spine_01'],
      Spine1: ['spine1', 'spine_02'],
      Neck: ['neck', 'neck_01'],
      Head: ['head'],
      LeftArm: ['leftarm', 'upperarm_l'],
      LeftForeArm: ['leftforearm', 'lowerarm_l'],
      LeftHand: ['lefthand', 'hand_l'],
      RightHand: ['righthand', 'hand_r'],
      RightArm: ['rightarm', 'upperarm_r'],
      RightForeArm: ['rightforearm', 'lowerarm_r'],
      LeftUpLeg: ['leftupleg', 'thigh_l'],
      LeftLeg: ['leftleg', 'calf_l'],
      LeftFoot: ['leftfoot', 'foot_l'],
      RightUpLeg: ['rightupleg', 'thigh_r'],
      RightLeg: ['rightleg', 'calf_r'],
      RightFoot: ['rightfoot', 'foot_r']
    };

    this.bones = {};
    root.traverse((obj) => {
      if (!obj.isBone) return;
      const cleanName = obj.name.replace(/^mixamorig:?/i, '').toLowerCase();
      for (const [key, aliases] of Object.entries(map)) {
        if (!this.bones[key] && aliases.includes(cleanName)) this.bones[key] = obj;
      }
    });
  }

  /** Built-in 15-bone Mixamo-named hero, used until hero.glb / hero.fbx is added. */
  buildArticulatedHumanoidRig() {
    const group = new THREE.Group();
    const bones = {};

    const makeBone = (name, x, y, z, parent) => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(x, y, z);
      parent.add(b);
      return b;
    };

    bones.Hips = makeBone('mixamorigHips', 0, 0.96, 0, group);
    bones.Spine = makeBone('mixamorigSpine', 0, 0.14, 0, bones.Hips);
    bones.Spine1 = makeBone('mixamorigSpine1', 0, 0.24, 0, bones.Spine);
    bones.Neck = makeBone('mixamorigNeck', 0, 0.22, 0, bones.Spine1);
    bones.Head = makeBone('mixamorigHead', 0, 0.1, 0, bones.Neck);

    bones.LeftArm = makeBone('mixamorigLeftArm', 0.2, 0.18, 0, bones.Spine1);
    bones.LeftForeArm = makeBone('mixamorigLeftForeArm', 0, -0.27, 0, bones.LeftArm);
    bones.RightArm = makeBone('mixamorigRightArm', -0.2, 0.18, 0, bones.Spine1);
    bones.RightForeArm = makeBone('mixamorigRightForeArm', 0, -0.27, 0, bones.RightArm);

    bones.LeftHand = makeBone('mixamorigLeftHand', 0, -0.27, 0, bones.LeftForeArm);
    bones.RightHand = makeBone('mixamorigRightHand', 0, -0.27, 0, bones.RightForeArm);

    bones.LeftUpLeg = makeBone('mixamorigLeftUpLeg', 0.11, -0.06, 0, bones.Hips);
    bones.LeftLeg = makeBone('mixamorigLeftLeg', 0, -0.43, 0, bones.LeftUpLeg);
    bones.LeftFoot = makeBone('mixamorigLeftFoot', 0, -0.42, 0, bones.LeftLeg);

    bones.RightUpLeg = makeBone('mixamorigRightUpLeg', -0.11, -0.06, 0, bones.Hips);
    bones.RightLeg = makeBone('mixamorigRightLeg', 0, -0.43, 0, bones.RightUpLeg);
    bones.RightFoot = makeBone('mixamorigRightFoot', 0, -0.42, 0, bones.RightLeg);

    const jacketMat = new THREE.MeshStandardMaterial({
      name: 'cloth_jacket',
      color: 0x1e293b,
      roughness: 0.72,
      metalness: 0.12
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      name: 'cloth_pants',
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.05
    });
    const skinMat = new THREE.MeshStandardMaterial({
      name: 'skin_head',
      color: 0xd9a17c,
      roughness: 0.5,
      metalness: 0.02
    });
    const hairMat = new THREE.MeshStandardMaterial({
      name: 'hair_cards',
      color: 0x181310,
      roughness: 0.42,
      side: THREE.DoubleSide
    });

    const attach = (bone, geo, mat, offsetY = 0, offsetZ = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(0, offsetY, offsetZ);
      bone.add(m);
      return m;
    };

    const vestMat = new THREE.MeshStandardMaterial({ name: 'cloth_vest', color: 0x2f3b30, roughness: 0.85, metalness: 0.05 });
    const gearMat = new THREE.MeshStandardMaterial({ name: 'gear', color: 0x14171a, roughness: 0.55, metalness: 0.45 });
    const bootMat = new THREE.MeshStandardMaterial({ name: 'boots', color: 0x1a1613, roughness: 0.7, metalness: 0.05 });
    const visorMat = new THREE.MeshStandardMaterial({ name: 'visor', color: 0x0b1620, roughness: 0.12, metalness: 0.6 });
    const add2 = (bone, geo, mat, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.x = rx;
      bone.add(m);
      return m;
    };
    // tactical operator details
    add2(bones.Spine, new THREE.BoxGeometry(0.36, 0.34, 0.22), vestMat, 0, 0.2, 0.012);          // plate carrier
    add2(bones.Spine, new THREE.BoxGeometry(0.28, 0.24, 0.05), gearMat, 0, 0.22, 0.13);          // front plate
    add2(bones.Spine, new THREE.BoxGeometry(0.1, 0.12, 0.06), gearMat, -0.09, 0.05, 0.13);       // mag pouch
    add2(bones.Spine, new THREE.BoxGeometry(0.1, 0.12, 0.06), gearMat, 0.09, 0.05, 0.13);
    add2(bones.Spine, new THREE.BoxGeometry(0.25, 0.26, 0.1), gearMat, 0, 0.2, -0.15);            // backpack
    add2(bones.Hips, new THREE.BoxGeometry(0.34, 0.07, 0.2), gearMat, 0, 0.04, 0);                // belt
    add2(bones.Head, new THREE.SphereGeometry(0.13, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), gearMat, 0, 0.12, -0.01); // helmet
    add2(bones.Head, new THREE.BoxGeometry(0.2, 0.05, 0.05), visorMat, 0, 0.1, 0.09);             // goggles
    add2(bones.Neck, new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), skinMat, 0, 0.0, 0);

    attach(bones.Hips, new THREE.SphereGeometry(0.15, 24, 18), pantsMat, 0);
    attach(bones.Spine, new THREE.CapsuleGeometry(0.14, 0.24, 12, 24), jacketMat, 0.14);
    attach(bones.Head, new THREE.SphereGeometry(0.115, 28, 24), skinMat, 0.09);
    attach(
      bones.Head,
      new THREE.SphereGeometry(0.12, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6),
      hairMat,
      0.11,
      -0.01
    );

    attach(bones.LeftArm, new THREE.CapsuleGeometry(0.052, 0.2, 8, 16), jacketMat, -0.13);
    attach(bones.LeftForeArm, new THREE.CapsuleGeometry(0.044, 0.2, 8, 16), jacketMat, -0.12);
    attach(bones.RightArm, new THREE.CapsuleGeometry(0.052, 0.2, 8, 16), jacketMat, -0.13);
    attach(bones.RightForeArm, new THREE.CapsuleGeometry(0.044, 0.2, 8, 16), jacketMat, -0.12);

    attach(bones.LeftHand, new THREE.SphereGeometry(0.05, 12, 10), gearMat, -0.03);
    attach(bones.RightHand, new THREE.SphereGeometry(0.05, 12, 10), gearMat, -0.03);

    attach(bones.LeftUpLeg, new THREE.CapsuleGeometry(0.072, 0.32, 10, 18), pantsMat, -0.21);
    attach(bones.LeftLeg, new THREE.CapsuleGeometry(0.058, 0.32, 10, 18), pantsMat, -0.21);
    attach(bones.LeftFoot, new THREE.CapsuleGeometry(0.052, 0.12, 8, 14), bootMat, -0.04, 0.05).rotation.x =
      Math.PI / 2;

    attach(bones.RightUpLeg, new THREE.CapsuleGeometry(0.072, 0.32, 10, 18), pantsMat, -0.21);
    attach(bones.RightLeg, new THREE.CapsuleGeometry(0.058, 0.32, 10, 18), pantsMat, -0.21);
    attach(bones.RightFoot, new THREE.CapsuleGeometry(0.052, 0.12, 8, 14), bootMat, -0.04, 0.05).rotation.x =
      Math.PI / 2;

    this.assetLoader.applyCharacterPBRMaterials(group);
    return { group, bones };
  }

  /**
   * Fixed-step simulation (60 Hz). Must be followed by physics.step() once.
   * @param inputState latched input; *JustPressed flags are true for exactly one step
   */
  update(dt, inputState, cameraYaw) {
    this.prevPosition.copy(this.position);
    this.prevYaw = this.yaw;

    // another system (vehicle, scripted animation) owns the body: keep the capsule glued to it
    if (this.externalControl) {
      this.velocity.set(0, 0, 0);
      this.verticalVelocity = 0;
      this.isSprinting = false;
      this.smoothedSpeed = 0;
      const centerOffset = this.activeHalfHeight + this.capsuleRadius;
      this.rigidBody.setNextKinematicTranslation({
        x: this.position.x,
        y: this.position.y + centerOffset - (this.hideCollider ? 80 : 0),
        z: this.position.z
      });
      return;
    }

    if (inputState.crouchJustPressed) {
      this.setCrouchState(!this.isCrouching);
    }

    const wantsMove = Math.hypot(inputState.moveX, inputState.moveY) > 0.1;
    if (inputState.sprint && wantsMove && !this.isCrouching && this.stamina > 5) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - 18 * dt);
    } else {
      this.isSprinting = false;
      this.stamina = Math.min(this.maxStamina, this.stamina + 14 * dt);
    }

    // camera-relative movement: forward = where the camera looks, right = forward x up
    this._forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    this._right.set(-this._forward.z, 0, this._forward.x);

    const moveDir = this._moveDir.set(0, 0, 0);
    moveDir.addScaledVector(this._forward, inputState.moveY);
    moveDir.addScaledVector(this._right, inputState.moveX);

    const inputMag = Math.min(1, moveDir.length());
    if (inputMag > 0.001) moveDir.normalize();

    let targetSpeed = 0;
    if (inputMag > 0.05) {
      if (this.isCrouching) {
        targetSpeed = 1.65 * inputMag;
      } else if (this.isSprinting) {
        targetSpeed = 6.8;
      } else if (inputState.walk || inputMag <= 0.65) {
        targetSpeed = 1.85 * Math.max(inputMag, 0.5);
      } else {
        targetSpeed = 4.2 * inputMag;
      }
    }

    const accel = this.isGrounded ? 14.0 : 4.5;
    const blend = Math.min(1, dt * accel);
    this.velocity.x += (moveDir.x * targetSpeed - this.velocity.x) * blend;
    this.velocity.z += (moveDir.z * targetSpeed - this.velocity.z) * blend;

    let justJumped = false;
    if (inputState.jumpJustPressed && this.isGrounded) {
      if (this.isCrouching) {
        this.setCrouchState(false);
      } else if (this.stamina >= 12) {
        this.verticalVelocity = 5.4;
        this.isGrounded = false;
        justJumped = true;
        this.stamina = Math.max(0, this.stamina - 12);
      }
    }

    this.verticalVelocity -= 14.5 * dt;
    if (this.verticalVelocity < -22) this.verticalVelocity = -22;

    const vyPrev = this.verticalVelocity;
    this.kcc.computeColliderMovement(this.collider, {
      x: this.velocity.x * dt,
      y: this.verticalVelocity * dt,
      z: this.velocity.z * dt
    });
    const corrected = this.kcc.computedMovement();
    const grounded = this.kcc.computedGrounded();
    const wasGrounded = this.isGrounded;
    this.isGrounded = grounded && !justJumped;
    if (this.isGrounded && !wasGrounded && vyPrev < -7) {
      this.landImpact = Math.min(0.35, Math.max(0.05, (-vyPrev - 7) * 0.03));
    }

    if (this.isGrounded && this.verticalVelocity < 0) {
      this.verticalVelocity = -0.5;
    }
    this.airTime = this.isGrounded ? 0 : this.airTime + dt;

    const centerOffset = this.activeHalfHeight + this.capsuleRadius;
    const cur = this.rigidBody.translation();

    let nextX = cur.x + corrected.x;
    let nextY = cur.y + corrected.y;
    let nextZ = cur.z + corrected.z;

    // out-of-bounds safety: never stay stuck in the void
    if (nextY < -10) {
      nextX = this.spawnPoint.x;
      nextY = this.spawnPoint.y + centerOffset + 0.5;
      nextZ = this.spawnPoint.z;
      this.verticalVelocity = 0;
      this.velocity.set(0, 0, 0);
      this.prevPosition.set(nextX, nextY - centerOffset, nextZ);
    }

    this.rigidBody.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });
    this.position.set(nextX, nextY - centerOffset, nextZ);

    // smoothed ground speed (avoids animation-state flicker at thresholds)
    const rawSpeed = Math.hypot(corrected.x, corrected.z) / dt;
    this.smoothedSpeed += (rawSpeed - this.smoothedSpeed) * Math.min(1, dt * 10);

    let yawDelta = 0;
    const wrap = (a) => {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    };
    const facingAim = this.combat && this.combat.facingAim;
    const aimYaw = cameraYaw + Math.PI;
    if (inputMag > 0.08) {
      const moveYaw = Math.atan2(moveDir.x, moveDir.z);
      // while aiming the legs lean towards the aim direction, the torso follows the camera
      const targetYaw = facingAim ? moveYaw + wrap(aimYaw - moveYaw) * 0.5 : moveYaw;
      const diff = wrap(targetYaw - this.yaw);
      yawDelta = diff;
      this.yaw += diff * Math.min(1, dt * 12);
      this._turningToAim = false;
    } else if (facingAim) {
      const diff = wrap(aimYaw - this.yaw);
      if (Math.abs(diff) > 0.9) this._turningToAim = true;
      if (this._turningToAim) {
        this.yaw += diff * Math.min(1, dt * 9);
        if (Math.abs(diff) < 0.08) this._turningToAim = false;
      }
    } else {
      this._turningToAim = false;
    }

    // pose the model at the true simulation position, then animate + IK in that frame
    this.rootGroup.position.copy(this.position);
    this.rootGroup.rotation.y = this.yaw;

    if (this.animController) {
      this.animController.update(dt, {
        horizontalSpeed: this.smoothedSpeed,
        airTime: this.airTime,
        verticalVelocity: this.verticalVelocity,
        isCrouching: this.isCrouching,
        isSprinting: this.isSprinting,
        justJumped,
        yawDelta,
        // signed speed along the facing direction: negative = moving backwards relative to the body
        forwardSpeed: this.velocity.x * Math.sin(this.yaw) + this.velocity.z * Math.cos(this.yaw)
      });
    }

    if (this.footIK) {
      this.footIK.update(dt, {
        isGrounded: this.isGrounded || this.airTime < 0.12,
        baseY: this.position.y,
        yaw: this.yaw,
        excludeCollider: this.collider
      });
    }

    if (this.combat) this.combat.applyPose(dt);
    if (this.pickupT > 0) this.applyPickupPose(dt);
  }

  playPickup() {
    this.pickupT = 0.7;
  }

  /** Bend down and reach: spine folds forward, arms swing down and forward, knees soften. */
  applyPickupPose(dt) {
    this.pickupT = Math.max(0, this.pickupT - dt);
    const k = Math.sin(Math.PI * (1 - this.pickupT / 0.7));
    const b = this.bones;
    const t = this._pickAxis || (this._pickAxis = new THREE.Vector3());
    const yaw = this.yaw;
    t.set(Math.cos(yaw), 0, -Math.sin(yaw)); // character left axis (nose-down rotation)
    const ang = (a) => (a * Math.abs(k)) ;
    this.rootGroup.updateMatrixWorld(true);
    rotateBoneAboutAxis(b.Spine, t, ang(0.55));
    rotateBoneAboutAxis(b.Spine1, t, ang(0.35));
    rotateBoneAboutAxis(b.LeftArm, t, ang(1.0));
    rotateBoneAboutAxis(b.RightArm, t, ang(1.0));
    rotateBoneAboutAxis(b.LeftUpLeg, t, ang(-0.35));
    rotateBoneAboutAxis(b.RightUpLeg, t, ang(-0.35));
  }

  /** Hide the body in first person (the weapon stays visible). */
  setFirstPerson(on) {
    if (this.modelHolder) this.modelHolder.visible = !on;
  }

  /** Called every displayed frame: draw the hero between the last two simulation steps. */
  /** Swap the built-in hero's outfit (operator / executive / survivor / racer). */
  setOutfit(id) {
    if (!this.usingFallbackRig || !OUTFITS[id]) return false;
    this.outfitId = id;
    const old = this.modelHolder;
    const built = buildHumanoid({ outfit: id, seed: OUTFIT_IDS.indexOf(id) + 1 });
    this.assetLoader.applyCharacterPBRMaterials(built.group);
    this.rootGroup.remove(old);
    this.humanoid = built;
    this.bones = built.bones;
    this.modelHolder = new THREE.Group();
    this.modelHolder.add(built.group);
    this.rootGroup.add(this.modelHolder);
    this.modelRoot = built.group;
    const wasFp = old && !old.visible;
    this.modelHolder.visible = !wasFp;

    this.animController = new AnimationController(this.modelRoot, this.bones);
    const clips = AnimationController.createSynthesizedMixamoClips(this.bones);
    for (const spec of ANIM_SPECS) this.animController.registerClip(spec.state, clips[spec.state], spec.once);
    this.animController.transitionTo('idle', 0.01);
    this.rootGroup.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    this.bones.LeftFoot.getWorldPosition(v);
    const footHeight = THREE.MathUtils.clamp(v.y - this.rootGroup.position.y, 0.03, 0.2);
    this.footIK = new FootIKSolver(this.physics, this.bones, { footHeight });
    old.traverse((o) => { if (o.geometry && !o.geometry.isSphereGeometry) o.geometry.dispose?.(); });
    return true;
  }

  cycleOutfit() {
    const i = OUTFIT_IDS.indexOf(this.outfitId);
    const next = OUTFIT_IDS[(i + 1) % OUTFIT_IDS.length];
    return this.setOutfit(next) ? next : null;
  }

  setExternalControl(on) {
    this.externalControl = on;
    if (on) this.setCrouchState(false);
  }

  /** Move the hero (capsule bottom) instantly, without interpolation. */
  teleportTo(x, y, z, yaw = this.yaw) {
    this.position.set(x, y, z);
    this.prevPosition.copy(this.position);
    this.renderPosition.copy(this.position);
    this.yaw = this.prevYaw = yaw;
    this.velocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    const centerOffset = this.activeHalfHeight + this.capsuleRadius;
    const t = { x, y: y + centerOffset, z };
    this.rigidBody.setTranslation(t, true);
    this.rigidBody.setNextKinematicTranslation(t);
    this.rootGroup.position.copy(this.position);
    this.rootGroup.rotation.y = yaw;
  }

  applyInterpolation(alpha) {
    if (this.externalControl) return;
    this.renderPosition.lerpVectors(this.prevPosition, this.position, alpha);

    let dy = this.yaw - this.prevYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;

    this.rootGroup.position.copy(this.renderPosition);
    this.rootGroup.rotation.y = this.prevYaw + dy * alpha;
  }
}

