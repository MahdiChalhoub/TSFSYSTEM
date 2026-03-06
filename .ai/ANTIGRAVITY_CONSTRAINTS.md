# 🔒 ANTIGRAVITY CONSTRAINTS & ARCHITECTURE ENFORCEMENT

**Purpose**: Prevent Antigravity from deviating from TSFSYSTEM architecture
**Version**: 1.0.0
**Date**: 2026-03-04
**Priority**: CRITICAL - Must be included in every Antigravity session

---

## ⚠️ THE PROBLEM

**Issue**: Antigravity has access to Claude Code capabilities (file operations, code generation) and might:
- ❌ Bypass our Kernel OS architecture
- ❌ Create direct cross-module imports
- ❌ Hardcode values
- ❌ Ignore event-driven patterns
- ❌ Use standard solutions instead of our custom patterns
- ❌ Break tenant isolation

**Solution**: Strict constraints + architecture validation checklist

---

## 🚫 ABSOLUTE PROHIBITIONS (Non-Negotiable)

### **1. NEVER Bypass Kernel OS**

```python
# ❌ ABSOLUTELY FORBIDDEN
from apps.inventory.models import Product
from apps.finance.models import Invoice

# Direct access across modules
product = Product.objects.get(id=123)
```

```python
# ✅ REQUIRED: Use Kernel OS
from kernel.tenancy.models import TenantOwnedModel
from kernel.events import emit_event

# Event-driven communication
emit_event('sales.product_sold', {'product_id': 123, 'quantity': 10})
```

---

### **2. NEVER Hardcode Values**

```python
# ❌ ABSOLUTELY FORBIDDEN
TAX_RATE = 0.15
CURRENCY = 'USD'
MAX_DISCOUNT = 20
ADMIN_EMAIL = 'admin@example.com'
```

```python
# ✅ REQUIRED: Use Config System
from kernel.config import get_config

tax_rate = get_config('default_tax_rate', default=0.15)
currency = get_config('default_currency', default='USD')
max_discount = get_config('max_discount_percent', default=20)
admin_email = get_config('admin_email', default='admin@example.com')
```

---

### **3. NEVER Skip Tenant Isolation**

```python
# ❌ ABSOLUTELY FORBIDDEN
class Invoice(models.Model):  # Plain Django model
    customer = models.ForeignKey(Customer)
```

```python
# ✅ REQUIRED: Inherit from TenantOwnedModel
from kernel.tenancy.models import TenantOwnedModel

class Invoice(TenantOwnedModel):  # Automatic tenant isolation
    customer = models.ForeignKey(Customer)
```

---

### **4. NEVER Use Direct Cross-Module Calls**

```python
# ❌ ABSOLUTELY FORBIDDEN
from apps.inventory.services import InventoryService

def complete_sale(sale):
    InventoryService.reduce_stock(product_id, quantity)  # Direct call
```

```python
# ✅ REQUIRED: Event-Driven Communication
from kernel.events import emit_event

def complete_sale(sale):
    emit_event('sales.order_completed', {
        'order_id': sale.id,
        'items': sale.items,
        'tenant_id': sale.tenant_id
    })
    # Inventory module listens and reduces stock
```

---

### **5. NEVER Create Models Without Audit**

```python
# ❌ ABSOLUTELY FORBIDDEN
class Invoice(TenantOwnedModel):
    # No audit logging
    pass
```

```python
# ✅ REQUIRED: Include Audit Mixin
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin

class Invoice(AuditLogMixin, TenantOwnedModel):
    # Automatic audit logging on all changes
    pass
```

---

### **6. NEVER Ignore Module Boundaries**

```python
# ❌ ABSOLUTELY FORBIDDEN
# In apps/finance/views.py
from apps.crm.models import Contact  # Cross-module import
from apps.inventory.models import Product
```

```python
# ✅ REQUIRED: Use Contracts + Events
# In apps/finance/views.py
from kernel.events import emit_event
from kernel.contracts import get_contract

# Get contract definition
contact_contract = get_contract('crm.contact_data')

# Request data via event
emit_event('finance.needs_contact_data', {'contact_id': 123})
```

