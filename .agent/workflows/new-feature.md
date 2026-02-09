---
description: Complete checklist for developing new features in Dajingo platform
---

# New Feature Development Workflow

// turbo-all

Follow this checklist when building any new feature, page, or module.

---

## Phase 1: Backend (Django)

### 1.1 Models
```bash
# Create/update models in:
erp_backend/apps/<module>/models.py
```
- [ ] Define model with proper fields
- [ ] Add `organization` ForeignKey for multi-tenancy
- [ ] Add `created_at`, `updated_at` timestamps
- [ ] Add `created_by`, `updated_by` if needed

### 1.2 Migrations
```bash
python manage.py makemigrations <module>
python manage.py migrate <module>
```

### 1.3 Service Layer (if complex logic needed)
```bash
# Create service in:
erp_backend/apps/<module>/services.py
```

### 1.4 Views & Serializers
```bash
# Add to:
erp_backend/apps/<module>/views.py
```
- [ ] Create serializer with all fields
- [ ] Create ViewSet with:
  - `AuditLogMixin` (for audit logging)
  - `ConnectorAwareMixin` (for request buffering)
  - `permission_classes` with module-specific permissions

Example ViewSet pattern:
```python
class MyViewSet(AuditLogMixin, ConnectorAwareMixin, viewsets.ModelViewSet):
    queryset = MyModel.objects.all()
    serializer_class = MySerializer
    permission_classes = [IsAuthenticated, CanViewMyModule]
    
    def get_queryset(self):
        return super().get_queryset().filter(
            organization_id=self.request.headers.get('X-Organization-ID')
        )
```

### 1.5 URLs
```bash
# Register in:
erp_backend/apps/<module>/urls.py
erp_backend/erp/urls.py  # Include module URLs
```

### 1.6 Permissions
- [ ] Define permission classes in views.py or separate permissions.py
- [ ] Use pattern: `Can<Action><Module>` (e.g., `CanViewInventory`, `CanEditFinance`)

### 1.7 Module Manifest (if new module)
```bash
# Create:
erp_backend/apps/<module>/manifest.json
```
```json
{
  "name": "Module Name",
  "code": "module_code",
  "version": "1.0.0",
  "category": "engine",
  "permissions": ["module.view", "module.edit", "module.admin"]
}
```

### 1.8 App Registration (if new module)
```bash
# Add to erp_backend/erp/settings.py INSTALLED_APPS:
'apps.<module>',
```

---

## Phase 2: Frontend (Next.js)

### 2.1 Server Actions
```bash
# Create:
src/app/actions/<module>.ts
```
- [ ] Import `erpFetch` from `@/lib/erp-api`
- [ ] Create CRUD functions: `get<Entity>`, `create<Entity>`, `update<Entity>`, `delete<Entity>`

### 2.2 Page Components
```bash
# Create pages in:
src/app/(privileged)/saas/<module>/page.tsx
src/app/(privileged)/saas/<module>/[id]/page.tsx  # Detail view
src/app/(privileged)/saas/<module>/create/page.tsx  # Create form
```

### 2.3 UI Standards
- [ ] Use Card, Button, Badge from `@/components/ui`
- [ ] Rich aesthetics: gradients, shadows, animations
- [ ] Responsive grid layout
- [ ] Loading states with spinners
- [ ] Error handling with toast notifications

### 2.4 Sidebar Navigation
```bash
# Update:
src/components/admin/Sidebar.tsx
```
- [ ] Add menu item under appropriate section
- [ ] Use correct icon from lucide-react

---

## Phase 3: Platform Integration

### 3.1 MCP Server (AI Integration)
```bash
# Update:
erp_backend/apps/mcp/server.py
```
- [ ] Add new Tool definition in `get_tools()`
- [ ] Add handler in `handle_tool_call()`

### 3.2 Connector Module (if sensitive operations)
- [ ] Ensure `ConnectorAwareMixin` is on ViewSet
- [ ] Add connector policy if write buffering needed

---

## Phase 4: Documentation

### 4.1 Module Documentation
```bash
# Create:
DOCUMENTATION/<module>.md
```
Include:
- Goal of the module
- Data READ from (tables)
- Data SAVED to (tables)
- User-interacted variables
- Step-by-step workflow

---

## Phase 5: Version Control

### 5.1 Git Commands
```bash
git status
git add .
git commit -m "[vX.X.X-bXXX] <MODULE>: <SHORT DESCRIPTION>"
git push origin engine-stable
```

Versioning:
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes
- BUILD: Incremental builds

---

## Quick Reference

| Component | Location |
|-----------|----------|
| Models | `erp_backend/apps/<module>/models.py` |
| Views | `erp_backend/apps/<module>/views.py` |
| URLs | `erp_backend/apps/<module>/urls.py` |
| Manifest | `erp_backend/apps/<module>/manifest.json` |
| Actions | `src/app/actions/<module>.ts` |
| Pages | `src/app/(privileged)/saas/<module>/` |
| Sidebar | `src/components/admin/Sidebar.tsx` |
| MCP Tools | `erp_backend/apps/mcp/server.py` |
| Docs | `DOCUMENTATION/<module>.md` |
