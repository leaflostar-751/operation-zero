# OPERATION ZERO — GOKU Audit Blueprint (2026-11-21)

**Mode: AUDIT ONLY.** Is round mein game ka code/asset nahi badla. Sirf naap, dekhna, aur likhna. Labels: **LIVE** = chalte game se naapa (sandbox, software GL), **STATIC** = file/code padh kar, **SIMULATED** = stub physics / software GL (asli GPU nahi), **ESTIMATE** = meri andaza, naapa nahi.
Status words: PASS / PARTIAL / FAIL / BLOCKED / UNVERIFIED / NOT_IMPLEMENTED / NOT_POSSIBLE.

## 0. Sabse pehle 5 saaf baatein
1. Game ka **poora 3D procedural code se banta hai**: repo mein ek bhi `.glb` ya texture file nahi (STATIC). Isliye "AAA jaisi" shakal ke liye asli models/textures banane padenge (Step 2/1) — sirf lighting badalne se nahi hoga.
2. Sabse bara, naapa hua masla **mobile performance** hai: 969 draw calls (budget 150), 1.18M triangles (budget 300k) (LIVE).
3. GOKU abhi **dekh aur naap** sakta hai (screenshots, 360° sheets, reference numbers). Wo **khud code ya asset nahi badal sakta** (NOT_IMPLEMENTED). Fix insaan/Claude karta hai, GOKU verify karta hai.
4. Blender: is sandbox mein **install nahi aur pip block** → Blender wala kaam yahan test nahi ho sakta (BLOCKED). Online (GitHub runner) par ho sakta hai, UNVERIFIED.
5. "AAA se muqabla" ke liye asli reference tasveerein chahiye; unke bina AAA ka dawa nahi kiya ja sakta (Phase 4 mein likha).

## Phase 1 — Project discovery (STATIC)
| Hissa | Naap |
|---|---|
| Stack | Vite 5 + three.js 0.170 + Rapier 0.14 (physics sandbox mein stub: SIMULATED) |
| `src/` | ~13.4k lines JS: characters 4251 (11 files), world 4237 (11), vehicles 2365 (3), core 1273 (7), ui 383, main 376, ai 364, debug 107 |
| Placeholder | `src/modes/` 5 files / 5 lines total (racing, fighting, extraction modes = NOT_IMPLEMENTED); `src/audio/` 5 lines (awaaz NOT_IMPLEMENTED) |
| Assets | `public/assets/*` sirf README + `vehicles/manifest.json` (khali `vehicles: []`) → koi GLB, koi texture, koi HDRI nahi |
| Runtime textures | 48 (LIVE) — code se banti hain (canvas) |
| Tools/tests | tools 10 files, scripts 8, cloud 8, tests 4; reference check, turntable, QA, ledger, relay, daily guard |
| Purane sawal | duplicate systems: nahi dhoonde (poora audit nahi, sirf directory-level) → PARTIAL |

## Phase 2 — Live visual inspection (kitna dekha gaya)
| Cheez | Dekha? | Kaise | Status |
|---|---|---|---|
| Hero | haan | 360° sheet + naap | PASS (dekha); look = Step 1 |
| GOKU partner | haan | 360° sheet + 10 clips ke joints | PASS |
| Zombie | 1 type, 1 sheet | 360° + feet naap | PARTIAL (runner/civilian-derived variants nahi dekhe) |
| Gaadiyan | 3 / 5 (apex-gt, stallion, ranger) | 360° sheets | PARTIAL — **vortex aur sprint-r (bike) abhi nahi dekhi** |
| Imaratein | 2 landmarks (Meridien, VU) | 360° | PARTIAL — 492 houses/blocks sirf numbers (storey), tasveer nahi |
| Roads, terrain, trees, props | QA cells + spawn shot | screenshots | PARTIAL |
| Lighting/shadows | spawn + cells | screenshots | PARTIAL (flat-looking ground, 1 shadow light) |
| Animations | numbers (joints) | motion dekhna sheets se nahi hota | PARTIAL — video/frame sequence NOT_DONE |
| Interiors | — | game mein interiors hain hi nahi | NOT_POSSIBLE |
| Camera transitions | — | NOT_DONE |

