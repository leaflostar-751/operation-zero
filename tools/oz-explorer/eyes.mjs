// GOKU's "eyes": pure pixel maths on a screenshot (no game code, no network). Used by goku_qa.mjs and tested by eyes.test.mjs.
// The limits are HEURISTICS (starting values from the QA checklist), not facts: a flag only means "go and look at this picture".
export const LIM = { minEntropy: 3, maxDominant: 0.6, minEdge: 0.04, minContrast: 60, dark: 25, bright: 235 };
export const flagsOf = (m) => { const f = []; if (m.lumaMean < LIM.dark) f.push('too_dark'); if (m.lumaMean > LIM.bright) f.push('too_bright'); if (m.entropy < LIM.minEntropy || m.dominantPct > LIM.maxDominant) f.push('flat_or_empty'); if (m.edgeDensity < LIM.minEdge) f.push('low_detail'); if (m.contrast < LIM.minContrast) f.push('low_contrast'); return f; };
// runs INSIDE a blank browser page (needs canvas + Image), so it must stay self-contained
export const analyze = async ({ a, b }) => {
  const W = 320, H = 200, N = W * H;
  const px = async (s) => { const img = new Image(); await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('decode')); img.src = 'data:image/jpeg;base64,' + s; }); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
  const luma = (d) => { const L = new Float32Array(N); for (let i = 0; i < N; i++) L[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]; return L; };
  const d = await px(a), L = luma(d), bins = new Map();
  for (let i = 0; i < N; i++) { const k = ((d[i * 4] >> 4) << 8) | ((d[i * 4 + 1] >> 4) << 4) | (d[i * 4 + 2] >> 4); bins.set(k, (bins.get(k) || 0) + 1); }
  let ent = 0, dom = 0; for (const v of bins.values()) { const q = v / N; ent -= q * Math.log2(q); if (q > dom) dom = q; }
  const hist = new Uint32Array(256); let sum = 0; for (let i = 0; i < N; i++) { hist[Math.round(L[i])]++; sum += L[i]; }
  const pct = (q) => { let c = 0; for (let i = 0; i < 256; i++) { c += hist[i]; if (c >= q * N) return i; } return 255; };
  let edges = 0; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + W] - L[i - W]) > 24) edges++; }
  const out = { entropy: +ent.toFixed(2), dominantPct: +dom.toFixed(3), lumaMean: +(sum / N).toFixed(1), contrast: pct(0.95) - pct(0.05), edgeDensity: +(edges / N).toFixed(3) };
  if (b) { const L2 = luma(await px(b)); let s = 0, ch = 0; for (let i = 0; i < N; i++) { const df = Math.abs(L[i] - L2[i]); s += df; if (df > 24) ch++; } out.diff = { meanAbs: +(s / N).toFixed(1), changedPct: +(ch / N).toFixed(3) }; }
  return out;
};
