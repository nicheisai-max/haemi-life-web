#!/bin/bash

echo "----- CLEAN STATE ENFORCEMENT START -----"

echo "Switching to main branch"
git checkout main || git checkout -f main

echo "Fetching remote"
git fetch origin

echo "Hard resetting to origin/main"
git reset --hard origin/main

echo "Cleaning working tree"
git clean -fd

echo "Removing local sandbox branches"
for branch in $(git branch | grep "ai/sandbox-"); do
  git branch -D $branch || true
done

echo "Removing remote sandbox branches"
for branch in $(git branch -r | grep "origin/ai/sandbox-" | sed 's/origin\///'); do
  git push origin --delete $branch || true
done

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
