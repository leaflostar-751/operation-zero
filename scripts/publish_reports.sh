#!/usr/bin/env bash
# Makes the `reports` branch an exact copy of the reports folder (creates the branch if missing) and pushes ONLY that branch.
# "latest/game", "latest/goku" and "improvements/*" are REPLACED each run (files that no longer exist are removed).
# REPORTS_HISTORY=keep    (default) one new commit on top; old versions stay in git history.
# REPORTS_HISTORY=replace the branch becomes ONE single commit (old commits are dropped from the branch). Before that, verify_cumulative.mjs
#                         must confirm that nothing is lost (improvements 1..N, ledger, trend, calendar), otherwise exit 3 and NOTHING is pushed.
#   (GitHub may still serve old commits by their exact SHA for a while; this is not a secure delete. Nothing secret is ever stored here.)
# The helper folder prev-shots/ (last run's pictures, input only) is never published.
# It refuses to touch main/master. Needs: a git repo with an `origin` remote and push rights (in GitHub Actions: permissions: contents: write).
# Usage: bash scripts/publish_reports.sh [reports_dir]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-reports}"; BRANCH="${REPORTS_BRANCH:-reports}"; REMOTE="${REPORTS_REMOTE:-origin}"; HIST="${REPORTS_HISTORY:-keep}"
case "$BRANCH" in main|master|HEAD|"") echo "REFUSED: this script never writes to '$BRANCH'" >&2; exit 2;; esac
case "$HIST" in keep|replace) ;; *) echo "REPORTS_HISTORY must be keep or replace" >&2; exit 2;; esac
[ -d "$SRC" ] || { echo "no folder $SRC" >&2; exit 2; }
git config user.name  >/dev/null 2>&1 || git config user.name  "goku-qa"
git config user.email >/dev/null 2>&1 || git config user.email "goku-qa@users.noreply.github.com"
TMP="$(mktemp -d)"; NEW="$(mktemp -d)"; OLD="$(mktemp -d)"; TMPBR="_reports_tmp_$$"
trap 'git worktree remove --force "$TMP" >/dev/null 2>&1 || true; git branch -D "$TMPBR" >/dev/null 2>&1 || true; rm -rf "$TMP" "$NEW" "$OLD"' EXIT
cp -R "$SRC"/. "$NEW"/; rm -rf "$NEW/prev-shots"
EXISTS=0; OLDSHA=""
if git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  EXISTS=1; git fetch --quiet "$REMOTE" "$BRANCH:refs/remotes/$REMOTE/$BRANCH"; OLDSHA="$(git rev-parse "refs/remotes/$REMOTE/$BRANCH")"
fi
if [ "$HIST" = replace ]; then
  [ "$EXISTS" = 1 ] && git archive "$OLDSHA" | tar -x -C "$OLD"
  node "$HERE/verify_cumulative.mjs" "$OLD" "$NEW" || { echo "REFUSED: replacing would lose data; nothing was pushed" >&2; exit 3; }
  git worktree add --quiet --detach "$TMP"
  ( cd "$TMP" && git checkout --quiet --orphan "$TMPBR" && git rm -rf --quiet . >/dev/null 2>&1 || true )
  cp -R "$NEW"/. "$TMP"/; cd "$TMP"; git add -A
  git commit --quiet -m "GOKU QA reports $(date -u +%Y-%m-%dT%H:%MZ) (single commit: replaces the previous content)"
  if [ "$EXISTS" = 1 ]; then git push --quiet --force-with-lease="refs/heads/$BRANCH:$OLDSHA" "$REMOTE" "HEAD:refs/heads/$BRANCH"; else git push --quiet "$REMOTE" "HEAD:refs/heads/$BRANCH"; fi
  echo "published to $REMOTE/$BRANCH (history replaced: 1 commit)"; exit 0
fi
if [ "$EXISTS" = 1 ]; then git worktree add --quiet -B "$TMPBR" "$TMP" "refs/remotes/$REMOTE/$BRANCH"
else
  git worktree add --quiet --detach "$TMP"
  ( cd "$TMP" && git checkout --quiet --orphan "$TMPBR" && git rm -rf --quiet . >/dev/null 2>&1 || true )
fi
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$NEW"/. "$TMP"/
cd "$TMP"
git add -A
if git diff --cached --quiet; then echo "nothing new to publish"; exit 0; fi
git commit --quiet -m "GOKU QA reports $(date -u +%Y-%m-%dT%H:%MZ)"
git push --quiet "$REMOTE" "HEAD:refs/heads/$BRANCH"
echo "published to $REMOTE/$BRANCH"