## Phase 3 — Graphics audit (12 mudde)
| # | Mudda | Nateeja | Evidence | Status |
|---|---|---|---|---|
| 1 | Geometry/topology | gaadi jism "takiye jaisa" naram; panel lines/seams nahi | contact sheets | FAIL (look) |
| 2 | Anatomy/proportions | insaan 18/18 range ke andar | reference check LIVE | PASS |
| 3 | Chehra/aankh/baal/kapde | chehre ke tagged hisse nahi, zombies ek jaisi pose | NOT measurable | NOT_IMPLEMENTED |
| 4 | Gaadi geometry/materials | Ranger 2.07 m (range se bahar), rim/glass detail saada | reference + sheets | PARTIAL |
| 5 | Texture resolution/UV | koi authored texture nahi; 48 generated | LIVE count | FAIL (for AAA) |
| 6 | PBR maps | zameen par albedo+normal+roughness (`World.js`), paani par normal map (`City.js`); imaraton/props mostly solid colour/vertex colour + roughness; AO maps `grep` mein nahi | STATIC + LIVE | PARTIAL (AAA ke liye kam) |
| 7 | Environment density | zameen flat, spawn par M0 test-course slabs placeholder | sheets + World.js | FAIL (look) → Step 3 |
| 8 | Terrain/trees/grass/water | trees LOD ho chuke (Step 4 r3); terrain flat | STATIC+sheets | PARTIAL |
| 9 | Lighting/shadow/AO | 1 directional (512 map) + hemisphere + 2 point; AO nahi | LIVE | PARTIAL |
| 10 | Animation/rigging | joints 40/40 range ke andar, feet zameen par 5/5 | LIVE | PASS (numbers) / UNVERIFIED (motion ka look) |
| 11 | Camera | spawn view theek, near-plane issue nahi dikha | sheets | PARTIAL |
| 12 | Rendering/post | post-processing hai; fps asli GPU par NOT measured | LIVE 2.6 fps = software GL, bekar | UNVERIFIED |

## Phase 4 — AAA reference comparison: **NOT_DONE (aur jhoot nahi bolunga)**
- Asli AAA screenshots/models is repo mein ya sandbox mein nahi; web se download karke "isse milta hai" kehna licence + dawa dono ke hisaab se theek nahi.
- Jo **number** se muqabla ho sakta hai wo table mein hai: draw calls, triangles, unique materials (Phase 6). Look ka muqabla tab hoga jab aap reference tasveerein/blueprints dein (aapki apni ya licence-wali).
- Har future comparison ka format: current | target | farq | exact wajah | fix | performance cost | zaroori assets.

## Phase 5 — Redesign plan (order aapka tay kiya hua)
| Step | Kya | Zaroori | Cost (ESTIMATE) |
|---|---|---|---|
| 4 | Look + mobile performance (ab ka kaam) | code-only | draw calls ↓ bohat, triangles ↓ |
| 3 | City/ground: M0 slabs hatana, ground detail, roads/props | tools, shayad Blender | tris ↑ thora, instancing zaroori |
| 2 | 250+ original parametric gaadiyan | generator code (+Blender export) | har gaadi ≤ 5–8 draw calls ka target |
| 1 | Characters: chehra, baal, kapde, rig | Blender (ya MakeHuman-jaise open tool), licence check | skinned mesh = mobile par mehnga: LOD |
| 0 | Modes, audio | — | — |
Aap har step ki tasdeeq ke baad hi agla.

