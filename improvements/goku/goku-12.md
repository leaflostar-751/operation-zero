# Goku 12 — improvements 1 to 12 (cumulative)

This file replaces "Goku 11". Everything done so far is listed here, newest first. Older entries are copied unchanged.

## Improvement 12 — Online work, not idle hours: deep night audit (mode=deep, 03:07 PKT), PR gate (comments numbers on every pull request), online minutes scoreboard
- Date: 2026-11-24
- Status: PARTIAL
- Changed: .github/workflows/goku-qa.yml,scripts/online_ledger.mjs,scripts/online_ledger.test.mjs,scripts/gate_summary.mjs,tools/oz-explorer/turntable.mjs,DAILY_SERVER_PLAN.md
- Evidence: Unit tests: online_ledger 5/5; gate_summary tested on fake + real motion/vehicle files (counts, FAIL on failing unit/game test); workflow YAML parses (3 jobs: guard, qa, gate; triggers: dispatch, schedule x3, pull_request). Run #1 (REAL, main): 15 min 33 s
- Commit/tag: -
- Not verified: The new workflow parts (deep mode, PR gate comment, scoreboard step, expressions) have NOT run on GitHub yet; schedule only works from main (needs merge); deep duration is an ESTIMATE; PR comment permission unverified

## Improvement 11 — Motion checks: motion.mjs (hero/GOKU gait + blends) and vehiclemotion.mjs (all-direction driving) + HUMAN_AND_MOTION_BRIEF
- Date: 2026-11-24
- Status: PARTIAL
- Changed: tools/oz-explorer/motion.mjs,tools/oz-explorer/vehiclemotion.mjs,tools/oz-explorer/motion.test.mjs,tools/oz-explorer/vehiclemotion.test.mjs,goku_knowledge/references.json,goku_knowledge/HUMAN_AND_MOTION_BRIEF.md,goku_knowledge/README.md,.github/workflows/goku-qa.yml
- Evidence: Unit tests: motion 10/10, vehiclemotion 11/11, reference 18/18, daily_guard 10/10, improvement 11/11. LIVE in sandbox (SIMULATED GL, game's own clips and drive code): motion 146 measurements (planted 30% thigh stretch detected as 0.30), 16 Minor outside typical range (locked knee 0.999, slow-walk foot skating, crouch-walk both feet in air 10.5%); vehicles 104 measurements, 4 Major: all 4 cars lean INTO turns (-1.2..-2.4 deg, OZ-014). No game file changed
- Commit/tag: -
- Not verified: Clip only: foot IK, weapon-hold arm IK, muscle taper, joint gaps, clothing clipping not measured; vehicles measured in flat free space only (no crash, ramp, slope, driver pose, camera); ranges are ESTIMATE textbook values; server run of both tools not done yet

## Improvement 10 — Run #1 follow-ups: A0 tolerance, standing-hero foot check, turntable zombies+partner order, zombie-pressure test
- Date: 2026-11-24
- Status: PARTIAL
- Changed: tests/a0_debug.mjs,tools/oz-explorer/reference.mjs,tools/oz-explorer/reference.test.mjs,tools/oz-explorer/turntable.mjs,tests/zombie_pressure.mjs,.github/workflows/goku-qa.yml,GOKU_AUDIT_BLUEPRINT.md
- Evidence: Sandbox (SIMULATED): regression smoke PASS, A0 5/5 (drift 0.00000 m), GOKU partner PASS, explorer 0 findings; reference test 18/18; standing hero foot 0.062 m; turntable 4/4 character sheets (zombies no longer skipped); zombie_pressure runs and prints UNVERIFIED under stub physics (hero y 1.8 m). GitHub run #1 (REAL, 15 min 33 s): vite build PASS, A0 1 FAIL, hero foot 0.228 Major
- Commit/tag: -
- Not verified: Server run after these fixes not done yet: A0 on real Rapier, hero foot on server, zombie_pressure on real Rapier (OZ-011), turntable zombie sheets on server

## Improvement 9 — Per-pass draw-call accounting, reference check works with skinned characters, permission policy
- Date: 2026-11-23
- Status: PASS
- Changed: tools/oz-explorer/drawcalls.mjs (main vs shadow pass), reference.mjs (foot box from skinned vertices), turntable.mjs (screenshot timeout), GOKU_PERMISSIONS.md
- Evidence: per-pass total 928 vs measured 966 (4%); QA after fix: 11 false knee-wrong-way findings removed (22->10 findings); reference test 16/16
- Commit/tag: tag step4-r4
- Not verified: never run on real GitHub; GOKU still cannot change code itself

## Improvement 8 — Audit blueprint (phases 1-8), corrected audit master prompt, draw-call owner tool
- Date: 2026-11-21
- Status: PARTIAL
- Changed: GOKU_AUDIT_BLUEPRINT.md, goku_knowledge/AUDIT_MASTER_PROMPT.md, tools/oz-explorer/drawcalls.mjs, DAILY_SERVER_PLAN.md
- Evidence: drawcalls.mjs run twice LIVE (969/965 calls, 1.18M tris, 571/587 material objects); repo has 0 GLB/texture files (STATIC); 3 of 5 vehicles + 2 landmarks looked at
- Commit/tag: tag audit-v1
- Not verified: vortex + sprint-r + 492 houses not looked at; AAA comparison NOT_DONE (no reference pictures); real GPU fps; shareable-material count; never run on real GitHub

## Improvement 7 — GOKU ghoomna (turntable 360° inspection) + ground-contact check; inspection round 1
- Date: 2026-11-21
- Status: PARTIAL
- Changed: tools/oz-explorer/turntable.mjs (new), reference.mjs + references.json (feet-on-ground check), goku-qa.yml (turntable step), GOKU_INSPECTION_ROUND_1.md, inspection-round-1/*.jpg
- Evidence: reference test 16/16 PASS; LIVE measure: ground-contact 5/5 in range; 8 contact sheets looked at; --maxSeconds budget tested (NOT_DONE written, not hidden)
- Commit/tag: tag turntable-v1
- Not verified: never run on real GitHub; GPU speed; faces/stairs/doors/car-vs-photo not measurable; GOKU cannot fix code itself

## Improvement 6 — Real-world reference check (knowledge pack v1): vehicle sizes, character proportions, joint bending, building storey height
- Date: 2026-11-21
- Status: PARTIAL
- Changed: goku_knowledge/references.json, tools/oz-explorer/reference.mjs, goku_qa.mjs
- Evidence: compare logic 14/14 PASS; measured 110 values inside the running game (SIMULATED run): 12/12 human proportions and 40/40 joint values in range (no knee/elbow bends the wrong way in any of 10 clips), 2 vehicle values outside (Ranger 4x4 is 2.07 m tall, typical max 2.0 m), 6 landmark storey heights APPROX outside; planted faults 3/3 detected
- Commit/tag: tag knowledge-v1
- Not verified: faces, stairs/doors, car look vs real photos, clothing clipping are NOT measurable yet; ranges are typical values, not a specific car model

## Improvement 5 — Cumulative improvement files (improvement N holds 1..N and replaces N-1) + GitHub branch replace mode with a data-loss guard
- Date: 2026-11-21
- Status: PASS
- Changed: scripts/improvement.mjs, verify_cumulative.mjs, publish_reports.sh, improvements/
- Evidence: improvement tool 11/11, publish + guard 13/13 PASS (local bare repo, SIMULATED)
- Commit/tag: tag knowledge-v1
- Not verified: never run against a real GitHub repo; GitHub may still serve old commits by exact SHA for a while

## Improvement 4 — Daily server QA: evening guard, latest/game + latest/goku folders, screenshot eyes, GOKU trend + calendar
- Date: 2026-11-21
- Status: PARTIAL
- Changed: scripts/daily_guard.mjs, tools/oz-explorer/eyes.mjs, goku_qa.mjs, workflow
- Evidence: guard 10/10, publish 8/8, eyes 7/7 PASS; goku_qa end-to-end x3 with 3/3 self-test (SIMULATED)
- Commit/tag: 20d8596 (tag daily-v1)
- Not verified: real GitHub schedule (can be delayed or dropped); pixel flags are heuristics, art quality needs a person

## Improvement 3 — GOKU QA: report, persistent bug ledger, self-test with planted faults, online workflow (reports branch only)
- Date: 2026-11-19
- Status: PARTIAL
- Changed: tools/oz-explorer/goku_qa.mjs, scripts/publish_reports.sh, .github/workflows/goku-qa.yml
- Evidence: self-test: planted floating tree and ground hole were both detected (SIMULATED)
- Commit/tag: ccec9cb (tag goku-qa-v1)
- Not verified: the GitHub workflow has never run on GitHub

## Improvement 2 — GOKU partner: A* path finding (NavGrid), pace matching, safer wall margins
- Date: 2026-11-18
- Status: PASS
- Changed: src/ai/GokuPartner.js, src/ai/NavGrid.js
- Evidence: goku tests pass (SIMULATED); stuck/gave-up counters are reported every QA run
- Commit/tag: 2d173b7 (tag step4-r3-wip)
- Not verified: partner only walks and fights: no driving

## Improvement 1 — GOKU partner player inside the game + goku-merge tool + tests
- Date: 2026-11-18
- Status: PASS
- Changed: src/ai/GokuPartner.js, tools/goku-merge, tests/goku_partner.mjs
- Evidence: goku test passes in the sandbox (SIMULATED)
- Commit/tag: 73eb20e (tag goku-partner-v1)
- Not verified: the Windows GOKU agent is a separate program and is not connected to the game
