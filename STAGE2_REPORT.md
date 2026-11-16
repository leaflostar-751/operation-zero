# Stage 2 – Zombie & Combat audit (Stage 1.12)

Labels: LIVE VERIFIED = ran in the real game page (headless Chromium, SwiftShader, game code unmodified); SIMULATED = ran in the page but with the harness' Rapier STUB (box-ray maths only, no real solver) or by calling functions directly; STATIC = read from source only; NOT TESTED.

## Bug register (all found before fixing; before/after from the same script `s2.cjs`)
| ID | Sev | Finding | Root cause | Before | After | Label |
|---|---|---|---|---|---|---|
| ZOM-001 | P1 | Zombie waves spawn ~230 m from the hero when the hero is in the city (x < -70) | `spawnWave/spawnInfectedAhead` clamp to +-70 (old test-yard size) | 230 m | 12 m | LIVE VERIFIED |
| ZOM-002 | P1 | Zombies cannot chase beyond +-76 m of origin | hard-coded `abs(x)<76` movement bound | not run (code) | bound = MAP_BOUNDS | STATIC (fix covered by ZOM-001 run) |
| ZOM-003 | P1 | Zombie walks through walls/props | obstacle ray only added a steer offset, position was always updated | crossed wall by 4.4 m | stops 0.3 m before wall, slides | SIMULATED (stub rays vs cuboids) |
| ZOM-004 | P2 | Dead zombie keeps collider + combat target (kinematic body parked at y=-50) | `die()` only moved the body; `dispose()` never removed it; `convertCivilian` left the body | colliders/targets +8 after 8 kills, never freed | +0 | LIVE VERIFIED (stub colliders list) |
| ZOM-005 | P2 | Spawn may land inside a building | no check | - | up to 8 retries around the ring using `city.hitsBuilding` | STATIC |
| CMB-001 | P2 | Melee "hits" corpses (hit marker + thud) | corpses stay in `targetList` | true | false | LIVE VERIFIED |
| CMB-002 | P2 | Dead hero can still shoot/punch during the 3 s respawn timer | no health check in `CombatSystem.update` | fired = true | false | LIVE VERIFIED |
| CMB-003 | P3 | Respawn keeps an in-progress reload / melee | state not reset | - | reset on respawn | STATIC |
| PERF-001 | P3 | Extra probe rays cost CPU | swept probe each step | 1.76 ms/step (14 zombies, stub scans all colliders) | 1.00 ms/step (look-ahead probe every 4th step) | SIMULATED (stub, not representative of real Rapier BVH) |

## Checked and OK
- Ammo: 30 shots -> 0/120; reload -> 30/90 (LIVE VERIFIED, direct calls to fire()/update()).
- Damage: body 20, headshot 64 (x3.2) (LIVE VERIFIED, direct onHit calls).
- HUD HP clamp and bar (previous stage). Zero JS errors in all runs.
- Real game loop: wave of 6 chases the hero (LIVE VERIFIED, 6 s run); original yard zombies stay idle.

## NOT TESTED / limits
- Real Rapier: ray/kinematic/vehicle collisions use the stub; zombie-vs-vehicle collision NOT TESTED.
- Real keyboard/mouse fire at a moving zombie, recoil feel, muzzle flash/sound (no audio device), tracer visuals.
- Zombie attack timing against a moving hero, vehicle run-over damage, infection civilian full sequence timing.
- Real-GPU FPS under 14 zombies; 20 zombies is capped at maxZombies=14 by design (raise `maxZombies` to test 20).
- Melee line-of-sight through walls (open: P3).
- Material disposal of dead zombies (only geometry is disposed; materials are shared via a cache, so impact is small) - STATIC.


## Closeout update (Stage 1.13)
| ID | Result | Label |
|---|---|---|
| ZOM-005 building spawn | 120 spawned in dense colonies, 0 inside buildings; the old naive ring would have put 28 of 120 inside | LIVE VERIFIED (uses real `city.hitsBuilding`) |
| CMB-003 respawn reset | died (hp 0) -> 100/100, ammo 30/120, reloadT -1, melee null | LIVE VERIFIED |
| CMB-004 melee through walls (was open P3) | LOS ray added: no wall hits, wall blocks, wall removed hits again | SIMULATED (stub rays vs cuboids) |
| PERF-002 30 zombies | spawned 30 (maxZombies raised for the test), 2.28 ms/sim-step, 0.16 ms pose/frame | SIMULATED (stub physics, SwiftShader host; NOT a real-GPU/Rapier figure) |
| Real Rapier collision test | cannot run in this sandbox (npm network blocked) | NOT TESTED - run `tests/stage2_console.js` locally (paste in DevTools console) |
| Zombie vs vehicle | NOT TESTED - goes with the Stage 3 vehicle audit |

Zip note: the delivered archive of this stage is ~172 KB and contains `ZombieSystem.js` with `MAP_BOUNDS` clamps, `removeTarget`, swept-move probe. A ~168 KB zip is the previous stage (1.11) and lacks them. Quick check: `grep -c removeTarget src/characters/CombatSystem.js` must print 1 or more.
