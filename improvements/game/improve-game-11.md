# Improve game 11 — improvements 1 to 11 (cumulative)

This file replaces "Improve game 10". Everything done so far is listed here, newest first. Older entries are copied unchanged.

## Improvement 11 — Cars now roll OUTWARD in turns (OZ-014): one sign fixed in VehicleSystem.updateFrame
- Date: 2026-11-24
- Status: PASS
- Changed: src/vehicles/VehicleSystem.js
- Evidence: LIVE (SIMULATED GL; game's own drive/updateFrame code, vehiclemotion.mjs): body roll outward before -> after: Apex GT -1.445 -> +1.445 deg, Stallion -1.826 -> +1.826, Ranger -2.414 -> +2.414, Vortex -1.208 -> +1.208; bike unchanged (-35.966); lateral g and L/R symmetry identical before/after; vehicle motion Major findings 4 -> 0 (104 measurements, 101 in range). Regression PASS: smoke, A0, GOKU partner (12 hits / 4 kills), explore 852 m 0 stuck, explorer 0 findings; unit tests motion 10/10, vehiclemotion 11/11, reference 18/18. Same camera before/after picture: tilt is only 1.4 deg so the two pictures look identical at this size (number is the proof)
- Commit/tag: -
- Not verified: Looks of a car leaning 1-4 deg not judged by a person; real phone/GPU; collisions, ramps, crash, other vehicles' roll under real Rapier not measured; server run of vehiclemotion not done yet

## Improvement 10 — Step 4 r4: characters rigid-skinned (1 mesh per material) + size-adaptive body-part detail — draw calls 964→681 at spawn
- Date: 2026-11-23
- Status: PARTIAL
- Changed: src/characters/CharacterBuilder.js (optimiseHumanoid -> SkinnedMesh per material; ell() uses 3 sphere detail levels)
- Evidence: LIVE drawcalls.mjs before/after: 964->681 calls, 609->395 geometries, 1.175M->1.02M tris; characters main 140->68, shadow 398->187; smoke PASS, A0 5/5, GOKU partner PASS (12 hits/4 kills), explorer 0 findings; hero A/B picture same by eye
- Commit/tag: tag step4-r4
- Not verified: real phone/GPU fps; skinned mesh on real mobile GPUs; shader programs 37->48 (compile time); triangles still 1.02M vs 300k budget; draw calls 681 vs 150 budget (FAIL); run-to-run variance

## Improvement 9 — Free-GPU relay planner: which free server today, hours left, what comes next
- Date: 2026-11-21
- Status: PASS
- Changed: cloud/relay.mjs, relay.config.json, relay-test.mjs
- Evidence: fake-clock test 11/11 PASS (day/week/month limits, Pakistan day change)
- Commit/tag: 41ede55 (tag relay-v1)
- Not verified: the free-tier hours themselves (Kaggle ~30 h/week is user-reported); whether WebGL works on those free GPUs

## Improvement 8 — Cloud play prototype: the game runs on a server and is streamed to a viewer
- Date: 2026-11-21
- Status: PARTIAL
- Changed: cloud/stream-server.mjs, cloud/viewer, cloud/test-client.mjs, cloud/cloudplay.sh
- Evidence: plumbing test 7/7 PASS (SIMULATED, CPU only, about 1 fps)
- Commit/tag: 6d2dd22 (tag cloudplay-proto-v1)
- Not verified: real GPU speed and delay; no GPU server/account exists yet (deployment BLOCKED)

## Improvement 7 — Deploy v2: vendor chunks, cacheable bundle folder, _headers, base-aware asset URLs (GitHub Pages sub-path fix)
- Date: 2026-11-19
- Status: PARTIAL
- Changed: vite.config.js, public/_headers, src/utils/assetUrl.js, DEPLOY.md
- Evidence: assetUrl unit-checked in the harness (STATIC); old absolute /assets paths would have 404ed on a sub-path
- Commit/tag: c3d7987 (tag deploy-ready-v2)
- Not verified: vite build with the new config; _headers behaviour on a real host

## Improvement 6 — Deploy v1: GitHub Pages workflow and honest DEPLOY.md
- Date: 2026-11-18
- Status: PARTIAL
- Changed: .github/workflows (pages), DEPLOY.md
- Evidence: workflow file written; no real GitHub run yet
- Commit/tag: ef3a5ea (tag deploy-ready-v1)
- Not verified: vite build is BLOCKED in the sandbox (no npm registry); GitHub run never happened

## Improvement 5 — Step 4 r3: road details, 5 villa designs, hidden spawn slab, tree culling + LOD
- Date: 2026-11-18
- Status: PARTIAL
- Changed: src/world/City.js, Districts.js, World.js, Trees.js, OzDebug.js
- Evidence: rendered triangles at spawn 2.70M -> 1.18M (renderer.info count); smoke/a0/goku/explorer tests pass
- Commit/tag: 286524f (tag step4-r3)
- Not verified: mobile budget is still FAIL: about 966 draw calls at spawn vs a 150 target; real GPU fps unknown

## Improvement 4 — Trees checked against solid objects, palm placement fixed, loading layer removed after fade
- Date: 2026-11-18
- Status: PASS
- Changed: src/world/Trees.js, src/world/City.js, loading code
- Evidence: tree audit (exact ray test, SIMULATED) reported 0 floating / sunk trees out of 1030 in the runs after this change
- Commit/tag: 2d173b7 (tag step4-r3-wip)
- Not verified: real Rapier physics (preview used a stub)

## Improvement 3 — Step 4 r2: look/lighting pass, gait IK (running legs), car+building data net, A0 debug door, explorer
- Date: 2026-11-17
- Status: PARTIAL
- Changed: src/characters (foot IK, gait), src/world, src/debug/OzDebug.js, tools/oz-explorer
- Evidence: explorer + audits run in the sandbox (SIMULATED); debug door is read-only and only on with ?oz_debug=1
- Commit/tag: 6b8ba19 (tag A0-debug-door)
- Not verified: real GPU look and fps; Step 4 was not yet confirmed by you

## Improvement 2 — Smoke test fixed (screenshot timeout)
- Date: 2026-11-16
- Status: PASS
- Changed: tests/smoke.mjs
- Evidence: smoke test runs to the end in the sandbox (SIMULATED, software GL)
- Commit/tag: e68dc1f (tag M0-done)
- Not verified: real GPU

## Improvement 1 — Baseline: Stage 0-4 code arranged into one runnable Vite + Three.js project
- Date: 2026-11-16
- Status: PASS
- Changed: whole project (first commit in git)
- Evidence: project loads; smoke test came with improvement 2
- Commit/tag: 9d28bd4 (tag M0-baseline)
- Not verified: everything done BEFORE this commit (Gemini stages, early fixes) is not recorded in git
