# Game ko online karna (static hosting)

Status (honest): **NOT_IMPLEMENTED / NOT VERIFIED** — game abhi kisi real server par live nahi hai.
Meri sandbox `npm install` / `vite build` nahi chala sakti (npm registry blocked = BLOCKED), isliye build
GitHub ke servers par ya aapke PC par hota hai. Repo ke andar kuch secret/token kabhi nahi rakhna.

## Raasta A — GitHub Pages (free, card nahi chahiye, auto build)
File `.github/workflows/deploy-pages.yml` already ready hai.
1. github.com par naya repo banayein (naam: operation-zero). **Note:** free plan par GitHub Pages sirf *public* repo ke liye
   chalta hai (code sab ko dikhega). Private rakhna ho to Raasta B use karein.
2. Is project folder ko us repo ke `main` branch par push karein.
3. Repo -> Settings -> Pages -> Source: **GitHub Actions**.
4. Actions tab mein `deploy-pages` green hone ka intezar karein. Link: `https://<username>.github.io/operation-zero/`
5. Har naye push par game khud update hota hai.

## Raasta B — Netlify / Cloudflare Pages (free, card nahi, private repo bhi chalta hai)
- Netlify Drop (app.netlify.com/drop): PC par `npm install && npm run build`, phir `dist/` folder drag karein.
- Ya repo connect karein: Build command `npm run build`, Publish directory `dist`.

## Raasta C — sirf PC par test
`npm install` -> `npm run dev` (http://localhost:3000) | `npm run build` -> `dist/` | `npm run preview`

## Assets (200-300 MB)
Models/textures `public/assets/...` mein rakhein *build se pehle*. GitHub ki normal file limit 100 MB/file hai; bade
assets ke liye Git LFS ya alag asset host chahiye — pehle batayein assets kahan hain.

## "Online server se performance behtar hogi?" — sach (zaroori)
- **FPS / lag (draw calls, triangles, GPU) server se theek nahi hota.** Game aapke phone/PC ki GPU par chalta hai; static hosting sirf
  files bhejta hai. FPS ke liye game ke andar kaam chahiye (LOD, kam draw calls, shadow limit) — woh Step 4 ka performance kaam hai.
- **Server se kya behtar hota hai (free, is repo mein tayyar):**
  - `vite.config.js`: `three` aur `rapier` alag chunks mein (parallel download, update par dobara download nahi hote).
  - Hashed bundles `dist/bundle/` mein -> 1 saal cache; bade assets `dist/assets/` -> 1 hafta cache (`public/_headers`, Netlify / Cloudflare Pages).
  - GitHub Pages `_headers` ignore karta hai (apna ~10 min cache) — isliye load-speed ke liye Netlify / Cloudflare Pages behtar.
  - Asset URLs ab sub-folder par bhi chalte hain (`src/utils/assetUrl.js`); pehle `/assets/...` GitHub Pages par 404 deta.
  - Brotli/gzip text files par host khud lagata hai. 200-300 MB assets ke liye asli faida: textures **KTX2**, models **meshopt/Draco** (asset pipeline).
- **Teen alag cheezein (confusion na ho):**
  1. Static hosting (free) = game ka link, tez load. Tayyar, par aap ko push/publish karna hai.
  2. Multiplayer / game server (Node/WebSocket) = NOT_IMPLEMENTED. Hosting ka alag kaam, design chahiye.
  3. Cloud streaming (server par render, video phone par) = paid + latency; mein ne nahi kiya, bina approval kabhi nahi karunga.
- Status: build config / headers / asset URLs **UNVERIFIED** — sandbox mein `vite build` BLOCKED hai; pehla GitHub Actions run (ya aap ka `npm run build`) hi sabit karega.

## GOKU QA online
Dekhein `GOKU_INTEGRATION.md` (status table + `.github/workflows/goku-qa.yml`). Reports sirf `reports` branch par jate hain.

## GOKU online (A3)
- Game mein GOKU partner browser ke andar chalta hai (`window.__OZ_GOKU`).
- Online GOKU sirf **read-only** token se repo padhega aur sirf `reports` branch par likhega. Token mujhe chat mein na bhejein.
- Explorer report: `node tools/oz-explorer/explore.mjs` -> `reports/run-<time>/report.json` (abhi UNTESTED).

## Rollback
`vite.config.js.bak` purana config hai (sirf `base: './'` ka farq). Naya chunking/`assetsDir` hatana ho to `vite.config.js.bak` copy kar dein.