---

## 📋 MANDATORY ARCHITECTURE CHECKLIST

Before Antigravity creates/modifies ANY code, verify:

```
☐ Does this model inherit from TenantOwnedModel?
☐ Does this model include AuditLogMixin?
☐ Are all configurable values using get_config()?
☐ Are cross-module communications using events?
☐ Are permissions checked via RBAC system?
☐ Are contracts defined for data structures?
☐ Is this following our module boundaries?
☐ Is this using existing kernel patterns?
```

**IF ANY ☐ IS UNCHECKED → STOP AND FIX**

---

## 🏗️ ARCHITECTURE PATTERNS (Must Follow)

### **Pattern 1: Model Structure**

```python
# REQUIRED TEMPLATE for all models
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.config import get_config
from django.db import models

class YourModel(AuditLogMixin, TenantOwnedModel):
    """
    [Description]

    Tenant Isolation: ✅ Automatic via TenantOwnedModel
    Audit Logging: ✅ Automatic via AuditLogMixin
    """

    # Fields here
    name = models.CharField(max_length=200)

    # Configuration-driven defaults
    @classmethod
    def get_default_settings(cls):
        return get_config('yourmodel_defaults', default={})

    class Meta:
        db_table = 'module_yourmodel'  # Namespaced table name
        indexes = [
            models.Index(fields=['tenant', 'created_at']),
        ]
```

---

### **Pattern 2: Cross-Module Communication**

```python
# REQUIRED TEMPLATE for cross-module interaction

# Step 1: Define contract (in producer module)
from kernel.contracts import define_contract

define_contract('inventory.stock_changed', {
    'product_id': {'type': 'integer', 'required': True},
    'old_quantity': {'type': 'integer', 'required': True},
    'new_quantity': {'type': 'integer', 'required': True},
    'reason': {'type': 'string', 'required': True},
    'tenant_id': {'type': 'integer', 'required': True}
})

# Step 2: Emit event (producer)
from kernel.events import emit_event

emit_event('inventory.stock_changed', {
    'product_id': product.id,
    'old_quantity': old_qty,
    'new_quantity': new_qty,
    'reason': 'sale_completed',
    'tenant_id': request.tenant.id
})

# Step 3: Listen to event (consumer)
from kernel.events import event_handler
from kernel.contracts import enforce_contract

@event_handler('inventory.stock_changed')
@enforce_contract('inventory.stock_changed')
def handle_stock_changed(payload):
    # React to stock change
    notify_low_stock_alert(payload)
```

---

### **Pattern 3: Configuration-Driven Features**

```python
# REQUIRED TEMPLATE for configurable behavior
from kernel.config import get_config, is_feature_enabled

def process_invoice(invoice, user):
    # Feature flags
    if is_feature_enabled('auto_invoice_send', user=user):
        send_invoice_email(invoice)

    # Config-driven values
    tax_rate = get_config('tax_rate', default=0.15)
    currency = get_config('default_currency', default='USD')
    payment_terms = get_config('default_payment_terms', default='Net 30')

    # Apply configuration
    invoice.tax_rate = tax_rate
    invoice.currency = currency
    invoice.payment_terms = payment_terms

    # Policy-based validation
    from kernel.rbac.policies import PolicyEngine
    if not PolicyEngine.check('invoice.can_create', user, invoice):
        raise PermissionDenied("Cannot create invoice")

    invoice.save()
```

---

### **Pattern 4: Permission Checking**

```python
# REQUIRED TEMPLATE for permission checks
from kernel.rbac.decorators import require_permission
from kernel.rbac.policies import PolicyEngine

# Method 1: Decorator (for views)
@require_permission('finance.create_invoice')
def create_invoice_view(request):
    # Your code
    pass

# Method 2: Manual check (for services)
def create_invoice(user, data):
    if not user.has_permission('finance.create_invoice'):
        raise PermissionDenied("Missing permission: finance.create_invoice")

    # Your code

# Method 3: Policy-based (complex rules)
@PolicyEngine.register('invoice.can_void')
def can_void_invoice(user, invoice):
    rules = get_config('invoice_void_rules', default={})
    # Apply rules
    return check_rules(user, invoice, rules)

def void_invoice(user, invoice):
    if not PolicyEngine.check('invoice.can_void', user, invoice):
        raise PermissionDenied("Cannot void this invoice")

    # Your code
```

