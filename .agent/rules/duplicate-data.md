---
trigger: always_on
---

1. Before creating any new database field or column,
   you MUST check if the same business value already exists.

2. If a field already represents that value:
   - You MUST reuse it.
   - You MUST reference it using a foreign key or relation.
   - You MUST NOT create a new column with the same meaning.

3. Creating two fields with the same business meaning is FORBIDDEN.

4. If the value belongs to another table:
   - Store only the foreign key.
   - Read the value from the authoritative table.

5. Every new field must declare:
   - Business meaning
   - Authoritative table
   - Authoritative column

6. If authoritative source is not defined,
   the field is NOT allowed to be created.
