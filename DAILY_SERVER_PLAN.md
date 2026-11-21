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
