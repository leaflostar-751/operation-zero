import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class Physics {
  constructor(scene) {
    this.scene = scene;
    this.RAPIER = RAPIER;
    this.world = null;
    this.ready = false;
    this.debugEnabled = false;
    this.debugMesh = null;
    this.dynamicSyncList = [];
  }

  async init() {
    await RAPIER.init();
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    this.ready = true;

    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true
    });
    const geometry = new THREE.BufferGeometry();
    this.debugMesh = new THREE.LineSegments(geometry, material);
    this.debugMesh.frustumCulled = false;
    this.debugMesh.visible = false;
    this.scene.add(this.debugMesh);
  }

  createFixedGroundBox(halfWidth, halfHeight, halfDepth) {
    if (!this.ready) return null;
    // Top face sits exactly at y = 0
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -halfHeight, 0);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth).setFriction(0.9);
    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider };
  }

  createFixedBox(x, y, z, halfW, halfH, halfD, rotationEuler = null) {
    if (!this.ready) return null;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    if (rotationEuler) {
      const q = new THREE.Quaternion().setFromEuler(rotationEuler);
      bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD).setFriction(0.85);
    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider };
  }

  /** remove a fixed body/collider created by createFixedBox (used by chunk streaming) */
  removeEntry(entry) {
    if (!entry || !this.world) return;
    try {
      if (entry.body && this.world.removeRigidBody) this.world.removeRigidBody(entry.body);
      else if (entry.collider) this.world.removeCollider(entry.collider, true);
    } catch (_) { /* already removed */ }
  }

  createKinematicBox(x, y, z, halfW, halfH, halfD) {
    if (!this.ready) return null;
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD);
    const collider = this.world.createCollider(colliderDesc, body);
    return { body, collider };
  }

  createDynamicBox(mesh, halfW, halfH, halfD, mass = 12.0) {
    if (!this.ready) return null;
    const pos = mesh.position;
    const quat = mesh.quaternion;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setLinearDamping(1.2)
      .setAngularDamping(1.5);

    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
      .setMass(mass)
      .setFriction(0.75)
      .setRestitution(0.05);
    const collider = this.world.createCollider(colliderDesc, body);

    const entry = { mesh, body, collider, isHeld: false };
    this.dynamicSyncList.push(entry);
    return entry;
  }

  createFixedSphere(x, y, z, radius) {
    if (!this.ready) return null;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.ball(radius);
    this.world.createCollider(colliderDesc, body);
    return body;
  }

  /**
   * Ray cast against the physics world.
   * @returns {{toi:number, point:THREE.Vector3, normal:THREE.Vector3, collider:any}|null}
   */
  castRay(origin, dir, maxToi, excludeCollider = null) {
    if (!this.ready) return null;
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z }
    );
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxToi,
      true,
      undefined,
      undefined,
      excludeCollider || undefined
    );
    if (!hit) return null;
    const toi = hit.timeOfImpact ?? hit.toi ?? 0;
    return {
      toi,
      point: new THREE.Vector3(origin.x + dir.x * toi, origin.y + dir.y * toi, origin.z + dir.z * toi),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      collider: hit.collider
    };
  }

  setDebugEnabled(enabled) {
    this.debugEnabled = enabled;
    if (this.debugMesh) {
      this.debugMesh.visible = enabled;
      if (enabled) {
        this.updateDebugRender();
      }
    }
  }

  step() {
    if (!this.ready) return;
    this.world.step();

    for (const item of this.dynamicSyncList) {
      if (!item.isHeld) {
        const t = item.body.translation();
        const r = item.body.rotation();
        item.mesh.position.set(t.x, t.y, t.z);
        item.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
    }

    if (this.debugEnabled) {
      this.updateDebugRender();
    }
  }

  updateDebugRender() {
    if (!this.ready || !this.debugMesh) return;
    const { vertices, colors } = this.world.debugRender();

    // Replace + dispose old geometry so GPU buffers do not leak every step
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    next.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    const old = this.debugMesh.geometry;
    this.debugMesh.geometry = next;
    old.dispose();
  }
}
