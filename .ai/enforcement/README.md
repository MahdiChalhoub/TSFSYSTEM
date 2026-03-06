# 🔒 Module Boundaries Enforcement System

**Version**: 1.0.0
**Status**: ✅ Production Ready
**Date**: 2026-03-04

---

## 🎯 **What Is This?**

An automated system that **prevents architecture violations** in TSFSYSTEM ERP:

- ❌ Blocks cross-module imports (enforces event-driven communication)
- ❌ Detects hardcoded values (enforces configurable design)
- ❌ Ensures tenant isolation (enforces TenantOwnedModel)
- ❌ Checks audit logging (enforces AuditLogMixin)
- ⚠️  Warns on missing RBAC checks

**Enforcement happens**:
1. ✅ **Pre-commit** - Before you commit code
2. ✅ **CI/CD** - During GitHub Actions builds
3. ✅ **Manual** - Run checks anytime

---

## 🚀 **Quick Start**

### **Installation**

```bash
# Install the enforcement system
bash .ai/enforcement/install.sh
```

This will:
- Install pre-commit hook
- Create baseline of existing violations
- Make scripts executable
- Test the system

### **Manual Check**

```bash
# Check all files
python3 .ai/enforcement/enforce.py check

# Check specific file
python3 .ai/enforcement/enforce.py check apps/finance/models.py

# Check only staged files (fast)
python3 .ai/enforcement/enforce.py check --staged
```

### **Pre-Commit Hook**

Automatically runs when you commit:

```bash
git add apps/finance/models.py
git commit -m "Add invoice model"

# 🔍 Running TSFSYSTEM Architecture Enforcement...
# ❌ Architecture violations detected
# [Shows violations]
```

**Bypass** (not recommended):
```bash
git commit --no-verify -m "message"
```

---

## 📋 **Rules Enforced**

### **1. Cross-Module Imports** ❌

**Violation**:
```python
# In apps/finance/views.py
from apps.inventory.models import Product  # ❌ BLOCKED
```

**Fix**:
```python
# Use events instead
from kernel.events import emit_event

emit_event('finance.needs_product_data', {'product_id': 123})
```

---

### **2. Hardcoded Values** ❌

**Violation**:
```python
TAX_RATE = 0.15  # ❌ BLOCKED
CURRENCY = 'USD'  # ❌ BLOCKED
```

**Fix**:
```python
from kernel.config import get_config

tax_rate = get_config('default_tax_rate', default=0.15)
currency = get_config('default_currency', default='USD')
```

---

### **3. Tenant Isolation** ❌

**Violation**:
```python
class Invoice(models.Model):  # ❌ BLOCKED
    customer = models.ForeignKey(Customer)
```

**Fix**:
```python
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin

class Invoice(AuditLogMixin, TenantOwnedModel):
    customer = models.ForeignKey(Customer)
```

---

### **4. Audit Logging** ⚠️

**Warning**:
```python
class Invoice(TenantOwnedModel):  # ⚠️  Missing audit
    pass
```

**Fix**:
```python
class Invoice(AuditLogMixin, TenantOwnedModel):  # ✅
    pass
```

---

### **5. RBAC Checks** ⚠️

**Warning**:
```python
def delete_invoice(request, invoice_id):  # ⚠️  No permission check
    invoice.delete()
```

**Fix**:
```python
from kernel.rbac.decorators import require_permission

@require_permission('finance.delete_invoice')
def delete_invoice(request, invoice_id):
    invoice.delete()
```

---

## ⚙️ **Configuration**

Edit [config.yaml](config.yaml) to customize:

### **Enable/Disable Rules**

```yaml
enforcement:
  rules:
    cross_module_imports: true     # Block cross-module imports
    hardcoded_values: true          # Detect hardcoding
    tenant_isolation: true          # Ensure TenantOwnedModel
    audit_logging: true             # Ensure AuditLogMixin
    rbac_checks: warn               # Warn (not block) on missing RBAC
```

### **Module Dependencies**

```yaml
modules:
  finance:
    allowed_dependencies:
      - core
      - crm  # Finance can import from CRM (if needed)
```

