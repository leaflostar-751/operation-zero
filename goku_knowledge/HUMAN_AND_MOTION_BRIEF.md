# GOKU — Insaan, harkat (motion) aur gaadi: graphics detail + glitch-free instructions (2026-11-24)

> Owner ka hukm: *"Player ko human ki tarah redesign karo: haddi (skeleton), maas-pesiyan (muscles), nerves system, poora jism. Daudte waqt tangen curved na hon. Gaadi mein har taraf bhagne par glitch na ho. Ultra realistic detail."*
> Ye file GOKU ke liye **kaam ka tareeqa + naap ke number** hai. Sab status words: PASS / PARTIAL / FAIL / BLOCKED / UNVERIFIED / NOT_IMPLEMENTED / NOT_POSSIBLE. Label: LIVE / SIMULATED / STATIC / ESTIMATE.

## 0. Sach pehle (GOKU ye hamesha yaad rakhe)
1. GOKU **dekh sakta, naap sakta, flag kar sakta, brief likh sakta** hai. Game ka code **khud nahi badal sakta** (NOT_IMPLEMENTED). "Khudi design" ka matlab abhi: GOKU **design brief + number likhta hai** (neeche section 6), Claude branch `goku/<id>` par implement karta hai, GOKU **wahi test dobara chala kar** tay karta hai ke badlaav rakhna hai ya wapas.
2. **"Ultra realistic" ka dawa nahi.** Abhi body ellipsoids/tubes se bani hai (procedural). Mobile budget ~300k triangles poore scene ka hai. Photo-real chehra/skin/muscle ke liye asli models (GLB, licence ke saath) + Blender chahiye = **owner ki ijazat** (BLOCKED in sandbox). Jo abhi ho sakta hai: **sahi anatomy ki proportions, haddi-muscle-skin ki layers, saaf harkat, zero glitch** (free, mobile-safe).
3. "Behtar hua" tabhi jab **same test, same camera, pehle/baad number behtar** aur kuch toota nahi (`GOKU_PERMISSIONS.md` ke 5 rules).

## 1. Insaan = ek poora system (5 layers). Har layer ka apna check
| Layer | Insaan mein | Game mein kahan | GOKU kaise jaanche | Abhi |
|---|---|---|---|---|
| 1. Haddi (skeleton) | ~22 bones: Hips, Spine, Neck, Head, Arm/ForeArm/Hand, UpLeg/Leg/Foot/Toe | `CharacterBuilder.js` (bones), `references.json` `human` | lambai/ratio (`reference.mjs`): height, leg 0.47, arm, shoulder, L/R asymmetry | PASS (hero/goku in range) |
| 2. Maas-pesiyan (muscles) | har haddi par volume: deltoid (kandha), pectoral (seena), biceps/triceps, latissimus (peeth), abdominals, gluteus, **quadriceps (aage ranan), hamstring (peechay), gastrocnemius (pindli)** | `ell()` / `tube()` parts | width-profile naap (haddi ke 25/50/75 % par chorai) — **NOT_IMPLEMENTED (agla tool)** | UNVERIFIED |
| 3. Skin / surface | muscles ke upar ek chikni sath, jodon par smooth | rigid skinning (har vertex 100 % ek bone) | jodon par gap/crease: close-up tasveer (turntable) | PARTIAL (gap risk) |
| 4. Nerves = control system | dimaagh→nerve→muscle = input→state machine→clip→IK | `AnimationController.js` → `FootIKSolver.js`/`TwoBoneIK.js` → weapon-hold IK | `motion.mjs` (neeche) | PARTIAL |
| 5. Kapde/gear | kapda jism ke upar, andar nahi ghusta | offset shells, vest, helmet | penetration (abhi naap nahi) | NOT_IMPLEMENTED |

### Muscle map (GOKU ke redesign brief ke liye — kahan kitna volume)
- **Gardan/kandha:** sternocleidomastoid (gardan ke dono taraf), trapezius (gardan→kandha ki dhalaan), deltoid (kandhe ka gol hissa).
- **Dhad:** pectoral (seena, aage), latissimus (peeth, V-shape), abdominals/obliques (pait), erector (kamar).
- **Bazu:** biceps (aage), triceps (peechay), forearm (kuhni ke paas mota, kalai par patla).
- **Kulha/ranan:** gluteus (kulha), quadriceps (ranan ke aage, upar se mota → ghutne par patla), hamstring (peechay), adductor (andar).
- **Pindli:** gastrocnemius (pindli ka ubhaar **upar ke 1/3 hissay mein**), Achilles (takhne ke paas patla), takhna 0.07 m.
- **Rule:** limb **taper** hota hai (ranan mota → ghutna patla → pindli ubhaar → takhna patla); sab hissay jodon par **overlap** karen; L/R symmetric (±2 %). Constant-chorai wali "naali" = FAIL (abhi trousers naali jaisi dikhti hain, UNVERIFIED by number, tasveer se aisa lagta hai).

