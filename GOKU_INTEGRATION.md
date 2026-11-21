# GOKU <-> OPERATION ZERO: how they connect

## STATUS (checked 2026-11-19) — two different GOKUs
| Question | In-game GOKU partner (browser, in this repo) | Real GOKU (Windows Python agent, GOKU_StageF24b.zip) |
|---|---|---|
| Plays the game? | PASS (SIMULATED): follows, fights zombies (12 hits / 4 kills), explores 700-800 m by itself, A* paths | NOT_IMPLEMENTED: only a 2D screen game loop (Angry-Birds profile); no OPERATION ZERO profile, 3D game is not understood |
| Finds bugs? | PASS (SIMULATED): notes stuck / inside-solid / no-ground / out-of-world with exact x,y,z; self-test finds 2 planted faults | not for this game (screen vision cannot measure 3D positions); it can use the exact data from the debug door once wired |
| Bug management (ledger)? | PASS: `reports/ledger.json` + `LEDGER.md` (open / not_seen_latest; "fixed" is set only by a person) | has its own ledgers for its own bugs, not for this game |
| Report? | PASS: `tools/oz-explorer/goku_qa.mjs` -> `reports/latest/game/REPORT.md` + `reports/latest/goku/GOKU_REPORT.md` (replaced every run; see DAILY_SERVER_PLAN.md) | NOT_IMPLEMENTED for this game |
| GitHub attached? | NOT_ATTACHED: no repo yet, no GitHub account linked to Claude, token invalid | no git/GitHub tool in its firewall (`tools/cli_executor.py` only parses ping/ipconfig/netstat); can only open github.com in a browser |
| Runs on online servers? | READY, UNVERIFIED: `.github/workflows/goku-qa.yml` (GitHub Actions, laptop OFF) | NOT_POSSIBLE on Linux servers (Win32/UIA/GDI). Needs a Windows machine; GITHUB-hosted windows runners have no stable desktop session |
| Updates its own improvement on GitHub? | it writes ONLY reports to the `reports` branch (`scripts/publish_reports.sh`, refuses main/master). Code changes stay a human decision | `memory/` and learning data are never touched by upgrades (your policy); backing them up to a PRIVATE repo is a separate step |

## Online GOKU QA (your laptop/PC can stay off)
1. Put this folder in a GitHub repo (see DEPLOY.md).
2. Actions tab -> `goku-qa` -> Run workflow. It builds the game, GOKU plays/audits it, and pushes `REPORT.md`, `report.json`, `ledger.json`, `LEDGER.md` to branch `reports`.
3. Read `latest/game/REPORT.md` and `latest/goku/GOKU_REPORT.md` on the `reports` branch (or on the run page: both are printed in the run summary). They are REPLACED each run; older versions stay in git history.
4. It also runs by itself every evening if the day had no run (laptop may be off): see DAILY_SERVER_PLAN.md.
4. Nothing is written to `main`. For a hard guarantee also protect `main` (Settings -> Branches).
Local run: `node tools/oz-explorer/goku_qa.mjs http://localhost:5173/ --selftest`

Honest status: the game side is built and tested here (SIMULATED). Hosting, GitHub and the GOKU side are NOT done from this sandbox (no network); the steps below are what you run on your PC.

## What exists in the game repo
| Piece | File | Status |
|---|---|---|
| Debug door (read-only) | `src/debug/OzDebug.js`, enabled by `?oz_debug=1` | built, test `tests/a0_debug.mjs` |
| Boot smoke test | `tests/smoke.mjs` | built |
| Explorer (exact checks) | `tools/oz-explorer/explore.mjs` | built, one report folder per run |
| Reports | `reports/run-<time>/report.json` | format below |

## Report format (what GOKU reads)
`findings[]`: id, type, position, evidence, confidence (EXACT | MODEL_OPINION), severity, suggested_fix. `coverage[]`: visited cells + perf per cell.

## Connection plan (same as your Master Prompt)
1. Game repo `operation-zero` on GitHub: branches `main`, `fix-<id>`, `reports`. Stages = tags.
2. Static host for the built game (`npm run build`, upload `dist/`): itch.io / Netlify / GitHub Pages. Check size limits first.
3. Online GOKU (laptop OFF): a Linux VM runs `node tools/oz-explorer/explore.mjs <live-url>` on a schedule, commits `reports/run-*` to branch `reports` with a READ-ONLY-to-main token. It never edits code.
4. Laptop GOKU: `git pull`, reads the newest report, for each finding: reproduce, fix on `fix-<id>`, rerun explorer on the same cell, show you diff + before/after. You approve the merge.
5. GOKU (Windows agent) calls the explorer as a tool through its existing browser/shell tools. No change to GOKU's code is needed for the first connection: it only has to run the command above and read `report.json`.

## What I did NOT touch
The GOKU zip was only read. Nothing in it was modified or executed.

## What you must provide (never paste tokens in chat)
GitHub repo link for the game, and a fine-grained read-only token created by you and stored only on the VM.
