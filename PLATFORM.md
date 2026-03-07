## 4. Strict Repository Governance (SYSTEM MODE)

### Data Safety (Non-Negotiable)
- **Forbidden**: Modifying or deleting existing UI layout, Tailwind styles, hover/active states, or React component logic without explicit instruction.
- **Database**: Zero destructive operations (`DROP`, `TRUNCATE`, `DELETE` without `WHERE`).

### Git Safety & Workflow
- **No Direct Push**: AI never pushes directly to `main`.
- **No History Rewriting**: `git push --force`, `git reset --hard`, `git rebase -i`, and `git commit --amend` are strictly forbidden.
- **Sandbox Only**: All work happens in `ai/sandbox-<task-name>`.

### Human Merge Authority
- **No Auto-Merge**: AI never merges pull requests. 
- **Authority**: Merge authority belongs exclusively to humans via GitHub's branch protection system.
- **CI Dependency**: PRs are created only after passing 100% of local validation (`npm ci`, `npm run build`, `npm run lint`, `npm test`).

### CI Failure Policy
- If any CI job (lint, type-check, build, unit, integration, Playwright) fails:
    - AI stops immediately.
    - AI fixes the failure in the same sandbox branch.
    - AI re-runs CI until 100% success.

---
*Enterprise Healthcare Compliance Standard - Haemi Life.*