## 2. "Daudte waqt tangen curved / theek nahi" — glitch list + naap (LIVE, `tools/oz-explorer/motion.mjs`)
Tool game ke **apne clips** frame-by-frame chalata hai (hero aur GOKU, walk/run/sprint/crouch-walk + clips ke beech blend). Threshold = typical insaan (textbook, **ESTIMATE**, ek khaas insaan nahi).
| Glitch | Dikhta kaisa | Naap | Hadd | Pehla naap (SIMULATED GL, clip only) |
|---|---|---|---|---|
| Ghutna ulti taraf | tang "<" ki jagah ">" | knee wrong-way (deg) | ≤ 3° | 0° PASS |
| Tang kheench/sikud | haddi ki lambai badalti | leg bone length change | ≤ 3 % | 0 % PASS |
| **Curved / bow-legged / knock-knee** | ghutna hip-takhna line se bahar | knee sideways off line (m) | ≤ 0.07 m | 0.000 m PASS |
| **Ghutna lock (stick-leg)** | tang bilkul seedhi lakdi | hip-ankle / leg length | < 0.995 | **0.999 = Minor (walk/run/sprint sab mein)** |
| **Foot skating (barf par phisalna)** | zameen par paon ghisat'e hain | stance foot speed vs ground speed | ≤ 20 % at clip speed; ≤ 60 % edge | clip speed par 0.1–0.3 % PASS; **slow walk (0.2 m/s) par paon zameen se ~4× tez ghisat'e hain (residual 3.0) = Minor**; crouch-walk 0.25 m/s par ~2.7× tez (residual 1.7) |
| Paon hawa mein (dono) | daudte/chalte waqt tairna | both feet air share | walk ≈ 0, run ≤ 0.4 | run 0.23 PASS; **crouch-walk 0.105 (hona 0 chahiye) = Minor** |
| Pop / snap (blend par jhatka) | state badalte hi ek joint jhatke se mud jaye | max joint turn in ONE 1/60 s frame | ≤ 30° | max 21.6° (run→sprint) PASS |
| Cadence (qadam/min) | bahut tez/slow qadam | steps per min | walk 90–135, run 140–195, sprint 165–235 | 126 / 167 / 214 PASS |
| Pelvis bob, trunk lean | robot jaisa seedha ya zyada jhoomna | m / deg | walk 2–8 cm, run 4–13 cm; lean run 2–20° | 5.5 / 6.9 / 7.7 cm; lean 2.6 / 7.7 / 12.3° PASS |
| L/R phase | dono tang saath chalen | phase | 0.42–0.58 | 0.49 / 0.47 / 0.50 PASS |

**Asli tasveer (side view, hero, walk/run/sprint):** upar ka body aage jhuka, rifle dono haath mein, daudte waqt peechay wali tang poori seedhi (lakdi), aage wali ghutne se mudi; ghutna "kinked" dikhta hai kyunke jodon par rigid-skin ka sakht kona hai. Ye **tasveer se** hai, number se nahi → UNVERIFIED (look = Step 1).

**Jo ab tak naap NAHI hota (honest):** foot IK ka asar (asli hero ko chalane wala input chahiye), bazu/weapon-hold (weapon IK clips ko override karta hai), muscle taper, joint gap, kapde ka clipping, chehra. → `references.json` `notMeasurableYet`.

### Fix ke liye pehle se pakde hue candidate (Claude implement karega, GOKU verify)
- **OZ-015 foot skating slow speed:** `AnimationController.update()` mein playback `clamp(speed/ref, 0.55, 1.75)`; 0.55 se neeche paon zameen se tez chalte hain. Idea: neeche idle se blend ya clamp 0.3 + walk threshold. Test: `motion.mjs` `foot skating at the slowest speed` ≤ 0.6.
- **OZ-016 locked knee:** synthesized clips mein ghutna 0° tak seedha; soft-knee: stance mein ≥ 4–6° flex. Test: `hip-ankle/leg length` < 0.995 **aur** `foot skating` PASS rahe (aage ki tang chhoti hui to skating badh sakti hai).
- **OZ-017 crouch-walk flight 10 %:** clip ka stance/duty theek karo. Test: `both feet in the air` ≤ 0.02.
- **OZ-018 joint gaps (rigid skinning):** jodon par 2-bone blend weights. Test: close-up tasveer + triangles/draw calls na badhen.

## 3. Gaadi — "har taraf bhaagne par glitch" (LIVE, `tools/oz-explorer/vehiclemotion.mjs`)
Game ke apne `drive()` + `updateFrame()` ko 60 Hz loop mein chalata hai (khuli jagah, collisions band, baad mein sab restore): **aage, brake, reverse, left turn, right turn, handbrake**. Har gaadi (4 cars + 1 bike).
| Maneuver | Kya hona chahiye | Naap | Hadd |
|---|---|---|---|
| Seedha | seedhi jaye, pahiye aage ki taraf ghoomen, zameen par rahen | straight drift, wheel spin sign, rolling ratio, hub-height error | ≤ 5 cm, sign=1, 0.9–1.1, ≤ 5 cm |
| Brake | nose neeche, speed sirf ghate, 1.6 g se zyada nahi | nose-down deg, speed rise, decel g | ≤ 6°, ≤ 0.01 m/s, ≤ 1.6 g |
| Reverse | pahiye ulte ghoomen, steer sahi taraf | spin sign rev | = 1 |
| Left/Right | gaadi us taraf mude, aage ke pahiye us taraf, **inner pahiya zyada mude (Ackermann)**, body **bahar ki taraf jhuke (car)** / **andar (bike)**, L/R barabar | yaw sign, front-wheel sign, Ackermann, body roll outward | car roll 0–7° outward; bike 3–50° inward |
| Handbrake | peechay se phisle, bounded | slip angle, yaw rate | 5–90° |
| Hamesha | NaN nahi, ek frame mein speed jhatka nahi | NaN, speed step/frame | 0, ≤ 0.5 m/s |

