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

## GOKU online (A3)
- Game mein GOKU partner browser ke andar chalta hai (`window.__OZ_GOKU`).
- Online GOKU sirf **read-only** token se repo padhega aur sirf `reports` branch par likhega. Token mujhe chat mein na bhejein.
- Explorer report: `node tools/oz-explorer/explore.mjs` -> `reports/run-<time>/report.json` (abhi UNTESTED).

## Rollback
`vite.config.js.bak` purana config hai (sirf `base: './'` ka farq).
