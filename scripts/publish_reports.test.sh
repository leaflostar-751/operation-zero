#!/usr/bin/env bash
# Test of publish_reports.sh against a LOCAL bare repo (no network): replace semantics, prev-shots excluded, main refused.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; T="$(mktemp -d)"; ok=0; bad=0
chk() { if eval "$2"; then echo "PASS $1"; ok=$((ok+1)); else echo "FAIL $1"; bad=$((bad+1)); fi; }
git init -q --bare "$T/remote.git"; git init -q -b main "$T/work"; cd "$T/work"
git config user.email t@t; git config user.name t; echo hi > a.txt; git add -A; git commit -qm init; git remote add origin "$T/remote.git"; git push -q origin main 2>/dev/null
mkdir -p r1/latest/game/shots r1/latest/goku r1/prev-shots; echo v1 > r1/latest/game/REPORT.md; echo p1 > r1/latest/game/shots/old_spot.jpg; echo g1 > r1/latest/goku/GOKU_REPORT.md; echo '{}' > r1/meta.json; echo pp > r1/prev-shots/x.jpg
bash "$HERE/publish_reports.sh" r1 >/dev/null 2>&1
L() { git --git-dir="$T/remote.git" show "reports:$1" 2>/dev/null; }; LS() { git --git-dir="$T/remote.git" ls-tree -r --name-only reports; }
chk "run 1 published latest/game/REPORT.md" '[ "$(L latest/game/REPORT.md)" = v1 ]'
chk "prev-shots is NOT published" '! LS | grep -q prev-shots'
mkdir -p r2/latest/game/shots r2/latest/goku; echo v2 > r2/latest/game/REPORT.md; echo p2 > r2/latest/game/shots/new_spot.jpg; echo g2 > r2/latest/goku/GOKU_REPORT.md; echo '{"n":2}' > r2/meta.json
bash "$HERE/publish_reports.sh" r2 >/dev/null 2>&1
chk "run 2 REPLACED the report (v2, not v1+v2)" '[ "$(L latest/game/REPORT.md)" = v2 ] && [ "$(L latest/goku/GOKU_REPORT.md)" = g2 ]'
chk "stale picture from run 1 is gone, new one is there" '! LS | grep -q old_spot && LS | grep -q new_spot'
chk "only ONE report file per folder on the branch (no piling up)" '[ "$(LS | grep -c REPORT.md)" = 2 ]'
chk "history keeps the old version (2 commits, rollback possible)" '[ "$(git --git-dir="$T/remote.git" rev-list --count reports)" = 2 ]'
chk "main branch untouched" '[ "$(git --git-dir="$T/remote.git" ls-tree -r --name-only main)" = a.txt ]'
set +e; REPORTS_BRANCH=main bash "$HERE/publish_reports.sh" r2 >/dev/null 2>&1; rc=$?; set -e
chk "publishing to main is REFUSED (exit 2)" '[ $rc = 2 ]'

# ---------- REPLACE mode (history dropped, data-loss guard)
mkdir -p "$T/ik"; cd "$T/work"
R2="$T/rep.git"; git init -q --bare "$R2"; git remote add rep "$R2"
mk() { # mk <dir> <run> <trend_len> <improve_n>
  rm -rf "$1"; mkdir -p "$1/latest/game" "$1/latest/goku" "$1/improvements/game"; echo "run$2" > "$1/latest/game/REPORT.md"
  node -e "const n=+process.argv[1];require('fs').writeFileSync(process.argv[2]+'/latest/goku/trend.json',JSON.stringify(Array.from({length:n},(_,i)=>({time:'t'+i}))))" "$3" "$1"
  echo '[{"key":"k1"}]' > "$1/ledger.json"; echo "{\"runNumber\":$2,\"days\":{\"d\":1}}" > "$1/meta.json"
  node --input-type=module -e "import {addEntry} from '$HERE/improvement.mjs'; for(let i=1;i<=+process.argv[1];i++) addEntry(process.argv[2]+'/improvements','game','g'+i,{status:'PASS',date:'2026-11-2'+i});" "$4" "$1"
}
RP() { REPORTS_REMOTE=rep REPORTS_HISTORY=replace bash "$HERE/publish_reports.sh" "$1"; }
mk "$T/a1" 1 1 1; RP "$T/a1" >/dev/null 2>&1
mk "$T/a2" 2 2 2; RP "$T/a2" >/dev/null 2>&1
cnt() { git --git-dir="$R2" rev-list --count reports; }
chk "replace mode: after 2 runs the branch is ONE commit" '[ "$(cnt)" = 1 ]'
chk "replace mode: content is run 2, improvement file is improve-game-2.md only" '[ "$(git --git-dir="$R2" show reports:latest/game/REPORT.md)" = run2 ] && git --git-dir="$R2" ls-tree -r --name-only reports | grep -q "improvements/game/improve-game-2.md" && ! git --git-dir="$R2" ls-tree -r --name-only reports | grep -q "improve-game-1.md"'
SHA_BEFORE="$(git --git-dir="$R2" rev-parse reports)"
mk "$T/a3" 3 1 3                                  # trend shrank (restore failed) -> must be refused
set +e; RP "$T/a3" >/dev/null 2>&1; rc=$?; set -e
chk "trend shrank -> REFUSED (exit 3), branch unchanged" '[ $rc = 3 ] && [ "$(git --git-dir="$R2" rev-parse reports)" = "$SHA_BEFORE" ]'
mk "$T/a4" 4 3 1                                  # improvements went back from 2 to 1 -> must be refused
set +e; RP "$T/a4" >/dev/null 2>&1; rc=$?; set -e
chk "improvements lost (2 -> 1) -> REFUSED (exit 3), branch unchanged" '[ $rc = 3 ] && [ "$(git --git-dir="$R2" rev-parse reports)" = "$SHA_BEFORE" ]'
mk "$T/a5" 5 3 3; RP "$T/a5" >/dev/null 2>&1
chk "healthy run 3 is accepted: improve-game-3.md, still ONE commit" '[ "$(cnt)" = 1 ] && git --git-dir="$R2" ls-tree -r --name-only reports | grep -q "improve-game-3.md"'
echo "{\"passed\":$ok,\"total\":$((ok+bad))}"; [ $bad = 0 ]