**Pehla LIVE naap (SIMULATED GL; dynamics GPU par nirbhar nahi):**
- **Car body ULTI taraf jhukti hai (OZ-014, Major):** Apex GT −1.4°, Stallion −1.8°, Ranger −2.4°, Vortex −1.2° — **4 mein se 4 car** mode ke andar (leans INTO the turn, bike jaisa). Asli car bahar ki taraf jhukti hai. STATIC wajah: `VehicleSystem.updateFrame()` mein `targetRoll = clamp(-latG * bodyRoll * 0.05 …)` — gaadi ka +X **left** hai, left turn par `latG > 0` → roll negative → left (andar wali) side neeche. Bike sahi (andar jhukti hai) PASS.
- Baqi sab PASS: pahiye sahi taraf (forward/reverse), rolling ratio 1.0, steer sign, Ackermann, hub height 0 (pahiye zameen par), straight drift 0.
- Minor: Vortex steer lock 23.9° (<25), Sprint-R bike 7.9° (<8), strongest braking 1.4–1.8 g (arcade-ish).
- **Ye abhi nahi dekha:** crash, ramp/slope/curb (gaadi ka `y` hamesha 0 — zameen par uthti nahi), per-wheel suspension, driver ka pose, camera clipping, enter/exit.

## 4. Graphics detail ki seedhi (ultra-realistic ka sach)
| Level | Kya | Kaun kar sakta | Mobile cost | Status |
|---|---|---|---|---|
| L0 | ellipsoid/tube body (abhi) | — | 68 main draw calls (characters) | PASS (kaam karta hai) |
| L1 | sahi anatomy proportions + muscle volumes + taper (procedural) | Claude (free) | triangles thore badhen, LOD se control | NOT_IMPLEMENTED |
| L2 | jodon par 2-bone skin blend, normal/detail procedural maps, kapde ki shells | Claude (free) | chhota | NOT_IMPLEMENTED |
| L3 | asli modelled characters/cars (GLB, licence record) | owner assets / Blender (ijazat) | tris budget ke andar | BLOCKED (assets nahi) |
| L4 | photo-real chehra/skin shader | desktop only | bhaari | NOT_POSSIBLE on weak mobile |
Budget (ESTIMATE): hero ≤ ~15k tris, NPC ≤ ~6k, har insaan ≤ ~5 draw calls; poora scene 150 calls/300k tris (abhi 681/1.02M, FAIL).
"Realistic" ka dawa sirf tab jab owner ki di hui **tasveer ke saath side-by-side** ho (abhi NOT_DONE).

## 5. GOKU ka kaam-chakra (har issue ke liye)
1. **Inspect:** `turntable.mjs` (har taraf se), close-ups (ghutna, kandha, kuhni), motion tasveer (side view).
2. **Measure:** `motion.mjs`, `vehiclemotion.mjs`, `reference.mjs`, `goku_qa.mjs`, `drawcalls.mjs`. Number LIVE/SIMULATED likho.
3. **Flag:** issue ID (OZ-0xx), severity, evidence (tasveer + number), root cause (file+line), fix idea, test, kitna cost.
4. **Brief:** "kya banana hai" (reference sheet: front/side, muscle map, bones, joint limits, budget) — bina brief ke implement nahi.
5. **Claude implement** branch `goku/<id>` par, **ek badlaav, chhota**.
6. **GOKU dobara naape** (same camera/test): behtar + kuch toota nahi → rakho; warna revert.
7. `improvement.mjs add` (cumulative), PR; merge owner karta hai.

### Joint limits (insaan, textbook ESTIMATE) — GOKU in se bahar jaaye to flag
ghutna 0–140° sirf peechay mudta; kuhni 0–145° sirf aage; kulha flexion −20..120°; takhna −20..50°; gardan ±70° ghumna; kamar twist ±45°. "Hyper-extension" > 5° = FAIL.

## 6. Commands (owner/GOKU)
```
node tools/oz-explorer/motion.mjs http://localhost:4173/ --out reports/latest/motion
node tools/oz-explorer/vehiclemotion.mjs http://localhost:4173/ --out reports/latest/vehicles
node tools/oz-explorer/motion.test.mjs && node tools/oz-explorer/vehiclemotion.test.mjs
```
GitHub par ye dono har `goku-qa` run mein khud chalte hain (reports branch: `latest/motion/MOTION.md`, `latest/vehicles/VEHICLES.md`).