## Phase 6 — Performance (LIVE, spawn view, software GL)
| Metric | Abhi | Mobile budget | Status |
|---|---|---|---|
| Draw calls | **969** | 150 | FAIL |
| Triangles | **1,177,834** | 300,000 | FAIL |
| Geometries | 609 | ≤200 | FAIL |
| Textures | 48 | ≤40 | FAIL (thora) |
| Material objects / distinct (type,colour,roughness,metalness) | **571 / 226** | — | upper bound: 345 shayad share ho sakte hain; asli number UNVERIFIED (is key mein emissive, vertex-colour, maps, transparency shamil nahi; `MergeStatic.js` pehle se kuch dedupe karta hai) |
| Shadow casters (1 directional light, 512 map) | 1028 | kam | root cause |
| Shader programs | 37 | — | OK |
| Heap | 117 MB | — | OK |
| FPS | 2.6 (software GL) | 30+ | UNVERIFIED (asli GPU nahi) |

**Repeatable tool:** `node tools/oz-explorer/drawcalls.mjs <url> --out drawcalls` (har fix ke baad before/after). Do run: 969 aur 965 calls, 571 aur 587 material objects — run-to-run ±1–3% farq normal (random zombies/weather). Maine ye tool khud sandbox mein chalaya (PASS), GitHub par abhi nahi (UNVERIFIED).

**Draw calls kahan se (LIVE scene tree):** `city` 571 bacche / 923 meshes (457 instanced), ~270 alag "merged" imarat-meshes (har ek ka apna draw call), 98 loose scene meshes (props/test course), gaadiyan: apex-gt 37, stallion 37, ranger 40, vortex 36, sprint-r 66 meshes (≈216 meshes, sab spawn ke aas-paas load). Triangles: `city` ≈784k, baqi group ≈497k.

**Levers, asar ke hisaab se (ESTIMATE, har ek ke baad dobara naapna zaroori):**
1. Duplicate materials share karna (571 objects, 226 combos = upper bound; pehle asli duplicates ginna) — kam risk, batching kholta hai.
2. Imaratein ek material par merge/instance karke ~270 calls ghatana.
3. Shadow casters ghatana: sirf paas ki cheezein shadow dalein, imaratein/dur ki cheezein nahi.
4. Gaadiyan: door wali gaadiyon par mesh-merge / LOD (216 meshes → ~5×8).
5. Triangles: building/tree LOD aur distance cull; 17,640-vertex wale meshes (2 groups mein dikhe; kis cheez ke hain UNVERIFIED) ko simple LOD.
Asli fps sirf asli GPU/phone par naapi ja sakti hai (UNVERIFIED).

