---
description: single-source
---

1. Every business value must have ONE and ONLY ONE authoritative source.

2. No duplicated business meaning across tables.
   (If two fields represent the same concept → it is INVALID.)

3. Each value must declare:
   - Which table owns it
   - Which column is authoritative
   - Which modules may read it
   - Which modules may write it

4. Other tables may REFERENCE the value,
   but must NOT redefine or duplicate it.

5. If a value already exists somewhere:
   - Reuse it
   - Do NOT create another column for the same meaning.

6. If a proposal introduces duplicate meaning → REJECT IT.
