import * as THREE from 'three';

/**
 * Merge static, non-instanced meshes under `root` into one mesh per (material, shadow flags, spatial cell).
 * Cells keep frustum culling effective; the merge removes most draw calls (and shadow/SSAO-pass calls).
 * Returns {before, after}.
 */
const canon = new Map();
/** Share one material instance between meshes whose look is identical (landmark builders create many duplicates). */
function canonical(m) {
  if (!m.isMeshStandardMaterial && !m.isMeshBasicMaterial && !m.isMeshLambertMaterial) return m;
  if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return m; // custom shader patch: keep as is
  if (m.userData && m.userData.noShare) return m;
  const k = [m.type, m.color?.getHex(), m.roughness, m.metalness, m.map?.uuid, m.normalMap?.uuid, m.roughnessMap?.uuid, m.emissive?.getHex(), m.emissiveIntensity,
    m.emissiveMap?.uuid, m.aoMap?.uuid, m.transparent, m.opacity, m.side, m.vertexColors, m.flatShading, m.alphaTest, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits,
    m.depthWrite, m.envMapIntensity, m.name].join('|');
  const hit = canon.get(k);
  if (hit) return hit;
  canon.set(k, m);
  return m;
}

export function mergeStaticMeshes(root, cell = 120) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const bb = new THREE.Box3();
  const c = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.isLine || o.isPoints) return;
    const g = o.geometry;
    if (!g || !g.attributes.position || !g.attributes.normal || g.morphAttributes?.position) return;
    if (o.userData?.noMerge) return;
    o.material = canonical(o.material);
    let vis = true;
    for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
    if (!vis) return;
    if (!g.boundingBox) g.computeBoundingBox();
    bb.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
    bb.getCenter(c);
    const sig = (g.attributes.uv ? 'u' : '-') + (g.attributes.color ? 'c' : '-');
    const key = [o.material.uuid, o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, o.renderOrder, sig, Math.floor(c.x / cell), Math.floor(c.z / cell)].join('|');
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, ro: o.renderOrder, uv: !!g.attributes.uv, col: !!g.attributes.color, list: [] }));
    b.list.push(o);
  });

  let before = 0, after = 0;
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const b of buckets.values()) {
    before += b.list.length;
    if (b.list.length < 2) { after += b.list.length; continue; }
    let vc = 0, ic = 0;
    for (const o of b.list) { const g = o.geometry; vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(vc * 3), N = new Float32Array(vc * 3);
    const U = b.uv ? new Float32Array(vc * 2) : null, C = b.col ? new Float32Array(vc * 3) : null;
    const I = new Uint32Array(ic);
    let vo = 0, io = 0;
    for (const o of b.list) {
      const g = o.geometry, p = g.attributes.position, nn = g.attributes.normal, u = g.attributes.uv, col = g.attributes.color;
      nm.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
        n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize();
        N[(vo + i) * 3] = n.x; N[(vo + i) * 3 + 1] = n.y; N[(vo + i) * 3 + 2] = n.z;
        if (U) { U[(vo + i) * 2] = u.getX(i); U[(vo + i) * 2 + 1] = u.getY(i); }
        if (C) { C[(vo + i) * 3] = col.getX(i); C[(vo + i) * 3 + 1] = col.getY(i); C[(vo + i) * 3 + 2] = col.getZ(i); }
      }
      // mirrored transforms flip the winding
      const flip = o.matrixWorld.determinant() < 0;
      const cnt = g.index ? g.index.count : p.count;
      for (let i = 0; i < cnt; i += 3) {
        const a0 = g.index ? g.index.getX(i) : i, a1 = g.index ? g.index.getX(i + 1) : i + 1, a2 = g.index ? g.index.getX(i + 2) : i + 2;
        I[io++] = vo + a0; I[io++] = vo + (flip ? a2 : a1); I[io++] = vo + (flip ? a1 : a2);
      }
      vo += p.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (U) geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    if (C) geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    geo.setIndex(new THREE.BufferAttribute(I, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const m = new THREE.Mesh(geo, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv; m.renderOrder = b.ro;
    m.name = 'merged';
    root.add(m);
    for (const o of b.list) o.parent && o.parent.remove(o);
    after += 1;
  }
  return { before, after };
}
