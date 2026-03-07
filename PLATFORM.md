# Enterprise AI Development Platform Principles

This document outlines the core principles and workflows for the Haemi Life AI-assisted engineering platform.

## 1. Core Principles

### Stability over Automation
Tooling must never compromise repository stability. Automated actions should be readable, reversible, and predictable.

### Deterministic Builds
The system enforces `npm ci` and lockfile integrity. A build that passes in CI today must be reproducible tomorrow.

### Fast Developer Feedback
CI pipelines are optimized for speed (< 5 minutes) and parallel execution. Local hooks are minimal to preserve developer productivity.

## 2. Sandbox Development Model

All development occurs in isolated sandboxes.

1.  **Branch Creation**: `npm run sandbox -- <task-name>`
2.  **Implementation**: Develop features/fixes in the sandbox.
3.  **Validation**: Pushes trigger independent CI jobs:
    -   `lint`: Code style enforcement.
    -   `type-check`: TypeScript safety.
    -   `build`: Production build verification.
    -   `test`: Integration and Unit tests.
    -   `ui-regression`: Visual baseline checking (0.1% threshold).
4.  **Reporting**: AI Architecture and Product Intelligence reports are generated in `.ai-system/reports/`.
5.  **Merge**: Pull Requests are merged automatically upon success.

## 3. Intelligence Layers

### AI Architecture Analyzer
- AST-based metrics for complexity and coupling.
- Reports structural issues without automatic modification.

### AI Product Intelligence
- UX and Design System drift detection.
- Provides suggestions for improvement.

---
*Designed for Botswana's National Digital Healthcare Platform.*
