# GOKU inspection round 1 — sab cheezon ke gird ghoom kar dekha (2026-11-21)

**Kaise:** `tools/oz-explorer/turntable.mjs` ne camera ko har cheez ke gird 4 angle (0/90/180/270) + upar se ghumaya; sheets `inspection-round-1/*.jpg`. Rendering = software GL (SIMULATED, ~1 fps), physics = stub (SIMULATED). Nambar jo likhe hain wo game se LIVE naape gaye; "dikhta hai" wali baatein meri aankh ki hain (subjective).

## Naap kar pakda gaya (MEASURED)
| # | Cheez | Nateeja | Status |
|---|---|---|---|
| 1 | Hero / GOKU / zombies ke feet | sabse neecha paon zameen se 0.04–0.14 m upar (ankle bone ki normal height) — **hawa mein nahi**, zameen mein nahi | PASS (ab permanent check: `ground-contact` rows) |
| 2 | Ranger 4x4 ki unchai | 2.07 m, typical off-road SUV range se bahar (height aur height/length) | PARTIAL — Minor; roof rack/lights shamil ho sakte hain, asli model ka naam chahiye |
| 3 | Landmarks ki manzil-unchai (6) | 5.0–8.9 m/manzil "APPROX" | UNVERIFIED — andaza hai (chhat/tower shamil), bug nahi |
| 4 | Insaan 18/18, joints 40/40, imaraton 12/12 (houses) | range ke andar | PASS |

## Aankh se dekha (subjective, sheets mein dekho)
| # | Cheez | Kya dikha | Kis Step ka kaam |
|---|---|---|---|
| A | Gaadiyan (apex-gt, stallion) | jism naram/"takiye jaisa", panel lines/darwaza seam nahi | Step 2 (250+ parametric cars) |
| B | Spawn ke paas gehri neeli/grey bari slabs | **M0 test course** (range backstop wall 16x4 m, stairs/ramp boxes — `World.js`); movement tests ke liye jaan-boojh kar hain, bug nahi, lekin placeholder dikhti hain | Step 3 (spawn area replace) — tests ki wajah se abhi hataya nahi |
| C | Zameen | flat, texture repeat | Step 3 |
| D | Meridien hotel | tower theek, khidkiyan "quilted/pyramid" style, sign sirf ek taraf | Step 3 (look) |
| E | VU university | lawn+trees+clock tower achhe | — |
| F | Zombie | sab ek jaisi pose (bazu aage), feet zameen par | Step 1 (characters) |
| G | Stallion 0° view | camera paas wali SUV ke andar — turntable ka artefact, game bug nahi | — |

## Sabse bara asli masla (Step 4, abhi bhi FAIL)
Mobile budget ~150 draw calls / 300k triangles; spawn par ~966 calls, 1.18M tris, explorer cells 596–1766 calls. Levers: shadow-pass cap, building LOD, kam draw calls, character LOD. (Step 4 khatam hone se pehle Step 3/2/1 shuru nahi.)

## Is round mein kya theek kiya
Game ka code **nahi badla** (koi saaf chhota bug nahi mila jo bina Step 2/3/1 ke theek ho). Naya: turntable tool, ground-contact check, online workflow step. GOKU khud code nahi badal sakta (NOT_IMPLEMENTED).
