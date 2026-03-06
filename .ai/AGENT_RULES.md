# 🤖 AGENT BEHAVIOR RULES

**Version**: 2.0.0
**Date**: 2026-03-04
**Priority**: CRITICAL - ALL AGENTS MUST FOLLOW

---

## 🎯 **CORE PRINCIPLES**

### **1. NO ASSUMPTIONS - ALWAYS ASK FIRST** ⚠️

**RULE**: Before implementing ANYTHING, agents MUST ask clarifying questions.

**WHY**: User wants CUSTOM solutions, not standard/generic ones.

**MANDATORY QUESTIONS BEFORE STARTING**:
```
1. "What SPECIFIC outcome do you want?"
2. "Are there any constraints or preferences?"
3. "Do you want the standard approach or custom solution?"
4. "What should I avoid or definitely NOT do?"
5. "How customizable/dynamic should this be?"
```

---

### **2. COLLABORATIVE PLANNING - NOT SOLO DECISIONS** 🤝

**RULE**: Plan TOGETHER with user, don't decide alone.

**PROCESS**:
```
STEP 1: Ask questions (use askUserQuestion tool)
STEP 2: Propose 2-3 options
STEP 3: User chooses approach
STEP 4: Create detailed plan
STEP 5: Get approval before implementing
```

**WRONG** ❌:
```
Agent: "I'll implement feature X with approach Y"
[Implements without asking]
```

**CORRECT** ✅:
```
Agent: "I see you want feature X. Let me clarify:
  1. Should this be configurable per tenant?
  2. Do you want UI for this or code-only?
  3. Any specific fields/options you need?
  4. Standard approach or custom logic?

  Based on your answers, I'll propose 2-3 options."
```

---

### **3. NO HARDCODING - EVERYTHING DYNAMIC** 🔧

**RULE**: Make EVERYTHING configurable/customizable.

**BANNED PATTERNS**:
```python
# ❌ WRONG - Hardcoded
TAX_RATE = 0.15
CURRENCY = 'USD'
MAX_DISCOUNT = 20

# ✅ CORRECT - Dynamic/Configurable
from kernel.config import get_config

tax_rate = get_config('default_tax_rate', default=0.15)
currency = get_config('default_currency', default='USD')
max_discount = get_config('max_discount_percent', default=20)
```

**ALWAYS**:
- Use config system for values that might change
- Use database for user-defined options
- Use feature flags for toggleable behavior
- Use tenant-specific settings

---

### **4. CUSTOMIZATION FIRST, STANDARDS SECOND** 🎨

**RULE**: Prioritize user's specific needs over "best practices".

**QUESTIONS TO ASK**:
```
1. "Do you want this to match your existing patterns?"
2. "Should this follow a specific naming convention?"
3. "Any specific structure/format you prefer?"
4. "Do you want this reusable or one-off?"
```

**EXAMPLE**:
```
User: "Add validation to invoice"

❌ WRONG (assumes):
Agent: "I'll add standard validation (email, phone, etc.)"

✅ CORRECT (asks):
Agent: "What validations do you need?
  - Email format?
  - Phone format?
  - Custom business rules?
  - Field-specific constraints?

  Tell me exactly what you want validated and I'll implement it."
```

---

### **5. PREVENT SOLUTION ASSUMPTIONS** 🛑

**RULE**: Never assume you know the "right" solution.

**COMMON ASSUMPTIONS TO AVOID**:
- ❌ "I'll use approach X because it's best practice"
- ❌ "I'll structure it like module Y"
- ❌ "I'll add these fields (user didn't ask for)"
- ❌ "I'll use this library/pattern by default"

**INSTEAD, ASK**:
- ✅ "Which approach do you prefer: A, B, or C?"
- ✅ "Should this match existing module X?"
- ✅ "What fields do you need? (I'll only add those)"
- ✅ "Any specific tools/patterns you want me to use?"

---

## 📋 **AGENT WORKFLOW**

### **MANDATORY WORKFLOW** (Every Task)

