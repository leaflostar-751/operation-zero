# STAGE 3 – PERFORMANCE REPORT
Labels: LIVE VERIFIED / SIMULATED (harness Rapier stub) / STATIC (source reading) / NOT TESTED.

No FPS or GPU numbers are given: the sandbox renders on a software GPU (SwiftShader) and the physics is a stub, so they would be invented.

| Item | Value | Label |
|---|---|---|
| Meshes per vehicle (draw calls, before shadow/post passes) | Apex 37, Stallion 37, Ranger 40, Vortex 36, Sprint-R 66 | LIVE VERIFIED (scene traversal) |
| Triangles per vehicle | 35,196 / 29,700 / 41,800 / 39,892 / 19,612 | LIVE VERIFIED |
| Distinct materials per vehicle | 16 / 16 / 16 / 15 / 16 | LIVE VERIFIED |
| Wheel merge effect (Stage 1.10) | car 85 -> 37 meshes, bike 106 -> 66, same triangles | LIVE VERIFIED |
| 5 parked vehicles, sim cost | 0.001 ms/step | SIMULATED |
| 5 vehicles rolling at 15 m/s | after: see STAGE3_TEST_RESULTS.md (ray comb costs more on the stub, which scans every collider; real Rapier uses a BVH) | SIMULATED |
| Spawn/remove x10 | 0 geometry / collider / scene-child leak | LIVE VERIFIED |
| Remaining GPU-side cost | 5 vehicles at the pad ~ 200 meshes x (main + shadow) passes | STATIC estimate |

Possible optimisations (not done): merge each vehicle's body panels into one mesh per material (Sprint-R still has 66 meshes), share wheel geometry between cars via instancing, cull the ray comb when no solid is within 15 m (chunk-based), dispose cached materials on scene change.