### **Whitelist Patterns**

```yaml
whitelist:
  hardcoded:
    - file: "*/version.py"
      pattern: "^VERSION = "
      reason: "Version strings are OK"

    - file: "*/test_*.py"
      pattern: ".*"
      reason: "Test files can have hardcoded data"
```

### **Gradual Migration**

```yaml
migration:
  allow_existing: true          # Don't break existing code
  fail_on_new_only: true        # Only fail on NEW violations
  baseline_file: ".ai/enforcement/baseline.json"
```

---

## 📊 **Baseline System**

The baseline tracks existing violations so you can:
- ✅ **Not break existing code** (violations already present)
- ❌ **Block new violations** (new code must be clean)

### **Create Baseline**

```bash
python3 .ai/enforcement/enforce.py baseline
```

Creates `.ai/enforcement/baseline.json` with current violations.

### **View Baseline**

```bash
cat .ai/enforcement/baseline.json | jq '.counts'

# Output:
# {
#   "total": 47,
#   "errors": 32,
#   "warnings": 15
# }
```

### **Fix Gradually**

Fix violations over time, then recreate baseline:

```bash
# Fix some violations
# ...

# Update baseline
python3 .ai/enforcement/enforce.py baseline
```

---

## 🔧 **Integration**

### **Pre-Commit Hook** (Automatic)

Installed by `install.sh`, runs automatically on `git commit`.

**Location**: `.git/hooks/pre-commit` → symlink to `.ai/enforcement/pre-commit-hook.sh`

**Disable temporarily**:
```bash
git commit --no-verify
```

---

### **CI/CD** (GitHub Actions)

Already integrated in [.github/workflows/ci.yml](../../.github/workflows/ci.yml):

```yaml
- name: 🔒 Architecture Enforcement
  run: |
    pip install pyyaml
    python3 .ai/enforcement/enforce.py check
  continue-on-error: false  # Build fails if violations found
```

---

### **IDE Integration**

#### **VS Code**

Add to `.vscode/tasks.json`:

```json
{
  "label": "Check Architecture",
  "type": "shell",
  "command": "python3 .ai/enforcement/enforce.py check ${file}",
  "problemMatcher": []
}
```

Run: `Ctrl+Shift+P` → "Run Task" → "Check Architecture"

#### **PyCharm**

Add External Tool:
- **Program**: `python3`
- **Arguments**: `.ai/enforcement/enforce.py check $FilePath$`
- **Working Directory**: `$ProjectFileDir$`

---

## 📈 **Reports**

### **Console Report** (Default)

```bash
python3 .ai/enforcement/enforce.py check

# Output:
# ❌ ERRORS (5):
#
# 1. apps/finance/models.py:15:0
#    Rule: tenant_isolation
#    Model "Invoice" must inherit from TenantOwnedModel
#    Fix: class Invoice(AuditLogMixin, TenantOwnedModel):
```

### **JSON Report**

```bash
python3 .ai/enforcement/enforce.py report > report.json
```

### **HTML Report** (Coming Soon)

```bash
python3 .ai/enforcement/enforce.py report --format html
```

---

## 🎯 **Examples**

### **Example 1: Check Before Commit**

```bash
# Make changes
vim apps/finance/models.py

# Check for violations
python3 .ai/enforcement/enforce.py check apps/finance/models.py

# ✅ No violations found!

# Commit
git add apps/finance/models.py
git commit -m "Add discount field"
```

---

### **Example 2: Fix Violation**

```bash
# Check file
python3 .ai/enforcement/enforce.py check apps/finance/views.py

# Output:
# ❌ Cross-module import: finance → inventory
# Line 10: from apps.inventory.models import Product
# Fix: Use events instead

# Fix the code
vim apps/finance/views.py
# Change to: emit_event('finance.needs_product', {...})

# Re-check
python3 .ai/enforcement/enforce.py check apps/finance/views.py

# ✅ No violations found!
```

---

### **Example 3: Whitelist Exception**