```
┌─────────────────────────────────────────────────────┐
│ STEP 1: UNDERSTAND (Ask Questions)                  │
├─────────────────────────────────────────────────────┤
│ Tools: askUserQuestion                              │
│                                                     │
│ Questions to ask:                                   │
│ • What EXACTLY do you want? (be specific)          │
│ • What should it NOT do?                           │
│ • Any existing patterns to follow?                 │
│ • Standard or custom solution?                     │
│ • How configurable should it be?                   │
│ • What are the constraints?                        │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ STEP 2: RESEARCH (Understand Context)               │
├─────────────────────────────────────────────────────┤
│ Actions:                                            │
│ • Read .ai/CONTEXT.md                              │
│ • Check existing code patterns                     │
│ • Identify similar implementations                 │
│ • Note module boundaries                           │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ STEP 3: PROPOSE (Offer Options)                     │
├─────────────────────────────────────────────────────┤
│ Format:                                             │
│ "Based on your requirements, here are 3 options:   │
│                                                     │
│ OPTION A: [Description]                            │
│   Pros: ...                                        │
│   Cons: ...                                        │
│                                                     │
│ OPTION B: [Description]                            │
│   Pros: ...                                        │
│   Cons: ...                                        │
│                                                     │
│ OPTION C: [Description]                            │
│   Pros: ...                                        │
│   Cons: ...                                        │
│                                                     │
│ Which do you prefer, or want me to combine?"       │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ STEP 4: PLAN (Create Detailed Plan)                 │
├─────────────────────────────────────────────────────┤
│ Create plan with:                                   │
│ • Files to create/modify                           │
│ • Code structure                                   │
│ • Configuration points (what's customizable)       │
│ • Database changes                                 │
│ • Testing approach                                 │
│                                                     │
│ Save to: .ai/plans/{task_name}.md                 │
│                                                     │
│ Show plan to user, get approval                    │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ STEP 5: IMPLEMENT (Only After Approval)             │
├─────────────────────────────────────────────────────┤
│ Rules:                                              │
│ • Follow approved plan EXACTLY                     │
│ • Make everything configurable                     │
│ • No hardcoding                                    │
│ • No assumptions                                   │
│ • Use existing patterns                            │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ STEP 6: REVIEW (Check Before Finalizing)            │
├─────────────────────────────────────────────────────┤
│ Ask:                                                │
│ • "Does this match what you wanted?"               │
│ • "Any changes needed?"                            │
│ • "Should I add more configurability?"             │
└─────────────────────────────────────────────────────┘
```

---

## 🔍 **CLARIFICATION QUESTIONS (Templates)**

### **For New Features**:
```
1. SCOPE:
   • "What should this feature do EXACTLY?"
   • "What should it NOT do?"
   • "Any edge cases to handle?"

2. CUSTOMIZATION:
   • "Should this be configurable per tenant?"
   • "Should this be toggleable (feature flag)?"
   • "What parts should be customizable?"

3. INTEGRATION:
   • "Should this integrate with existing modules?"
   • "Any specific modules to connect with?"
   • "Event-driven or direct calls?"

4. UI/UX:
   • "Do you need UI for this?"
   • "Admin-only or user-facing?"
   • "Any specific layout/design?"

5. DATA:
   • "What data fields do you need?"
   • "Any relationships to existing models?"
   • "How should data be validated?"

6. APPROACH:
   • "Standard approach or custom solution?"
   • "Any existing patterns to follow?"
   • "Preferred implementation style?"
```

---

### **For Modifications**:
```
1. INTENT:
   • "Why do you want to change this?"
   • "What problem are you solving?"
   • "What's the desired outcome?"

2. SCOPE:
   • "Just this file or related files too?"
   • "Keep existing behavior or change it?"
   • "Backward compatibility needed?"

3. PREFERENCES:
   • "How should this work differently?"
   • "Any specific approach you want?"
   • "Keep it simple or add features?"
```

---

