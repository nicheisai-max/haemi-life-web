# Haemi Life — Database Migration & Governance Policy

This policy governs all changes to the **digital_health_pharmacy_hub** database schema. Adherence to this policy is mandatory for all engineering team members.

## 1. Governance Principles

- **Zero Manual SQL:** Manual `ALTER TABLE`, `DROP`, or `CREATE` commands in production or staging environments are strictly prohibited.
- **Code-Driven Schema:** All schema changes must be implemented via code-based migrations (Knex.js).
- **Single Source of Truth:** The `backend/db/migrations` directory is the only authoritative source for database schema structure.

## 2. Migration Requirements

- **Non-Destructive by Default:** Migrations should favor `ADD COLUMN` or `ADD INDEX` over destructive operations where possible.
- **Reversibility:** Every migration must implement a `down` function that accurately reverts the changes made in the `up` function.
- **Data Integrity:** Any migration that transforms existing data must be tested against a non-production dataset for zero data loss.
- **Performance:** Adding indexes to large tables (>1M rows) must be coordinated with DevOps to minimize lock-time.

## 3. Workflow for Database Changes

1. **Local Development:** Create a new migration using `npx knex migrate:make migration_name --knexfile db/knexfile.js`.
2. **Implementation:** Write the `up` and `down` logic using Knex Schema Builder.
3. **Execution:** Apply the changes locally using `npx knex migrate:latest`.
4. **Peer Review:** Include the migration file in the Pull Request.
5. **Deployment:** The CI/CD pipeline executes `migrate:latest` during the deployment phase.

---

*This policy is designed to ensure production stability, version traceability, and operational safety for the Haemi Life healthcare platform.*
