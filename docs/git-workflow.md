# Git Workflow — Haemi Life Web

> **Enterprise Git Governance Policy — Solo Founder Edition**
> Version 1.1 — March 2026
> This document defines the binding Git workflow for all development on the Haemi Life Web repository.
> **Solo Developer Note:** Human PR approvals are disabled. The CI pipeline is the sole merge gate.

---

## Table of Contents

1. [Sandbox Development Model](#1-sandbox-development-model)
2. [Pull Request Process](#2-pull-request-process)
3. [Squash Merge Policy](#3-squash-merge-policy)
4. [Commit Message Standard](#4-commit-message-standard)
5. [CI Pipeline Enforcement](#5-ci-pipeline-enforcement)
6. [Repository Protection Rules](#6-repository-protection-rules)
7. [Forbidden Operations](#7-forbidden-operations)
8. [Repository Hygiene Rules](#8-repository-hygiene-rules)
9. [Branch Cleanup](#9-branch-cleanup)

---

## 1. Sandbox Development Model

**Rule:** All development must occur inside sandbox branches. Direct commits to `main` are permanently blocked by both the Husky pre-commit hook and GitHub branch protection.

### Branch Naming Format

```
ai-sandbox/<feature-name>
```

### Examples

```
ai-sandbox/auth-hardening
ai-sandbox/session-security
ai-sandbox/ci-stabilization
ai-sandbox/stripe-payment-gateway
ai-sandbox/dashboard-redesign
```

### Creating a Sandbox Branch

```bash
# Create and switch to a new sandbox branch
git checkout -b ai-sandbox/your-feature-name

# Verify branch name passes the branch guard
node scripts/branch_guard.js
```

### Rules Inside Sandbox Branches

- ✅ Unlimited commits allowed
- ✅ History rewriting (`rebase`, `reset`) is permitted
- ✅ Force pushes to sandbox branches are allowed
- ✅ WIP commits acceptable (cleaned up before PR via squash merge)
- ❌ Never push `main` commits manually

---

## 2. Pull Request Process

All work merges into `main` exclusively through Pull Requests.

### Step-by-Step

```bash
# 1. Develop inside your sandbox branch
git checkout -b ai-sandbox/auth-hardening

# 2. Make commits (all conventional commit format)
git add .
git commit -m "feat(auth): implement refresh token rotation security"

# 3. Push sandbox branch to origin
git push origin ai-sandbox/auth-hardening

# 4. Open Pull Request on GitHub
#    - Title must follow Conventional Commit format
#    - Link to any relevant issue
#    - Description must clearly state: what changed, why, and how to verify
```

### PR Title Format

The PR title becomes the squash merge commit on `main`. It must follow Conventional Commit format:

```
feat(auth): production-grade authentication hardening
fix(ci): resolve backend test environment variables
refactor(api): simplify session validation logic
```

### PR Checklist (before merging)

- [ ] All CI checks pass (`Commit Lint`, `Repository Health Audit`, `Validate Monorepo`)
- [ ] PR title follows Conventional Commit format
- [ ] No debug files, logs, or temp artifacts staged
- [ ] No files >1MB committed

> **Solo Developer Note:** No human approval is required. Once all three CI jobs are green, the repository owner can merge immediately.

---

## 3. Squash Merge Policy

**Rule:** All Pull Requests must use **Squash and Merge**. This is enforced in GitHub repository settings.

### Why Squash Merge?

Sandbox branches accumulate WIP, debugging, and experimental commits during development. These are valid inside the sandbox but must never pollute `main` branch history.

### Example

**Sandbox branch commits (messy, acceptable):**
```
fix(auth): typo in error message
wip: debugging session logic
add console.log for debugging
adjust refresh logic
fix lint errors
add integration tests
fix mock setup
```

**Main branch result (clean, one commit):**
```
feat(auth): production-grade authentication hardening
```

### Configuration

Squash merge is enforced in: **GitHub Settings → General → Pull Requests → Allow squash merging** (see [.github/branch-protection.md](.github/branch-protection.md) for setup steps).

---

## 4. Commit Message Standard

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. This is enforced automatically by the `.husky/commit-msg` hook.

### Format

```
type(scope): description
```

- **type** — the kind of change (required)
- **scope** — the area of the codebase (optional but recommended)
- **description** — short imperative summary, minimum 10 characters (required)

### Allowed Types

| Type | Purpose |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks, dependency bumps |
| `docs` | Documentation only changes |
| `style` | Formatting, missing semi-colons, no logic change |
| `perf` | Performance improvement |
| `ci` | CI/CD pipeline changes |
| `build` | Build system changes |
| `revert` | Revert a previous commit |

### Examples

```bash
# Good — descriptive, scoped, conventional
git commit -m "feat(auth): implement refresh token rotation security"
git commit -m "fix(ci): resolve backend test environment variables"
git commit -m "refactor(auth): simplify session validation logic"
git commit -m "test(api): add integration tests for appointment booking"
git commit -m "chore(deps): upgrade express to 4.18.3"
git commit -m "docs(api): document authentication endpoints"

# Bad — blocked by commit-msg hook
git commit -m "fix stuff"           # ❌ No type, no scope, too vague
git commit -m "update"              # ❌ No type, too short
git commit -m "WIP"                 # ❌ WIP commits blocked on main
git commit -m "feat: fixed"         # ❌ Description too short (<10 chars)
```

### Hook Enforcement

The `.husky/commit-msg` hook runs `scripts/commit-msg-guard.js` automatically on every commit attempt. Invalid messages are blocked immediately with a clear error and examples.

---

## 5. CI Pipeline Enforcement

Every PR and push to `main` triggers the CI pipeline. **All three jobs must pass before merge.**

### Pipeline Jobs

| Job | Trigger | What It Validates |
|---|---|---|
| **Commit Lint** | PR only | PR title + all commit messages follow Conventional Commit format |
| **Repository Health Audit** | PR + push to main | No tracked temp files, no large files >1MB, no obvious secrets |
| **Validate Monorepo** | PR + push to main | Lint, TypeScript type-check, build success, backend tests |

### Status Check Names (GitHub UI)

When configuring branch protection, add these exact job names as required status checks:

- `Commit Lint`
- `Repository Health Audit`
- `Validate Monorepo`

### CI Failure Response

| Failure | Fix |
|---|---|
| `Commit Lint` fails | Update PR title or commit messages to Conventional Commit format |
| `Repository Health Audit` fails — tracked artifact | Run `git rm --cached <file>` and commit the change |
| `Repository Health Audit` fails — large file | Remove the file, add pattern to `.gitignore`, use Git LFS if needed |
| `Validate Monorepo` fails — lint | Run `npm run lint` locally, fix errors |
| `Validate Monorepo` fails — tests | Run `npm run test:backend` locally, fix failures |

---

## 6. Repository Protection Rules

All rules are enforced at both local (Husky hooks) and remote (GitHub branch protection) levels.

### GitHub Branch Protection Summary

| Rule | `main` | `release/*` |
|---|---|---|
| Require PR before merge | ✅ | ✅ |
| **Require approvals** | ❌ Disabled (solo developer) | ❌ Disabled |
| Require CI to pass | ✅ | ✅ |
| Require linear history | ✅ | ✅ |
| Disable force pushes | ✅ | ✅ |
| Allow deletions (sandbox auto-cleanup) | ✅ | ✅ |
| Admin bypass disabled | ✅ | ✅ |

**Full setup instructions:** [.github/branch-protection.md](.github/branch-protection.md)

### Local Husky Hook Summary

| Hook | Script | What It Enforces |
|---|---|---|
| `pre-commit` | `branch_guard.js --commit` | No commits directly on `main` |
| `pre-commit` | `large-file-guard.js` | No files >1MB, no forbidden patterns |
| `pre-commit` | `lint-staged` | ESLint on staged files |
| `commit-msg` | `commit-msg-guard.js` | Conventional Commit format |
| `pre-push` | `branch_guard.js` | No direct pushes to `main` |

---

## 7. Forbidden Operations

These operations are permanently blocked on protected branches.

### Permanently Forbidden on `main` and `release/*`

```bash
git push --force             # ❌ Blocked by GitHub branch protection
git push --force-with-lease  # ❌ Blocked by GitHub branch protection
git reset --hard HEAD~1      # ❌ Never rewrite committed main history
git filter-repo              # ❌ History rewriting strictly forbidden
git rebase main              # ❌ Use squash merge via PR instead
```

### Permitted in Sandbox Branches Only

```bash
# These are acceptable only inside ai-sandbox/* branches
git push --force origin ai-sandbox/my-feature   # ✅ OK in sandbox
git rebase -i HEAD~5                             # ✅ OK in sandbox
git reset --hard HEAD~1                          # ✅ OK in sandbox
```

---

## 8. Repository Hygiene Rules

### Files That Must Never Be Committed

| Category | Examples |
|---|---|
| Secrets & credentials | `.env`, `.env.*`, `TEST_CREDENTIALS.md` |
| Dependencies | `node_modules/` |
| Build outputs | `dist/`, `build/`, `out/`, `*.tsbuildinfo` |
| Logs | `*.log`, `lint_output.txt`, `debug_output.txt` |
| CI artifacts | `.ci-stats-bundle.json`, `test_output.txt`, `bundle-report.html` |
| Database artifacts | `*.sql`, `*.dump`, `/backups/` |
| Archives | `*.zip`, `*.tar.gz`, `*.rar` |
| Coverage | `coverage/` |

All patterns above are covered in `.gitignore`.

### Before Every Commit

1. Run `git status` — check no unexpected files are staged
2. Run `git diff --cached --stat` — verify staged files look correct
3. Verify no files >1MB (enforced automatically by `large-file-guard.js`)

---

## 9. Branch Cleanup

Sandbox branches are automatically deleted after their PR is merged, enabled via **GitHub Settings → General → Automatically delete head branches**.

### Manual Cleanup

If a branch needs to be deleted manually:

```bash
# Delete remote sandbox branch
git push origin --delete ai-sandbox/old-feature

# Delete local sandbox branch
git branch -d ai-sandbox/old-feature

# Prune deleted remote branches from local cache
git fetch --prune
```

### Never Delete

- `main` — protected, deletion disabled in GitHub
- `release/*` — protected, deletion disabled in GitHub

---

*Haemi Life Web — Enterprise Git Governance v1.0*
*Secure. Trusted. Premium. Designed to Google-grade engineering standards.*
