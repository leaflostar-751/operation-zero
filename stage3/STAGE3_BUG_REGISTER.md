# STAGE 3 – BUG REGISTER
Labels: LIVE VERIFIED / SIMULATED (harness Rapier stub) / STATIC (source reading) / NOT TESTED.

Every bug applies to all 5 vehicles unless stated (each was measured per vehicle, see STAGE3_TEST_RESULTS.md).

## Fixed in this stage
| ID | Sev | File / function | Root cause | Repro | Expected | Actual (before) | Evidence | Fix | Regression test | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| VEH-001 | P2 | VehicleSystem.beginExit / stepExit | exit point was always `doorWorld`, never checked for walls | park with the driver door 0.3 m from a wall, press Y | hero steps out on a free side | hero ends inside the wall (5/5 vehicles) | s3v exitBlocked | `findExitPoint()` tries driver door, passenger door, wider door, behind, in front with ray checks | s3v exitBlocked, `heroInsideWall=false` 5/5 | FIXED (SIMULATED rays) |
| VEH-002 | P2 | VehicleSystem.integrate | only 8 rays from the centre; a 0.3 m pole between rays is not detected | drive at 12 m/s at a 0.3 m post 0.6 m off centre | car stops / slides | drives through (5/5) | s3v thinPole_offset0_6 | comb of parallel rays every ~0.15 m on the travelling face (+ sparse sides + diagonals), no per-step allocations | thinPole offset + centre: blocked on 4 cars; bike passes only because the pole is outside its 0.56 m body | FIXED (SIMULATED) |
| VEH-003 | P3 | VehicleSystem.update + stepEnter/stepExit | `this.t += dt` executed twice per step | measure enter/exit time | enter 1.7 s, exit 0.7 s | 0.87 s / 0.35 s (animation at 2x) | s3v enter/exitOpen | removed the extra increment in `update()` | enter 1.72 s, exit 0.70 s | FIXED (LIVE VERIFIED) |
| VEH-004 | P3 | VehicleSystem TUNE.accel | arcade accel far above traction limit | 0-100 km/h | roughly 3.5/4.3/8/2.6/3 s | 2.2/2.5/7.4/1.4/1.1 s (bike 2.5 g) | s3v accel | accel retuned | 4.05/4.72/7.43/2.67/3.30 s | FIXED (LIVE VERIFIED); ranger left as is |
| VEH-005 | P3 | VehicleSystem.drive (reverse) | reverse cap = 25% of vmax | hold brake from rest | ~30 km/h car, walking pace bike | up to 52 km/h car, 49 km/h bike | s3v reverse | reverse cap 9 m/s car, 2.5 m/s bike | 24-26 km/h cars, 8 km/h bike | FIXED (LIVE VERIFIED) |
| VEH-006 | P3 | VehicleSystem.drive friction limit | one mu (1.0 g) for every car | full-lock turn at 15 m/s | SUV < sports car < hypercar | 1.0 g for all | s3v turn20 | per-vehicle `tune.mu` (apex 1.05, stallion .95, ranger .8, vortex 1.25) | 1.05 / .95 / .80 / 1.24 g | FIXED (LIVE VERIFIED) |
| VEH-007 | P3 | VehicleSystem.remove | removing the active vehicle left the engine oscillators running | remove active vehicle | engine stops | oscillators keep running | STATIC | `engine.stop()` in `remove()` | spawn/remove x10 no errors | FIXED (STATIC; audio NOT TESTED) |
| VEH-008 | P3 | VehicleSystem.integrate | ~9 Vector3 allocations per vehicle per step | - | none | allocations | STATIC | preallocated `_o`, `_d`, cached ray set | coasting 5 vehicles run | FIXED (STATIC) |

## Open (not fixed in this stage)
| ID | Sev | Finding | Label |
|---|---|---|---|
| VEH-101 | P3 | Rays are cast at y=0.55 m: anything lower (0.3 m curb) is driven through. No step-height logic. | SIMULATED (0.3 m curb drives through on 5/5) |
| VEH-102 | P3 | Vehicles are kinematic boxes: no momentum transfer between vehicles, parked cars never move when hit. | STATIC |
| VEH-103 | P3 | Damage is a health number only: no body deformation; health 0 = engine dead forever (no repair/respawn of the vehicle). Hard crash >19 m/s (car) ejects driver by design. | STATIC |
| VEH-104 | P3 | Suspension is visual only (body roll/pitch). No spring/damper, wheel travel, rollover, airborne or slope handling; ground is flat y=0. Wheel bottoms sit exactly at y=0 (checked). | STATIC + LIVE VERIFIED (wheel bottoms) |
| VEH-105 | P4 | Models have no door meshes/animation, no indicators, one shared headlight and one brake-light material per car, no visible interior beyond seat/wheel/pedals. | STATIC (inventory counts LIVE VERIFIED) |
| VEH-106 | P3 | Vehicle vs hero: no run-over damage, hero capsule behaves like a wall in real Rapier (the stub ignores capsules). | NOT TESTED / STATIC |
| VEH-107 | P3 | Collider box differs from the visual bbox: Ranger visual 2.16 x 2.14 x 4.76 vs collider 1.88 x 2.07 x 4.15 (mirrors/wheels overhang 0.14 m per side, 0.3 m front/back). Other cars within 0.1-0.25 m. | LIVE VERIFIED |
| VEH-108 | P3 | Audio is a synthesized sawtooth+square pair with a fake 5-gear sweep; no skid/brake/collision-per-vehicle layers, no cleanup test. | STATIC / NOT TESTED |
| VEH-109 | P3 | No first-person/cockpit camera for vehicles; chase camera only (collision ray excludes only the vehicle). | STATIC |
