# STAGE 3 – FULL VEHICLE AUDIT REPORT
Labels: LIVE VERIFIED / SIMULATED (harness Rapier stub) / STATIC (source reading) / NOT TESTED.

## 1. Inventory (STATIC, from source)
| File | Lines | Contents |
|---|---|---|
| `vehicles/VehicleModels.js` | ~1260 | `VEHICLE_INFO`, `PAINT`, procedural `buildCar` / `buildBike`, `addWheel` (+ `mergeLocal`), `mergeStatics`, GLB hooks |
| `vehicles/VehicleSystem.js` | ~900 | `TUNE` handling table, `EngineSound`, `TyreFX` (instanced skid marks + smoke), `Vehicle`, `VehicleSystem` (`spawn/remove/nearest/update/coast/drive/integrate/beginEnter/stepEnter/finishEnter/beginExit/findExitPoint/stepExit/applyPose/updateFrame/driveCamera`) |
| `vehicles/VehicleImporter.js` | 205 | GLB vehicle manifest/importer (manifest `vehicles` array is empty: procedural fallback is the only path in use) |
| Related | | `core/Physics.js` (kinematic box, castRay, removeEntry), `characters/CombatSystem.js` (targets for run-over), `core/Input.js` (moveX/moveY/handbrake/sprint/vehicleJustPressed), `ui` speedometer elements |

Vehicles in the game (5): Apex GT, Stallion V8, Ranger 4x4, Vortex R (cars), Sprint-R (bike). Each has its own section in STAGE3_TEST_RESULTS.md.

## 2. How the vehicle model works (STATIC)
Arcade kinematic model, not a rigid-body vehicle: position/yaw integrated in the fixed 60 Hz step; longitudinal force = `accel * throttle * (1-(v/vmax)^2)`; braking limited to ~1 g; lateral grip = exponential decay of side velocity; steering by a bicycle model, lock reduced with speed; yaw rate friction-limited (|v*w| <= mu*g, handbrake lowers it). Bike: lean angle from `tan(phi)=v*w/g` with a lag (47 degree limit) and the lean produces the yaw rate; highside if the rear is locked above 0.8 rad lean. Collision: ray comb against the physics world, slide + bounce, health loss above 5 m/s impact. Wheels spin from speed, Ackermann steering on cars, body roll/pitch from lateral/longitudinal acceleration. Collider: one kinematic box per vehicle.

## 3. Module-by-module result
| Module | Result |
|---|---|
| 1 Models | procedural, see STAGE3_GRAPHICS_REPORT.md |
| 2 Physics | numbers measured per vehicle (LIVE VERIFIED); realism fixed (VEH-004/5/6); no airborne/slope/rollover modelled (VEH-104) |
| 3 Suspension/wheels | wheel radii 0.31-0.40 m, bottoms exactly at y=0 (LIVE VERIFIED); Ackermann present (STATIC); no spring/damper travel (VEH-104) |
| 4 Motorcycle | lean 47.0 deg measured vs 46.9 expected from tan(lean)=v*w/g (LIVE VERIFIED); lean is a real state that drives yaw, not just an animation (STATIC); rider on bike via IK to pegs/bars (STATIC); highside/recovery: only the lock-up trigger exists (NOT TESTED) |
| 5 Collision/damage | wall stop without penetration (SIMULATED); thin posts fixed (VEH-002); zombies run over (SIMULATED); curbs ignored (VEH-101); no vehicle-vehicle momentum (VEH-102); health-only damage (VEH-103) |
| 6 Animation | wheels, steering wheel, brake lights, headlight intensity, tyre marks, rider IK exist (STATIC); doors/indicators absent (VEH-105); enter/exit speed fixed (VEH-003) |
| 7 Camera/controls | chase camera with collision ray (STATIC); no first-person (VEH-109); real input devices NOT TESTED |
| 8 Audio | synthesized oscillators (VEH-108); NOT TESTED |
| 9 Graphics | STAGE3_GRAPHICS_REPORT.md |
| 10 Performance | STAGE3_PERFORMANCE_REPORT.md |
| 11 Enter/exit/integration | state machine returns to clean foot state 5/5 (LIVE VERIFIED); exit inside walls fixed (VEH-001); firing blocked while driving (LIVE VERIFIED); death in vehicle: code path `health<=0 -> beginExit(true)` (STATIC); respawn/vehicle persistence NOT TESTED |

## 4. Deliverables
STAGE3_BUG_REGISTER.md, STAGE3_FIX_LOG.md, STAGE3_TEST_RESULTS.md, STAGE3_GRAPHICS_REPORT.md, STAGE3_PERFORMANCE_REPORT.md, STAGE3_REMAINING_ISSUES.md, data_before.json, data_after.json and the updated project zip.
