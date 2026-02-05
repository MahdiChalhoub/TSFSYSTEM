---
description: cleanup-project
---

# Project Cleanup Workflow

This workflow is used to maintain a clean project structure by archiving unnecessary, deprecated, or replaced files.

// turbo-all

1. **Identify Target Files**
   - Identify files or directories that are no longer needed.
   - Verify that these files are not currently imported or referenced in active code.

2. **Archive Files**
   - Move the identified files to the `/ARCHIVE` directory.
   - **CRITICAL**: Preserve the original folder structure inside `/ARCHIVE`.
   - Example: `src/old/utils.ts` -> `ARCHIVE/src/old/utils.ts`.

3. **Update References**
   - Remove any dead imports or references to the archived files.
   - Update documentation if necessary.

4. **Verify Integrity**
   - Run the build process: `npm run build` (Next.js) and `python manage.py check` (Django).
   - Ensure no regressions were introduced.

5. **Commit and Push**
   - Follow the versioning and documentation rules for the cleanup operation.
