import * as THREE from 'three';
import { VEHICLE_INFO } from './VehicleModels.js';
import { assetUrl } from '../utils/assetUrl.js';

/**
 * Drop-in real vehicle models (Sketchfab / any .glb).
 *
 *  1. put the file in  public/assets/vehicles/  (e.g. sports-car.glb)
 *  2. add an entry to  public/assets/vehicles/manifest.json :
 *       { "vehicles": [ { "type": "apex-gt", "file": "sports-car.glb", "length": 4.5,
 *                         "rotateY": 0, "color": "#b0101a" } ] }
 *     `type` is the slot it replaces: apex-gt | stallion | ranger | vortex | sprint-r
 *  3. reload. Wheels are found by node name (wheel / tyre / tire / rim), glass by material name,
 *     the car is scaled to `length` metres, put on the ground and its nose turned to +Z.
 *     If a model faces the wrong way use "rotateY": 90 / 180 / -90.
 */
const TEMPLATES = new Map();

export function hasImportedVehicle(type) {
  return TEMPLATES.has(type);
}

export async function loadVehicleManifest(gltfLoader, base = assetUrl('/assets/vehicles/')) {
  let manifest;
  try {
    const r = await fetch(base + 'manifest.json', { cache: 'no-cache' });
    if (!r.ok) return 0;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) return 0; // SPA fallback html
    manifest = await r.json();
  } catch (_) {
    return 0;
  }
  let n = 0;
  for (const entry of manifest.vehicles || []) {
    if (!VEHICLE_INFO[entry.type] || !entry.file) continue;
    try {
      const gltf = await gltfLoader.loadAsync(base + entry.file);
      TEMPLATES.set(entry.type, { scene: gltf.scene, opts: entry });
      n++;
    } catch (e) {
      console.warn('[VehicleImporter] could not load', entry.file, e);
    }
  }
  return n;
}

const WHEEL_RE = /wheel|tyre|tire|rim|roue|felge/i;
const NOT_WHEEL_RE = /steer|brake_?light|housing|arch|well/i;