---

## 🛡️ VALIDATION SCRIPT

Use this to validate Antigravity's output:

```python
#!/usr/bin/env python3
"""
Validate code against TSFSYSTEM architecture
Usage: python validate_architecture.py <file_path>
"""

import ast
import sys
import re

class ArchitectureValidator:
    def __init__(self, file_path):
        self.file_path = file_path
        with open(file_path, 'r') as f:
            self.content = f.read()
        self.tree = ast.parse(self.content)
        self.errors = []

    def validate(self):
        self.check_model_inheritance()
        self.check_hardcoded_values()
        self.check_cross_module_imports()
        self.check_tenant_isolation()
        self.check_config_usage()
        return len(self.errors) == 0, self.errors

    def check_model_inheritance(self):
        """Ensure models inherit from TenantOwnedModel"""
        for node in ast.walk(self.tree):
            if isinstance(node, ast.ClassDef):
                # Check if it's a model
                if 'models.Model' in ast.unparse(node):
                    # Should inherit from TenantOwnedModel
                    bases = [ast.unparse(b) for b in node.bases]
                    if 'TenantOwnedModel' not in ' '.join(bases):
                        self.errors.append(
                            f"Line {node.lineno}: Model '{node.name}' must inherit from TenantOwnedModel"
                        )

    def check_hardcoded_values(self):
        """Check for hardcoded values"""
        # Simple regex check
        patterns = [
            (r"^\s*[A-Z_]+\s*=\s*['\"]", "Hardcoded string constant"),
            (r"^\s*[A-Z_]+\s*=\s*\d+", "Hardcoded numeric constant"),
        ]

        for i, line in enumerate(self.content.split('\n'), 1):
            if 'get_config' not in line:  # Skip if using get_config
                for pattern, msg in patterns:
                    if re.match(pattern, line):
                        self.errors.append(f"Line {i}: {msg} - use get_config() instead")

    def check_cross_module_imports(self):
        """Check for direct cross-module imports"""
        for node in ast.walk(self.tree):
            if isinstance(node, ast.ImportFrom):
                if node.module and node.module.startswith('apps.'):
                    # Check if importing from different module
                    parts = node.module.split('.')
                    if len(parts) >= 2:
                        imported_module = parts[1]
                        current_module = self.file_path.split('/apps/')[-1].split('/')[0] if '/apps/' in self.file_path else None

                        if current_module and imported_module != current_module:
                            self.errors.append(
                                f"Line {node.lineno}: Cross-module import detected: {node.module}. Use events instead."
                            )

    def check_tenant_isolation(self):
        """Check for queries without tenant filtering"""
        # Check for .objects.all() or .objects.get() without tenant
        dangerous_patterns = [
            r"\.objects\.all\(\)",
            r"\.objects\.filter\([^)]*(?!tenant)",
        ]

        for i, line in enumerate(self.content.split('\n'), 1):
            if 'TenantOwnedModel' not in line:  # Models inheriting TenantOwnedModel are safe
                for pattern in dangerous_patterns:
                    if re.search(pattern, line):
                        self.errors.append(
                            f"Line {i}: Potential tenant leak - ensure tenant filtering"
                        )

    def check_config_usage(self):
        """Ensure get_config is imported if used"""
        uses_config = 'get_config' in self.content
        imports_config = 'from kernel.config import get_config' in self.content

        if uses_config and not imports_config:
            self.errors.append("get_config() used but not imported from kernel.config")

def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_architecture.py <file_path>")
        sys.exit(1)

    validator = ArchitectureValidator(sys.argv[1])
    is_valid, errors = validator.validate()

    if is_valid:
        print(f"✅ {sys.argv[1]} passes architecture validation")
        sys.exit(0)
    else:
        print(f"❌ {sys.argv[1]} has {len(errors)} architecture violations:")
        for error in errors:
            print(f"  • {error}")
        sys.exit(1)

if __name__ == '__main__':
    main()
```