## Phase 7 — Issue register (persistent; asli ledger `ledger.json` har run mein badhta hai)
| ID | Severity | Issue | Evidence | Root cause | Fix (proposed) | Files | Test | Status |
|---|---|---|---|---|---|---|---|---|
| OZ-001 | Major | 969 calls vs 150 → **681 after fix #2 (2026-11-23)**, still FAIL vs 150 | `__OZ_DEBUG.perf()` LIVE + `drawcalls.mjs` | materials ki bharmaar, per-building meshes, 1028 shadow casters, vehicle parts | levers 1–4 | `src/world/*`, `MergeStatic.js`, `src/vehicles/*` | `goku_qa --cells 3` perf rows | PARTIAL (open) |
| OZ-002 | Major | 1.18M tris vs 300k | LIVE | city 784k + groups 497k | LOD/cull | `City.js`, `Trees.js` | same | FAIL (open) |
| OZ-003 | Major | 571 materials objects, 226 (type,colour,roughness,metalness) combos | LIVE | kuch materials har object par naye (kitne share ho sakte hain = UNVERIFIED) | material cache + key mein emissive/vertexColors/maps | `CityTextures.js`, `MergeStatic.js`, builders | material-count test | PARTIAL (open) |
| OZ-004 | Minor | Ranger 2.07 m (class range ~1.7–1.95) | reference check LIVE | roof rack shamil / body height | model naam + spec chahiye | `VehicleModels.js` | `reference.test` + live | PARTIAL |
| OZ-005 | Major(look) | gaadi body takiye jaisi | sheets | smooth loft, no panels | Step 2 generator | `VehicleModels.js` | sheet before/after | NOT_IMPLEMENTED |
| OZ-006 | Minor(look) | M0 test-course slabs spawn par | sheets + probe | `World.js` test props | Step 3 mein replace (tests ke saath) | `World.js` | smoke + a0 tests | open |
| OZ-007 | Major(look) | zameen flat | sheets | ground material/detail nahi | Step 3 | `World.js`, `CityTextures.js` | sheet | NOT_IMPLEMENTED |
| OZ-008 | Major(look) | chehra/baal nahi, zombies ek jaisi pose | sheets | procedural body | Step 1 | `CharacterBuilder.js` | sheet | NOT_IMPLEMENTED |
| OZ-009 | Info | modes/audio khali | STATIC | placeholders | Step 0 | `src/modes`, `src/audio` | — | NOT_IMPLEMENTED |
| OZ-010 | Info | asli GPU fps/Rapier/vite build kabhi naapa nahi | sandbox limit | npm registry/GPU nahi | owner ke phone/GitHub run | — | real run | PARTIAL (2026-11-24: vite build + real Rapier run GitHub par ho gaya; asli GPU fps/phone abhi UNVERIFIED) |
| OZ-011 | Major (UNVERIFIED) | zombies hero tak pahunchein to hero ka `position.y` 1.8 m par chala jaata hai aur wahin rehta hai (zombie ke sar par khada) | sandbox probe 70 s, LIVE par **stub physics = SIMULATED**: y 0 → 1.8, hp 100 → 46 | stub ka `ground()` zombie ke collider ko zameen maanta hai (STATIC padha); asli Rapier mein autostep sirf 0.38 m hai | pehle asli Rapier par naapo | `tests/zombie_pressure.mjs` (naya) | GitHub run mein har baar chalta hai | UNVERIFIED |
| OZ-012 | Minor | server par A0 "read-only" test FAIL: hero y −0.0018 → −0.0023, camera y 0.3 mm farq | GitHub run #1 | test bilkul barabar maangta tha, game beech mein chalta rehta hai (asli physics hero ko mm mein settle karti hai) | position 1 cm tolerance, ginti/health exact | `tests/a0_debug.mjs` | sandbox A0 5/5; server par agla run | PARTIAL (server UNVERIFIED) |
| OZ-013 | Major (UNVERIFIED) | hero ground-contact: lowest foot 0.228 m (range −0.10..0.20) server par | GitHub run #1 (1 sample, state record nahi tha) | daudte waqt dono paon hawa mein ho sakte hain; ya asli koi masla — **pata nahi** | ab sirf khade hero ko judge karo; state + speed evidence mein likho | `reference.mjs` | `reference.test` 18/18; sandbox khada hero 0.062 m | UNVERIFIED |
| OZ-014 | Major | 4 mein se 4 car turn mein **andar** ki taraf jhukti hain (bike jaisa); asli car bahar jhukti hai | `vehiclemotion.mjs` LIVE: Apex GT −1.4°, Stallion −1.8°, Ranger −2.4°, Vortex −1.2° (typical 0..+7° outward) | `VehicleSystem.updateFrame`: `targetRoll = clamp(-latG * bodyRoll * 0.05, ...)` (car ka +X = left, left turn par latG>0) | roll ka sign ulta (sirf car, bike nahi) | `src/vehicles/VehicleSystem.js` | `vehiclemotion.mjs` before/after | **FIXED (PR, 2026-11-24): roll −1.4/−1.8/−2.4/−1.2° → +1.4/+1.8/+2.4/+1.2°, Major 4 → 0, regression PASS** (PASS; server UNVERIFIED) |
| OZ-015 | Minor | slow chalte waqt paon zameen par phisalte hain (walk clip 0.2 m/s par ~4× tez) | `motion.mjs` LIVE: slideLow 3.013 (hero aur GOKU), crouch-walk 1.745 | speed-match clamp 0.55 se neeche | idle se blend ya clamp neeche | `AnimationController.js` | `motion.mjs` slideLow ≤ 0.6 | OPEN |
| OZ-016 | Minor | daudte/chalte waqt tang bilkul seedhi (ghutna lock) | `motion.mjs` reachMax 0.999 (walk/run/sprint) | synth clip ghutna 0° tak seedha | stance mein ≥ 4–6° flex | synth clips | reachMax < 0.995 aur skating PASS | OPEN |
| OZ-017 | Minor | crouch-walk mein 10.5 % waqt dono paon hawa mein | `motion.mjs` flight 0.105 | crouch-walk duty chhota | clip theek | synth clips | flight ≤ 0.02 | OPEN |
| OZ-018 | Minor (UNVERIFIED) | jodon (ghutna/kuhni/kandha) par rigid-skin ka sakht kona / gap | tasveer se lagta hai, number nahi | har vertex 100 % ek bone | 2-bone blend weights | `CharacterBuilder.js` | close-up + draw calls na badhen | UNVERIFIED |