export function adaptImported(type, colorOverride) {
  const { scene, opts } = TEMPLATES.get(type);
  const info = VEHICLE_INFO[type];
  const bike = info.kind === 'bike';
  const root = scene.clone(true);
  // own materials per instance (paint / lights are tweaked below)
  root.traverse((o) => {
    if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // --- orientation, scale, ground
  const holder = new THREE.Group();
  holder.add(root);
  holder.rotation.y = THREE.MathUtils.degToRad(opts.rotateY || 0);
  holder.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(holder);
  let size = box.getSize(new THREE.Vector3());
  if (opts.autoRotate !== false && size.x > size.z * 1.15 && !opts.rotateY) {
    holder.rotation.y = Math.PI / 2; // the long axis was X
    holder.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(holder);
    size = box.getSize(new THREE.Vector3());
  }
  const targetLen = opts.length || (bike ? 2.1 : 4.5);
  const k = targetLen / size.z;
  holder.scale.setScalar(k);
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(holder);
  const centre = box.getCenter(new THREE.Vector3());
  holder.position.set(-centre.x, -box.min.y, -centre.z);

  const group = new THREE.Group();
  group.name = 'vehicle_' + type;
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);
  bodyGroup.add(holder);
  group.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(group);
  size = box.getSize(new THREE.Vector3());

  // --- wheels
  const found = [];
  holder.traverse((o) => {
    if (!o.name || !WHEEL_RE.test(o.name) || NOT_WHEEL_RE.test(o.name)) return;
    // skip nodes whose ancestor is already a wheel
    for (let p = o.parent; p && p !== holder; p = p.parent) if (WHEEL_RE.test(p.name || '')) return;
    found.push(o);
  });
  const wheels = [];
  const zMid = 0;
  for (const node of found) {
    const wb = new THREE.Box3().setFromObject(node);
    const wc = wb.getCenter(new THREE.Vector3());
    const ws = wb.getSize(new THREE.Vector3());
    const radius = Math.max(ws.y, ws.z) / 2;
    if (radius < 0.12 || radius > 0.65 || ws.x > radius * 2.2) continue; // not a wheel-shaped thing
    const local = bodyGroup.worldToLocal(wc.clone());
    const pivot = new THREE.Group();
    const spin = new THREE.Group();
    pivot.position.copy(local);
    pivot.add(spin);
    bodyGroup.add(pivot);
    spin.attach(node);
    const front = local.z > zMid;
    wheels.push({ pivot, spin, steer: !bike && front, radius, side: local.x >= 0 ? 1 : -1, z: local.z });
  }
  const zs = wheels.map((w) => w.z);
  const wheelbase = zs.length > 1 ? Math.max(...zs) - Math.min(...zs) : size.z * 0.6;

  // --- materials: paint, glass, lights
  const paint = colorOverride ?? opts.color;
  const brake = [];
  const head = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const n = m.name || '';
      if (paint && /paint|body|carpaint|exterior|shell/i.test(n) && m.color) m.color.set(paint);
      if (/glass|window|windshield|windscreen/i.test(n)) {
        m.transparent = true;
        m.opacity = Math.min(m.opacity, 0.38);
        m.roughness = 0.04;
        m.metalness = 0.0;
        m.depthWrite = false;
      }
      if (/brake|tail|rear.?light/i.test(n) && 'emissive' in m) {
        m.emissive = new THREE.Color(0xff1010);
        m.emissiveIntensity = 0.5;
        brake.push(m);
      }
      if (/head.?light|headlamp|front.?light/i.test(n) && 'emissive' in m) {
        m.emissive = new THREE.Color(0xfff2d0);
        m.emissiveIntensity = 0.6;
        head.push(m);
      }
    }
  });

  // --- rider anchors
  const H = size.y;
  const seatX = bike ? 0 : opts.seatX ?? Math.min(0.4, size.x * 0.22);
  const seatY = opts.seatY ?? (bike ? H * 0.62 : H * 0.36);
  const seatZ = opts.seatZ ?? (bike ? -size.z * 0.08 : size.z * 0.02 - 0.1);
  const mk = (x, y, z, parent = group) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const seat = mk(seatX, seatY + 0.07, seatZ, bodyGroup);
  const handL = mk(seatX + (bike ? 0.3 : 0.17), seatY + (bike ? 0.25 : 0.38), seatZ + (bike ? 0.5 : 0.5), bodyGroup);
  const handR = mk(seatX - (bike ? 0.3 : 0.17), seatY + (bike ? 0.25 : 0.38), seatZ + (bike ? 0.5 : 0.5), bodyGroup);
  const pedalPoints = {
    accel: mk(seatX - 0.1, 0.18, seatZ + 0.78, bodyGroup),
    brake: mk(seatX + 0.05, 0.18, seatZ + 0.78, bodyGroup),
    rest: mk(seatX + 0.3, 0.16, seatZ + 0.7, bodyGroup)
  };
  const pegs = bike ? { L: mk(0.26, 0.38, seatZ - 0.05, bodyGroup), R: mk(-0.26, 0.38, seatZ - 0.05, bodyGroup) } : undefined;
  let steeringWheel = null;
  holder.traverse((o) => {
    if (!steeringWheel && /steering.?wheel/i.test(o.name || '')) steeringWheel = o;
  });

  const out = {
    group,
    bodyGroup,
    wheels,
    info,
    seat,
    handL,
    handR,
    pedalPoints,
    pegs,
    steeringWheel: steeringWheel || { rotation: { z: 0 } },
    brakeLights: brake,
    headlights: head,
    doorPoint: new THREE.Vector3(size.x / 2 + 0.85, 0, seatZ),
    cameraHeight: H + 0.45,
    dims: {
      length: size.z,
      width: size.x,
      height: H,
      wheelRadius: wheels[0]?.radius ?? 0.33,
      wheelbase,
      zCenter: 0,
      halfExtents: { x: size.x / 2 - 0.02, y: H / 2, z: size.z / 2 - 0.05 }
    },
    imported: true
  };
  if (bike) out.handlebar = { L: handL, R: handR };
  return out;
}
