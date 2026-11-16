# STAGE 3 – FIX LOG
Labels: LIVE VERIFIED / SIMULATED (harness Rapier stub) / STATIC (source reading) / NOT TESTED.

Order: (1) enter/exit timing + exit point, (2) collision rays, (3) handling tune, (4) housekeeping. Each fix re-ran the full per-vehicle script (`harness/s3v.cjs`, kept in the project notes) and the Stage 1/2 regressions listed at the end.

1. **VEH-003** `VehicleSystem.update`: removed `this.t += dt` (the same counter is advanced in `stepEnter`/`stepExit`). Result: enter 0.87 s -> 1.72 s, exit 0.35 s -> 0.70 s on all 5.
2. **VEH-001** new `findExitPoint(v)`. Candidates: driver door, passenger door, both at 1.8x, behind, in front. A candidate is rejected if a ray from the vehicle centre to it hits something, or a 0.45 m radial probe around it hits something. Result: hero never ends inside the wall on 5/5.
3. **VEH-002** `buildRaySet` + `integrate` rewritten. Rays are parallel combs; the trailing face is skipped (about 27 rays per moving vehicle instead of 8 centre rays, no allocations). Result: 0.3 m post at 0.6 m offset blocked on the 4 cars.
4. **VEH-004/005/006** `TUNE` retuned (accel, per-vehicle `mu`), reverse cap lowered.
5. **VEH-007/008** engine stopped on `remove()`, allocation-free integrate.

Regression after the last change: spawn/remove x10 leak-free; zero JS errors in the full run; enter -> drive -> exit state machine returns to `foot / active null / driver false / externalControl false` on 5/5; fire-while-driving still blocked; Stage 2 `s2.cjs`/`s3.cjs` zombie and combat suites unchanged (see STAGE2_REPORT.md).

Rollback: restore `src/vehicles/VehicleSystem.js` from the Stage 1.13 zip.
