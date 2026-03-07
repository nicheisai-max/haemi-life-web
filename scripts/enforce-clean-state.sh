#!/bin/bash

echo "----- CLEAN STATE ENFORCEMENT START -----"

# Safety Check: Refuse execution if working tree is dirty unless --force is passed
if [[ "$*" != *"--force"* ]]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "❌ ERROR: Working tree is dirty. Stash or commit changes first."
    echo "To bypass this safety check, use: npm run branch:cleanup -- --force"
    exit 1
  fi
fi

echo "Switching to main branch"
git checkout main || git checkout -f main

echo "Fetching remote"
git fetch origin

echo "Hard resetting to origin/main"
git reset --hard origin/main

echo "Cleaning working tree"
git clean -fd

echo "Removing local sandbox branches"
local_branches=$(git branch --list "ai/sandbox-*")
if [ -n "$local_branches" ]; then
  for branch in $local_branches; do
    git branch -D $branch || true
  done
fi

echo "Removing remote sandbox branches"
remote_branches=$(git branch -r --list "origin/ai/sandbox-*")
if [ -n "$remote_branches" ]; then
  for branch in $remote_branches; do
    git push origin --delete ${branch#origin/} || true
  done
fi

echo "Pruning remote references"
git fetch --prune

echo "Final sync"
git checkout main
git fetch origin
git reset --hard origin/main
git clean -fd

echo "Verification"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
STATUS=$(git status --porcelain)

if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERROR: Branch is not main"
  exit 1
fi

if [ -n "$STATUS" ]; then
  echo "ERROR: Working tree not clean"
  exit 1
fi

echo "Repository clean and synchronized"

echo "----- CLEAN STATE ENFORCEMENT COMPLETE -----"
