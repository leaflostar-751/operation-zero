# STAGE 3 – TEST RESULTS (per vehicle)

Labels: LIVE VERIFIED = executed in the real game page (headless Chromium/SwiftShader, game code unmodified, driven through `VehicleSystem.update` with scripted input); SIMULATED = same, but physics is the harness Rapier STUB (ray-vs-cuboid maths, no real solver) or numbers are not representative of a real GPU/CPU; STATIC = source reading only; NOT TESTED = could not be run here.

Test course: flat empty ground at x=150, z=-200..-20 with all streamed city colliders removed (a first run placed the vehicles in front of a real building collider and was discarded). Every vehicle was tested individually; one vehicle passing says nothing about the others.

Raw data: `stage3/data_before.json` (before fixes), `stage3/data_after.json` (after fixes).


## Apex GT (JDM-style fastback coupe)

| Test | Before fixes | After fixes | Label |
|---|---|---|---|
| 0-100 km/h | 2.23 s | 4.05 s | LIVE VERIFIED (arcade model, not real engine curve) |
| Top speed in 30 s (tune vmax) | 162 km/h (201) | 143 km/h (201) | LIVE VERIFIED |
| Brake 100->0 | 29.6 m / 2.23 s (12.4 m/s2) | 29.6 m / 2.23 s (12.4 m/s2) | LIVE VERIFIED |
| Handbrake 100->0 | 54 m | 54 m | LIVE VERIFIED |
| Reverse speed reached | -39.2 km/h | -24.5 km/h | LIVE VERIFIED |
| Steady full-lock turn lateral accel | 0.99 g, radius 23.1 m | 1.05 g, radius 21.9 m | LIVE VERIFIED |
| Wall hit at 20 m/s: penetration / health lost | (measurement script bug, discarded) | 0 m / 36.4 of 100 | LIVE VERIFIED on stub box |
| 4 repeated wall hits at 15 m/s: health lost each | [41.3, 41.3, 41.3, 41.3] | [33, 33, 33, 33] | SIMULATED |
| Thin pole 0.3 m, 0.6 m off centre | drove through: True | drove through: False | SIMULATED (stub rays) |
| Thin pole in centre | drove through: False | drove through: False | SIMULATED |
| 0.3 m high curb | drives through: True | drives through: True | SIMULATED (open, VEH-101) |
| Run over zombie at 18 m/s | zombie hp lost 319 | zombie hp lost 283, vehicle keeps 69 km/h | SIMULATED |
| Exit with wall on the door side | hero inside wall: True | hero inside wall: False | SIMULATED |
| Enter duration | 0.87 s | 1.72 s | LIVE VERIFIED |
| Exit duration | 0.35 s | 0.7 s | LIVE VERIFIED |
| State after exit (mode / active / driver / externalControl) | foot / null / false / false | foot / null / false / false | LIVE VERIFIED |
| Fire weapon while driving | ammo used 0 | ammo used 0 | LIVE VERIFIED (blocked by design) |
| Wheel bottoms vs ground (y) | [0, 0, 0, 0] | [0, 0, 0, 0] | LIVE VERIFIED (rest pose) |
| Model bbox vs collider (m, w x h x l) | [1.94, 1.3, 4.67] | [1.78, 1.3, 4.45] | LIVE VERIFIED |

## Stallion V8 (muscle car)

| Test | Before fixes | After fixes | Label |
|---|---|---|---|
| 0-100 km/h | 2.48 s | 4.72 s | LIVE VERIFIED (arcade model, not real engine curve) |
| Top speed in 30 s (tune vmax) | 151 km/h (187) | 132 km/h (187) | LIVE VERIFIED |
| Brake 100->0 | 32.1 m / 2.43 s (11.4 m/s2) | 32.1 m / 2.45 s (11.3 m/s2) | LIVE VERIFIED |
| Handbrake 100->0 | 57.7 m | 57.7 m | LIVE VERIFIED |
| Reverse speed reached | -36.3 km/h | -23.9 km/h | LIVE VERIFIED |
| Steady full-lock turn lateral accel | 0.99 g, radius 23.1 m | 0.95 g, radius 24.2 m | LIVE VERIFIED |
| Wall hit at 20 m/s: penetration / health lost | (measurement script bug, discarded) | 0 m / 34.7 of 100 | LIVE VERIFIED on stub box |
| 4 repeated wall hits at 15 m/s: health lost each | [39.1, 39.1, 39.1, 39.1] | [31.2, 31.2, 31.2, 31.2] | SIMULATED |
| Thin pole 0.3 m, 0.6 m off centre | drove through: True | drove through: False | SIMULATED (stub rays) |
| Thin pole in centre | drove through: False | drove through: False | SIMULATED |
| 0.3 m high curb | drives through: True | drives through: True | SIMULATED (open, VEH-101) |
| Run over zombie at 18 m/s | zombie hp lost 455 | zombie hp lost 402, vehicle keeps 62 km/h | SIMULATED |
| Exit with wall on the door side | hero inside wall: True | hero inside wall: False | SIMULATED |
| Enter duration | 0.87 s | 1.72 s | LIVE VERIFIED |
| Exit duration | 0.35 s | 0.7 s | LIVE VERIFIED |
| State after exit (mode / active / driver / externalControl) | foot / null / false / false | foot / null / false / false | LIVE VERIFIED |
| Fire weapon while driving | ammo used 0 | ammo used 0 | LIVE VERIFIED (blocked by design) |
| Wheel bottoms vs ground (y) | [0, 0, 0, 0] | [0, 0, 0, 0] | LIVE VERIFIED (rest pose) |
| Model bbox vs collider (m, w x h x l) | [1.99, 1.41, 4.99] | [1.91, 1.42, 4.79] | LIVE VERIFIED |

