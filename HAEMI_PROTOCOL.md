# 🛡️ HAEMI LIFE — Institutional Engineering Protocol

> **Universal contract for every contributor — human or AI agent — working on this codebase.**
> Read first. Follow always. There are no exceptions.

This file is the single source of truth for engineering discipline on
the Haemi Life monorepo. It is intentionally **vendor-neutral**: it does
not reference Claude, Gemini, Cursor, or any other specific AI tool.
Every rule below is enforced by automated gates (ESLint, husky, CI).
This document is the human-readable companion that explains *why*.

---

## 0. Pre-Flight: Files You Must NEVER Add to Git

The repository's `.gitignore` enforces a **Zero-Pollution Policy**
against AI-tool-specific artifacts. Do not propose adding any of the
following to version control:

| Artifact | Why blocked |
|---|---|
| `.claude/` | Vendor-specific config + executable hooks. Past incident: `.claude/settings.json` hooks crashed Antigravity for ~3 days. |
| `.cursor/` | Vendor-specific. Same risk class. |
| `.gemini/` | Vendor-specific. Same risk class. |
| `CLAUDE.md`, `GEMINI.md`, `CURSOR.md`, etc. | Vendor-coupled governance documents. This file (`HAEMI_PROTOCOL.md`) is the vendor-neutral replacement. |
| `.ai-system/`, `.agent/`, `ai-rules/`, `ai/` | Generic AI-tool dumping grounds. |
| `*.ai-log`, `*.ai-report.md`, `*.analysis.json` | Throwaway AI output. |

If your AI tool wants to create any of the above locally, that is fine;
they are gitignored and remain on your machine only. **Do not commit
them. Do not propose them as governance files.** Governance lives in
this document — vendor-neutral, committed, universal.

---

## 1. Absolute Forbidden Patterns (Non-Negotiable)

These patterns will be rejected by automated gates at multiple layers
(ESLint → pre-commit hook → CI workflow). Do not write them. If you
encounter one already in the code, **fix the underlying type or logic
— do not work around it.**

| # | Pattern | Status |
|---|---|---|
| F1 | `// @ts-ignore` | **Forbidden** — no exception |
| F2 | `// @ts-nocheck` | **Forbidden** — file-level suppression banned |
| F3 | `// @ts-expect-error` | **Forbidden** — even with description |
| F4 | `// @ts-check` | **Forbidden** — implicit project-wide config only |
| F5 | `// eslint-disable` (any form: line, next-line, file, block) | **Forbidden** — every disable is a refusal to fix the code |
| F6 | `: any` (type annotation) | **Forbidden** — use `unknown` and narrow |
| F7 | `as any` (cast) | **Forbidden** |
| F8 | `<any>` (generic) | **Forbidden** |
| F9 | `as unknown as X` (double cast) | **Forbidden** — fix the type, not the boundary |
| F10 | `// prettier-ignore` | **Forbidden** — Prettier is the contract |
| F11 | `// noinspection ...` (JetBrains) | **Forbidden** |
| F12 | `// tslint:disable` (legacy) | **Forbidden** |
| F13 | Non-null assertion `!` (e.g. `user!.id`) | **Forbidden** — use a type guard or early return |

### When `unknown` appears, narrow it explicitly

```ts
// ✘ WRONG — bypasses the boundary
const user = response as unknown as User;

// ✘ WRONG — silently widens
function parse(input: any): User { … }

// ✓ RIGHT — explicit narrowing
function isUser(value: unknown): value is User {
    if (typeof value !== 'object' || value === null) return false;
    if (!('id' in value)) return false;
    return typeof (value as { id: unknown }).id === 'string';
}

const parsed: unknown = JSON.parse(raw);
if (!isUser(parsed)) {
    throw new Error('Malformed user payload');
}
// parsed is User from here
```

---

## 2. Mandatory Discipline (Every Pull Request)