**Save as**: `.ai/scripts/validate_architecture.py`

---

## 📝 STARTUP MESSAGE FOR ANTIGRAVITY

Copy this at the start of EVERY Antigravity session:

```
🔒 TSFSYSTEM ARCHITECTURE CONSTRAINTS (CRITICAL - READ FIRST)

Project: TSFSYSTEM ERP - Multi-tenant, Event-Driven Architecture

📖 READ THESE FILES FIRST:
1. .ai/ANTIGRAVITY_CONSTRAINTS.md (THIS FILE - Architecture rules)
2. .ai/AGENT_RULES.md (Behavioral rules)
3. .ai/CONTEXT.md (Project status)
4. KERNEL_COMPLETE_V2.md (Kernel reference)

🚫 ABSOLUTE PROHIBITIONS (Never violate):
1. ❌ NO direct cross-module imports (use events)
2. ❌ NO hardcoded values (use get_config)
3. ❌ NO models without TenantOwnedModel inheritance
4. ❌ NO models without AuditLogMixin
5. ❌ NO bypassing RBAC permissions
6. ❌ NO breaking module boundaries

✅ REQUIRED PATTERNS:
• Models: Inherit TenantOwnedModel + AuditLogMixin
• Config: Use kernel.config.get_config() for all values
• Events: Use kernel.events.emit_event() for cross-module
• Contracts: Define with kernel.contracts.define_contract()
• RBAC: Check permissions via kernel.rbac
• Modules: Follow module.json manifest

📋 BEFORE EVERY CODE CHANGE:
☐ Read .ai/ANTIGRAVITY_CONSTRAINTS.md patterns
☐ Verify model inherits TenantOwnedModel
☐ Verify using get_config() not hardcoded values
☐ Verify using events not direct imports
☐ Verify RBAC permissions checked
☐ Run validation: python .ai/scripts/validate_architecture.py <file>

⚠️ ARCHITECTURE VALIDATION:
After creating/modifying code, YOU MUST validate:
• No hardcoded values
• No cross-module imports
• TenantOwnedModel inheritance
• AuditLogMixin included
• Events for communication
• Permissions checked

If validation fails, FIX IMMEDIATELY before continuing.

🤝 COLLABORATION:
• Ask questions BEFORE implementing
• Propose 2-3 options (user chooses)
• Show plan, get approval
• Validate against architecture
• Handoff to Claude Code for file operations (if needed)

CONFIRM YOU'VE READ AND WILL FOLLOW ALL CONSTRAINTS.
```

---

## 🔄 HANDOFF PROTOCOL (Antigravity → Claude Code)

When Antigravity creates a plan and hands off to Claude Code:

### **Antigravity's Handoff Message**:
```markdown
## 🔄 HANDOFF TO CLAUDE CODE

**Task**: [Task name]
**Status**: Plan complete, ready for implementation

### Architecture Validation Checklist:
- [ ] All models inherit TenantOwnedModel + AuditLogMixin
- [ ] All config values use get_config()
- [ ] Cross-module communication via events
- [ ] Contracts defined for all event payloads
- [ ] RBAC permissions specified
- [ ] Module boundaries respected

### Files to Create/Modify:
[List files with architecture notes]

### Implementation Notes:
[Specific architecture patterns to follow]

### Validation Command:
```bash
python .ai/scripts/validate_architecture.py apps/module/file.py
```

**Plan saved to**: .ai/plans/[task-name].md
**Claude**: Please implement following our architecture patterns.
```

### **Claude Code's Validation**:
Before implementing, Claude checks:
1. ✅ Antigravity's plan follows architecture patterns
2. ✅ No prohibited patterns (hardcoding, direct imports)
3. ✅ Contracts defined
4. ✅ Tenant isolation maintained

---

## 🚨 ERROR CORRECTION PROTOCOL

If Antigravity violates architecture:

### **Immediate Response**:
```
STOP ⚠️

This violates TSFSYSTEM architecture (.ai/ANTIGRAVITY_CONSTRAINTS.md):

Violation: [Specific issue]
File: [File path]
Line: [Line number]

Required Fix:
[Show correct pattern]

Please read .ai/ANTIGRAVITY_CONSTRAINTS.md section [X] and redo following our patterns.
```

