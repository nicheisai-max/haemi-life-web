#!/bin/bash

echo "----- DETERMINISTIC STATE ENFORCEMENT START -----"

# Switch to main and pull latest
git checkout -f main
git fetch origin --prune
git reset --hard origin/main
git clean -fd

# List and delete all local sandbox branches
local_sandboxes=$(git branch --list "ai/sandbox-*")
if [ -n "$local_sandboxes" ]; then
  for branch in $local_sandboxes; do
    git branch -D "${branch#* }" || true
  done
fi

# List and delete all remote sandbox branches
remote_sandboxes=$(git branch -r --list "origin/ai/sandbox-*")
if [ -n "$remote_sandboxes" ]; then
  for branch in $remote_sandboxes; do
    clean_branch=$(echo "$branch" | sed 's/origin\///')
    git push origin --delete "$clean_branch" || true
  done
fi

# Final deterministic reset
git fetch origin --prune
git reset --hard origin/main
git clean -fd

# Validation
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
STATUS=$(git status --porcelain)
SANDBOX_COUNT=$(git branch --list "ai/sandbox-*" | wc -l)

if [ "$CURRENT_BRANCH" != "main" ] || [ -n "$STATUS" ] || [ "$SANDBOX_COUNT" -gt 0 ]; then
  echo "❌ STATE ENFORCEMENT FAILED"
  exit 1
fi

echo "✅ REPOSITORY STATE DETERMINISTIC: main"
echo "----- DETERMINISTIC STATE ENFORCEMENT COMPLETE -----"
