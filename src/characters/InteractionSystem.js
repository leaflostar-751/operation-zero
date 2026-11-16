import * as THREE from 'three';

export class InteractionSystem {
  constructor(camera, physics) {
    this.camera = camera;
    this.physics = physics;
    this.interactables = [];
    this.heldObject = null;
    this.focusedItem = null;
    this.stowed = null; // item carried on the back
    this.hero = null;
    this.onPickUp = null;

    this.promptEl = document.getElementById('interaction-prompt');
    this.promptTextEl = document.getElementById('interaction-text');

    this._forward = new THREE.Vector3();
    this._camForward = new THREE.Vector3();
    this._holdPos = new THREE.Vector3();
    this._toItem = new THREE.Vector3();
    this._throw = new THREE.Vector3();
    this._zero = new THREE.Vector3();
  }

  register(item) {
    this.interactables.push(item);
  }

  /** Fixed step. inputState flags are single-step latched by the caller. */
  update(dt, playerPos, cameraYaw, inputState) {
    // animated things (doors) keep moving even while carrying a crate
    for (const item of this.interactables) {
      if (item.update) item.update(dt);
    }

    this._forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));

    if (this.heldObject) {
      this._holdPos.set(
        playerPos.x + this._forward.x * 1.35,
        playerPos.y + 1.15,
        playerPos.z + this._forward.z * 1.35
      );
      const body = this.heldObject.physicsEntry.body;
      body.setTranslation({ x: this._holdPos.x, y: this._holdPos.y, z: this._holdPos.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.heldObject.mesh.position.copy(this._holdPos);

      this.showPrompt('Drop (E)  |  Throw (G)  |  Stow on back (B)');
      if (inputState.stowJustPressed && !this.stowed) {
        this.stowOnBack();
        return;
      }

      if (inputState.interactJustPressed) {
        this.dropHeldObject(this._zero.set(0, 0, 0));
      } else if (inputState.pushJustPressed) {
        this._throw.copy(this._forward).multiplyScalar(8.5);
        this._throw.y += 2.5;
        this.dropHeldObject(this._throw);
      }
      return;
    }

    if (inputState.stowJustPressed && this.stowed) {
      this.takeFromBack(playerPos);
      return;
    }

    // closest interactable in front of the camera within 2.5 m
    let bestItem = null;
    let bestDist = 2.5;
    this.camera.getWorldDirection(this._camForward);

    for (const item of this.interactables) {
      const dist = item.mesh.position.distanceTo(playerPos);
      if (dist < bestDist) {
        this._toItem.subVectors(item.mesh.position, playerPos);
        this._toItem.y = 0;
        if (this._toItem.lengthSq() > 1e-6) this._toItem.normalize();
        const dot = this._toItem.x * this._camForward.x + this._toItem.z * this._camForward.z;
        if (dot > 0.25) {
          bestDist = dist;
          bestItem = item;
        }
      }
    }

    this.focusedItem = bestItem;
    if (this.focusedItem) {
      this.showPrompt(this.focusedItem.getPrompt());
      if (inputState.interactJustPressed) {
        this.focusedItem.onInteract(this, playerPos, this._camForward);
      } else if (inputState.pushJustPressed && this.focusedItem.onPush) {
        this.focusedItem.onPush(this._camForward);
      }
    } else {
      this.hidePrompt();
    }
  }

  pickUp(item) {
    this.heldObject = item;
    item.physicsEntry.isHeld = true;
    if (this.onPickUp) this.onPickUp();
  }

  /** Put the carried crate on the hero's back (attached to the spine, scaled down). */
  stowOnBack() {
    const spine = this.hero && this.hero.bones && (this.hero.bones.Spine1 || this.hero.bones.Spine);
    if (!spine || !this.heldObject) return;
    const item = this.heldObject;
    const entry = item.physicsEntry;
    try {
      entry.body.setEnabled(false);
    } catch (_) {
      entry.body.setTranslation({ x: 0, y: -200, z: 0 }, true);
    }
    entry.isHeld = true; // keeps the physics sync from dragging the mesh around
    this.heldObject = null;
    item.stowScale = 0.55 / Math.max(item.mesh.geometry.parameters.width || 0.55, 0.55);
    spine.add(item.mesh);
    item.mesh.position.set(0, 0.12, -0.27);
    item.mesh.rotation.set(0, 0, 0);
    item.mesh.scale.setScalar(item.stowScale);
    this.stowed = item;
    if (this.onPickUp) this.onPickUp();
  }

  takeFromBack(playerPos) {
    const item = this.stowed;
    if (!item) return;
    const entry = item.physicsEntry;
    item.mesh.removeFromParent();
    item.mesh.scale.setScalar(1);
    this.hero.scene.add(item.mesh);
    const y = playerPos.y + 1.15;
    const dir = this._forward;
    const pos = { x: playerPos.x + dir.x * 1.3, y, z: playerPos.z + dir.z * 1.3 };
    try {
      entry.body.setEnabled(true);
    } catch (_) { /* stub */ }
    entry.body.setTranslation(pos, true);
    entry.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    item.mesh.position.set(pos.x, pos.y, pos.z);
    entry.isHeld = false;
    this.stowed = null;
    if (this.onPickUp) this.onPickUp();
  }

  dropHeldObject(velocity) {
    if (!this.heldObject) return;
    const entry = this.heldObject.physicsEntry;
    entry.isHeld = false;
    entry.body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
    this.heldObject = null;
  }

  showPrompt(text) {
    if (!this.promptEl || !this.promptTextEl) return;
    if (this.promptTextEl.textContent !== text) this.promptTextEl.textContent = text;
    this.promptEl.classList.remove('hidden');
  }

  hidePrompt() {
    if (this.promptEl) this.promptEl.classList.add('hidden');
  }
}
