# Roz ka server plan — laptop ON ho ya OFF (honest status)

## Kaun si cheez kahan chalti hai
| Kaam | Kahan chalta hai | Laptop chahiye? | Status |
|---|---|---|---|
| Roz ka GOKU QA (GOKU khelta hai, audits, screenshots, report) | GitHub ka server (Actions) | **Nahi** | PASS locally (SIMULATED); GitHub par pehli run UNVERIFIED |
| Game khud kholna (browser mein) | Aap ka laptop/phone | Haan (processing wahin hoti hai) | PASS |
| Game ki processing server par (Cloud Play) | GPU server (paid ya free-ghante relay) | Sirf screen | prototype PASS; deployment BLOCKED (account/GPU nahi) |
| Asli (Windows) GOKU | Aap ka Windows laptop | Haan | server par NOT_POSSIBLE (Windows/2D agent) |

## 24 ghante ke cases
| Case | Kya hota hai |
|---|---|
| Laptop 24 ghante OFF | Shaam 19:17 PKT par `guard` dekhta hai: aaj ki run hai? Nahi -> QA chalti hai. 21:47 par dobara guard (agar pehla slot late/dropped ho). Report `reports` branch par. Laptop ki zarurat nahi. |
| Laptop 6-7 ghante ON | Server ka QA laptop par depend nahi karta. Laptop sirf reports dekhne ki screen hai. Game laptop par kholein to us waqt processing laptop par hoti hai. |
| Aap ne din mein khud run chalayi (GitHub app se bhi ho sakti hai) | `meta.json` mein aaj ki tareekh likhi jati hai -> shaam ka guard SKIP karta hai (double run nahi). |
| Din mein ek bar bhi on nahi hue | Shaam ka guard server par run chala deta hai = "last hours" wali shart. |
| GitHub ne schedule delay/drop kiya | 2 slots hain; phir bhi guarantee NAHI (GitHub load par drop kar sakta hai). Aap manual "Run workflow" kar sakte hain. |

Din = Pakistan time (UTC+5). Guard ka test: `node scripts/daily_guard.test.mjs` (10/10 PASS, fake clock).

## Reports kahan aur kaise replace hoti hain
Branch `reports` (sirf yahi branch likhi jati hai):
```
latest/game/   REPORT.md, report.json, shots/*.jpg (GOKU ne jo screenshots dekhe)   <- har run par REPLACE
latest/goku/   GOKU_REPORT.md, goku.json, trend.json (pichle 30 runs ka hisaab)    <- har run par REPLACE
ledger.json, LEDGER.md   bug list (jagah par update hoti hai, duplicate nahi)
meta.json                aakhri run ka din + calendar (guard isi se faisla karta hai)
```
Naam "improve game 1 -> 2" ki tarah: file ka naam wahi rehta hai, andar ka naya hota hai. Purana version git history mein rehta hai (wapas ja sakte hain). `node`/`bash scripts/publish_reports.test.sh` = 8/8 PASS.

## GOKU ko "dikhna" (code ke bajaye real picture)
- GOKU ab har run mein 4 jagah ke asli screenshots leta hai (3 aerial + 1 player-view) aur pixel ginta hai: bohot andhera/roshan, khali/flat, kam detail, kam contrast, aur pichli run se kitna badla. Yeh **heuristic** flags hain ("is picture ko dekho"), bug ka faisla nahi.
- Self-test: sab kuch chhupa do (khali duniya) -> check ne 4 flags diye (entropy 0.27, edges 0.031); healthy view par 0 flags.
- Art-quality (chehra, kapde, pose) pixel ginti se nahi pata chalta: uske liye screenshots kisi insaan/Claude ko dekhne honge. AI vision model API se roz automatic dekhna = paid + key chahiye, NOT_IMPLEMENTED.

## GitHub login / sign-up ka popup — kyun nahi
- Roz ka QA ko login ki zarurat nahi: workflow ka apna `GITHUB_TOKEN` hota hai (har run ke liye naya, sirf is repo ke liye).
- Players se "Sign in with GitHub" maangna ghalat hai: zyada players ke paas GitHub nahi, aur token se unke repos ka access khatre mein aata hai. Game/GOKU ko player ke GitHub se kuch post nahi karna chahiye.
- Safe tareeqa (NOT_IMPLEMENTED, aap haan kahein to bana dunga): game mein "Problem report karo" button jo GitHub ka prefilled issue page kholta hai (device, fps, error saath). Login GitHub khud maangta hai, game ke paas koi token nahi.
- GOKU apna code khud badalna = NOT_IMPLEMENTED aur main par push kabhi nahi; agar banega to sirf Pull Request, aap approve karenge.

## Laptop par crash/lag aaye to
"Server par khelo" popup (game ka device-check: bar bar crash ya kam fps par pehle hi popup) = NOT_IMPLEMENTED. Server mode ke liye GPU server chahiye (free relay ke ghante: `cloud/relay.mjs plan`).

