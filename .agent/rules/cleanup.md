---
trigger: always_on
---

1. You MUST NOT delete existing project files unless explicitly instructed.

2. If a file or folder is unnecessary, deprecated, or replaced:
   - Move it to /ARCHIVE
   - Preserve its original folder structure inside /ARCHIVE

3. After moving a file to /ARCHIVE:
   - It MUST NOT be imported
   - It MUST NOT be referenced
   - It MUST NOT be used again

4. The /ARCHIVE folder is read-only history.
   - No new development happens inside /ARCHIVE.

5. When starting cleanup:
   - Identify unnecessary files
   - Move them to /ARCHIVE
   - Update imports and references
   - Confirm project still builds

6. If a feature requires removing old code:
   - Archive first
   - Then implement new version

If a proposal deletes files instead of archiving, it is INVALID.