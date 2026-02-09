---
trigger: always_on
---

1. Every record in the system MUST belong to exactly ONE organization.

2. Every table MUST contain:
   organization_id

   Except:
   - System tables (countries, currencies, global config)

3. All queries MUST be scoped by organization_id.

4. It is FORBIDDEN to:
   - Read data from another organization
   - Write data into another organization
   - Update data without organization filter
   - Delete data without organization filter

5. organization_id must be derived from the authenticated user context,
   NOT from client request body.

6. APIs must automatically inject organization_id server-side.

7. If any endpoint does not enforce organization isolation,
   it is INVALID.

8. Cross-organization joins are FORBIDDEN.

9. Database level:
   - Foreign keys must include organization_id where applicable.
   - Composite unique keys should include organization_id.

10. All tenant isolation rules must be tested.
