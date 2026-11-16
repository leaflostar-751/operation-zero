import * as THREE from 'three';

/**
 * Distant scenery so the arena no longer ends at a hard line:
 *  - an endless dusty outer ground,
 *  - a ring of rolling hills (vertex-coloured, noise displaced),
 *  - a far skyline of towers with lit windows,
 *  - instanced pine / round trees around and inside the arena border,
 *  - a few drifting cloud sprites.
 * Everything is instanced / merged: ~12 draw calls, ~40k triangles total.
 */

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (
    hash2(xi, yi) * (1 - u) * (1 - v) +
    hash2(xi + 1, yi) * u * (1 - v) +
    hash2(xi, yi + 1) * (1 - u) * v +
    hash2(xi + 1, yi + 1) * u * v
  );
}
function fbm(x, y) {
  let a = 0.5, f = 1, t = 0;
  for (let i = 0; i < 4; i++) {
    t += a * vnoise(x * f, y * f);
    a *= 0.5;
    f *= 2.07;
  }
  return t;
}

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8a93a0';
  g.fillRect(0, 0, 64, 128);
  const r = rng(7);
  for (let y = 4; y < 124; y += 8) {
    for (let x = 4; x < 60; x += 8) {
      const on = r() > 0.55;
      g.fillStyle = on ? '#d8e2f0' : '#707a88';
      g.fillRect(x, y, 5, 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  return t;
}

export class Scenery {
  constructor(scene, tierConfig) {
    this.scene = scene;
    this.tier = tierConfig;
    this.clouds = [];
    this.group = new THREE.Group();
    this.group.name = 'scenery';
    scene.add(this.group);
  }

  build() {
    this.buildOuterGround();
    this.buildHills();
    this.buildTrees();
    this.buildClouds();
  }

  buildOuterGround() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b6f64, roughness: 0.97, metalness: 0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.1;
    m.receiveShadow = false;
    this.group.add(m);
  }

  buildHills() {
    const inner = 1100, outer = 2600, segR = 36, segA = 160;
    const pos = [], col = [], idx = [];
    const cLow = new THREE.Color(0x56664a);
    const cMid = new THREE.Color(0x6f7a58);
    const cRock = new THREE.Color(0x8b8a80);
    const cHaze = new THREE.Color(0x9aa9b3);
    const tmp = new THREE.Color();
    for (let i = 0; i <= segR; i++) {
      const tr = i / segR;
      const r = inner + (outer - inner) * tr * tr;
      for (let j = 0; j <= segA; j++) {
        const a = (j / segA) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const ridge = Math.min(1, Math.max(0, (r - inner) / 120));
        let h = (fbm(x * 0.006, z * 0.006) - 0.3) * 110 * ridge + fbm(x * 0.03, z * 0.03) * 7 * ridge;
        h = Math.max(-0.4, h) - 0.1;
        pos.push(x, h, z);
        const k = Math.min(1, Math.max(0, h / 55));
        tmp.copy(cLow).lerp(cMid, Math.min(1, k * 2));
        if (k > 0.55) tmp.lerp(cRock, (k - 0.55) * 1.6);
        tmp.lerp(cHaze, Math.min(0.75, tr * tr * 0.8));
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let i = 0; i < segR; i++) {
      for (let j = 0; j < segA; j++) {
        const a = i * (segA + 1) + j;
        const b = a + segA + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    this.group.add(mesh);
  }

  buildSkyline() {
    const r = rng(1337);
    const n = this.tier.name === 'LOW' ? 36 : 70;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const tex = windowTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.55, metalness: 0.15 });
    mat.onBeforeCompile = (sh) => {
      // repeat the window texture per building height/width using the instance scale
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vScale;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vScale;')
        .replace('#include <map_fragment>', `
          vec2 uvS = vMapUv * vec2(max(vScale.x, vScale.z) / 22.0, vScale.y / 34.0);
          vec4 sampledDiffuseColor = texture2D( map, uvS );
          diffuseColor *= sampledDiffuseColor;`);
    };
    const inst = new THREE.InstancedMesh(geo, mat, n);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.1;
      const rad = 520 + r() * 160;
      const w = 26 + r() * 40;
      const h = 35 + Math.pow(r(), 2) * 110;
      q.setFromEuler(new THREE.Euler(0, r() * Math.PI, 0));
      m4.compose(new THREE.Vector3(Math.cos(a) * rad, -2, Math.sin(a) * rad), q, new THREE.Vector3(w, h, w * (0.7 + r() * 0.6)));
      inst.setMatrixAt(i, m4);
      col.setHSL(0.58, 0.08 + r() * 0.08, 0.62 + r() * 0.2);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);
  }

  buildTrees() {
    const r = rng(99);
    const count = this.tier.name === 'LOW' ? 140 : 320;
    // pine = trunk + 3 cones merged into one geometry
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6);
    trunk.translate(0, 1.1, 0);
    parts.push({ g: trunk, c: new THREE.Color(0x4a3524) });
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.ConeGeometry(1.9 - i * 0.45, 3.2 - i * 0.5, 8);
      cone.translate(0, 3.0 + i * 1.5, 0);
      parts.push({ g: cone, c: new THREE.Color(0x24462c).offsetHSL(0, 0, i * 0.02) });
    }
    const merge = (list) => {
      const P = [], C = [], I = [];
      let off = 0;
      for (const { g, c } of list) {
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          P.push(p.getX(i), p.getY(i), p.getZ(i));
          C.push(c.r, c.g, c.b);
        }
        const ix = g.index;
        for (let i = 0; i < ix.count; i++) I.push(ix.getX(i) + off);
        off += p.count;
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      out.setIndex(I);
      out.computeVertexNormals();
      return out;
    };
    const pineGeo = merge(parts);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    const pines = new THREE.InstancedMesh(pineGeo, mat, count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 8) {
      const x = (r() - 0.5) * 700;
      const z = (r() - 0.5) * 700;
      const edge = Math.max(Math.abs(x), Math.abs(z));
      if (edge < 88 || x < 90) continue; // keep the arena and the city clear
      const hillH = Math.max(0, (fbm(x * 0.006, z * 0.006) - 0.3) * 110 * Math.min(1, Math.max(0, (Math.hypot(x, z) - 150) / 120)));
      const s = 0.8 + r() * 1.1;
      q.setFromEuler(new THREE.Euler(0, r() * Math.PI * 2, 0));
      m4.compose(new THREE.Vector3(x, hillH - 0.1, z), q, new THREE.Vector3(s, s * (0.9 + r() * 0.5), s));
      pines.setMatrixAt(placed++, m4);
    }
    pines.count = placed;
    pines.instanceMatrix.needsUpdate = true;
    pines.castShadow = false;
    this.group.add(pines);
  }

  buildClouds() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const x = 30 + r() * 68, y = 44 + r() * 40, rad = 14 + r() * 22;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const rr = rng(21);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.55 + rr() * 0.3 });
      const s = new THREE.Sprite(m);
      const a = rr() * Math.PI * 2;
      const rad = 260 + rr() * 380;
      s.position.set(Math.cos(a) * rad, 150 + rr() * 90, Math.sin(a) * rad);
      const sc = 140 + rr() * 200;
      s.scale.set(sc * 1.8, sc * 0.6, 1);
      s.userData.speed = 1.2 + rr() * 1.5;
      this.group.add(s);
      this.clouds.push(s);
    }
  }

  update(dt, camPos) {
    for (const s of this.clouds) {
      s.position.x += dt * s.userData.speed;
      if (s.position.x > 700) s.position.x = -700;
    }
    // keep the outer ground / hills centred so they never move relative to the camera horizon
    if (camPos) {
      this.group.position.x = camPos.x * 0.0;
    }
  }
}
