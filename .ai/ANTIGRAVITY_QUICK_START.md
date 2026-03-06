# ⚡ ANTIGRAVITY QUICK START

**Copy/Paste this at the start of EVERY Antigravity session**

---

## 📋 STARTUP MESSAGE (Copy This)

```
🔒 TSFSYSTEM ARCHITECTURE - READ FIRST

📖 REQUIRED READING (in order):
1. .ai/ANTIGRAVITY_CONSTRAINTS.md (Architecture rules - CRITICAL)
2. .ai/AGENT_RULES.md (Behavior rules)
3. .ai/CONTEXT.md (Project status)

🚫 NEVER DO (Zero tolerance):
❌ Hardcode values (TAX_RATE = 0.15) → Use get_config()
❌ Direct cross-module imports → Use events
❌ Models without TenantOwnedModel → Always inherit
❌ Skip AuditLogMixin → Always include
❌ Direct module calls → Use emit_event()
❌ Bypass RBAC → Check permissions

✅ ALWAYS DO:
• Models: class X(AuditLogMixin, TenantOwnedModel)
• Config: get_config('key', default=value)
• Events: emit_event('module.event', {...})
• RBAC: @require_permission('module.action')

📋 WORKFLOW:
1. Ask clarifying questions FIRST
2. Read architecture constraints
3. Propose 2-3 options
4. Create detailed plan
5. VALIDATE with: python .ai/scripts/validate_architecture.py <file>
6. Get approval
7. Handoff to Claude Code (if needed)

Confirm you've read all files and will follow architecture.
```

---

## 🧪 QUICK TEST (After Confirmation)

Test with this:
```
Task: "Add a status field to Invoice model"
```

**✅ CORRECT Response**:
```
Antigravity: "Let me clarify first:

1. Status values: draft/sent/paid/void? Custom list?
2. Configurable: Per tenant or global?
3. Workflow: Any status transition rules?
4. Permissions: Who can change status?

After you answer, I'll validate the approach:
• Inherit: AuditLogMixin + TenantOwnedModel ✅
• Status choices: Use get_config() ✅
• Transitions: Policy-based rules ✅
• Events: Emit 'invoice.status_changed' ✅

Then I'll propose 2-3 implementation options."
```

**❌ WRONG Response**:
```
Antigravity: "I'll add:
class Invoice(models.Model):  ← Missing TenantOwnedModel
    STATUS_CHOICES = [(...)]  ← Hardcoded
```

If wrong, say:
```
STOP. Read .ai/ANTIGRAVITY_CONSTRAINTS.md
Violations:
1. Missing TenantOwnedModel inheritance
2. Hardcoded STATUS_CHOICES

Fix and retry.
```

---

## 🛡️ VALIDATION COMMANDS

**Before finalizing ANY code**:
```bash
# Validate architecture
python .ai/scripts/validate_architecture.py apps/module/file.py

# Check for hardcoding
grep -n "= '[^']*'" apps/module/file.py | grep -v "get_config"

# Check cross-module imports
grep -n "from apps\." apps/module/file.py
```

---

## 🔄 HANDOFF TO CLAUDE CODE

When your plan is ready:
```markdown
## HANDOFF TO CLAUDE CODE

Task: [Name]
Status: Architecture validated ✅

Architecture Checklist:
✅ TenantOwnedModel + AuditLogMixin
✅ get_config() for all values
✅ Events for cross-module
✅ Contracts defined
✅ RBAC permissions
✅ Module boundaries respected

Validation:
```bash
python .ai/scripts/validate_architecture.py <file>
```

Plan: .ai/plans/[task].md
```

---

## 🚨 COMMON MISTAKES TO AVOID

| Mistake | Why Wrong | Fix |
|---------|-----------|-----|
| `class Invoice(models.Model):` | No tenant isolation | `class Invoice(AuditLogMixin, TenantOwnedModel):` |
| `TAX_RATE = 0.15` | Hardcoded | `get_config('tax_rate', 0.15)` |
| `from apps.inventory.models import Product` | Cross-module | `emit_event('needs_product', {...})` |
| `def view(request):` no decorator | Missing RBAC | `@require_permission('x.y')` |

---

## ✅ CHECKLIST (Before Completing Task)

```
☐ Read .ai/ANTIGRAVITY_CONSTRAINTS.md
☐ Read .ai/AGENT_RULES.md
☐ Asked clarifying questions
☐ Proposed 2-3 options
☐ Models inherit TenantOwnedModel + AuditLogMixin
☐ No hardcoded values (all use get_config)
☐ Cross-module via events (no direct imports)
☐ Contracts defined for events
☐ RBAC permissions specified
☐ Ran validation script (passed)
☐ Created handoff plan
```

**IF ANY UNCHECKED → NOT READY**

---

**Quick Links**:
- Full constraints: [.ai/ANTIGRAVITY_CONSTRAINTS.md](.ai/ANTIGRAVITY_CONSTRAINTS.md)
- Behavior rules: [.ai/AGENT_RULES.md](.ai/AGENT_RULES.md)
- Validation script: [.ai/scripts/validate_architecture.py](.ai/scripts/validate_architecture.py)