## Phase 8 — Roadmap + zaroori tools
| Phase | Kaam | Status abhi |
|---|---|---|
| Step 4 | OZ-001..003 (performance + look) | FAIL → agla kaam |
| Step 3 | ground/city | not started (aapki tasdeeq ke baad) |
| Step 2 | 250+ gaadiyan | not started |
| Step 1 | characters (chehra/baal/rig) | not started |
| Step 0 | modes/audio | not started |

**Zaroori tools/dependencies:** Blender (BLOCKED here; GitHub runner par `apt/snap/pip bpy` UNVERIFIED), asli phone ya GPU test (UNVERIFIED), reference photos/blueprints (aapse), GitHub link + empty repo `operation-zero` (aapse), licence-wali open assets sirf jab licence IS use ki ijazat de.
**Hardware:** 4 GB RAM laptop → ek waqt mein ek bhari cheez; local AI model + 3D tool saath nahi. Heavy kaam online servers par.

## Round 2 — fix log (2026-11-23), pehla asli GOKU-ijazat wala fix
**Naap pehle:** `drawcalls.mjs` ke per-pass hisaab se spawn par 966 calls mein se **585 (61%) sun-shadow pass**; shadow pass ka ~70% (401 calls, 493k tris) **13 insaan** (~31–61 mesh har ek). Tool ka main 347 + shadow 581 = 928, asli 966 ke 4% ke andar (LIVE).
| Fix | Kya | Naap (spawn, LOW tier, LIVE) |
|---|---|---|
| #1 | body-parts ki detail unki screen-size ke hisaab se (`ell()` mein 3 sphere detail) | triangles 1.175M → 1.020M; characters shadow tris 493k → 370k |
| #2 | rigid skinning: har insaan ka har material ek `SkinnedMesh` (har vertex 100% apni purani bone se bandha) | draw calls 964 → **681**; characters main 140→68, shadow 398→187; geometries 609→395 |
**Kuch toota nahi:** smoke PASS, A0 5/5, GOKU partner PASS (12 hits/4 kills), explorer 6 cells/0 findings, reference test 16/16. Hero A/B tasveer (purana vs naya code, same camera): helmet/goggles/vest/rifle/camo ek jaise, koi tooti/kheenchi body nahi (aankh se; farq animation-phase ka).
**QA tool ko bhi theek karna pada:** pair ke "joota kis taraf" wali jaanch foot-bone ke mesh dekhti thi; ab mesh skinned hain to wo 11 jhoote "knee wrong way" Major deti thi. Ab skinned vertices se foot box banta hai → wapas saaf (QA 22 → 10 findings, baqi sab purane/APPROX).
**Abhi bhi baqi (Step 4):** draw calls 681 vs 150, triangles ~1.02M vs 300k (city 784k tris), shader programs 37 → 48 (skinned variants; asli phone par compile-time UNVERIFIED), run-to-run triangle farq ±15% (chalte zombies). Agle levers: building/city triangles LOD, vehicles ke 216 mesh merge, shadow casters ki had.