## Improvement files: "improvement 10" mein 1 se 10 sab (aur purani file replace)
- Do alag list: `improvements/game/improve-game-<N>.md` aur `improvements/goku/goku-<N>.md`. Folder mein hamesha **sirf ek** file hoti hai.
- `improve-game-10.md` mein improvement 1..10 sab likhe hote hain (naya sab se upar). Nayi improvement aati hai to `improve-game-11.md` banti hai (1..11) aur 10 wali file **hat jati hai**. Purani entries ek-ek byte same copy hoti hain, kabhi dobara nahi likhi jatin.
- Tool: `node scripts/improvement.mjs add game "<title>" --status PASS --changed "files" --evidence "..." --commit abc` / `list game` / `check`. Test: `node scripts/improvement.test.mjs` (11/11 PASS).
- Abhi tak ka kaam git history se back-fill hua: game 1..9, GOKU 1..6. (Git se pehle ka kaam, jaise Gemini ke Stage 0-3, in mein nahi hai.)
- GOKU apni improvement khud nahi likhta/badalta (NOT_IMPLEMENTED): har improvement ek insaan/Claude reports padh kar karta hai aur yahan darj karta hai.

## GitHub par purani files na rahein (replace mode)
- Workflow ab `reports` branch ko **sirf ek commit** bana deta hai (`REPORTS_HISTORY=replace`): pichli files branch se hat jati hain.
- Is se pehle `verify_cumulative.mjs` check karta hai ke kuch gum na ho: improvement 1..N, bug ledger, GOKU trend, calendar. Kuch kam mila to **REFUSED (exit 3), kuch push nahi hota** (test: `bash scripts/publish_reports.test.sh`, 13/13 PASS).
- Sach: GitHub purane commit ko unke exact SHA se kuch der tak dikha sakta hai (secure delete nahi); yahan koi secret nahi rakha jata. Purani history chahiye ho to workflow mein `REPORTS_HISTORY: keep` kar dein.
- Improvement files main repo mein rehti hain (aap zip se upload karte hain); workflow unhein `reports` branch par bhi mirror karta hai. Agar aap purani zip upload kar dein (number peeche chala jaye) to publish refuse ho jata hai.


## GOKU "ghoomna" (turntable) — har cheez ke gird 360° (naya)
- Tool: `tools/oz-explorer/turntable.mjs` — gaadiyon, hero, GOKU, zombie aur landmarks ke gird camera ghuma kar har taraf ki tasveer + ek contact sheet banata hai (`NN_<subject>.jpg`, `manifest.json`, `TURNTABLE.md`).
- Online: `goku-qa.yml` mein QA ke baad ek extra step (`continue-on-error`, 15 min cap, `--maxSeconds 600`) -> `reports/latest/turntable/` (har run mein replace). **UNVERIFIED** — GitHub par abhi tak ek bhi run nahi hua; time budget ka local test PASS (NOT_DONE likhta hai, chhupata nahi).
- GOKU sirf *dekhta aur flag* karta hai; code khud theek nahi karta (NOT_IMPLEMENTED). Fix insaan/Claude karta hai (ya future mein Pull Request).
- Pehla haath se kiya hua round: `GOKU_INSPECTION_ROUND_1.md` + `inspection-round-1/*.jpg`.

## Audit blueprint + draw-call tool (2026-11-21)
- `GOKU_AUDIT_BLUEPRINT.md` — phases 1-8 asli numbers ke saath (AUDIT ONLY), issue register OZ-001..010.
- `goku_knowledge/AUDIT_MASTER_PROMPT.md` — aapka pasted prompt, project ke rules ke mutabiq theek kiya hua (audit mode vs implement mode alag).
- `tools/oz-explorer/drawcalls.mjs` — draw calls/triangles/materials ka scene-tree breakdown (LIVE), performance fix ke before/after ke liye.

## GOKU ko "online" kaise rakhein — asli kaam, khali ghante nahi (2026-11-24)
Sach: khali baithe 24 ghante "online" hona jhoota number hai. Jo ginta hai: **server par GOKU ne kitna asli kaam kiya** aur **kitne fix verify hue**. Isliye 3 tarah ki runs hain (sab free, public repo; GOKU sirf `reports` branch mein likhta hai, `main` ko nahi):
| Kind | Kab | Kya karta hai | Kitna (ESTIMATE) |
|---|---|---|---|
| **daily** | shaam 19:17 PKT (21:47 retry); guard: din mein pehle se run ho chuki to SKIP | build, khelna, performance, reference, 360° tasveerein, game tests, motion + gaadi naap | ~20 min |
| **deep** (naya) | roz raat **03:07 PKT** (aur manual `mode=deep`) | har car/insaan/landmark 8 angles se, 5 performance cells, 600 s khelna, motion + gaadi, zombie pressure | ~60–120 min |
| **gate** (naya) | **har Pull Request** par (khud, bina poochay) | build + saare unit/game tests + motion + gaadi; numbers PR par comment | ~10 min |
Deep run us PKT din ki "complete run" bhi ginti hai, isliye shaam ka daily guard us din SKIP karega (double kaam nahi).
**Scoreboard:** `reports` branch par `ONLINE.md` / `online.json` — total server minutes, runs (daily/deep/gate), din-ba-din. "Fixes GOKU ne khud likhe" = **0** (NOT_IMPLEMENTED); fix Claude likhta hai, GOKU same test se verify karta hai.
**Kya abhi NAHI hota:** khud fix likhna (iske liye LLM chahiye: paid API key ya free-tier model — **owner ki ijazat + UNVERIFIED**), main mein merge (owner), asli GPU/phone fps.
**Schedule sirf `main` se chalta hai**, isliye deep/daily ka naya schedule tab shuru hoga jab ye PR `main` mein merge ho.
