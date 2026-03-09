## 🔄 HANDOFF TO CLAUDE CODE

**Task**: Redesign Roles & Permissions UI based on the "huge model" requirements.
**Status**: Pending User Approval

### Selected Architecture: The Split-Pane Role Builder

### Architecture Validation Checklist:
- [x] All config values use get_config()
- [x] RBAC permissions specified (UI reflects backend actual permissions from `PermissionViewSet`)
- [x] Module boundaries respected (Permission grouping by module split by `.`)
- [x] No hardcoded values (UI colors use CSS variables from TSFSYSTEM Global Theme Engine)

### Files to Create/Modify:
1. `erp_backend/erp/views_users.py`:
   - Need to ensure `permissions-matrix` endpoint or a new `roles-builder` endpoint fetches and structures all dynamically registered system `Permission` objects across all modules, not just `SALES_PERMISSION_CODES`. Or utilize `RoleViewSet` and `PermissionViewSet`.
   - Update `RoleViewSet` with nested serializers to allow creating/updating of a `Role` and mapping multiple `Permission` items to it in one API call.
2. `src/app/(privileged)/settings/roles/page.tsx`:
   - Redesign as a shell for the new UI component `RolesBuilderClient`.
3. `src/app/(privileged)/settings/roles/RolesBuilderClient.tsx` (New):
   - Left Sidebar: List of `Role`s. Add "+" button for creating new roles.
   - Right Main View: When a Role is selected, show tabs for `Core`, `Inventory`, `Finance`, `POS`, `CRM`, etc. (grouped dynamically based on permission prefix).
   - Each tab contains checklists (e.g. `inventory.view_products`, `finance.void_invoice`).
4. `src/app/actions/settings/roles.ts`:
   - Integrate with the core v2 `erpFetch` action layer to match the new dynamic `RoleViewSet` API signatures.

### Implementation Notes:
- UI must follow the V2 Aesthetics ("Dajingo Pro") standard: glassmorphism, `--app-surface/60`, no hardcoded colors, smooth macro-animations between role selections.
- The UI handles the complexity by pushing permissions into nested categories.

### Validation Command:
```bash
python .ai/scripts/validate_architecture.py apps/core/views.py
```
