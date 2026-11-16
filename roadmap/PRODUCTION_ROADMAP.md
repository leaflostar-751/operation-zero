# OPERATION ZERO – Project Inspection + Production Roadmap
Status words: PASS / PARTIAL / FAIL / BLOCKED / NOT VERIFIED. Nothing in the project was modified for this report (new file only).

## 1. Inspection (facts from the files)
| Item | Finding |
|---|---|
| Engine | Vite 5 + Three.js r170 + @dimforge/rapier3d-compat 0.14, plain JS modules, no framework. NOT Unity/Unreal. |
| Size | 40 source files, ~12,000 lines, `src/` 648 KB, `public/` 48 KB (empty asset folders: characters, hdri, textures, vehicles). |
| Tests | No automated test suite in the repo. One manual console script (`tests/stage2_console.js`). Headless Playwright harness exists only in my scratchpad, not in the zip. |
| Build | `package.json` has dev/build/preview. `node_modules` not present here; npm registry blocked in my sandbox, so `npm install` + `vite build` = BLOCKED here, must be run on the user's PC. |
| Assets | 0 external GLB/texture/audio files. All characters, cars, trees, buildings are procedural. `VehicleImporter.js` and `AssetLoader.js` exist but the manifest is empty (NOT VERIFIED with a real GLB). |
| Environment | Sandbox: 2 CPU, 7 GB RAM, software GL only (SwiftShader). Real GPU, real Rapier, real audio, real Android = not available to me. |

## 2. Systems vs the 10 priorities
| # | Priority | What exists (file) | Status | Missing |
|---|---|---|---|---|
| 1 | Character anatomy, skeleton, facial rig, movement | `CharacterBuilder.js`, `CharacterController.js`, `AnimationController.js`, `TwoBoneIK.js`, `FootIKSolver.js` | PARTIAL | Real anatomy/skin, facial rig and expressions, muscle deformation; animation is procedural; Stage 4 IK audit not done |
| 2 | Hand-to-hand and firearm animation | `CombatSystem.js` (melee combo, one rifle, recoil, reload) | PARTIAL | Hit reactions by body part, grapple/throw, other gun classes, per-gun reload sets |
| 3 | Zombie types, AI, bosses | `ZombieSystem.js` | PARTIAL | Walker/Runner + infection only; no 8 other classes, no horde director, no bosses, no door/window rules |
| 4 | Cars, NFS customization, combat attachments | `VehicleModels.js`, `VehicleSystem.js` (5 vehicles, Stage 3 audit) | PARTIAL | No part-level meshes, customization, damage zones, fuel, armour, turret, doors; collision/physics SIMULATED only |
| 5 | Weapons, attachments, firing | `WeaponModel.js`, `CombatSystem.js` | PARTIAL | Only AR-7; no attachment slots, no data-driven weapon definitions |
| 6 | Maps, trees, buildings, weather | `World.js`, `City.js`, `Districts.js`, `Trees.js`, `Scenery.js` | PARTIAL | One city zone; 7 other zones, interiors, weather, day/night missing |
| 7 | Sound and interactions | `AudioManager.js` (5 lines), engine oscillator in `VehicleSystem.js`, `InteractionSystem.js` | FAIL (audio) / PARTIAL (interaction) | No sound library, no footsteps/guns/zombie audio, no spatial mix |
| 8 | Story, missions, survival, extraction | none | FAIL (not started) | Mission manager, inventory, save, HUD survival stats |
| 9 | Optimization Android / PC | `QualityConfig.js` (4 tiers), static merge, chunk-streamed city | PARTIAL | Never run on an Android device; Android build not set up |
| 10 | Testing and bug prevention | Stage 2/3 reports, bug registers | PARTIAL | No in-repo automated tests or CI |

## 3. Assumptions (reversible)
1. Stay on Vite + Three.js: the working code is 12k lines; a Unity rewrite would throw it away. The skill recommends Unity for Android; trade-off: Unity has better mobile tooling, Three.js has faster iteration and runs in the browser on PC.
2. Android = the same web build wrapped with Capacitor (WebView). Real-device FPS is unknown until tested: Android WebView limits (memory, GPU) may force a lower tier or a Unity port later.
3. The skill's 4 GB laptop note conflicts with the user's earlier 16-32 GB PC target: Stage 1 code must also run on LOW tier, so the PC high tier is an add-on.
4. No external assets until the user uploads them; licenses must be recorded per file (CC0 / CC-BY).

## 4. Milestones (one at a time, each ends with a PASS/PARTIAL/FAIL/BLOCKED report)
| Milestone | Scope | Acceptance criteria | Tests |
|---|---|---|---|
| M0 Foundation (this stage) | Lock the repo: add `tests/` runner (headless smoke), `ASSET_LICENSES.md`, data-driven folders (`data/weapons.json`, `enemies.json`, `vehicles.json`) without changing behaviour | Game boots, 0 console errors, same HUD/behaviour as the Stage 3 zip | Boot smoke test, screenshot compare |
| M1 Asset pipeline | Verify GLB import for a character, a gun and a car; Mixamo retarget; KTX2/meshopt | One uploaded GLB per type shows with correct scale, hands on grip, wheels on ground | Import test with real files; BLOCKED until files arrive |
| M2 Character and combat | Priority 1 and 2: Stage 4 IK/animation audit and fixes, hit reactions, pistol and shotgun | No foot sliding (measured), no clipping, reload and aim sets per gun | Measured foot-slide, bone-limit and clip tests |
| M3 Zombies and bosses | Priority 3: Screamer, Brute, Crawler, Stalker, Spitter; horde director; first boss | Each class has distinct speed, senses, attack, weak point; spawn cap and cleanup hold over 10-min soak | AI state tests, soak test, leak count |
| M4 Weapons and attachments | Priority 5: data-driven guns, 5 attachment slots with real stat effects, recoil patterns | Attachment changes measured spread/recoil/noise | Unit tests on stat math |
| M5 Vehicles | Priority 4: close Stage 3 open bugs, damage zones, part swaps, armour, fuel, roof gun | Damage changes performance; no part clipping | Collision tests (real Rapier on user PC) |
| M6 World | Priority 6: forest zone, interiors, weather, day/night | Draw-call and FPS budget per tier | Renderer-info report, real GPU run on user PC |
| M7 Audio and interactions | Priority 7: audio manager, sound events with cooldowns and priority, door/laptop interactions | Every event has trigger, variation, cooldown, priority table | Event log test; audio only PASS after a real listening check |
| M8 Missions and extraction | Priority 8: mission manager, inventory, save/load, extraction loop | One full mission start to extraction | Save/load round trip |
| M9 Android and PC tiers | Priority 9: Capacitor build, touch controls, texture compression, LOD | Runs on a named Android device at a measured FPS | Real device profiling by user; BLOCKED for me |
| M10 Release QA | Priority 10 | Full regression, bug register closed or documented | All previous suites |

## 5. Stage 1 plan = M0 (needs user approval before any edit)
1. Create new files only: `tests/smoke.mjs`, `data/*.json` stubs, `ASSET_LICENSES.md`, `.gitignore`.
2. Zip backup of the current project before the first edit (rollback path: restore the zip).
3. Run boot smoke + screenshot in the harness; report PASS/FAIL with console errors.
4. No gameplay file is edited in M0.

## 6. Open risks
- Real Rapier, real GPU, real audio, Android device: not available to me (BLOCKED, user must run).
- Procedural art cannot reach AAA; real detail needs uploaded GLB models and textures.
- Scope: this is a multi-month production; each milestone is delivered separately.