## Ranger 4x4 (boxy SUV)

| Test | Before fixes | After fixes | Label |
|---|---|---|---|
| 0-100 km/h | 7.43 s | 7.43 s | LIVE VERIFIED (arcade model, not real engine curve) |
| Top speed in 30 s (tune vmax) | 105 km/h (136) | 105 km/h (136) | LIVE VERIFIED |
| Brake 100->0 | 35.1 m / 2.68 s (10.4 m/s2) | 35.1 m / 2.68 s (10.4 m/s2) | LIVE VERIFIED |
| Handbrake 100->0 | 62 m | 62 m | LIVE VERIFIED |
| Reverse speed reached | -24.7 km/h | -23.7 km/h | LIVE VERIFIED |
| Steady full-lock turn lateral accel | 1 g, radius 23 m | 0.8 g, radius 28.7 m | LIVE VERIFIED |
| Wall hit at 20 m/s: penetration / health lost | (measurement script bug, discarded) | 0 m / 31.6 of 100 | LIVE VERIFIED on stub box |
| 4 repeated wall hits at 15 m/s: health lost each | [28.5, 28.5, 28.5, 28.5] | [28.5, 28.5, 28.5, 28.5] | SIMULATED |
| Thin pole 0.3 m, 0.6 m off centre | drove through: True | drove through: False | SIMULATED (stub rays) |
| Thin pole in centre | drove through: False | drove through: False | SIMULATED |
| 0.3 m high curb | drives through: True | drives through: True | SIMULATED (open, VEH-101) |
| Run over zombie at 18 m/s | zombie hp lost 388 | zombie hp lost 388, vehicle keeps 59 km/h | SIMULATED |
| Exit with wall on the door side | hero inside wall: True | hero inside wall: False | SIMULATED |
| Enter duration | 0.87 s | 1.72 s | LIVE VERIFIED |
| Exit duration | 0.35 s | 0.7 s | LIVE VERIFIED |
| State after exit (mode / active / driver / externalControl) | foot / null / false / false | foot / null / false / false | LIVE VERIFIED |
| Fire weapon while driving | ammo used 0 | ammo used 0 | LIVE VERIFIED (blocked by design) |
| Wheel bottoms vs ground (y) | [0, 0, 0, 0] | [0, 0, 0, 0] | LIVE VERIFIED (rest pose) |
| Model bbox vs collider (m, w x h x l) | [2.16, 2.14, 4.76] | [1.88, 2.07, 4.15] | LIVE VERIFIED |

## Vortex R (wedge hypercar)

| Test | Before fixes | After fixes | Label |
|---|---|---|---|
| 0-100 km/h | 1.38 s | 2.67 s | LIVE VERIFIED (arcade model, not real engine curve) |
| Top speed in 30 s (tune vmax) | 214 km/h (259) | 185 km/h (259) | LIVE VERIFIED |
| Brake 100->0 | 26.5 m / 1.98 s (14 m/s2) | 26.5 m / 2 s (13.9 m/s2) | LIVE VERIFIED |
| Handbrake 100->0 | 49.3 m | 49.3 m | LIVE VERIFIED |
| Reverse speed reached | -52.2 km/h | -26.2 km/h | LIVE VERIFIED |
| Steady full-lock turn lateral accel | 0.99 g, radius 23.2 m | 1.24 g, radius 18.4 m | LIVE VERIFIED |
| Wall hit at 20 m/s: penetration / health lost | (measurement script bug, discarded) | 0 m / 42.5 of 100 | LIVE VERIFIED on stub box |
| 4 repeated wall hits at 15 m/s: health lost each | [51.9, 51.9, 51.9, 51.9] | [39.4, 39.4, 39.4, 39.4] | SIMULATED |
| Thin pole 0.3 m, 0.6 m off centre | drove through: True | drove through: False | SIMULATED (stub rays) |
| Thin pole in centre | drove through: False | drove through: False | SIMULATED |
| 0.3 m high curb | drives through: True | drives through: True | SIMULATED (open, VEH-101) |
| Run over zombie at 18 m/s | zombie hp lost 365 | zombie hp lost 307, vehicle keeps 78 km/h | SIMULATED |
| Exit with wall on the door side | hero inside wall: True | hero inside wall: False | SIMULATED |
| Enter duration | 0.87 s | 1.72 s | LIVE VERIFIED |
| Exit duration | 0.35 s | 0.7 s | LIVE VERIFIED |
| State after exit (mode / active / driver / externalControl) | foot / null / false / false | foot / null / false / false | LIVE VERIFIED |
| Fire weapon while driving | ammo used 0 | ammo used 0 | LIVE VERIFIED (blocked by design) |
| Wheel bottoms vs ground (y) | [0, 0, 0, 0] | [0, 0, 0, 0] | LIVE VERIFIED (rest pose) |
| Model bbox vs collider (m, w x h x l) | [2.04, 1.28, 4.95] | [1.96, 1.23, 4.57] | LIVE VERIFIED |

