#!/usr/bin/env bash
# Copies the contents of a reports folder to the `reports` branch (creates it if missing) and pushes ONLY that branch.
# It refuses to touch main/master. Needs: a git repo with an `origin` remote and push rights (in GitHub Actions: permissions: contents: write).
# Usage: bash scripts/publish_reports.sh [reports_dir]
set -euo pipefail
SRC="${1:-reports}"; BRANCH="${REPORTS_BRANCH:-reports}"; REMOTE="${REPORTS_REMOTE:-origin}"
case "$BRANCH" in main|master|HEAD|"") echo "REFUSED: this script never writes to '$BRANCH'" >&2; exit 2;; esac
[ -d "$SRC" ] || { echo "no folder $SRC" >&2; exit 2; }
git config user.name  >/dev/null 2>&1 || git config user.name  "goku-qa"
git config user.email >/dev/null 2>&1 || git config user.email "goku-qa@users.noreply.github.com"
TMP="$(mktemp -d)"; trap 'git worktree remove --force "$TMP" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
if git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  git fetch --quiet "$REMOTE" "$BRANCH:refs/remotes/$REMOTE/$BRANCH"
  git worktree add --quiet -B "$BRANCH" "$TMP" "refs/remotes/$REMOTE/$BRANCH"
else
  git worktree add --quiet --detach "$TMP"
  ( cd "$TMP" && git checkout --quiet --orphan "$BRANCH" && git rm -rf --quiet . >/dev/null 2>&1 || true )
fi
cp -R "$SRC"/. "$TMP"/
cd "$TMP"
git add -A
if git diff --cached --quiet; then echo "nothing new to publish"; exit 0; fi
git commit --quiet -m "GOKU QA reports $(date -u +%Y-%m-%dT%H:%MZ)"
git push --quiet "$REMOTE" "HEAD:refs/heads/$BRANCH"
echo "published to $REMOTE/$BRANCH"
