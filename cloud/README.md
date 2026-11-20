# CLOUD PLAY — game ki saari processing server par (prototype)

**Idea:** game server ke andar (headless Chromium) chalta hai. Player ko sirf video frames milte hain; player ke keys/mouse server ko jate hain.
Isliye player ke laptop/phone par game ki processing nahi hoti. "On" karne par server chalta hai, kaam khatam hone par band (paisa sirf on-time ka).

## Status (honest)
| Hissa | Status |
|---|---|
| Server (`stream-server.mjs`) + viewer + input (keyboard, mouse-drag) | **PASS (SIMULATED)**: 7/7 plumbing checks on a CPU-only sandbox (frames are JPEG, W moves the hero inside the server game, mouse turns the camera, wrong token 401, second player 409, 0 page errors) |
| Idle auto-stop (`IDLE_MIN`) | **PASS (SIMULATED)**: process exits by itself when nobody plays; `AUTO_SHUTDOWN=1` (machine power-off) **UNVERIFIED** |
| Real GPU speed (fps), latency, quality | **UNVERIFIED** — needs a real GPU machine |
| Touch controls (Android phone as the player) | **NOT_IMPLEMENTED** |
| HTTPS / many players / login | **NOT_IMPLEMENTED** (one server process = one player, token in the link) |
| `cloudplay.sh` start/stop of the cloud machine | **UNVERIFIED** (needs your AWS account) |

## Kharcha (sach)
GPU machine zaroori hai: AWS `g4dn.xlarge` (1 NVIDIA T4) ~ **$0.526 / ghanta** on-demand (instances.vantage.sh). $100 credit ~ 190 ghante (AWS rate par; Azure ka alag).
Naye accounts par GPU limit aksar 0 hoti hai — request karni parti hai (UNVERIFIED). Machine band = compute ka bill band.

## Setup (GPU machine par; sab UNVERIFIED jab tak aap chala kar na dekhein)
1. Ubuntu GPU machine banayein (g4dn.xlarge, NVIDIA driver wala image). Security group: port 8090 **sirf apne IP** ke liye.
2. `git clone <repo> && cd operation-zero && npm install && npm i ws playwright && npx playwright install --with-deps chromium && npm run build`
3. `nohup npx vite preview --port 4173 &`
4. `GPU=1 AUTO_SHUTDOWN=1 IDLE_MIN=10 node cloud/stream-server.mjs`  -> ye link print karega: `http://<machine>:8090/?token=...`
5. Apne laptop/phone ke browser mein wo link kholein. W/A/S/D, mouse drag = camera.
6. Khatam hone par: `CLOUDPLAY_INSTANCE_ID=i-xxxx AWS_REGION=ap-south-1 bash cloud/cloudplay.sh stop` (ya `IDLE_MIN` ke baad khud band).
GPU flags kaam na karein to `chrome://gpu` jaisa check karein; `GPU=0` software rendering hai (bahut slow, sirf test ke liye).

## Security
- Token link mein hai aur abhi plain HTTP hai: Wi-Fi par koi dekh sakta hai. Public karne se pehle HTTPS lagayein (Cloudflare Tunnel / Caddy).
- Sirf whitelisted keys (W/A/S/D, arrows, Shift, Space, F1..) server par dabti hain; baqi ignore.
- Token ya AWS keys kabhi repo mein na rakhein.

## Test (sandbox mein chala)
`DEBUG_STATE=1 TOKEN=abc GAME_URL=http://localhost:4173/ node cloud/stream-server.mjs` aur doosre terminal mein `TOKEN=abc node cloud/test-client.mjs 8090`
