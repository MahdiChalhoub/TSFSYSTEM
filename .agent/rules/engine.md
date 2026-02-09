---
trigger: always_on
---

1. ONLY ONE SERVICE MAY ACCESS THE DATABASE DIRECTLY.

2. Django is the SINGLE SOURCE OF TRUTH for all database reads and writes.

3. Next.js MUST NOT connect to PostgreSQL directly.

4. Prisma MUST NOT be used to read or write production database data.

5. All data access must go through Django APIs.

6. Next.js is UI + client logic ONLY.

7. All business logic and transactions must live in Django.

If any feature proposal violates this rule, it is INVALID.
8. All financial operations must be executed inside database transactions in Django.

9. No table may be modified without a Django migration.

10. No schema change may be performed from Prisma.

11. API contracts must be documented.

12. Every endpoint must specify:
    - Input
    - Output
    - Tables touched
