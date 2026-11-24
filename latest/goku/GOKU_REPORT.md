# GOKU report — 2026-11-24T07:33:14.740Z (day 2026-11-24, trigger: workflow_dispatch)

GOKU tool status: **PASS**. This is the in-game GOKU partner (JavaScript). The Windows GOKU agent is not part of server runs.

## This run
- Fought zombies: 12 hits, 4 kills in 30 simulated s.
- Explored alone: 838 m in 200 simulated s; inside-solid samples 0; bad positions 0; stuck events 0; gave-up paths 1; path plans 12.
- Exact audits on 1030 trees; console errors 0; screenshots looked at: 4.

## Self-test (faults planted on purpose in memory, never saved)
- PASS — planted floating tree (+1.5 m) is detected by the audit (gap 1.54 m at -798.62,48.3)
- PASS — planted hole in the ground is noted by GOKU as no_ground ({"x":40.4,"z":40.4,"confidence":"EXACT"})
- PASS — planted empty world (all objects hidden) is flagged by the visual check (flags [too_dark,flat_or_empty,low_detail,low_contrast] entropy 0.27, edges 0.03, contrast 1 (healthy spawn view had 0 flags, edges 0.166))
- PASS — planted 2.6 m tall hero is flagged by the reference check (height 2.761 m)
- PASS — planted 0.9 m wheel radius is flagged by the reference check (wheelRadius 0.9 m)
- PASS — planted knee bent both ways: exactly one direction is called wrong-way (+1.0 rad: flex 62 deg, off 0.19 m, wrong=false; -1.0 rad: flex 53 deg, off -0.16 m, wrong=true)

## Trend (last 2 runs, newest first) — this is how you see GOKU getting better or worse
| Day | Trigger | Kills | Metres | Stuck | Gave up | Self-test | Pics flagged | Outside real-world range | Bugs (major) |
|---|---|---|---|---|---|---|---|---|---|
| 2026-11-24 | workflow_dispatch | 4 | 838 | 0 | 1 | 6/6 | 0/4 | 8 | 12 (3) |
| 2026-11-24 | workflow_dispatch | 4 | 836 | 0 | 1 | 6/6 | 0/4 | 9 | 13 (4) |

## Daily runs (last 1 days with a run)
11-24

GOKU does not change its own code (NOT_IMPLEMENTED). Any change to the game or to GOKU is made by a person after reading these reports.