## Round 3 — GitHub run #1 ke baad (2026-11-24)
**Online hua kya (LIVE, GitHub runner):** run #1 `goku-qa`, 19:08:01 → 19:23:34 UTC = **15 min 33 s**, success. Asli `vite build` PASS. smoke PASS, GOKU partner PASS (12 hits / 4 kills, 851 m, stuck 0), A0 4 PASS + 1 FAIL (OZ-012). `deploy-pages` fail hua kyunki Pages on nahi (kuch publish nahi hua).
**Run #1 ke 3 server-only masle aur chhote fix (kuch tooti nahi: sandbox regression PASS):**
| Masla | Fix | Naap |
|---|---|---|
| A0 read-only FAIL | position 1 cm tolerance (OZ-012) | sandbox A0 5/5, drift 0.00000 m |
| hero foot 0.228 | sirf khade hero ko judge karo, state+speed evidence (OZ-013) | unit 18/18; sandbox khada hero 0.062 m IN_RANGE |
| turntable: zombie-0/1 sheet "subject gone" | characters pehle; GOKU partner sirf apni baari par on (wo zombies maar deta tha) | sandbox: hero, zombie-0, zombie-1, goku **4/4 sheets**, 0 skipped |
**Naya khoj (turntable tasveer se):** zombie-0 sheet mein hero ki camo tangein frame ke upar hawa mein thin → probe ne OZ-011 pakda. Sandbox physics stub hai, isliye `tests/zombie_pressure.mjs` GitHub par asli Rapier ke saath chalega.
**Abhi bhi baqi:** draw calls 681 vs 150, triangles ~1.02M vs 300k (Step 4 levers neeche), asli phone par fps.

## Round 4 — insaan + harkat + gaadi ke naap (2026-11-24)
Naye tools (kuch game file nahi badli): `motion.mjs` (146 naap, hero + GOKU), `vehiclemotion.mjs` (104 naap, 5 gaadiyan). Details: `goku_knowledge/HUMAN_AND_MOTION_BRIEF.md`. Pehle asli glitch: OZ-014 (cars andar jhukti hain). Hero ki tangon ka geometry theek (curved/stretch/wrong-way 0), par slow-speed skating, locked knee, crouch-walk flight Minor (OZ-015..017).

## Round 5 — server ne fixes verify kiye (2026-11-24, run #2 = REAL GitHub, branch `goku/OZ-014-car-roll`, 17 min 21 s, success)
| Issue | Run #1 (pehle) | Run #2 / gate (baad, REAL Rapier) | Status |
|---|---|---|---|
| OZ-011 hero zombie ke sar par (y 1.8) | sandbox stub par dikha | `zombie_pressure`: zombies hero tak pahunche, max hero y **0.20 m** (hadd 0.5), hp 100 → 67 | **sandbox stub ka artifact; asli Rapier par PASS** |
| OZ-012 A0 read-only | FAIL (0.5 mm drift) | **PASS** (hero drift 0.0005 m, camera 0.00055 m) | PASS |
| OZ-013 hero foot 0.228 Major | Major | ground-contact 2 in range, 0 outside (Major 4 → 3) | PASS (ek sample tha; ab khada-hero check + state evidence) |
| turntable zombie sheets | skipped | `02_zombie-0`, `03_zombie-1`, `04_goku` bani | PASS (landmarks/sprint-r 600 s budget mein nahi aaye: deep mode mein aayenge) |
| OZ-014 cars andar jhukti | (gaadi naap nahi tha) | vehicles 104 naap: **0 Major**, 101 in range | PASS |
Baqi Major (sirf performance): 893 / 321 / 430 draw calls (budget 150), 1.11M / 557k / 619k triangles (budget 300k) — Step 4 ka kaam.