### **Example Corrections**:

**Violation: Hardcoded Value**
```
STOP ⚠️

Violation: Hardcoded value
File: apps/finance/models.py
Line: 15
Code: TAX_RATE = 0.15

Required Fix:
from kernel.config import get_config

class Invoice(AuditLogMixin, TenantOwnedModel):
    def get_tax_rate(self):
        return get_config('default_tax_rate', default=0.15)

Read: .ai/ANTIGRAVITY_CONSTRAINTS.md section "NEVER Hardcode Values"
```

**Violation: Cross-Module Import**
```
STOP ⚠️

Violation: Direct cross-module import
File: apps/finance/services.py
Line: 8
Code: from apps.inventory.models import Product

Required Fix:
# Remove direct import
# Use events instead:
from kernel.events import emit_event

emit_event('finance.needs_product_data', {
    'product_id': product_id,
    'tenant_id': tenant.id
})

Read: .ai/ANTIGRAVITY_CONSTRAINTS.md section "NEVER Use Direct Cross-Module Calls"
```

**Violation: Missing TenantOwnedModel**
```
STOP ⚠️

Violation: Model doesn't inherit TenantOwnedModel
File: apps/finance/models.py
Line: 10
Code: class Invoice(models.Model):

Required Fix:
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin

class Invoice(AuditLogMixin, TenantOwnedModel):
    # Automatic tenant isolation + audit logging

Read: .ai/ANTIGRAVITY_CONSTRAINTS.md section "NEVER Skip Tenant Isolation"
```

---

## 📊 COMPLIANCE TRACKING

After each Antigravity session, verify:

```bash
# Check for architecture violations
python .ai/scripts/validate_architecture.py apps/**/*.py

# Check for hardcoded values
grep -r "= '[^']*'" apps/ erp_backend/ --include="*.py" | grep -v "get_config"

# Check for cross-module imports
grep -r "from apps\." apps/ --include="*.py" | grep -v "# Architecture-approved"

# Check for models missing TenantOwnedModel
grep -r "class.*models\.Model" apps/ --include="*.py" | grep -v "TenantOwnedModel"
```

---

## 📖 REFERENCE GUIDE FOR ANTIGRAVITY

### **Quick Reference Card**:

| Need to... | DON'T DO | DO THIS |
|------------|----------|---------|
| Store config | `TAX_RATE = 0.15` | `get_config('tax_rate', 0.15)` |
| Create model | `class X(models.Model):` | `class X(AuditLogMixin, TenantOwnedModel):` |
| Call other module | `from apps.inv import Product` | `emit_event('needs_product', {...})` |
| Check permission | `if user.is_admin:` | `if user.has_permission('x.y'):` |
| Query data | `Invoice.objects.all()` | Automatic (via TenantOwnedModel) |
| Add feature | Implement directly | Define contract first |

### **File Templates**:

**Model Template**: See "Pattern 1: Model Structure" above
**Event Template**: See "Pattern 2: Cross-Module Communication" above
**Config Template**: See "Pattern 3: Configuration-Driven Features" above
**RBAC Template**: See "Pattern 4: Permission Checking" above

---

## ✅ FINAL CHECKLIST

Before Antigravity completes any task:

```
☐ Read .ai/ANTIGRAVITY_CONSTRAINTS.md
☐ Read .ai/AGENT_RULES.md
☐ Read .ai/CONTEXT.md
☐ Verified no hardcoded values
☐ Verified TenantOwnedModel + AuditLogMixin
☐ Verified events for cross-module
☐ Verified contracts defined
☐ Verified RBAC permissions
☐ Verified module boundaries respected
☐ Ran architecture validation script
☐ Created handoff plan for Claude Code
☐ All violations fixed
```

**IF ANY ☐ UNCHECKED → TASK NOT COMPLETE**

---

**Version**: 1.0.0
**Last Updated**: 2026-03-04
**Status**: ✅ MANDATORY - All Antigravity sessions must follow
**Violations**: Zero tolerance - immediate correction required
