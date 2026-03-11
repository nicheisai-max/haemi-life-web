# GitHub Branch Protection Rules — Haemi Life Web

> **Solo Developer Policy:** This repository is maintained by a single founder. Human review approvals are disabled — CI pipeline checks are the sole merge gate.

## Overview

This document specifies the **exact GitHub branch protection settings** required to enforce enterprise-grade Git governance. These settings must be applied manually in the GitHub repository settings UI.

---

## Step 1: Navigate to Branch Protection Settings

1. Open the repository on GitHub: `nicheisai-max/haemi-life-web`
2. Go to **Settings** → **Branches**
3. Under **Branch protection rules**, click **Add rule** (or edit existing if one exists for `main`)

---

## Step 2: Configure Main Branch Protection

**Branch name pattern:** `main`

### Required Settings (Must Enable)

| Setting | Value | Purpose |
|---|---|---|
| **Require a pull request before merging** | ✅ Enabled | No direct pushes to main |
| **Require approvals** | ❌ **Disabled** | Solo developer — author cannot approve own PR |
| **Dismiss stale PR approvals when new commits pushed** | ❌ Disabled | N/A — approvals not required |
| **Require status checks to pass before merging** | ✅ Enabled | CI is the sole merge gate |
| **Require branches to be up to date before merging** | ✅ Enabled | Linear history |
| **Require linear history** | ✅ Enabled | Squash/rebase commits only |
| **Do not allow bypassing the above settings** | ✅ Enabled | Admin bypass disabled |
| **Allow force pushes** | ❌ Disabled | History protection |
| **Allow deletions** | ✅ Enabled | Required for auto-delete of `ai-sandbox/*` after merge |

### Required Status Checks
Under "Require status checks to pass before merging", add these check names exactly:

- `Commit Lint`
- `Repository Health Audit`
- `Validate Monorepo`

> [!IMPORTANT]
> These CI checks are the **only** merge gate. With approvals disabled, all three jobs must be green before the repository owner can merge.

---

## Step 3: Configure Release Branch Protection (Optional but Recommended)

**Branch name pattern:** `release/*`

Apply the same settings as `main` above (approvals also disabled).

---

## Step 4: Enable Automatic Branch Deletion After Merge

1. Go to **Settings** → **General**
2. Scroll to **Pull Requests** section
3. Enable: **Automatically delete head branches** ✅

This auto-deletes `ai-sandbox/*` branches after their PR is merged (Rule 6).

---

## Step 5: Verify Merge Strategy

1. Still in **Settings** → **General** → **Pull Requests**
2. Disable:
   - ❌ Allow merge commits *(prevents fragmented history)*
   - ❌ Allow rebase merging *(prevents rebase pushes on main)*
3. Enable:
   - ✅ **Allow squash merging** *(enforces Rule 3 — squash merge policy)*
4. Set **Default commit message**: `Pull request title and description`

---

## Verification Checklist

After applying these settings:

- [ ] Direct push to `main` — should be blocked with "protected branch" error
- [ ] Force push to `main` — should be blocked
- [ ] Open a PR from `ai-sandbox/test-branch` — CI checks appear as required (no approval required)
- [ ] All CI checks pass → repository owner can merge immediately without approval
- [ ] Merge a PR — `ai-sandbox/test-branch` should be automatically deleted

---

## Current CI Jobs (Required Status Checks)

| Job Name | Purpose | Required |
|---|---|---|
| `Commit Lint` | Validates Conventional Commit format | Yes |
| `Repository Health Audit` | Checks for tracked artifacts, large files | Yes |
| `Validate Monorepo` | Lint, type-check, build, tests | Yes |