### **For Bug Fixes**:
```
1. UNDERSTANDING:
   • "What's the expected behavior?"
   • "What's the actual behavior?"
   • "How to reproduce?"

2. APPROACH:
   • "Quick fix or proper solution?"
   • "Fix root cause or symptom?"
   • "Add safeguards or just fix?"

3. TESTING:
   • "How should I verify the fix?"
   • "Any edge cases to test?"
   • "Need tests added?"
```

---

## 🚫 **BANNED PRACTICES**

### **1. Hardcoded Values**
```python
# ❌ NEVER DO THIS
ADMIN_EMAIL = 'admin@example.com'
TAX_RATE = 0.15
MAX_ITEMS = 100

# ✅ ALWAYS DO THIS
from kernel.config import get_config
admin_email = get_config('admin_email', default='admin@example.com')
tax_rate = get_config('tax_rate', default=0.15)
max_items = get_config('max_items', default=100)
```

---

### **2. Standard Solutions Without Asking**
```python
# ❌ WRONG - Assumes standard validation
def validate_email(email):
    # Standard regex validation
    return re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email)

# ✅ CORRECT - Ask first, then implement custom validation
# "What email validation rules do you need?
#  - Allow special chars?
#  - Specific domains only?
#  - Custom regex pattern?"
```

---

### **3. Fixed Enum/Choices**
```python
# ❌ WRONG - Hardcoded choices
class Invoice(models.Model):
    status = models.CharField(choices=[
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid')
    ])

# ✅ CORRECT - Configurable choices
class Invoice(models.Model):
    status = models.CharField(max_length=50)

    @classmethod
    def get_status_choices(cls):
        from kernel.config import get_config
        return get_config('invoice_status_choices', default=[
            ('draft', 'Draft'),
            ('sent', 'Sent'),
            ('paid', 'Paid')
        ])
```

---

### **4. Direct Cross-Module Calls**
```python
# ❌ WRONG - Direct import and call
from apps.inventory.models import Product
product.quantity -= 10

# ✅ CORRECT - Event-driven
from kernel.events import emit_event
emit_event('sales.product_sold', {'product_id': product.id, 'quantity': 10})
```

---

## 🎨 **CUSTOMIZATION PATTERNS**

### **Pattern 1: Config-Driven Behavior**
```python
from kernel.config import get_config

def process_invoice(invoice):
    # Ask: "Should tax be inclusive or exclusive?"
    tax_inclusive = get_config('tax_inclusive', default=False)

    # Ask: "Should we auto-send invoices?"
    auto_send = get_config('invoice_auto_send', default=False)

    # Ask: "What's the default payment terms?"
    payment_terms = get_config('invoice_payment_terms', default='Net 30')

    # Implementation based on config
    if tax_inclusive:
        total = calculate_inclusive_tax(invoice)
    else:
        total = calculate_exclusive_tax(invoice)

    invoice.payment_terms = payment_terms
    invoice.save()

    if auto_send:
        send_invoice(invoice)
```

---

### **Pattern 2: Feature Flag Variants**
```python
from kernel.config import is_feature_enabled

def create_invoice(request):
    # Ask: "Do you want the new invoice workflow or old one?"
    if is_feature_enabled('new_invoice_workflow', user=request.user):
        # New custom workflow
        return new_invoice_flow(request)
    else:
        # Old workflow
        return old_invoice_flow(request)
```

---

### **Pattern 3: Policy-Based Logic**
```python
from kernel.rbac.policies import PolicyEngine

# Ask: "What rules determine if user can void invoice?"
@PolicyEngine.register('invoice.can_void')
def can_void_invoice(user, invoice):
    # Customizable rules from config
    rules = get_config('invoice_void_rules', default={
        'only_own': True,
        'within_days': 7,
        'not_paid': True
    })

    if rules['only_own'] and invoice.created_by != user:
        return False

    if rules['within_days']:
        age_days = (timezone.now() - invoice.created_at).days
        if age_days > rules['within_days']:
            return False

    if rules['not_paid'] and invoice.status == 'paid':
        return False

    return True
```

---

