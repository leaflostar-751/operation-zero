# Playable build + upload (run on your own PC)
My sandbox cannot run `npm install` or `vite build` (network blocked), so the final build must be made on your PC. Status: BLOCKED here, NOT VERIFIED.

1. Install Node.js 20 or newer (https://nodejs.org).
2. Open a terminal in this folder:
   `npm install`
   `npm run dev`     -> play locally at http://localhost:3000
   `npm run build`   -> makes the `dist/` folder (the playable game)
3. Upload `dist/` (zip its contents, index.html at the top level):
   - itch.io: New project -> Kind: HTML -> upload the zip -> tick "This file will be played in the browser".
   - Netlify Drop (app.netlify.com/drop): drag the `dist` folder.
   - GitHub Pages / any static host also works.
4. Assets: put models in `public/assets/...` BEFORE `npm run build` so they are inside `dist/`.
5. Rollback: `vite.config.js.bak` is the old config (only change: `base: './'`).
Note: first load needs WebGL2. Quality tier is chosen automatically (Settings menu can change it).
