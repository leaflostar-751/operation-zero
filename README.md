# OPERATION ZERO — Stage 1 (Hero & Movement)

Built on Stage 0 (engine, quality tiers, PBR, Rapier).

## Run
```
npm install
npm run dev
```
Opens http://localhost:3000. Click the game once to capture the mouse (Esc releases it; press Esc again for Settings).

## Controls
| Key | Action |
|---|---|
| Mouse | Look / orbit camera |
| W A S D | Move (run) |
| X (hold) | Walk slowly |
| Shift | Sprint (uses stamina) |
| C | Crouch toggle |
| Space | Jump |
| E | Use: pick up / drop / push / door |
| G | Throw held crate / push heavy crate |
| V | First / third person |
| F2 / F3 / Esc | Checklist / telemetry / settings |

Gamepad: left stick move, right stick look, A jump, B crouch, X use, Y camera. Touch: on-screen joystick and buttons.

## Test course
Stairs + 22° ramp to a platform (north), two-wall corridor (east, camera test), blue door (west), orange crate to pick up and green heavy crate to push (south), Stage 0 sphere grid (far west).

## Hero and animations (optional, built-in hero works without them)
See `public/assets/characters/README.txt` and `animations/README.txt` (Mixamo, free). Add all 10 animations together with a real hero.

## Fixes applied to the Gemini Stage 1 code
- Skin shader injected code that does not compile (`totalDiffuse` not in scope) -> hero head would break. Now injected after the light loop.
- Strafe A/D was reversed.
- Landing animation spammed on stairs (autostep flickers "grounded"). Now debounced; landing only after a real fall.
- Crouch made the capsule float/pop; capsule now resizes with feet fixed.
- Foot IK rewritten as real two-bone IK; old one lowered the pelvis on every normal step.
- Camera/hero moved in the fixed step (judder) -> interpolated.
- One-shot keys (jump/crouch/use) could be lost or fire twice -> latched per step.
- Door froze while carrying a crate.
- Mixamo cm/m hip height and root drift handled automatically; hero.fbx also supported; model auto-scaled to 1.8 m.
- Ramp/platform overlap with the stairs removed; shadows follow the hero.


## Stage 1.5 update: combat, better hero, glitch fixes
Controls: LMB / Enter = fire, RMB / Z = aim, R = reload, F = punch, Q = kick, H = holster/draw.
Shooting range with 7 dummies is south of the spawn (turn around). F3 telemetry is now hidden by default.
Known limits: aim-strafe backward walking reuses the forward walk clip (slight foot skate); with a real Mixamo hero the
hand orientation on the rifle is not tuned (arm IK reaches the grips, wrist rotation is left to the animation).


## Stage 1.6: characters, zombies, vehicles
- N cycles the hero outfit (operator / executive (rich) / survivor (poor) / street racer). Same body, only clothes and gear differ.
- U spawns 3 zombies near you, I starts the infection demo (a person coughs, staggers, collapses, convulses, then turns). A zombie yard and one infected person are west-south of the spawn.
- Headshots do triple damage; vehicles run zombies over.
- Parking pad east of the spawn: Apex GT, Stallion V8, Ranger 4x4, Vortex R and the Sprint-R bike. Walk to a door, press Y. W/S gas and brake, A/D steer, Space handbrake, Shift boost.
- E picks up a crate, B stows it on your back (B again takes it off).
- Needs real files later: hero.glb + Mixamo animations (see public/assets/characters/README.txt) for photoreal humans, and .glb car models if you want licensed real-brand shapes.


## Stage 1.7 – scenery, vehicle fixes, GLB import

* **World**: hills ring, skyline, instanced pines, clouds, haze fog (`src/world/Scenery.js`). Camera far plane is 1800 m.
* **Vehicles**: tyre smoke + skid marks (instanced), crash damage, bike throws the rider on a hard hit, bike rider leans over the tank.
* **Player**: landing camera dip; F2 checklist / Settings now pause gameplay input.
* **Real models from Sketchfab (or anywhere)** – see `public/assets/vehicles/manifest.json`:
  1. On sketchfab.com pick a model with a *Download 3D model* button (CC licence), choose **glTF / GLB**.
  2. Put the file in `public/assets/vehicles/`, add `{ "type": "apex-gt", "file": "name.glb", "length": 4.5 }` to the manifest.
  3. Wheels are found by node name (wheel/tyre/tire/rim), glass by material name; use `rotateY` 90/180/-90 if it faces the wrong way, `color` to repaint.
  * Hero character: drop `hero.glb` (+ Mixamo animations) into `public/assets/characters/` as before.

## Stage 1.8 – vehicle physics + real stairs
* Bike: lean-driven turning (tan(phi) = v*w/g, 47 deg limit), lagged lean, countersteer pulse on the handlebar, stands up when slow, highside when the rear locks at full lean.
* Car: Ackermann wheel angles (inner wheel turns more), friction-limited cornering (a_lat <= mu*g, handbrake mu 0.55) with understeer speed scrub.
* Test stairs now use real dimensions (rise 0.17 m, going 0.28 m, 13 steps).
* Full audit + prompts for Gemini: see the "Graphics Report" doc.

