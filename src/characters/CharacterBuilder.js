import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural, outfit-driven humanoids that share ONE 17-bone Mixamo-named skeleton
 * (Hips, Spine, Spine1, Neck, Head, arms, forearms, hands, legs, feet) so animation, foot IK,
 * arm IK, combat and the zombie animator all work on every character.
 *
 * Material names follow AssetLoader.applyCharacterPBRMaterials (skin_* gets subsurface rim,
 * hair_* alpha-tested). NEVER put "head" / "body" / "face" in a clothing material name.
 */

export const OUTFITS = {
  operator: { label: 'Tactical Operator', gender: 'm' },
  executive: { label: 'Executive (rich)', gender: 'm' },
  survivor: { label: 'Street Survivor (poor)', gender: 'm' },
  racer: { label: 'Street Racer', gender: 'f' }
};
export const OUTFIT_IDS = Object.keys(OUTFITS);

const SKIN_TONES = [0xf0c8a0, 0xd9a17c, 0xb97a56, 0x8d5a3b, 0x6b4430];

// ------------------------------------------------------------------ procedural textures
const texCache = new Map();
function canvasTex(key, size, draw, { repeat = 1, srgb = true } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}
const rand = (() => {
  let s = 1337;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

function speckle(g, size, amount, alpha, dark = true) {
  for (let i = 0; i < amount; i++) {
    const v = dark ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${rand() * alpha})`;
    g.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
}

const TEX = {
  denim: (base = 0x2f4a6e) =>
    canvasTex('denim' + base, 256, (g, s) => {
      g.fillStyle = hex(base);
      g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 2) {
        g.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.05})`;
        g.fillRect(0, y, s, 1);
      }
      for (let x = 0; x < s; x += 3) {
        g.fillStyle = `rgba(0,0,0,${0.06 + rand() * 0.06})`;
        g.fillRect(x, 0, 1, s);
      }
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `rgba(210,225,255,${0.04 + rand() * 0.06})`;
        g.beginPath();
        g.ellipse(rand() * s, rand() * s, 30 + rand() * 40, 12 + rand() * 24, rand() * 3, 0, 6.3);
        g.fill();
      }
      speckle(g, s, 500, 0.25);
    }, { repeat: 2 }),
  camo: () =>
    canvasTex('camo', 256, (g, s) => {
      g.fillStyle = '#5a5f3f';
      g.fillRect(0, 0, s, s);
      const cols = ['#3d422b', '#7b7a52', '#2c2f21', '#8d8660'];
      for (let i = 0; i < 70; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        const x = rand() * s, y = rand() * s;
        g.ellipse(x, y, 10 + rand() * 26, 6 + rand() * 14, rand() * 3, 0, 6.3);
        g.fill();
        // wrap so it tiles
        g.ellipse(x - s, y, 20, 10, 0, 0, 6.3);
      }
      speckle(g, s, 600, 0.2);
    }, { repeat: 2 }),
  pinstripe: () =>
    canvasTex('pin', 256, (g, s) => {
      g.fillStyle = '#23262b';
      g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 16) {
        g.fillStyle = 'rgba(190,195,205,0.55)';
        g.fillRect(x, 0, 1, s);
      }
      speckle(g, s, 900, 0.12, false);
    }, { repeat: 3 }),
  knit: (base) =>
    canvasTex('knit' + base, 128, (g, s) => {
      g.fillStyle = hex(base);
      g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 4) {
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(x, 0, 1, s);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + 2, 0, 1, s);
      }
    }, { repeat: 4 }),
  worn: (base) =>
    canvasTex('worn' + base, 256, (g, s) => {
      g.fillStyle = hex(base);
      g.fillRect(0, 0, s, s);
      speckle(g, s, 1800, 0.22);
      speckle(g, s, 500, 0.14, false);
      for (let i = 0; i < 9; i++) {
        g.fillStyle = `rgba(40,28,15,${0.06 + rand() * 0.1})`;
        g.beginPath();
        g.ellipse(rand() * s, rand() * s, 20 + rand() * 40, 14 + rand() * 30, rand() * 3, 0, 6.3);
        g.fill();
      }
    }, { repeat: 2 }),
  leather: (base) =>
    canvasTex('leather' + base, 256, (g, s) => {
      g.fillStyle = hex(base);
      g.fillRect(0, 0, s, s);
      speckle(g, s, 2500, 0.1);
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = 'rgba(0,0,0,0.08)';
        g.beginPath();
        const x = rand() * s, y = rand() * s;
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 20, y + 10, x + 40 * rand(), y + 30 * rand());
        g.stroke();
      }
    }, { repeat: 2 }),
  skin: (tone, zombie) =>
    canvasTex('skin' + tone + (zombie ? 'z' : ''), 256, (g, s) => {
      g.fillStyle = hex(tone);
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(${zombie ? '60,70,50' : '140,70,50'},${rand() * 0.08})`;
        g.beginPath();
        g.arc(rand() * s, rand() * s, 4 + rand() * 18, 0, 6.3);
        g.fill();
      }
      speckle(g, s, 1400, 0.08);
      if (zombie) {
        g.strokeStyle = 'rgba(60,15,50,0.55)';
        g.lineWidth = 1.4;
        for (let i = 0; i < 26; i++) {
          g.beginPath();
          let x = rand() * s, y = rand() * s;
          g.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += (rand() - 0.5) * 36;
            y += (rand() - 0.2) * 30;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        for (let i = 0; i < 8; i++) {
          g.fillStyle = `rgba(90,10,10,${0.25 + rand() * 0.3})`;
          g.beginPath();
          g.ellipse(rand() * s, rand() * s, 8 + rand() * 16, 5 + rand() * 10, rand() * 3, 0, 6.3);
          g.fill();
        }
      }
    }, { repeat: 1 }),
  veins: () =>
    canvasTex('veins', 256, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.strokeStyle = 'rgba(70,20,90,0.9)';
      g.lineWidth = 1.6;
      for (let i = 0; i < 34; i++) {
        g.beginPath();
        let x = rand() * s, y = rand() * s;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (rand() - 0.5) * 34;
          y += (rand() - 0.5) * 34;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }, { repeat: 1 })
};

// ------------------------------------------------------------------ materials
function makeMaterials(outfit, tone, zombie) {
  const std = (name, color, opts = {}) =>
    new THREE.MeshStandardMaterial({ name, color, roughness: 0.8, metalness: 0.02, ...opts });
  const m = {};
  m.skin = std('skin_main', 0xffffff, { map: TEX.skin(tone, zombie), roughness: 0.55 });
  m.lips = std('skin_lips', zombie ? 0x6a3a3a : 0xb4605a, { roughness: 0.4 });
  m.eyeWhite = std('eye_white', zombie ? 0xd8d6a8 : 0xf4f4f0, { roughness: 0.18 });
  m.iris = std('eye_iris', zombie ? 0x7a1010 : 0x2d2118, { roughness: 0.1 });
  m.hair = std('hair_main', 0x1c1510, { roughness: 0.45 });
  m.black = std('cloth_black', 0x101113, { roughness: 0.6, metalness: 0.3 });
  m.metal = std('gear_metal', 0x8a8f96, { roughness: 0.3, metalness: 0.95 });
  m.gold = std('gear_gold', 0xd4a84a, { roughness: 0.25, metalness: 1.0 });
  m.rubber = std('gear_rubber', 0x151515, { roughness: 0.9 });
  m.white = std('cloth_white', 0xe8e8e6, { roughness: 0.75 });
  m.veinMat = new THREE.MeshBasicMaterial({
    map: TEX.veins(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });

  const dirty = zombie ? 0.55 : 0;
  const cl = (name, base, texKey) => {
    const mat = std('cloth_' + name, zombie ? 0xcfc7b8 : 0xffffff, { map: texKey, roughness: 0.88 });
    if (!texKey) mat.color.set(base);
    return mat;
  };
  switch (outfit) {
    case 'operator':
      m.pants = cl('pants', 0, TEX.camo());
      m.shirt = cl('shirt', 0, TEX.worn(0x4b5033));
      m.vest = cl('vest', 0, TEX.worn(0x2f3a2d));
      m.gear = std('cloth_gear', 0x17191c, { roughness: 0.6, metalness: 0.4 });
      m.boot = cl('boot', 0, TEX.leather(0x1f1a14));
      m.glove = std('cloth_glove', 0x16181a, { roughness: 0.7 });
      m.helmet = std('gear_helmet', 0x343a2f, { roughness: 0.55, metalness: 0.25 });
      m.visor = std('gear_visor', 0x07141c, { roughness: 0.08, metalness: 0.8 });
      break;
    case 'executive':
      m.pants = cl('pants', 0, TEX.pinstripe());
      m.shirt = std('cloth_shirt', 0xf3f3f1, { roughness: 0.7 });
      m.jacket = cl('blazer', 0, TEX.pinstripe());
      m.tie = std('cloth_tie', 0x16213f, { roughness: 0.35, metalness: 0.1 });
      m.shoe = std('cloth_shoe', 0x1c110a, { roughness: 0.22, metalness: 0.15 });
      m.pocket = std('cloth_pocketsq', 0xa5273b, { roughness: 0.5 });
      break;
    case 'survivor':
      m.pants = cl('jeans', 0, TEX.denim(0x3d567a));
      m.shirt = cl('hoodie', 0, TEX.knit(0x66666a));
      m.cap = cl('beanie', 0, TEX.knit(0x7c2d2a));
      m.shoe = cl('sneaker', 0, TEX.worn(0x8a867e));
      m.sole = std('cloth_sole', 0xc9c3b4, { roughness: 0.8 });
      m.patch = cl('patch', 0, TEX.denim(0x6d7d52));
      m.bag = cl('bag', 0, TEX.worn(0x5c4a32));
      break;
    case 'racer':
      m.pants = cl('leggings', 0, TEX.leather(0x15161a));
      m.jacket = std('cloth_jacket', 0xb01820, { roughness: 0.34, metalness: 0.1, map: TEX.leather(0xb01820) });
      m.stripe = std('cloth_stripe', 0xf2f2f2, { roughness: 0.4 });
      m.shirt = std('cloth_tank', 0x1c1c20, { roughness: 0.8 });
      m.boot = cl('boot', 0, TEX.leather(0x201a17));
      m.glove = std('cloth_glove', 0x16181a, { roughness: 0.5 });
      m.visor = std('gear_shades', 0x0a0a10, { roughness: 0.05, metalness: 0.9 });
      break;
  }
  if (dirty) {
    // dull and darken the clothes for zombies
    for (const k of ['pants', 'shirt', 'vest', 'jacket', 'cap', 'shoe', 'boot']) {
      if (m[k] && m[k].color) m[k].color.multiplyScalar(0.55);
    }
  }
  return m;
}

// ------------------------------------------------------------------ geometry helpers
const sphereG = new THREE.SphereGeometry(1, 24, 18);
function ell(parent, mat, rx, ry, rz, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(sphereG, mat);
  mesh.scale.set(rx, ry, rz);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function tube(parent, mat, rTop, rBot, len, x = 0, y = 0, z = 0, seg = 18) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, seg, 1), mat);
  mesh.position.set(x, y - len / 2, z);
  parent.add(mesh);
  return mesh;
}
function rbox(parent, mat, w, h, d, x = 0, y = 0, z = 0, r = 0.008) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.1, h / 2.1, d / 2.1)), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// ------------------------------------------------------------------ skeleton
function createSkeleton(female) {
  const group = new THREE.Group();
  const bones = {};
  const mk = (key, name, x, y, z, parent) => {
    const b = new THREE.Bone();
    b.name = 'mixamorig' + name;
    b.position.set(x, y, z);
    parent.add(b);
    bones[key] = b;
    return b;
  };
  const sx = female ? 0.178 : 0.2;
  const hx = female ? 0.115 : 0.108;
  mk('Hips', 'Hips', 0, 0.96, 0, group);
  mk('Spine', 'Spine', 0, 0.14, 0, bones.Hips);
  mk('Spine1', 'Spine1', 0, 0.24, 0, bones.Spine);
  mk('Neck', 'Neck', 0, 0.22, 0, bones.Spine1);
  mk('Head', 'Head', 0, 0.1, 0, bones.Neck);
  mk('LeftArm', 'LeftArm', sx, 0.18, 0, bones.Spine1);
  mk('LeftForeArm', 'LeftForeArm', 0, -0.27, 0, bones.LeftArm);
  mk('LeftHand', 'LeftHand', 0, -0.27, 0, bones.LeftForeArm);
  mk('RightArm', 'RightArm', -sx, 0.18, 0, bones.Spine1);
  mk('RightForeArm', 'RightForeArm', 0, -0.27, 0, bones.RightArm);
  mk('RightHand', 'RightHand', 0, -0.27, 0, bones.RightForeArm);
  mk('LeftUpLeg', 'LeftUpLeg', hx, -0.06, 0, bones.Hips);
  mk('LeftLeg', 'LeftLeg', 0, -0.43, 0, bones.LeftUpLeg);
  mk('LeftFoot', 'LeftFoot', 0, -0.42, 0, bones.LeftLeg);
  mk('RightUpLeg', 'RightUpLeg', -hx, -0.06, 0, bones.Hips);
  mk('RightLeg', 'RightLeg', 0, -0.43, 0, bones.RightUpLeg);
  mk('RightFoot', 'RightFoot', 0, -0.42, 0, bones.RightLeg);
  return { group, bones };
}

// ------------------------------------------------------------------ anatomy
function buildAnatomy(B, M, female, zombie, parts) {
  const k = female ? 0.9 : 1;
  // pelvis / abdomen / chest
  ell(B.Hips, M.skin, (female ? 0.17 : 0.158) , 0.1, 0.115, 0, -0.01, 0);
  ell(B.Spine, M.skin, 0.125 * k, 0.15, 0.092, 0, 0.1, 0);
  ell(B.Spine1, M.skin, (female ? 0.158 : 0.182), 0.19, 0.115, 0, 0.1, 0);
  // neck + trapezius
  tube(B.Neck, M.skin, 0.046, 0.052, 0.12, 0, 0.07, 0, 16);
  ell(B.Spine1, M.skin, 0.12 * k, 0.05, 0.085, 0, 0.2, -0.015);

  // arms
  for (const s of ['Left', 'Right']) {
    const arm = B[s + 'Arm'];
    const fore = B[s + 'ForeArm'];
    const hand = B[s + 'Hand'];
    ell(arm, M.skin, 0.049, 0.052, 0.05, 0, 0, 0); // deltoid
    tube(arm, M.skin, 0.052 * k, 0.04, 0.27, 0, 0, 0, 16);
    ell(fore, M.skin, 0.04, 0.04, 0.04, 0, 0, 0); // elbow
    tube(fore, M.skin, 0.04, 0.03, 0.27, 0, 0, 0, 16);
    buildHand(hand, M, s === 'Left' ? 1 : -1);
  }
  // legs
  for (const s of ['Left', 'Right']) {
    const up = B[s + 'UpLeg'];
    const lo = B[s + 'Leg'];
    ell(up, M.skin, 0.085 * k, 0.085, 0.085 * k, 0, 0, 0);
    tube(up, M.skin, 0.085 * k, 0.058, 0.43, 0, 0, 0, 16);
    ell(lo, M.skin, 0.058, 0.058, 0.058, 0, 0, 0);
    tube(lo, M.skin, 0.058, 0.036, 0.42, 0, 0, 0, 16);
  }

  // ---- head
  const head = B.Head;
  const skull = ell(head, M.skin, 0.092, 0.108, 0.1, 0, 0.095, -0.005);
  ell(head, M.skin, 0.082, 0.062, 0.088, 0, 0.04, 0.012); // cheek / maxilla
  // jaw pivots at the ear line so zombies can open the mouth
  const jaw = new THREE.Group();
  jaw.position.set(0, 0.058, -0.02);
  head.add(jaw);
  ell(jaw, M.skin, 0.071, 0.05, 0.085, 0, -0.03, 0.045);
  ell(jaw, M.skin, 0.03, 0.022, 0.03, 0, -0.058, 0.098); // chin
  ell(jaw, M.lips, 0.034, 0.008, 0.012, 0, -0.004, 0.118); // lower lip
  ell(head, M.lips, 0.032, 0.007, 0.011, 0, 0.044, 0.1); // upper lip
  parts.jaw = jaw;

  // nose, ears, brows
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.045, 12), M.skin);
  nose.rotation.x = Math.PI / 2 + 0.35;
  nose.position.set(0, 0.075, 0.107);
  head.add(nose);
  ell(head, M.skin, 0.019, 0.016, 0.017, 0, 0.056, 0.113);
  for (const sd of [1, -1]) {
    ell(head, M.skin, 0.011, 0.03, 0.022, sd * 0.093, 0.09, -0.005);
    // eye: socket shadow, sclera, iris, pupil
    const eye = new THREE.Group();
    eye.position.set(sd * 0.036, 0.105, 0.087);
    head.add(eye);
    ell(eye, M.skin, 0.02, 0.014, 0.012, 0, 0, -0.005);
    ell(eye, M.eyeWhite, 0.0155, 0.0135, 0.0105, 0, 0, 0.002);
    ell(eye, M.iris, 0.008, 0.008, 0.004, 0, 0, 0.011);
    ell(eye, M.black, 0.0035, 0.0035, 0.002, 0, 0, 0.0145);
    (parts.eyes ||= []).push(eye);
    rbox(head, M.hair, 0.038, 0.007, 0.012, sd * 0.038, 0.128, 0.09, 0.003).rotation.z = sd * -0.12;
  }
  parts.veinShell = [];
  return skull;
}

function buildHand(hand, M, sd, gloveMat = null) {
  const skin = gloveMat || M.skin;
  const g = new THREE.Group();
  hand.add(g);
  rbox(g, skin, 0.086, 0.09, 0.03, 0, -0.05, 0, 0.012);
  const fl = [0.045, 0.05, 0.047, 0.037];
  for (let i = 0; i < 4; i++) {
    const x = sd * (0.032 - i * 0.021);
    const f1 = new THREE.Group();
    f1.position.set(x, -0.098, 0);
    f1.rotation.x = -0.45;
    g.add(f1);
    rbox(f1, skin, 0.017, fl[i] * 0.95, 0.017, 0, -fl[i] / 2, 0, 0.006);
    const f2 = new THREE.Group();
    f2.position.set(0, -fl[i], 0);
    f2.rotation.x = -0.75;
    f1.add(f2);
    rbox(f2, skin, 0.0155, fl[i] * 0.8, 0.0155, 0, -fl[i] * 0.4, 0, 0.006);
  }
  const th = new THREE.Group();
  th.position.set(-sd * 0.045, -0.05, 0.005);
  th.rotation.set(-0.3, 0, sd * 0.7);
  g.add(th);
  rbox(th, skin, 0.02, 0.05, 0.02, 0, -0.025, 0, 0.008);
  return g;
}

// ------------------------------------------------------------------ clothes
function sleeves(B, mat, { short = false, rTop = 0.054, rMid = 0.047, rLow = 0.04, cuff = null } = {}) {
  for (const s of ['Left', 'Right']) {
    const arm = B[s + 'Arm'];
    const fore = B[s + 'ForeArm'];
    ell(arm, mat, rTop + 0.004, rTop, rTop + 0.004, 0, 0.0, 0);
    tube(arm, mat, rTop, rMid, 0.27, 0, 0, 0, 18);
    if (!short) {
      ell(fore, mat, rMid * 0.9, rMid * 0.9, rMid * 0.9, 0, 0, 0);
      tube(fore, mat, rMid * 0.92, rLow, 0.235, 0, 0, 0, 18);
      if (cuff) tube(fore, cuff, rLow + 0.004, rLow + 0.004, 0.03, 0, -0.225, 0, 18);
    }
  }
}
function pantLegs(B, mat, { rTop = 0.098, rKnee = 0.07, rAnkle = 0.055, short = 0, flare = 0 } = {}) {
  for (const s of ['Left', 'Right']) {
    const up = B[s + 'UpLeg'];
    const lo = B[s + 'Leg'];
    ell(up, mat, rTop, 0.095, rTop, 0, 0, 0);
    tube(up, mat, rTop, rKnee, 0.43, 0, 0, 0, 20);
    ell(lo, mat, rKnee * 1.02, rKnee, rKnee * 1.02, 0, 0, 0);
    tube(lo, mat, rKnee, rAnkle + flare, 0.4 - short, 0, 0, 0, 20);
  }
}
function pelvisCloth(B, mat, w = 0.168) {
  ell(B.Hips, mat, w, 0.105, 0.125, 0, -0.012, 0);
}
function torsoCloth(B, mat, { female = false, bulk = 1, hem = 0.0 } = {}) {
  ell(B.Spine, mat, (female ? 0.135 : 0.135) * bulk, 0.16, 0.098 * bulk, 0, 0.1 - hem, 0);
  ell(B.Spine1, mat, (female ? 0.163 : 0.19) * bulk, 0.2, 0.122 * bulk, 0, 0.1, 0);
  ell(B.Spine1, mat, 0.125, 0.055, 0.09, 0, 0.2, -0.015);
}
function shoes(B, soleMat, upperMat, { height = 0.07, length = 0.27, high = false, toe = 0.045 } = {}) {
  for (const s of ['Left', 'Right']) {
    const f = B[s + 'Foot'];
    rbox(f, soleMat, 0.098, 0.022, length, 0, -0.04, 0.062, 0.008);
    rbox(f, upperMat, 0.092, height - 0.02, length * 0.82, 0, -0.02 + (height - 0.07) / 2, 0.04, 0.02);
    ell(f, upperMat, 0.046, 0.032, toe, 0, -0.022, 0.14);
    if (high) {
      tube(B[s + 'Leg'], upperMat, 0.052, 0.046, 0.2, 0, -0.22, 0, 18);
    }
  }
}

function addOperator(B, M, parts) {
  pantLegs(B, M.pants, { rTop: 0.1, rKnee: 0.073, rAnkle: 0.06 });
  pelvisCloth(B, M.pants);
  rbox(B.Hips, M.gear, 0.34, 0.06, 0.22, 0, 0.04, 0, 0.02); // belt
  rbox(B.Hips, M.gear, 0.06, 0.15, 0.06, -0.19, -0.08, 0.02, 0.01); // drop-leg holster
  for (const s of ['Left', 'Right']) {
    rbox(B[s + 'Leg'], M.gear, 0.1, 0.09, 0.05, 0, -0.01, 0.07, 0.012); // knee pad
    shoes(B, M.rubber, M.boot, { high: true, height: 0.085 });
  }
  torsoCloth(B, M.shirt, { bulk: 1.0 });
  sleeves(B, M.shirt);
  // plate carrier + plates + pouches + radio
  ell(B.Spine1, M.vest, 0.2, 0.205, 0.138, 0, 0.1, 0);
  rbox(B.Spine1, M.gear, 0.24, 0.26, 0.04, 0, 0.1, 0.14, 0.02);
  rbox(B.Spine1, M.gear, 0.24, 0.26, 0.04, 0, 0.1, -0.14, 0.02);
  for (const x of [-0.085, 0, 0.085]) rbox(B.Spine1, M.gear, 0.07, 0.1, 0.05, x, -0.02, 0.17, 0.012);
  rbox(B.Spine1, M.gear, 0.05, 0.12, 0.04, 0.12, 0.12, 0.17, 0.01);
  tube(B.Spine1, M.gear, 0.006, 0.006, 0.18, 0.14, 0.32, 0.12, 6);
  rbox(B.Spine1, M.vest, 0.3, 0.06, 0.15, 0, 0.22, 0, 0.02); // shoulder yoke
  rbox(B.Spine, M.vest, 0.28, 0.2, 0.1, 0, 0.12, -0.17, 0.03); // assault pack
  for (const s of ['Left', 'Right']) {
    const arm = B[s + 'Arm'];
    const fore = B[s + 'ForeArm'];
    rbox(fore, M.gear, 0.085, 0.07, 0.085, 0, -0.04, 0, 0.012);
    ell(arm, M.vest, 0.058, 0.058, 0.058, 0, 0.0, 0);
    buildHand(B[s + 'Hand'], M, s === 'Left' ? 1 : -1, M.glove);
  }
  // helmet + goggles + chin strap
  const helm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), M.helmet);
  helm.scale.set(0.118, 0.125, 0.13);
  helm.position.set(0, 0.115, -0.012);
  B.Head.add(helm);
  rbox(B.Head, M.helmet, 0.17, 0.02, 0.05, 0, 0.175, 0.105, 0.008);
  rbox(B.Head, M.helmet, 0.025, 0.06, 0.1, 0.108, 0.07, -0.01, 0.01);
  rbox(B.Head, M.helmet, 0.025, 0.06, 0.1, -0.108, 0.07, -0.01, 0.01);
  rbox(B.Head, M.visor, 0.17, 0.05, 0.03, 0, 0.115, 0.098, 0.014);
  rbox(B.Head, M.gear, 0.03, 0.035, 0.05, 0, 0.17, 0.085, 0.01); // NVG mount
  hairShort(B.Head, M.hair, 0.06);
  stubble(B.Head, M);
}
function addExecutive(B, M, parts) {
  pantLegs(B, M.pants, { rTop: 0.097, rKnee: 0.068, rAnkle: 0.062 });
  pelvisCloth(B, M.pants, 0.164);
  rbox(B.Hips, M.black, 0.34, 0.035, 0.2, 0, 0.045, 0, 0.012); // belt
  rbox(B.Hips, M.gold, 0.04, 0.03, 0.01, 0, 0.045, 0.105, 0.004); // buckle
  shoes(B, M.rubber, M.shoe, { height: 0.065, length: 0.285, toe: 0.04 });
  // shirt + tie
  torsoCloth(B, M.shirt, { bulk: 1.0 });
  sleeves(B, M.shirt);
  rbox(B.Spine1, M.tie, 0.034, 0.3, 0.012, 0, 0.1, 0.123, 0.004);
  rbox(B.Spine1, M.tie, 0.05, 0.05, 0.016, 0, 0.245, 0.1, 0.006);
  // blazer
  ell(B.Spine1, M.jacket, 0.196, 0.2, 0.128, 0, 0.1, 0);
  ell(B.Spine, M.jacket, 0.142, 0.17, 0.105, 0, 0.08, 0);
  tube(B.Hips, M.jacket, 0.15, 0.165, 0.2, 0, 0.02, 0, 22).scale.z = 0.75;
  rbox(B.Spine1, M.jacket, 0.08, 0.2, 0.01, -0.07, 0.15, 0.13, 0.004).rotation.z = 0.3; // lapels
  rbox(B.Spine1, M.jacket, 0.08, 0.2, 0.01, 0.07, 0.15, 0.13, 0.004).rotation.z = -0.3;
  rbox(B.Spine1, M.pocket, 0.04, 0.02, 0.012, 0.1, 0.17, 0.132, 0.004);
  for (const s of ['Left', 'Right']) {
    const arm = B[s + 'Arm'];
    const fore = B[s + 'ForeArm'];
    ell(arm, M.jacket, 0.058, 0.058, 0.058, 0, 0, 0);
    tube(arm, M.jacket, 0.056, 0.049, 0.27, 0, 0, 0, 18);
    ell(fore, M.jacket, 0.048, 0.048, 0.048, 0, 0, 0);
    tube(fore, M.jacket, 0.049, 0.042, 0.205, 0, 0, 0, 18);
  }
  // watch (left wrist)
  tube(B.LeftForeArm, M.gold, 0.037, 0.037, 0.02, 0, -0.235, 0, 18);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.008, 20), M.black);
  dial.position.set(0, -0.245, 0.034);
  dial.rotation.x = Math.PI / 2;
  B.LeftForeArm.add(dial);
  hairSlick(B.Head, M.hair);
}
function addSurvivor(B, M, parts) {
  pantLegs(B, M.pants, { rTop: 0.1, rKnee: 0.074, rAnkle: 0.064, flare: 0.005 });
  pelvisCloth(B, M.pants, 0.17);
  rbox(B.LeftLeg, M.patch, 0.1, 0.1, 0.012, 0, -0.01, 0.068, 0.006);
  rbox(B.RightUpLeg, M.patch, 0.07, 0.09, 0.012, 0, -0.25, 0.088, 0.006);
  // ragged hem
  for (const s of ['Left', 'Right']) tube(B[s + 'Leg'], M.pants, 0.056, 0.06, 0.04, 0, -0.38, 0, 14);
  shoes(B, M.sole, M.shoe, { height: 0.07, length: 0.275 });
  // hoodie with hood bunched at the neck
  torsoCloth(B, M.shirt, { bulk: 1.08 });
  sleeves(B, M.shirt, { rTop: 0.058, rMid: 0.05, rLow: 0.045 });
  tube(B.Hips, M.shirt, 0.15, 0.16, 0.12, 0, 0.03, 0, 22).scale.z = 0.78;
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 12, 24), M.shirt);
  hood.rotation.x = Math.PI / 2 + 0.3;
  hood.position.set(0, 0.0, -0.02);
  B.Neck.add(hood);
  rbox(B.Spine, M.shirt, 0.22, 0.08, 0.04, 0, 0.0, 0.12, 0.03); // kangaroo pocket
  rbox(B.Spine1, M.patch, 0.07, 0.06, 0.012, 0.09, 0.12, 0.138, 0.005);
  // torn bag on one shoulder
  rbox(B.Spine1, M.bag, 0.26, 0.28, 0.12, 0, 0.1, -0.16, 0.03);
  tube(B.Spine1, M.bag, 0.012, 0.012, 0.3, 0.1, 0.25, 0.05, 6).rotation.z = 0.1;
  // wrist wrap
  tube(B.RightForeArm, M.white, 0.04, 0.04, 0.05, 0, -0.2, 0, 14);
  beanie(B.Head, M.cap);
  hairShort(B.Head, M.hair, 0.02, true);
  stubble(B.Head, M, true);
}
function addRacer(B, M, parts) {
  pantLegs(B, M.pants, { rTop: 0.1, rKnee: 0.066, rAnkle: 0.05 });
  pelvisCloth(B, M.pants, 0.176);
  shoes(B, M.rubber, M.boot, { high: true, height: 0.08, length: 0.26, toe: 0.04 });
  // tank top + leather jacket (cropped) with white stripes
  torsoCloth(B, M.shirt, { female: true, bulk: 1.0 });
  ell(B.Spine1, M.jacket, 0.17, 0.18, 0.125, 0, 0.1, 0);
  ell(B.Spine, M.jacket, 0.13, 0.1, 0.1, 0, 0.09, 0);
  for (const sd of [1, -1]) ell(B.Spine1, M.shirt, 0.07, 0.07, 0.06, sd * 0.075, 0.09, 0.09); // bust under jacket
  rbox(B.Spine1, M.stripe, 0.03, 0.3, 0.012, 0, 0.1, 0.132, 0.004);
  rbox(B.Spine1, M.jacket, 0.3, 0.05, 0.14, 0, 0.23, 0, 0.02);
  for (const s of ['Left', 'Right']) {
    const arm = B[s + 'Arm'];
    const fore = B[s + 'ForeArm'];
    ell(arm, M.jacket, 0.052, 0.052, 0.052, 0, 0, 0);
    tube(arm, M.jacket, 0.05, 0.044, 0.27, 0, 0, 0, 18);
    tube(arm, M.stripe, 0.0505, 0.0445, 0.04, 0, -0.1, 0, 18);
    ell(fore, M.jacket, 0.044, 0.044, 0.044, 0, 0, 0);
    tube(fore, M.jacket, 0.044, 0.038, 0.235, 0, 0, 0, 18);
    buildHand(B[s + 'Hand'], M, s === 'Left' ? 1 : -1, M.glove);
  }
  hairPonytail(B.Head, M.hair);
  // sunglasses pushed up on the head
  rbox(B.Head, M.visor, 0.16, 0.035, 0.03, 0, 0.17, 0.065, 0.014).rotation.x = -0.5;
}

// ------------------------------------------------------------------ hair / face extras
function hairShort(head, mat, front = 0.05, messy = false) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
  cap.scale.set(0.099, 0.108, 0.108);
  cap.position.set(0, 0.105, -0.012);
  cap.rotation.x = -0.1;
  head.add(cap);
  ell(head, mat, 0.095, 0.07, 0.07, 0, 0.115, -0.065);
  if (messy) for (let i = 0; i < 6; i++) ell(head, mat, 0.03, 0.02, 0.03, (rand() - 0.5) * 0.15, 0.19, (rand() - 0.5) * 0.12);
  void front;
}
function hairSlick(head, mat) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
  cap.scale.set(0.097, 0.115, 0.112);
  cap.position.set(0, 0.108, -0.01);
  cap.rotation.x = -0.25;
  head.add(cap);
  ell(head, mat, 0.095, 0.075, 0.07, 0, 0.11, -0.07);
}
function hairPonytail(head, mat) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat);
  cap.scale.set(0.1, 0.112, 0.112);
  cap.position.set(0, 0.105, -0.012);
  head.add(cap);
  ell(head, mat, 0.098, 0.1, 0.075, 0, 0.09, -0.06);
  const tail = new THREE.Group();
  tail.position.set(0, 0.12, -0.105);
  tail.rotation.x = 0.7;
  head.add(tail);
  ell(tail, mat, 0.03, 0.04, 0.03, 0, 0, 0);
  tube(tail, mat, 0.026, 0.008, 0.28, 0, 0, 0, 12);
}
function beanie(head, mat) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mat);
  b.scale.set(0.108, 0.115, 0.116);
  b.position.set(0, 0.112, -0.012);
  head.add(b);
  tube(head, mat, 0.105, 0.105, 0.03, 0, 0.12, -0.012, 24);
  ell(head, mat, 0.02, 0.02, 0.02, 0, 0.215, -0.012);
}
function stubble(head, M, heavy = false) {
  const mat = new THREE.MeshStandardMaterial({
    name: 'beard_stubble', color: 0x1a1410, roughness: 0.9, transparent: true, opacity: heavy ? 0.65 : 0.4, depthWrite: false
  });
  ell(head, mat, 0.078, 0.07, 0.084, 0, 0.042, 0.016);
  const jaw = head.children.find((c) => c.isGroup);
  if (jaw) ell(jaw, mat, 0.073, 0.052, 0.087, 0, -0.03, 0.046);
}

// ------------------------------------------------------------------ zombie damage
function applyZombie(B, M, parts, outfit, seed) {
  // blood + gore patches, exposed bone, torn hems, bite wound
  const blood = new THREE.MeshStandardMaterial({ name: 'cloth_blood', color: 0x4a0a0a, roughness: 0.35, metalness: 0.1 });
  const bone = new THREE.MeshStandardMaterial({ name: 'gear_bone', color: 0xd9d2b8, roughness: 0.6 });
  const flesh = new THREE.MeshStandardMaterial({ name: 'skin_wound', color: 0x6d1c1c, roughness: 0.3 });
  const splat = (parent, x, y, z, r) => {
    const m = ell(parent, blood, r, r * (0.6 + rand() * 0.7), 0.006, x, y, z);
    m.rotation.z = rand() * 3;
  };
  for (let i = 0; i < 6; i++) splat(B.Spine1, (rand() - 0.5) * 0.22, 0.02 + rand() * 0.16, 0.152 + 0.01 * rand(), 0.014 + rand() * 0.03);
  for (let i = 0; i < 3; i++) splat(B.Spine, (rand() - 0.5) * 0.16, 0.05 + rand() * 0.1, 0.12, 0.012 + rand() * 0.025);
  ell(B.Neck, flesh, 0.028, 0.022, 0.02, 0.05, 0.035, 0.035); // neck bite
  ell(parts.jaw, blood, 0.04, 0.02, 0.012, 0, -0.02, 0.115); // bloody mouth
  for (let i = 0; i < 4; i++) ell(parts.jaw, blood, 0.008, 0.02 + rand() * 0.02, 0.006, (rand() - 0.5) * 0.06, -0.06, 0.11);
  // one forearm with the bone sticking out
  const fore = B[seed % 2 ? 'LeftForeArm' : 'RightForeArm'];
  ell(fore, flesh, 0.036, 0.05, 0.036, 0, -0.16, 0.012);
  tube(fore, bone, 0.012, 0.009, 0.1, 0.01, -0.14, 0.04, 8).rotation.x = -0.5;
  // missing hair patches: scale the hair down where possible
  parts.zombie = true;
}

// ------------------------------------------------------------------ draw-call optimiser
/** Merge all static meshes of each bone by material (keeps the animated jaw separate). */
function optimiseHumanoid(group, bones, jaw) {
  group.updateMatrixWorld(true);
  const boneList = Object.values(bones);
  const owner = (o) => {
    let n = o.parent;
    while (n) {
      if (n === jaw) return null;
      if (n.isBone) return n;
      n = n.parent;
    }
    return null;
  };
  const buckets = new Map(); // bone -> Map(material -> geometries)
  const meshes = [];
  group.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const inv = new THREE.Matrix4();
  const m4 = new THREE.Matrix4();
  for (const mesh of meshes) {
    const b = owner(mesh);
    if (!b || !boneList.includes(b)) continue;
    let geo = mesh.geometry;
    if (geo.index) geo = geo.toNonIndexed();
    else geo = geo.clone();
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    }
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    inv.copy(b.matrixWorld).invert();
    m4.multiplyMatrices(inv, mesh.matrixWorld);
    geo.applyMatrix4(m4);
    if (!buckets.has(b)) buckets.set(b, new Map());
    const mm = buckets.get(b);
    if (!mm.has(mesh.material)) mm.set(mesh.material, []);
    mm.get(mesh.material).push(geo);
    mesh.parent.remove(mesh);
  }
  for (const [b, mm] of buckets) {
    for (const [mat, geos] of mm) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      b.add(mesh);
      for (const g of geos) g.dispose();
    }
  }
  // drop now-empty helper groups (hand fingers, eyes, ponytail pivots), never the jaw
  const prune = (o) => {
    for (const c of o.children.slice()) prune(c);
    if (o !== jaw && o.isGroup && o !== group && !o.children.length) o.parent.remove(o);
  };
  prune(group);
}

// ------------------------------------------------------------------ public
/**
 * @returns {{group, bones, parts, outfit, setInfection(t), materials}}
 * infection t: 0 healthy -> 1 fully turned (skin grey-green, veins, white eyes, drooping jaw)
 */
export function buildHumanoid({ outfit = 'operator', zombie = false, seed = 1, skinTone = null } = {}) {
  const def = OUTFITS[outfit] || OUTFITS.operator;
  const female = def.gender === 'f';
  const tone = skinTone ?? SKIN_TONES[seed % SKIN_TONES.length];
  const { group, bones: B } = createSkeleton(female);
  const M = makeMaterials(outfit, tone, false);
  const parts = {};

  buildAnatomy(B, M, female, false, parts);
  switch (outfit) {
    case 'executive': addExecutive(B, M, parts); break;
    case 'survivor': addSurvivor(B, M, parts); break;
    case 'racer': addRacer(B, M, parts); break;
    default: addOperator(B, M, parts);
  }
  if (zombie) applyZombie(B, M, parts, outfit, seed);

  // vein overlay shell on the head + arms (fades in with infection)
  const veinShells = [];
  const addVein = (parent, rx, ry, rz, x, y, z) => veinShells.push(ell(parent, M.veinMat, rx, ry, rz, x, y, z));
  addVein(B.Head, 0.096, 0.112, 0.104, 0, 0.095, -0.004);
  addVein(B.Neck, 0.05, 0.07, 0.05, 0, 0.05, 0);
  for (const s of ['Left', 'Right']) addVein(B[s + 'ForeArm'], 0.045, 0.14, 0.045, 0, -0.13, 0);

  const healthyTone = new THREE.Color(tone);
  const zombieTone = new THREE.Color(0x7c8f6c);
  const eyeHealthy = new THREE.Color(0xf4f4f0);
  const eyeSick = new THREE.Color(0xd8d6a0);
  const irisHealthy = new THREE.Color(0x2d2118);
  const irisSick = new THREE.Color(0xb02010);

  const api = {
    group,
    bones: B,
    parts,
    outfit,
    materials: M,
    gender: def.gender,
    infection: zombie ? 1 : 0,
    setInfection(t) {
      t = THREE.MathUtils.clamp(t, 0, 1);
      this.infection = t;
      M.skin.color.set(0xffffff).lerp(new THREE.Color(0x8fa17c), t);
      M.skin.roughness = 0.55 + 0.2 * t;
      M.veinMat.opacity = Math.min(1, t * 1.6);
      M.eyeWhite.color.copy(eyeHealthy).lerp(eyeSick, t);
      M.iris.color.copy(irisHealthy).lerp(irisSick, t);
      M.lips.color.set(0xb4605a).lerp(new THREE.Color(0x6a3a3a), t);
      if (parts.jaw) parts.jaw.rotation.x = 0.0 + t * 0.12;
      void healthyTone;
      void zombieTone;
    },
    /** jaw open amount 0..1 */
    setJaw(a) {
      if (parts.jaw) parts.jaw.rotation.x = a * 0.5;
    }
  };

  // remember rest pose for procedural animators
  for (const k of Object.keys(B)) B[k].userData.rest = B[k].quaternion.clone();
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  optimiseHumanoid(group, B, parts.jaw);
  if (zombie) api.setInfection(1);
  return api;
}