### **Pattern 4: Module-Specific Config**
```python
from kernel.modules import ModuleLoader

# Ask: "Should this module have custom settings?"
module_config = ModuleLoader.get_module_config(tenant, 'finance')

# Use module-specific settings
allow_negative = module_config.get('allow_negative_invoices', False)
require_approval = module_config.get('require_approval_above', 1000)
```

---

## 📝 **AGENT UPDATES PROTOCOL**

### **When to Update Agents/Skills**

**TRIGGER**: New capability or pattern is needed

**PROCESS**:
```
1. Identify what's missing
2. Check if it fits existing agent/skill
3. If yes: Update existing
4. If no: Create new agent/skill
5. Update documentation
6. Update routing rules
```

---

### **How to Update Agents**

**File to Update**: `.claude/agents/skills/{agent_name}.json`

**Add New Capability**:
```json
{
  "name": "backend-architect",
  "system_prompt": "You are BackendArchitect...",

  "capabilities": [
    "Design models",
    "Create APIs",
    "NEW: Ask clarifying questions before implementing",
    "NEW: Propose multiple options",
    "NEW: Make everything configurable"
  ],

  "rules": [
    "ALWAYS ask questions first (use askUserQuestion)",
    "NEVER hardcode values",
    "ALWAYS make things configurable",
    "ALWAYS propose 2-3 options",
    "NEVER assume standard solution"
  ]
}
```

---

### **How to Update Skills**

**When Adding New Kernel Component**:

**Example**: Add "contracts" skill

```json
{
  "name": "contract-definer",
  "description": "Defines interface contracts between modules",
  "capabilities": [
    "Define event schemas",
    "Validate payloads",
    "Track contract usage",
    "Version contracts"
  ],
  "usage": "When modules need to communicate",
  "tools": [
    "kernel.contracts.define_contract",
    "kernel.contracts.enforce_contract"
  ]
}
```

**Add to**: `.claude/agents/skills/contract-definer.json`

---

### **How to Update Hooks**

**When New Event Types Added**:

**File**: `.claude/hooks/post-commit.sh` (example)

```bash
#!/bin/bash
# Post-commit hook

# Check if kernel files changed
if git diff --name-only HEAD~1 | grep "kernel/"; then
  echo "⚠️  Kernel files changed - update CONTEXT.md"
fi

# Check if module.json changed
if git diff --name-only HEAD~1 | grep "module.json"; then
  echo "⚠️  Module manifest changed - re-register module"
  python manage.py register_module --scan
fi

# NEW: Check if contracts added
if git diff --name-only HEAD~1 | grep "contracts.py"; then
  echo "⚠️  Contracts changed - validate all modules"
fi
```

---

## 🔄 **AUTO-UPDATE TRIGGERS**

### **When New Component Added to Kernel**:

**Action**: Update agents to use it

**Script**: `.ai/auto_update_agents.sh`
```bash
#!/bin/bash
# Auto-update agents when kernel changes

KERNEL_COMPONENT=$1

case $KERNEL_COMPONENT in
  "contracts")
    echo "Adding contracts capability to agents..."
    # Update agent definitions
    # Add to routing rules
    # Update documentation
    ;;
  "modules")
    echo "Adding module loader capability..."
    ;;
esac
```

---

### **When New Pattern Introduced**:

**Action**: Document and add to agent knowledge

**File**: `.ai/PATTERNS.md` (auto-read by agents)

```markdown
# Code Patterns

## Latest Patterns

### Config-Driven Behavior (Added: 2026-03-04)
Instead of hardcoding, use:
```python
from kernel.config import get_config
value = get_config('key', default='default')
```

### Event Communication (Added: 2026-03-04)
Instead of direct calls, use:
```python
from kernel.events import emit_event
emit_event('event.type', payload={...})
```
```

---

## 📊 **AGENT CHECKLIST**

Before implementing ANYTHING, agent must check:

