import * as THREE from 'three';

/** Procedural canvas textures for the city: asphalt, pavement, facades, signs, water. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const cv = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function speckle(g, w, h, n, r, lo, hi, a) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(lo + r() * (hi - lo));
    g.fillStyle = `rgba(${v},${v},${v},${a})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

const cache = new Map();
const once = (k, f) => {
  if (!cache.has(k)) cache.set(k, f());
  return cache.get(k);
};

/** type: 'highway' (one carriageway, 3 lanes) | 'main' (2 lanes, dashed centre) | 'street' (no markings) | 'deck' */
export function asphaltTexture(type) {
  return once('asphalt_' + type, () => {
    const W = 512, H = 512; // v = 12 m along the road
    const c = cv(W, H);
    const g = c.getContext('2d');
    const r = rng(type.length * 977);
    g.fillStyle = '#3b3d41';
    g.fillRect(0, 0, W, H);
    speckle(g, W, H, 9000, r, 20, 110, 0.35);
    speckle(g, W, H, 2500, r, 120, 200, 0.18);
    // tyre wear bands
    const lanes = type === 'highway' ? 3 : type === 'main' ? 2 : 2;
    for (let l = 0; l < lanes; l++) {
      const cx = ((l + 0.5) / lanes) * W;
      for (const o of [-0.17, 0.17]) {
        const gr = g.createLinearGradient(cx + o * (W / lanes) - 14, 0, cx + o * (W / lanes) + 14, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(0.5, 'rgba(0,0,0,0.2)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(cx + o * (W / lanes) - 14, 0, 28, H);
      }
    }
    // patches and cracks
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(${20 + r() * 20},${20 + r() * 20},${22 + r() * 20},0.35)`;
      g.fillRect(r() * W, r() * H, 20 + r() * 80, 20 + r() * 70);
    }
    g.strokeStyle = 'rgba(15,15,15,0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      let x = r() * W, y = r() * H;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += r() * 30; g.lineTo(x, y); }
      g.stroke();
    }
    const line = (x, w, dash, col) => {
      g.fillStyle = col;
      if (!dash) g.fillRect(x - w / 2, 0, w, H);
      else g.fillRect(x - w / 2, 20, w, 110); // 3 m dash in a 12 m tile
    };
    if (type === 'highway') {
      line(8, 9, false, '#e8e8e2'); // edge lines
      line(W - 8, 9, false, '#e8e8e2');
      line(W / 3, 7, true, '#e8e8e2');
      line((2 * W) / 3, 7, true, '#e8e8e2');
    } else if (type === 'main') {
      line(7, 7, false, '#dcdcd5');
      line(W - 7, 7, false, '#dcdcd5');
      line(W / 2, 8, true, '#e8e8e2');
    } else if (type === 'deck') {
      line(7, 7, false, '#dcdcd5');
      line(W - 7, 7, false, '#dcdcd5');
      line(W / 2, 8, true, '#e8e8e2');
    }
    // worn paint
    speckle(g, W, H, 3500, r, 40, 90, 0.35);
    return tex(c, { aniso: 8 });
  });
}

export function pavementTexture() {
  return once('pave', () => {
    const c = cv(256, 256);
    const g = c.getContext('2d');
    const r = rng(11);
    g.fillStyle = '#9a968c';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
      const v = 140 + r() * 30;
      g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
      g.fillRect(x + 1, y + 1, 62, 62);
    }
    speckle(g, 256, 256, 3000, r, 90, 190, 0.25);
    return tex(c);
  });
}

export function grassTexture(base = '#5f7a3b') {
  return once('grass' + base, () => {
    const c = cv(256, 256);
    const g = c.getContext('2d');
    const r = rng(base.length * 31 + base.charCodeAt(3));
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) {
      const l = 30 + r() * 40;
      g.fillStyle = `hsla(${70 + r() * 30},45%,${l}%,0.35)`;
      g.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3);
    }
    return tex(c);
  });
}

export function fieldTexture(kind) {
  return once('field' + kind, () => {
    const c = cv(256, 256);
    const g = c.getContext('2d');
    const r = rng(kind === 'wheat' ? 5 : 9);
    g.fillStyle = kind === 'wheat' ? '#b7a55a' : kind === 'plough' ? '#7d6244' : '#5a8a3a';
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 8) {
      g.fillStyle = kind === 'plough' ? `rgba(60,40,25,${0.25 + r() * 0.2})` : `rgba(${kind === 'wheat' ? '140,120,50' : '40,90,30'},${0.2 + r() * 0.2})`;
      g.fillRect(x, 0, 3, 256);
    }
    speckle(g, 256, 256, 2500, r, 60, 160, 0.2);
    return tex(c);
  });
}

export function concreteTexture(tint = '#8d8d88') {
  return once('conc' + tint, () => {
    const c = cv(256, 256);
    const g = c.getContext('2d');
    const r = rng(tint.charCodeAt(1) + 3);
    g.fillStyle = tint;
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 5000, r, 60, 200, 0.2);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let x = 0; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    return tex(c);
  });
}

export function waterNormal() {
  return once('waterN', () => {
    const S = 256;
    const c = cv(S, S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const h = new Float32Array(S * S);
    const r = rng(77);
    const waves = [];
    for (let i = 0; i < 14; i++) waves.push([r() * 6 + 1, r() * 6 + 1, r() * 6.28, 0.4 + r()]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 0;
      for (const [fx, fy, ph, a] of waves) v += Math.sin(((x / S) * fx + (y / S) * fy) * 6.2832 + ph) * a;
      h[y * S + x] = v;
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = h[y * S + ((x + 1) % S)] - h[y * S + ((x + S - 1) % S)];
      const dy = h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x];
      const i = (y * S + x) * 4;
      img.data[i] = 128 + dx * 12;
      img.data[i + 1] = 128 + dy * 12;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return tex(c, { srgb: false });
  });
}

/**
 * Facade atlas: 512 x 1024. Bottom half (canvas y 512..1024) = ground storey, top half = upper storey.
 * One tile is 5 m wide x 3 m high per storey. Walls are painted near-white so instance colours tint them.
 * variant 0 plastered house, 1 brick arched, 2 modern glass, 3 shop-front
 */
export function facadeTexture(variant) {
  return once('facade' + variant, () => {
    const W = 512, H = 1024;
    const c = cv(W, H);
    const g = c.getContext('2d');
    const r = rng(100 + variant * 17);
    const wall = (y0) => {
      g.fillStyle = variant === 1 ? '#c98a72' : '#f1ece2';
      g.fillRect(0, y0, W, 512);
      speckle(g, W, 512, 4500, r, 150, 235, 0.22);
      if (variant === 1) {
        g.strokeStyle = 'rgba(70,35,25,0.45)';
        g.lineWidth = 1;
        for (let y = 0; y < 512; y += 16) {
          g.beginPath(); g.moveTo(0, y0 + y); g.lineTo(W, y0 + y); g.stroke();
          for (let x = (y / 16) % 2 ? 0 : 20; x < W; x += 40) { g.beginPath(); g.moveTo(x, y0 + y); g.lineTo(x, y0 + y + 16); g.stroke(); }
        }
      }
      for (let i = 0; i < 14; i++) { // rain streaks and stains
        const x = r() * W;
        const gr = g.createLinearGradient(0, y0, 0, y0 + 512);
        gr.addColorStop(0, 'rgba(60,50,40,0)');
        gr.addColorStop(0.3, `rgba(60,50,40,${0.05 + r() * 0.08})`);
        gr.addColorStop(1, 'rgba(60,50,40,0)');
        g.fillStyle = gr;
        g.fillRect(x, y0, 3 + r() * 10, 512);
      }
    };
    const glass = (x, y, w, h, arch = false) => {
      g.save();
      g.beginPath();
      if (arch) { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); }
      else g.rect(x, y, w, h);
      g.closePath();
      g.fillStyle = '#25303a';
      g.fill();
      g.clip();
      const gr = g.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, '#6f93b3'); gr.addColorStop(0.45, '#2f4558'); gr.addColorStop(1, '#16222c');
      g.fillStyle = gr;
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)'; // sky glint
      g.beginPath(); g.moveTo(x, y + h * 0.6); g.lineTo(x + w * 0.55, y); g.lineTo(x + w * 0.8, y); g.lineTo(x, y + h * 0.95); g.fill();
      g.restore();
      g.strokeStyle = '#d9d6cc'; g.lineWidth = 7; // frame
      if (arch) { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.stroke(); }
      else g.strokeRect(x, y, w, h);
      g.fillStyle = '#c9c5ba'; g.fillRect(x + w / 2 - 2, y, 4, h); // mullion
      g.fillStyle = '#b4afa3'; g.fillRect(x - 10, y + h, w + 20, 10); // sill
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 10, y + h + 10, w + 20, 6); // shadow under sill
    };
    // ---------- upper storey (canvas y 0..512)
    wall(0);
    if (variant === 0 || variant === 3) {
      glass(70, 150, 120, 230);
      glass(322, 150, 120, 230);
      g.fillStyle = '#7c7a72'; g.fillRect(300, 380, 80, 56); // AC unit
      g.fillStyle = '#5b5a54'; for (let i = 0; i < 5; i++) g.fillRect(304, 386 + i * 9, 72, 3);
      g.fillStyle = 'rgba(50,50,50,0.9)'; g.fillRect(0, 468, W, 8); // balcony rail
      for (let x = 6; x < W; x += 22) g.fillRect(x, 440, 3, 36);
    } else if (variant === 1) {
      glass(60, 120, 110, 260, true);
      glass(342, 120, 110, 260, true);
      g.fillStyle = '#6b4a38'; g.fillRect(0, 470, W, 10);
    } else {
      g.fillStyle = '#d4d1c8'; g.fillRect(0, 460, W, 52); // slab edge
      g.fillStyle = '#25303a'; g.fillRect(20, 90, 472, 330);
      const gr = g.createLinearGradient(0, 90, W, 420);
      gr.addColorStop(0, '#79a2c4'); gr.addColorStop(0.5, '#34506a'); gr.addColorStop(1, '#1a2733');
      g.fillStyle = gr; g.fillRect(20, 90, 472, 330);
      g.fillStyle = '#b9b6ad'; for (let x = 20; x <= 492; x += 118) g.fillRect(x - 3, 90, 6, 330);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(20, 400); g.lineTo(260, 90); g.lineTo(330, 90); g.lineTo(60, 420); g.fill();
    }
    // ---------- ground storey (canvas y 512..1024)
    wall(512);
    g.fillStyle = '#58564f'; g.fillRect(0, 980, W, 44); // plinth
    if (variant === 0) {
      g.fillStyle = '#6a4a32'; g.fillRect(40, 640, 130, 340); // wooden door
      g.fillStyle = '#4b3524'; g.fillRect(52, 660, 106, 130); g.fillRect(52, 810, 106, 150);
      g.fillStyle = '#c9a14a'; g.fillRect(146, 800, 8, 22);
      glass(300, 700, 130, 190);
    } else if (variant === 1) {
      g.fillStyle = '#2c3a4a'; g.fillRect(90, 600, 330, 380); // steel gate
      g.fillStyle = '#3d4f63'; for (let x = 96; x < 420; x += 20) g.fillRect(x, 606, 10, 368);
      g.fillStyle = '#c0392b'; g.fillRect(250, 600, 6, 380);
    } else if (variant === 2) {
      g.fillStyle = '#25303a'; g.fillRect(30, 620, 452, 350);
      const gr = g.createLinearGradient(0, 620, W, 970);
      gr.addColorStop(0, '#79a2c4'); gr.addColorStop(1, '#1a2733');
      g.fillStyle = gr; g.fillRect(30, 620, 452, 350);
      g.fillStyle = '#c2c0b8'; for (let x = 30; x <= 482; x += 113) g.fillRect(x - 3, 620, 6, 350);
    } else {
      // shop: sign band + rolling shutter
      g.fillStyle = '#ffffff'; g.fillRect(0, 540, W, 80);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 618, W, 6);
      g.fillStyle = '#a7a9ad'; g.fillRect(24, 640, 464, 340);
      g.strokeStyle = '#7d7f84'; g.lineWidth = 3;
      for (let y = 650; y < 980; y += 14) { g.beginPath(); g.moveTo(24, y); g.lineTo(488, y); g.stroke(); }
      g.fillStyle = '#8a8c90'; g.fillRect(24, 640, 464, 12);
    }
    return tex(c, { aniso: 8 });
  });
}

/** text sign texture */
export function signTexture(text, bg = '#1c4b8a', fg = '#ffffff', w = 512, h = 128) {
  const c = cv(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(8, 8, w - 16, h - 16);
  let size = 64;
  g.font = `700 ${size}px Arial, sans-serif`;
  while (g.measureText(text).width > w - 40 && size > 14) {
    size -= 2;
    g.font = `700 ${size}px Arial, sans-serif`;
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** curtain-wall / large window texture for landmark towers: floors tall, repeat set by caller */
export function curtainTexture(tintA = '#6f93b3', tintB = '#1d2c3a') {
  return once('curtain' + tintA, () => {
    const W = 256, H = 256;
    const c = cv(W, H);
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, tintA);
    gr.addColorStop(0.55, tintB);
    gr.addColorStop(1, '#0d151d');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.moveTo(0, H); g.lineTo(W * 0.6, 0); g.lineTo(W * 0.8, 0); g.lineTo(W * 0.2, H); g.fill();
    g.fillStyle = '#9aa3a9'; g.fillRect(0, 0, W, 10); g.fillRect(0, 0, 8, H); // spandrel + mullion
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 10, W, 4);
    return tex(c, { aniso: 8 });
  });
}

export function solidFacadeTexture(color = '#e9e3d6', windowsX = 6) {
  return once('solid' + color + windowsX, () => {
    const W = 512, H = 256;
    const c = cv(W, H);
    const g = c.getContext('2d');
    const r = rng(color.charCodeAt(2) * 13);
    g.fillStyle = color;
    g.fillRect(0, 0, W, H);
    speckle(g, W, H, 3000, r, 150, 235, 0.2);
    const ww = W / windowsX;
    for (let i = 0; i < windowsX; i++) {
      const x = i * ww + ww * 0.22;
      const gr = g.createLinearGradient(x, 60, x + ww * 0.56, 220);
      gr.addColorStop(0, '#6f93b3'); gr.addColorStop(1, '#1b2833');
      g.fillStyle = gr;
      g.fillRect(x, 60, ww * 0.56, 150);
      g.strokeStyle = '#d6d2c8'; g.lineWidth = 6; g.strokeRect(x, 60, ww * 0.56, 150);
      g.fillStyle = '#bdb8ac'; g.fillRect(x - 6, 210, ww * 0.56 + 12, 8);
    }
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, W, 14);
    return tex(c, { aniso: 8 });
  });
}

/** corrugated sheet-metal cladding (vertical ribs, rust streaks) for factories */
export function corrugatedTexture(color = '#8fa0ae') {
  return once('corr' + color, () => {
    const W = 256, H = 256;
    const c = cv(W, H);
    const g = c.getContext('2d');
    const r = rng(color.charCodeAt(3) * 17 + 5);
    g.fillStyle = color;
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 8) {
      const gr = g.createLinearGradient(x, 0, x + 8, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.30)');
      g.fillStyle = gr; g.fillRect(x, 0, 8, H);
    }
    for (let i = 0; i < 40; i++) { // rust / dirt streaks running down
      g.fillStyle = `rgba(${90 + r() * 40},${60 + r() * 20},40,${0.04 + r() * 0.08})`;
      g.fillRect(r() * W, r() * H * 0.4, 2 + r() * 6, 40 + r() * 160);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, H - 6, W, 6); // base grime
    return tex(c, { aniso: 8 });
  });
}
