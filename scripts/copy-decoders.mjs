// Cross-platform (Windows/Mac/Linux): copies Draco + Basis decoders from three.js
// into public/assets/decoders so the game works fully offline (no CDN).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libs = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs');

const jobs = [
  [join(libs, 'draco', 'gltf'), join(root, 'public', 'assets', 'decoders', 'draco')],
  [join(libs, 'basis'), join(root, 'public', 'assets', 'decoders', 'basis')]
];

for (const [from, to] of jobs) {
  if (!existsSync(from)) {
    console.warn(`[copy-decoders] skipped (not found): ${from}`);
    continue;
  }
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`[copy-decoders] ${to}`);
}