## Sprint-R (full-fairing superbike)

| Test | Before fixes | After fixes | Label |
|---|---|---|---|
| 0-100 km/h | 1.13 s | 3.30 s | LIVE VERIFIED (arcade model, not real engine curve) |
| Top speed in 30 s (tune vmax) | 200 km/h (230) | 163 km/h (230) | LIVE VERIFIED |
| Brake 100->0 | 30.8 m / 2.32 s (12 m/s2) | 30.8 m / 2.33 s (11.9 m/s2) | LIVE VERIFIED |
| Handbrake 100->0 | 55.8 m | 55.8 m | LIVE VERIFIED |
| Reverse speed reached | -49 km/h | -8.1 km/h | LIVE VERIFIED |
| Steady full-lock turn lateral accel | 1.06 g, radius 38.4 m | 1.07 g, radius 38.1 m | LIVE VERIFIED |
| Lean angle vs tan(lean)=v*w/g | 47 deg vs expected 46.7 | 47 deg vs expected 46.9 | LIVE VERIFIED (formula holds) |
| Wall hit at 20 m/s: penetration / health lost | (measurement script bug, discarded) | 0 m / 39.4 of 100 | LIVE VERIFIED on stub box |
| 4 repeated wall hits at 15 m/s: health lost each | [55.6, 55.6, 55.6, 55.6] | [36.3, 36.3, 36.3, 36.3] | SIMULATED |
| Thin pole 0.3 m, 0.6 m off centre | drove through: True | drove through: True (pole is beside the 0.56 m wide bike body: correct) | SIMULATED (stub rays) |
| Thin pole in centre | drove through: False | drove through: False | SIMULATED |
| 0.3 m high curb | drives through: True | drives through: True | SIMULATED (open, VEH-101) |
| Run over zombie at 18 m/s | zombie hp lost 199 | zombie hp lost 152, vehicle keeps 77 km/h | SIMULATED |
| Exit with wall on the door side | hero inside wall: True | hero inside wall: False | SIMULATED |
| Enter duration | 0.87 s | 1.72 s | LIVE VERIFIED |
| Exit duration | 0.35 s | 0.7 s | LIVE VERIFIED |
| State after exit (mode / active / driver / externalControl) | foot / null / false / false | foot / null / false / false | LIVE VERIFIED |
| Fire weapon while driving | ammo used 0 | ammo used 0 | LIVE VERIFIED (blocked by design) |
| Wheel bottoms vs ground (y) | [0, 0] | [0, 0] | LIVE VERIFIED (rest pose) |
| Model bbox vs collider (m, w x h x l) | [0.76, 1.32, 2.04] | [0.56, 1.2, 2] | LIVE VERIFIED |

## Multi-vehicle and lifecycle

- 5 vehicles parked, 600 fixed steps: 0.001 ms/step. 5 vehicles all rolling at 15 m/s: 0.238 ms/step (before ray-comb change: 0.125). SIMULATED: stub ray casting scans all colliders linearly; real Rapier will differ. LIVE VERIFIED that nothing throws.
- Spawn+remove 10 vehicles: geometry delta 0, collider delta 0, scene-child delta 0. LIVE VERIFIED no leak (materials are cached/shared; not disposed).
- JS errors during all runs: [].


## NOT TESTED
- Audio (engine/skid/collision sounds): no audio device; the engine is a synthesized oscillator pair, review is STATIC only.
- Real keyboard/mouse/gamepad input into the vehicle, first-person view (none supported), camera collision in real streets.
- Real Rapier collision, vehicle-vs-vehicle pushes, rollover (not modelled), airborne/landing (ground is flat y=0, not modelled), slopes.
- Real-GPU FPS with 5 vehicles in view.
