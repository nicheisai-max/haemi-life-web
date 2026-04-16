# HAEMI LIFE — Claude Code Project Intelligence

## Project Overview
**Haemi Life** — Enterprise-grade digital health platform (Botswana market).
- **Stack:** Node.js + Express (backend) + React + Vite (frontend) + PostgreSQL
- **Architecture:** npm workspaces monorepo (`backend/`, `frontend/`)
- **Status:** Local-only — no cloud hosting. Git + CI pipeline only.
- **Demo context:** Investor demo from local machine, local PostgreSQL DB.

---

## Starting the Project

### From Main Project Directory (ALWAYS use this)
```bash
cd "C:\Users\91989\Desktop\Deepak\haemi-life-web"
npm run dev
```
This runs `scripts/safe-dev.ts` which:
1. Nukes ports 5000 + 5173
2. Runs preflight (env validation)
3. Runs DB health check (schema-guard: 39 tables, SHA256 lock v4.0)
4. Starts backend (port 5000) + frontend (port 5173) via concurrently

### URLs
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000/api
- **Vite proxies** `/api` and `/socket.io` to backend

---

## Demo Credentials (All roles — same password)

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@haemilife.com | HaemiLifeDemo@2026 |
| **Doctor** | doctor@haemilife.com | HaemiLifeDemo@2026 |
| **Pharmacist** | pharmacist@haemilife.com | HaemiLifeDemo@2026 |
| **Patient** | patient@haemilife.com | HaemiLifeDemo@2026 |

### Multi-Role Demo Protocol (Investor)
Use **4 separate incognito windows** or **4 different browser profiles** — NOT regular tabs.
Reason: localStorage is shared across tabs (same origin) → refresh token collision between roles.

---

## Auth System Architecture

- **Access Token:** 15 min expiry, stored in sessionStorage (tab-scoped)
- **Refresh Token:** 7 days, stored in localStorage (origin-scoped)
- **Refresh:** Proactive every 15s if TTL < 5 min; Web Locks API prevents race conditions
- **Session popup:** Fires at 2 min remaining, user can extend
- **Admin controls:** Session timeout 5–1440 min (configurable in admin dashboard)
- **Cross-tab logout:** Via localStorage `haemi_logout_signal` + BroadcastChannel
- **Token revocation:** `token_version` increment (global) + `revoked` flag (per-session)

---

## Git Governance (ABSOLUTE RULES)

### Prohibited Commands
These are **STRICTLY FORBIDDEN** under all circumstances. No exceptions.

| Command | Why |
|---------|-----|
| `--no-verify` | NEVER skip Husky hooks. If a hook fails, FIX the root cause. |
| `--force` / `-f` on push | NEVER force-push. Rewrite history = destroyed work. |
| `npm run sync` | CI-ONLY command (`repo-hygiene.ts`). Running locally WILL corrupt the dev environment. |
| Any direct operation on `main` | `main` is the **holy grail**. No direct commits, no pushes, no resets. |

### Branch Convention
- All AI work MUST use `ai-sandbox/*` branches (enforced by `branch-guard.ts`)
- All code reaches `main` via **Pull Request only**
- Delete the `ai-sandbox/*` branch after merge — start fresh next session

### Workflow
```
main (holy grail — read-only)
  └── ai-sandbox/your-task-name (work here)
        └── PR → review → merge → delete branch
```

---

## Guard Scripts (Auto-run via Husky hooks)

| Script | Trigger | Purpose |
|--------|---------|---------|
| `branch-guard.ts` | pre-commit + pre-push | `ai-sandbox/*` branch naming enforcement |
| `schema-guard.ts` | db:health | SHA256 schema integrity (39 tables, v4.0) |
| `preflight.ts` | npm run dev | Env vars + DB connectivity + port check |
| `lint-staged` | pre-commit | ESLint on changed files |

**Push to main is BLOCKED** — all code goes via PR on sandbox branches.

---

## Database
- **Type:** Local PostgreSQL
- **Tables:** 39 institutional tables (exact parity enforced)
- **Schema version:** 4.0 (SHA256 deterministic lock)
- **Audit logs:** Immutable (PostgreSQL triggers block UPDATE/DELETE)
- **Seed data:** Botswana names, run `npm run seed` from backend/

---

## Worktree Context (Claude Code)

When running in a worktree (`.claude/worktrees/*`):
- `.env` files are NOT present (gitignored) — copy from main project before starting
- Run servers from **main project directory**, not worktree
- Branch: `ai-sandbox/*` → PRs target `main` → delete branch after merge

### Auto-fix for worktree .env
```powershell
Copy-Item "C:\Users\91989\Desktop\Deepak\haemi-life-web\backend\.env" ".\backend\.env" -Force
Copy-Item "C:\Users\91989\Desktop\Deepak\haemi-life-web\frontend\.env" ".\frontend\.env" -Force
```

---

## Key File Locations

| Area | Path |
|------|------|
| Auth middleware | `backend/src/middleware/auth.middleware.ts` |
| Token generation | `backend/src/controllers/auth.controller.ts` |
| Session timeout config | `backend/src/utils/config.util.ts` |
| Admin session control | `backend/src/controllers/admin.controller.ts` |
| Frontend auth context | `frontend/src/context/auth-context.tsx` |
| API service + refresh | `frontend/src/services/api.ts` |
| Session expiry popup | `frontend/src/components/auth/session-expiring-popup.tsx` |
| Role-based routing | `frontend/src/components/auth/role-route.tsx` |
| DB schema init | `backend/src/db/init.sql` |
| Orchestrator | `scripts/safe-dev.ts` |
| Seed script | `backend/src/scripts/seed.ts` |

---

## Do Not Touch
- `backend/src/db/init.sql` — schema locked at v4.0
- `.husky/` hooks — enterprise guardrails
- `scripts/branch-guard.ts` — branch naming enforcement
- Any audit/security tables — append-only by DB triggers