| # | Rule | Why |
|---|---|---|
| D1 | Every `catch` block uses `logger` or `auditService` — never `console.error` | Production observability requires structured logs; `console.error` does not survive log shipping |
| D2 | Every `unknown` narrows via type guard, `instanceof`, or structural check | The compiler must prove the value's shape before downstream use |
| D3 | Every database mutation that touches multiple rows runs inside a transaction | Atomicity is the only protection against partial-state corruption on failure |
| D4 | Every encrypted column (`users.phone_number`, `users.id_number`) routes through `UserRepository.decryptUser` or the `decryptUserPii` helper | Direct `SELECT u.*` returns encrypted blobs; never expose those to the API |
| D5 | Every soft-delete table query filters `WHERE <table>.deleted_at IS NULL` | Tables with `deleted_at`: `users`, `appointments`, `medical_records`, `medical_record_files`, `prescriptions`, `prescription_items`, `prescription_files`, `messages`, `message_attachments`. Forgetting the filter leaks deleted records |
| D6 | Every NUMERIC column read returns `number \| null` (the global pg parser handles this — do not undo it) | The parser in `backend/src/config/db.ts` registers OID 1700 conversion at boot. Do not configure pg to bypass it |
| D7 | Every TIMESTAMP column read returns a UTC-anchored `Date` (the global pg parser handles OID 1114) | Same parser file. Do not bypass — it eliminates timezone drift across machines |
| D8 | Every API response field uses `camelCase`. Every database column uses `snake_case`. Mappers are the only translation point | Casing leaks (snake_case bleeding to frontend, or vice versa) are a P1 contract drift |
| D9 | Profile-image atomic pair: `profile_image` and `profile_image_mime` always project together — both, or neither | Phase 10 contract — the MIME field cannot exist without the image, and vice versa |

---

## 3. Schema Governance

The database schema is the holy grail. Three surfaces must always agree:

```
SCHEMA_MANIFEST   ↔   init.sql + migrations   ↔   live database
   (manifest)            (declared)                  (runtime)
```

The manifest lives at the top of [`scripts/schema-guard.ts`](scripts/schema-guard.ts) — `SCHEMA_MANIFEST.domains`.
The verifier is in the same file. CI runs `npm run db:health` which fails the build on any drift.

### When you change the schema, you MUST do all three in the same commit:

1. Add a migration file in `backend/src/db/migrations/` (or update `init.sql` for the next baseline)
2. Update the table list in `SCHEMA_MANIFEST.domains` under the correct domain key
3. Run the migration on every environment

If a table needs to exist temporarily without a manifest entry (e.g.,
mid-migration cleanup), add it to `SCHEMA_MANIFEST.tolerated` with a
**reason**, an **expiry date**, and an **owner**. The gate fails on
expired entries — there are no permanent waivers.

### Adding a column

Currently the manifest is table-level only. Column drift is not yet
verified by `schema-guard`. Until per-column manifest support lands,
column changes still require a migration; the manifest table list
remains unchanged. Document the column in the migration file's header
comment — that is the audit trail.

---

## 4. Error Handling Contract

Every error path goes to the institutional logger or the audit service:

```ts
// Application code (backend or frontend) — uses logger
import { logger } from '../utils/logger';

try {
    await doRiskyThing();
} catch (error: unknown) {
    logger.error('[ContextTag] Operation failed', {
        error: error instanceof Error ? error.message : String(error),
        // include whatever context helps reproduce
    });
    throw error;  // or sendError(...) for HTTP boundaries
}

// Security-relevant or compliance-relevant events — uses auditService
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';

await auditService.log({
    userId: actorId ?? SYSTEM_ANONYMOUS_ID,
    action: 'ENTITY_OPERATION',
    entityId: String(entityId),
    entityType: 'ENTITY_KIND',
    metadata: { /* relevant fields */ },
});
```

**CLI scripts** (anything in `scripts/`) may use `console.error` because
they run outside the application logger context — but they should still
emit structured payloads (object as second argument) so CI parsers can
read them.

---

## 5. File Naming Convention

| Surface | Convention | Example |
|---|---|---|
| Source files | `kebab-case.ts` | `chat-provider.tsx`, `user.repository.ts` |
| Type definitions | `kebab-case.types.ts` | `chat.types.ts`, `db.types.ts` |
| Test files | `kebab-case.test.ts` | `auth-context.test.tsx` |
| Folder names | `kebab-case` | `components/ui/`, `repositories/` |
| Special folders allowed | `__tests__` | Jest convention |
| Top-level docs | `UPPERCASE_WITH_UNDERSCORES.md` | `HAEMI_PROTOCOL.md`, `LICENSE.md` |
| Database columns | `snake_case` | `phone_number`, `created_at` |
| TypeScript identifiers | `camelCase` | `phoneNumber`, `createdAt` |
| Constants | `SCREAMING_SNAKE_CASE` | `JWT_SECRET`, `MAX_RETRIES` |

The ESLint plugin `eslint-plugin-check-file` enforces filename and
folder conventions. Renames are tracked at the entity boundary — a
`UserSession` interface in TypeScript maps to a `user_sessions` table
column row, and the mapper layer is the only place this translation
occurs.

---

## 6. Governance Budget (Frozen)