```
☐ Did I ask clarifying questions?
☐ Did I understand user's SPECIFIC needs?
☐ Did I propose multiple options?
☐ Did I get approval on approach?
☐ Is everything configurable (no hardcoding)?
☐ Am I following existing patterns?
☐ Am I using kernel components correctly?
☐ Did I check module boundaries?
☐ Will this be customizable/dynamic?
☐ Did I avoid assumptions?
```

**IF ANY ☐ IS UNCHECKED → STOP AND ASK QUESTIONS**

---

## 🎯 **EXAMPLE: CORRECT WORKFLOW**

**User Request**: "Add discount feature to invoices"

**WRONG Approach** ❌:
```
Agent: "I'll add a discount field to Invoice model and apply it in calculations"
[Implements standard discount without asking]
```

**CORRECT Approach** ✅:
```
Agent: "I see you want discount functionality. Let me clarify:

1. DISCOUNT TYPE:
   • Percentage or fixed amount?
   • Or both (user chooses)?
   • Or configurable per tenant?

2. SCOPE:
   • Per invoice or per line item?
   • Or both levels?

3. LIMITS:
   • Maximum discount allowed?
   • Who can apply discounts (permissions)?
   • Approval required for large discounts?

4. CALCULATION:
   • Before tax or after tax?
   • Round up/down or exact?

5. CUSTOMIZATION:
   • Should this be configurable?
   • Different rules per tenant?
   • Feature flag to toggle?

Please answer these, then I'll propose 2-3 implementation options."

[User answers]

Agent: "Based on your answers, here are 3 options:

OPTION A: Simple percentage discount
  • Single discount field (percentage)
  • Applied to invoice total
  • No limits
  • Pros: Simple, fast
  • Cons: Not flexible

OPTION B: Flexible discount system
  • Percentage OR fixed amount
  • Per invoice AND per line item
  • Configurable limits
  • Permission-based
  • Pros: Very flexible
  • Cons: More complex

OPTION C: Fully dynamic system
  • All options configurable via kernel.config
  • Feature flagged
  • Tenant-specific rules
  • Policy-based validation
  • Pros: Maximum customization
  • Cons: Most development time

Which do you prefer, or want me to combine features?"

[User chooses]

Agent: "Great! I'll create detailed plan for [chosen option]."

[Creates plan, gets approval, implements]
```

---

## 🔐 **ENFORCEMENT**

### **How Rules Are Enforced**:

1. **Agent System Prompts** - Rules embedded in agent definitions
2. **Routing Rules** - Force questions before implementation
3. **Code Review** - Auto-check for hardcoding
4. **Pre-commit Hooks** - Prevent hardcoded values from being committed

---

### **Auto-Check Script** (`.ai/check_agent_compliance.sh`):

```bash
#!/bin/bash
# Check if agent followed rules

echo "Checking agent compliance..."

# Check for hardcoded values
echo "1. Checking for hardcoded values..."
grep -r "= '.*'" apps/ erp_backend/ | grep -v "get_config" && echo "❌ Hardcoded strings found"

# Check for direct cross-module imports
echo "2. Checking for cross-module imports..."
# [Implementation]

# Check if plan exists
echo "3. Checking if plan was created..."
if [ ! -f ".ai/plans/$(git log -1 --pretty=%B).md" ]; then
  echo "⚠️  No plan found - was task planned?"
fi
```

---

## ✅ **SUMMARY**

### **Core Rules**:
1. ✅ **NO ASSUMPTIONS** - Always ask first
2. ✅ **COLLABORATIVE** - Plan together
3. ✅ **NO HARDCODING** - Everything configurable
4. ✅ **CUSTOM FIRST** - User needs > standards
5. ✅ **PROPOSE OPTIONS** - Not solo decisions

### **Every Task**:
1. Ask questions (clarify)
2. Research context (understand)
3. Propose options (collaborate)
4. Create plan (detail)
5. Get approval (confirm)
6. Implement (execute)

### **Update When**:
- New kernel component added
- New pattern introduced
- New capability needed

---

**Version**: 2.0.0
**Status**: ✅ ACTIVE - All Agents Must Follow
**Last Updated**: 2026-03-04
