# STAGE 3 – GRAPHICS REPORT (per vehicle)
Evidence: 960x540 MEDIUM close-ups from SwiftShader (`vs_{0..4}_{front34,side,rear34}.png`, in the work scratchpad, not in the zip). SwiftShader is software GL: colours/AA/reflections are indicative only. Real-GPU look: NOT TESTED.
Test-rig note: some close-ups (e.g. Vortex side, vs_3_side) have the free camera inside a neighbouring car's cabin because the cars are parked close together; that is a test-camera problem, not a game bug. HUD overlay is visible in the shots (selectors in my script missed it).

## Geometry / inventory (LIVE VERIFIED, scene traversal)
| Vehicle | meshes | triangles | materials |
|---|---|---|---|
| Apex GT | 37 | 35,196 | 16 |
| Stallion V8 | 37 | 29,700 | 16 |
| Ranger 4x4 | 40 | 41,800 | 16 |
| Vortex R | 36 | 39,892 | 15 |
| Sprint-R | 66 | 19,612 | 16 |

## Per-vehicle visual findings (LIVE VERIFIED by looking at renders)
- Apex GT: smooth lofted body, spoked rims with brake discs, tinted glass, headlamp bulbs. Missing: door seams, handles, mirrors with housings, grille mesh, interior detail beyond seats/wheel.
- Stallion V8: orange muscle body, same wheel kit; long hood reads correctly; no door cut-lines, no chrome trim, no exhaust tips visible.
- Ranger 4x4: boxy green 4x4 with roof rack and spare, chunky tyres; flat panels, no hinges/handles/bumper detail.
- Vortex R: low yellow open-wheel-style sports body, cockpit with seats and wheel; fine silhouette but sparse surface detail.
- Sprint-R bike: red fairing, tank and tail are very blocky and oversized relative to the engine/frame; wheels with discs and forks are present; no visible chain, exhaust detail or mirrors at this distance; the fairing looks like stacked slabs, not a sculpted tank.
- Common: one headlight and one brake-light material each; no door meshes or indicators (VEH-105); window glass is a flat tint with no reflections beyond the env map.

## Materials (STATIC)
MeshStandard/Physical with roughness/metalness values; no normal maps, no albedo textures, no clear-coat texture, no UV-based decals. Paint is flat colour; metallic look depends only on the environment map.

## What can be improved with EXISTING procedural assets
- Roughness/clearcoat tuning, env-map intensity, better glass (transmission off for cost), emissive lamps with bloom-free glow.
- Adding more procedural geometry: door cut-lines (thin dark inset strips), handles, mirrors, grille slats, exhaust tips, plates (no real logos). This is geometry work, not shading, and costs triangles.
- Per-tier LOD: drop interior + brake discs on LOW.

## What REQUIRES new assets
- Real brand-grade body panels, curved fender detail, interior with dashboard/gauges, bike engine block/chain/exhaust, true normal-mapped tyres, license-plate textures. These need authored GLB models + textures (VehicleImporter already supports a manifest; `vehicles` array is empty).
- Shaders/lighting cannot turn the current slabs into a detailed model. No 'AAA' or 'photoreal' claim is made.

## Not tested
Shader compile errors on real GPU, LOD transitions (none exist for vehicles), AO, real reflections, texture memory (no textures used), shadow artefacts on a real GPU.