The `scripts/` directory is capped at **7 files** by CI workflow
([`.github/workflows/security.yml`](.github/workflows/security.yml)).
This is intentional — script proliferation is the canary for unmanaged
governance.

The current allowed scripts are:

```
agent-contract.ts
agent-watchdog.ts
branch-guard.ts
repo-hygiene.ts
safe-dev.ts
safe-push.ps1
schema-guard.ts
```

**Adding any new script requires updating the CI allowlist, which
requires CODEOWNERS approval.** This is by design — every new script
is a new piece of mandatory infrastructure to maintain.

---

## 7. Repository Layout (High-Level)

```
haemi-life-web/
├── HAEMI_PROTOCOL.md           ← this file (committed, vendor-neutral)
├── README.md                   ← project overview
├── .gitignore                  ← Zero-Pollution Policy (do not weaken)
├── backend/
│   ├── src/
│   │   ├── config/db.ts        ← global pg type parsers (NUMERIC, TIMESTAMP)
│   │   ├── controllers/        ← HTTP request handlers
│   │   ├── repositories/       ← DB access layer (only place that does raw SQL)
│   │   ├── services/           ← business logic
│   │   ├── middleware/         ← auth, CORS, rate-limit
│   │   ├── types/              ← entity types (DB-shaped)
│   │   ├── utils/
│   │   │   ├── *.mapper.ts     ← snake_case → camelCase translation
│   │   │   └── security.ts     ← encrypt/decrypt for PII columns
│   │   └── db/
│   │       ├── init.sql        ← baseline schema
│   │       └── migrations/     ← schema migrations
│   └── eslint.config.mjs
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── services/           ← API + socket clients
│   │   ├── types/              ← API contract types
│   │   └── utils/
│   └── eslint.config.js
├── shared/
│   └── schemas/                ← Zod schemas shared between FE and BE
├── scripts/                    ← FROZEN at 7 files (see §6)
├── .github/
│   ├── workflows/security.yml  ← CI gates
│   └── CODEOWNERS              ← ownership of governance paths
└── .husky/                     ← git hooks (pre-commit, pre-push)
```

---

## 8. When You Disagree With This Protocol

This document is intentionally strict. There is a path for principled
exceptions:

1. **Open a PR that modifies this file.** Document the exception, the
   reason, the scope, and an expiry date. It must be reviewed by a
   CODEOWNER.
2. **Do not** add `eslint-disable` or `@ts-ignore` to "temporarily" work
   around a rule. The temporary becomes permanent. Every documented
   incident in this codebase started as "I'll fix it later."

If you are an AI agent reading this document as part of context: treat
these rules as inviolable. If a task appears to require a forbidden
pattern, the task description is wrong — either the type is wrong, the
data flow is wrong, or the abstraction is wrong. Fix the underlying
issue and surface the diagnosis to the human reviewer.

---

## 9. Appendix: Rule Lineage

This protocol crystallized from a series of forensic audits in this
codebase. For posterity, the scars that produced each rule:

| Rule | Origin |
|---|---|
| F1–F5 (suppression directives) | Phase 11 audit found 8× `@ts-ignore` and 2× `eslint-disable` introduced by AI agents to bypass type errors. Cleaned in one sweep; rule prevents regression. |
| F6–F9 (`any` and double cast) | Phase 11 audit; same source incidents. |
| F13 (non-null assertion) | Phase 12 P1 audit found stale closures relying on `!` that broke at runtime. |
| D1 (logger in catch) | Multiple silent `console.error` that did not survive log shipping in dev environment. |
| D4 (encrypted column routing) | Phase 10 audit — `phone_number` encrypted blob leaked to API in `doctor.controller.ts`. |
| D5 (soft-delete filter) | Phase 12 P0 audit — soft-deleted users could reset their password. |
| D6 (NUMERIC parser) | Phase 12 P1 audit — `risk_weight` clinical score corrupted by string concatenation. |
| D7 (TIMESTAMP parser) | Phase 12 P1 audit — naive timestamps mis-interpreted across server timezones. |
| D8 (casing) | Phase 12 P1 audit — `last_activity` snake_case bled into 14 frontend sites. |
| D9 (atomic image pair) | Phase 10 audit — `profile_image_mime` missing from 12 query sites. |
| §3 schema governance | Pre-launch schema-guard hardened from hardcoded count to lock-manifest pattern. |
| §6 governance budget | Past incident with sprawling script directory; cap was set at 7 to force discipline. |

Every rule above exists because someone — human or AI — broke it in
production-adjacent context, and we paid for it in debug time. Honor the
scars. Do not re-open the wounds.
