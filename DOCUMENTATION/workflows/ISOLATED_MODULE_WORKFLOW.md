# Workflow: Isolated Module Development

Goal: Create a new business feature without affecting the core system or other modules.
Actors: Developers, SaaS Administrators.
Steps:
1. **Initialization**: Create a new directory in `src/modules/` (e.g., `src/modules/my-new-feature`).
2. **Development**:
   - Create an `index.tsx` file as the main export.
   - Use `erpFetch` for backend communication to maintain consistency.
   - Run `npm run dev` to see changes.
3. **Integration**:
   - Access the module via the dynamic route: `/saas/apps/my-new-feature`.
   - Ensure the module respects organization context provided by the kernel.
4. **Registry**: Add the module entry to the `Module` table via the SaaS Admin dashboard.

Data Movement:
- Logic and UI components are loaded dynamically from `src/modules/`.
- Tenant status is checked against `OrganizationModule`.

Affected Tables:
- `Module` (Catalog)
- `OrganizationModule` (Entitlements)
