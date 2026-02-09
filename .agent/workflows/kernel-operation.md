---
description: kernel operation
---

When I am asked to modify core system logic, the shell, or base infrastructure:
1. **Rule**: ❌ No feature design without architectural classification.
2. Identify if the change is structural (Base Git) or logical (Core Platform Module).
3. **Rule**: ❌ No Kernel logic inside Engine modules.
4. For structural changes (Next.js config, new NPM libraries):
   - Modify the file in the base repository.
   - Note that this requires a full deployment.
5. For logical changes (Menu items, global theme, core backend models):
   - Modify files in `erp_backend/erp/modules/coreplatform`.
   - Update the version in `coreplatform/manifest.json`.
   - **Rule**: ❌ No versionless updates.
6. **Rule**: ❌ No silent global changes. Document all platform-wide modifications.
7. Follow the /engine workflow steps for packaging (even though it's the Kernel module).
8. Update the `Kernel Update Strategy` documentation if necessary.
9. Generate git commit instructions with semantic versioning.
