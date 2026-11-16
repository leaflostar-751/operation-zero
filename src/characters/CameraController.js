import * as THREE from 'three';
import { clamp } from '../utils/math.js';

export class CameraController {
  constructor(camera, physics) {
    this.camera = camera;
    this.physics = physics;

    this.mode = 'THIRD_PERSON'; // 'THIRD_PERSON' | 'FIRST_PERSON'
    this.yaw = 0;
    this.pitch = 0.25;

    this.targetDistance = 3.2;
    this.currentDistance = 3.2;
    this.minDistance = 0.55;
    this.shoulderOffset = 0.32;

    this.pivotPos = new THREE.Vector3();
    this.pivotInitialised = false;

    this._target = new THREE.Vector3();
    this._arm = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  toggleMode(characterRoot) {
    this.mode = this.mode === 'THIRD_PERSON' ? 'FIRST_PERSON' : 'THIRD_PERSON';
    this.pivotInitialised = false;
    if (characterRoot) {
      characterRoot.visible = this.mode === 'THIRD_PERSON';
    }
    return this.mode;
  }

  /**
   * Once per displayed frame. `characterPosition` is the interpolated hero position
   * (capsule bottom).
   */
  update(dt, inputState, characterPosition, isCrouching, headBone, playerCollider) {
    const sensitivity = 0.0038;
    this.yaw -= inputState.lookX * sensitivity;
    this.pitch = clamp(this.pitch + inputState.lookY * sensitivity, -1.15, 1.35);

    const eyeHeight = isCrouching ? 1.12 : 1.58;

    if (this.mode === 'FIRST_PERSON') {
      if (headBone) {
        headBone.getWorldPosition(this.pivotPos);
        this.pivotPos.y += 0.08;
      } else {
        this.pivotPos.set(characterPosition.x, characterPosition.y + eyeHeight, characterPosition.z);
      }

      this.camera.position.copy(this.pivotPos);
      this._look.set(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        -Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this._look.add(this.pivotPos);
      this.camera.lookAt(this._look);
      this.applyKick(dt);
      return;
    }

    // Third person spring arm
    this._target.set(characterPosition.x, characterPosition.y + eyeHeight, characterPosition.z);
    if (!this.pivotInitialised) {
      this.pivotPos.copy(this._target);
      this.pivotInitialised = true;
    } else {
      this.pivotPos.lerp(this._target, 1 - Math.exp(-dt * 18));
    }

    // over-the-shoulder offset along the camera's right vector
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    this._arm.copy(this.pivotPos);
    this._arm.x += rightX * this.shoulderOffset;
    this._arm.z += rightZ * this.shoulderOffset;

    // direction from the pivot towards the camera
    this._dir
      .set(
        Math.cos(this.pitch) * Math.sin(this.yaw),
        Math.sin(this.pitch),
        Math.cos(this.pitch) * Math.cos(this.yaw)
      )
      .normalize();

    const hit = this.physics.castRay(this._arm, this._dir, this.targetDistance + 0.25, playerCollider);
    let allowed = this.targetDistance;
    if (hit) allowed = Math.max(this.minDistance, hit.toi - 0.22);

    // snap in quickly when a wall is hit, ease back out
    const rate = allowed < this.currentDistance ? 30 : 8;
    this.currentDistance += (allowed - this.currentDistance) * (1 - Math.exp(-dt * rate));

    this.camera.position.copy(this._arm).addScaledVector(this._dir, this.currentDistance);

    this._look.copy(this._arm).addScaledVector(this._dir, -6.0);
    this.camera.lookAt(this._look);
    this.applyKick(dt);
  }

  /** landing / impact dip: camera drops then eases back */
  applyKick(dt) {
    if (!this.kick) return;
    this.camera.position.y -= this.kick;
    this.kick = this.kick < 0.002 ? 0 : this.kick * Math.exp(-dt * 8);
  }
}
