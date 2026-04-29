# 🛡️ HAEMI LIFE: INSTITUTIONAL DEMO CREDENTIALS

This document serves as the **Single Source of Truth (SSoT)** for all institutional demo accounts used in the Haemi Life development and testing environments.

## 🔐 Master Credentials

The following accounts are seeded by `backend/src/scripts/seed.ts` and used in `e2e/tests/login.spec.ts`.

| Role | Email Address | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@haemilife.com` | `HaemiLifeDemo@2026` |
| **Doctor** | `doctor@haemilife.com` | `HaemiLifeDemo@2026` |
| **Patient** | `patient@haemilife.com` | `HaemiLifeDemo@2026` |
| **Pharmacist** | `pharmacist@haemilife.com` | `HaemiLifeDemo@2026` |

## ⚠️ Stability Policy

1. **Deterministic IDs**: These accounts use fixed UUIDs defined in `backend/src/config/identities.config.ts`.
2. **Password Policy**: The password `HaemiLifeDemo@2026` is the uniform institutional standard for all official demo sessions.
3. **No Drift**: Any changes to these credentials must be updated in this document, the seed script, and the identity configuration simultaneously.

---
*Enterprise Healthcare Compliance Standard - Haemi Life.*
