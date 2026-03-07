# AI-First SaaS Engineering Platform

This repository is an AI-assisted SaaS engineering platform governed by strict stability, determinism, and speed principles.

## 1. Core Principles

### Stability over Automation
Tooling must never compromise repository stability. The platform focuses on self-healing CI and deterministic state management.

### Deterministic Builds
All builds use `npm ci` and lockfile integrity. Parallel execution and smart caching ensure validation takes < 5 minutes.

### Human Command Gate
AI remains idle until explicitly instructed to proceed via the command: **"Now push the code"**.

## 2. Platform Architecture

### Self-Healing CI
When CI fails, the system automatically reads job logs, identifies root causes, and attempts fixes in the sandbox branch.

### Design Token Sovereignty
All UI styling is locked to centralized tokens in `index.css`. The Product Intelligence Engine monitors and reports "Design System Drift".

### Visual Integrity Guard
Playwright visual regressions run with a **0.1%** threshold. Dynamic regions (timestamps, counts) are masked to ensure zero false positives.

## 3. Workflow (Sandbox Model)

1.  **Orchestration**: `npm run orchestrate -- <task>`
2.  **Safety Guard**: Validates workspace integrity (clean tree, node version).
3.  **Sandbox**: Operations run on isolated `ai/sandbox-*` branches.
4.  **Enforcement**: After task completion, the platform:
    -   Merges the PR (if green).
    -   Nukes all local and remote sandbox branches.
    -   Hard-resets the local environment to `main`.

---
*Enterprise Healthcare Compliance Standard - Haemi Life.*