## Stage 1.9 – Gujranwala city (compact)
- Map is the same layout, shrunk (K=0.7 m/px, ~0.85 x 0.6 km). Press M for the full map.
- Colonies: lanes (galiyan) every 38 m, attached houses back-to-back, front walls + gates, bazaar lanes of shopfronts.
- Master City (east): gated villa plots (3 designs, portico/balcony/garage, lawns, palms).
- Markaz-e-Sanat (west): walled factory compounds (mill, steel, cement silos, warehouse, cold store, workshops, power yard).
- Landmarks: hospitals, Meridien hotel, VU, mosques, schools, petrol pumps, parks, wedding halls.
- Trees: real broadleaf / palm / cypress / shrub geometry (Trees.js). New: Districts.js, GeoBuilder.js.
- Not yet done: BMW/Toyota/Jeep-grade car detail, real bike model (needs GLB assets or a further pass).

## Stage 1.10 – full inspection fixes (QA-skill pass)
- **Hunched hero fixed**: Spine1/Neck have no animation tracks, so the combat torso twist/pitch accumulated every frame. They are now reset each frame (spine tilt 49–78° -> 4–7°); camera pitch clamp -0.7..0.55, neck counter-rotation.
- **Draw calls**: `world/MergeStatic.js` merges static city meshes per (deduplicated material, shadow flags, 120 m cell) – west colony view 836 -> 501 calls, centre colony 428 -> 389; materials 529 -> 188. Vehicle wheels/forks merged per material (car 85 -> 37 meshes, bike 106 -> 66) with identical triangles.
- Spawn floor z-fight fix verified (asphalt renders correctly).
- Known open: vehicle bodies are still procedural/stylised (real BMW/Toyota/Jeep-grade detail needs GLB models); real-GPU FPS and real Rapier were not measurable in the sandbox (SwiftShader).

## Stage 1.11 – audit-pack fixes
- Saved quality tier is validated against hardware: a saved HIGH/ULTRA on a weak device (<=4 GB / <=4 cores / mobile / integrated GPU) is capped to MEDIUM. LOW shadow map 1024 -> 512. `recommendQualityTier()` exported for a reset-to-recommended button.
- Input: all keys/drag released on tab hide (visibilitychange) and on pointer-lock loss, in addition to window blur.
- HUD: HP/stamina are NaN/Infinity-safe and clamped to 0..max; HP bar = hp/maxHealth. (The `1000000000` HP seen in an earlier screenshot came from the QA test harness setting hero.health = 1e9 to stop the hero dying; the game itself starts at 100.)
- Backward aim-strafe foot skating: walk/run/sprint clip plays in reverse when the body moves backwards relative to its facing (new `forwardSpeed` in AnimationController).

## Stage 1.12 – Stage 2 zombie/combat audit
See STAGE2_REPORT.md (bug register with LIVE VERIFIED / SIMULATED / STATIC / NOT TESTED labels). Fixes: zombie spawn/movement use the real map bounds and avoid buildings, swept collision (no walking through walls), dead zombies/converted civilians release collider + combat target, melee ignores corpses, dead hero cannot shoot, respawn resets reload/melee.

## Stage 1.13 – Stage 2 closeout
Melee line-of-sight, runtime tests for building-spawn avoidance and respawn reset, 30-zombie timing, `tests/stage2_console.js` for running the same checks against real Rapier locally. See STAGE2_REPORT.md.

## Stage 3 – Vehicle audit (see `stage3/`)
Five vehicles audited individually. Fixed VEH-001..008 (exit spots, enter/exit timing, reverse, tuning with friction-limited cornering, thin-obstacle rays, wheel/draw-call merge, engine cleanup). Open: VEH-101..109 (curbs, vehicle-vehicle, damage deformation, suspension/slopes, doors/indicators, collider mismatch, audio untested, first-person camera). Physics numbers are SIMULATED (Rapier stub); run `tests/stage2_console.js` with real Rapier locally. Read `stage3/STAGE3_REMAINING_ISSUES.md`.

## Stage 4a – Weather and day/night (new)
`src/world/WeatherSystem.js`: 24 h clock (1 game hour = 30 s), sun/moon, sky dome with clouds/stars, fog, 6 weather presets (clear, cloudy, rain, storm, fog, dust), GPU rain, lightning, wet ground, zombie sight/hearing multipliers, procedural rain/wind/thunder sound.
Keys: `.` next weather, `,` +1 hour, `/` freeze/unfreeze time. Console: `__opzero.weather.setWeather('storm')`, `__opzero.weather.setHour(22)`.
Status: LIVE VERIFIED by screenshots (SwiftShader, MEDIUM) for clear dawn/noon/dusk/night, cloudy, rain, storm, fog, dust. NOT TESTED: real GPU FPS, audio, other quality tiers. Open: wind does not move trees yet, wet look only on the ground plane, no rain splashes.

## Stage 4b – Lighting / overall look (Step 4 of the user's order 4,3,2,1)
- Colour grading in `PostProcessing.js` cinema pass (split-tone, saturation, contrast), driven per time-of-day and weather by `WeatherSystem`.
- Film grain cut from 0.03 to 0.012 and faded out in dark areas (night was noisy).
- Night is blue moonlight, readable; dusk/dawn ambient floors raised.
- Street lamps (highway medians): glowing lamp heads + additive light pools at night, no real point lights (cost: 2 instanced draw calls).
- LIVE VERIFIED (SwiftShader, MEDIUM) by screenshots: noon, dawn, cloudy, night city, lamp glow. NOT TESTED: real GPU FPS, HIGH/ULTRA (SSAO) look, lit building windows (not done yet, facades have no window mask).