```yaml
# .ai/enforcement/config.yaml

whitelist:
  hardcoded:
    - file: "apps/finance/tax_codes.py"
      pattern: "^TAX_CODES = "
      reason: "Tax codes are regulatory constants"
```

---

## 🚨 **Troubleshooting**

### **Issue: Pre-commit hook not running**

```bash
# Check if hook exists
ls -la .git/hooks/pre-commit

# Reinstall
bash .ai/enforcement/install.sh
```

### **Issue: "yaml module not found"**

```bash
pip3 install pyyaml
```

### **Issue: False positives**

Edit `config.yaml` to whitelist specific patterns:

```yaml
whitelist:
  imports:
    - "^from apps\\.core\\.utils"  # Allow core utils
```

### **Issue: Too strict**

Adjust enforcement level:

```yaml
enforcement:
  level: warn  # Change from 'strict' to 'warn'
```

---

## 📁 **Files**

```
.ai/enforcement/
├── config.yaml              # Configuration
├── enforce.py               # Main enforcement engine
├── pre-commit-hook.sh       # Pre-commit hook script
├── install.sh               # Installation script
├── baseline.json            # Existing violations baseline
├── reports/                 # Generated reports
└── README.md                # This file
```

---

## 🔄 **Workflow**

```
┌─────────────────┐
│  Developer      │
│  writes code    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  git add        │
│  git commit     │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  Pre-commit Hook    │◄─── .ai/enforcement/pre-commit-hook.sh
│  Runs enforcement   │
└────────┬────────────┘
         │
    ┌────▼────┐
    │ Pass?   │
    └──┬───┬──┘
       │   │
   Yes │   │ No
       │   │
       ▼   ▼
    Commit  Show violations
    Success & block commit
       │
       ▼
    ┌──────────────┐
    │  git push    │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────┐
    │  GitHub Actions  │◄─── .github/workflows/ci.yml
    │  Runs enforcement│
    └──────┬───────────┘
           │
      ┌────▼────┐
      │ Pass?   │
      └──┬───┬──┘
         │   │
     Yes │   │ No
         │   │
         ▼   ▼
      Deploy  Fail CI
      Success & notify
```

---

## ✅ **Success Metrics**

Track these metrics to measure enforcement effectiveness:

| Metric | Target | Current |
|--------|--------|---------|
| New violations per week | 0 | TBD |
| Existing violations | Decreasing | 47 (baseline) |
| False positives | <5% | TBD |
| Developer satisfaction | High | TBD |

---

## 🎓 **Best Practices**

### **1. Run checks locally before pushing**
```bash
python3 .ai/enforcement/enforce.py check --staged
```

### **2. Fix violations immediately**
Don't accumulate technical debt.

### **3. Update baseline regularly**
As you fix violations, update the baseline:
```bash
python3 .ai/enforcement/enforce.py baseline
```

### **4. Whitelist thoughtfully**
Only whitelist genuine exceptions, not workarounds.

### **5. Review config periodically**
Adjust rules as architecture evolves.

---

## 📞 **Support**

**Questions?**
- Read: [.ai/ANTIGRAVITY_CONSTRAINTS.md](../ANTIGRAVITY_CONSTRAINTS.md)
- Read: [.ai/AGENT_RULES.md](../AGENT_RULES.md)
- Check: `config.yaml` for configuration options

**Issues?**
- Check violations are legitimate
- Review whitelist patterns
- Adjust enforcement level if needed

**Contributing?**
- Add custom rules in `enforce.py`
- Improve detection patterns
- Add auto-fix capabilities

---

## 🎉 **Summary**

You now have **automated architecture enforcement** that:

✅ **Prevents violations** before they reach codebase
✅ **Runs automatically** (pre-commit + CI/CD)
✅ **Provides clear fixes** (shows how to correct violations)
✅ **Allows gradual migration** (baseline system)
✅ **Highly configurable** (whitelist, rules, severity)

**Your architecture is now bulletproof!** 🛡️

---

**Version**: 1.0.0
**Last Updated**: 2026-03-04
**Status**: ✅ Production Ready
