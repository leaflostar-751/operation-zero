# GOKU <-> OPERATION ZERO: how they connect

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
