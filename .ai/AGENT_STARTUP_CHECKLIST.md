# 🚀 AGENT STARTUP CHECKLIST

**Purpose**: Ensure agents follow all behavioral rules at the start of every chat session
**Version**: 1.0.0
**Date**: 2026-03-04

---

## ✅ PRE-CHAT CHECKLIST (For Users)

Before starting a new chat session, verify these files are in place:

```bash
# Quick verification command
ls -la .ai/AGENT_RULES.md .claude/CLAUDE.md
```

**Expected Output**:
```
-rw-r--r-- 1 user user 22859 Mar  4 01:49 .ai/AGENT_RULES.md
-rw-r--r-- 1 user user  XXXX Mar  4 XX:XX .claude/CLAUDE.md
```

If files exist ✅ → You're ready!

---

## 🤖 AGENT INITIALIZATION (What Happens Automatically)

### Claude Code (This Agent)
When you start a chat, Claude Code automatically:

1. ✅ **Reads Master Config**: [.claude/CLAUDE.md](.claude/CLAUDE.md)
   - Contains: "Ask First, Understand Second, Propose Third, Code Fourth"
   - References: `.ai/AGENT_RULES.md`

2. ✅ **Loads Context**: [.ai/CONTEXT.md](.ai/CONTEXT.md)
   - Project status
   - Locked files
   - Architecture decisions

3. ✅ **Checks Active Work**: [.ai/CURRENT_WORK.md](.ai/CURRENT_WORK.md)
   - What's in progress
   - Which files are locked
   - Handoff status

### Antigravity (Gemini)
You need to configure it to read:
1. `.ai/AGENT_RULES.md` (behavioral rules)
2. `.ai/CONTEXT.md` (project status)
3. `.ai/ROUTING_RULES.yaml` (task routing)

---

## 📋 FIRST MESSAGE TEMPLATE (Recommended)

### For Claude Code
Start your chat with:

```
Read .ai/AGENT_RULES.md and confirm you will follow all rules before we start.
```

Or more detailed:

```
Before we start:
1. Read .ai/AGENT_RULES.md (behavioral rules)
2. Read .ai/CONTEXT.md (project status)
3. Confirm you will:
   - Ask clarifying questions before implementing
   - Propose 2-3 options instead of solo decisions
   - Make everything configurable (no hardcoding)
   - Use kernel.config.get_config() for all values
```

### For Antigravity
Start your chat with:

```
System context:
- Read .ai/AGENT_RULES.md for behavioral rules
- Read .ai/CONTEXT.md for project status
- Read .ai/ROUTING_RULES.yaml for task routing
- Check .ai/CURRENT_WORK.md before starting

Follow all rules in AGENT_RULES.md, especially:
- Ask questions before implementing
- Propose multiple options
- No hardcoding
```

---

## 🔍 VERIFICATION TESTS

### Test 1: Question-First Behavior
```
You: "Add tax calculation to invoices"

✅ CORRECT Response:
Agent: "Let me clarify before implementing:
  1. What tax calculation method? (flat rate, tiered, location-based?)
  2. Inclusive or exclusive?
  3. Configurable per tenant?
  4. Default rate?
  5. Multiple tax types?

  Please answer these, then I'll propose options."

❌ WRONG Response:
Agent: "I'll add a 15% tax rate to invoices" [implements without asking]
```

### Test 2: Option Proposal
```
You: "Add discount feature"

✅ CORRECT Response:
Agent: [Asks questions first]
Agent: "Based on your answers, here are 3 options:
  Option A: Simple percentage (fast)
  Option B: Flexible system (balanced)
  Option C: Fully dynamic (customizable)

  Which do you prefer?"

❌ WRONG Response:
Agent: "I'll implement percentage discount" [no options given]
```

### Test 3: No Hardcoding
```
You: "Add default currency"

✅ CORRECT Response:
Agent: "I'll add currency using kernel.config:
  currency = get_config('default_currency', default='USD')
  This way you can change it per tenant."

❌ WRONG Response:
Agent: "I'll add: CURRENCY = 'USD'" [hardcoded value]
```

---

## 🚨 RED FLAGS (Agent NOT Following Rules)

Watch for these warning signs:

### 🚫 Red Flag #1: No Questions Asked
```
You: "Add feature X"
Agent: [Immediately implements without asking anything]
```

**Fix**: Remind agent to read `.ai/AGENT_RULES.md`

### 🚫 Red Flag #2: Solo Decisions
```
You: "Add validation"
Agent: "I'll add email and phone validation" [didn't ask what to validate]
```

**Fix**: Stop agent and say "Please ask what validations I need instead of assuming"

### 🚫 Red Flag #3: Hardcoded Values
```python
# Agent writes:
TAX_RATE = 0.15
MAX_DISCOUNT = 20
```

**Fix**: Say "This violates no-hardcoding rule. Use get_config() instead"

### 🚫 Red Flag #4: No Options Given
```
You: "How should I implement X?"
Agent: "You should use approach Y" [only one option]
```

**Fix**: Say "Please give me 2-3 options to choose from per AGENT_RULES.md"

---

## ✅ ENFORCEMENT METHODS

### Method 1: Explicit Reminder (Start of Chat)
```
You: "Read and follow .ai/AGENT_RULES.md for this entire session"
```

### Method 2: Inline Correction (During Chat)
```
Agent: [Does something wrong]
You: "Stop. That violates AGENT_RULES.md rule #3 (no hardcoding).
     Please redo using get_config()"
```

### Method 3: Rule Reference (Quick Fix)
```
Agent: [Implements without asking]
You: "AGENT_RULES.md Step 1: Ask questions first. Please ask clarifying questions."
```

### Method 4: Session Reset (Nuclear Option)
```
You: "Let's restart this task. First, read .ai/AGENT_RULES.md and
     confirm you'll follow all 6 core principles."
```

---

## 🎯 GOLDEN STARTUP FLOW

### Perfect Session Start
```
You: "Before we start any work today, please:
     1. Read .ai/AGENT_RULES.md
     2. Read .ai/CONTEXT.md
     3. Confirm you will follow the 6-step workflow for all tasks
     4. Confirm you will ask questions before implementing anything"

Agent: "✅ I've read both files. I confirm I will:
     - Ask clarifying questions before implementing (Step 1)
     - Propose 2-3 options for you to choose (Step 3)
     - Create detailed plan and get approval (Step 4)
     - Make everything configurable using kernel.config (no hardcoding)
     - Follow the 6-step workflow: Understand → Research → Propose → Plan → Implement → Review

     What would you like to work on?"

You: [Give task]

Agent: [Asks clarifying questions first]
```

---

## 🔧 ANTIGRAVITY SPECIFIC SETUP

### Option A: System Prompt (Recommended)
Add to Antigravity's system prompt:

```
CRITICAL RULES - Read before every task:
1. Read .ai/AGENT_RULES.md (behavioral rules)
2. Read .ai/CONTEXT.md (project status)
3. Read .ai/ROUTING_RULES.yaml (task routing)

MANDATORY BEHAVIOR:
- Ask clarifying questions BEFORE implementing
- Propose 2-3 options, let user choose
- Make everything configurable (use kernel.config)
- No hardcoded values
- No assumptions about solutions
- Collaborative planning (not solo decisions)

WORKFLOW (Every Task):
Step 1: UNDERSTAND (ask questions)
Step 2: RESEARCH (read context)
Step 3: PROPOSE (offer options)
Step 4: PLAN (create detailed plan)
Step 5: IMPLEMENT (after approval)
Step 6: REVIEW (verify with user)
```

### Option B: Manual Reminder (Each Session)
Start every Antigravity session with:

```
Context files to read:
- .ai/AGENT_RULES.md
- .ai/CONTEXT.md
- .ai/ROUTING_RULES.yaml

Follow 6-step workflow for all tasks.
Ask questions before implementing anything.
Propose multiple options, don't make solo decisions.
```

---

## 📊 COMPLIANCE MONITORING

### Daily Check
At the end of each session, verify:

```bash
# Check for hardcoded values (should return nothing)
grep -r "= '.*'" apps/ erp_backend/ --include="*.py" | grep -v "get_config"

# Check recent commits for compliance
git log -1 --stat

# Verify agent asked questions (manual check)
# - Did agent ask clarifying questions?
# - Did agent propose options?
# - Was everything made configurable?
```

### Weekly Audit
```bash
# Run compliance script
.ai/check_agent_compliance.sh

# Review recent work
git log --since="1 week ago" --stat

# Check for patterns
grep -r "TODO\|FIXME\|HACK" erp_backend/ apps/
```

---

## 🎓 TRAINING EXAMPLES

### Example 1: Perfect Session
```
User: "Add payment terms to invoices"

Agent: "Let me understand your requirements:

1. SCOPE:
   • What payment terms do you need? (Net 30, Net 60, custom?)
   • Fixed list or user-definable?

2. CUSTOMIZATION:
   • Configurable per tenant?
   • Different terms per customer?

3. DEFAULT:
   • What should be the default?
   • Who can change it?

Please answer these questions."

User: [Answers: Net 30/60/90, fixed list, yes per tenant, Net 30 default, admin can change]

Agent: "Based on your answers, here are 3 options:

OPTION A: Simple dropdown
  • Fixed list (Net 30, 60, 90)
  • Per tenant config
  • Pros: Fast, simple
  • Cons: Can't add custom terms

OPTION B: Configurable list
  • Admin defines available terms
  • Stored in database
  • Per tenant
  • Pros: Flexible
  • Cons: Need admin UI

OPTION C: Fully dynamic
  • Free text + dropdown
  • Template system
  • Per tenant + per customer
  • Pros: Maximum flexibility
  • Cons: More complex

Which do you prefer?"

User: "Option B"

Agent: "Perfect. Here's the detailed plan:
[Shows plan]
Approve to proceed?"

User: "Approved"

Agent: [Implements exactly as planned using get_config()]
```

---

## 🔒 FAIL-SAFES

### Fail-Safe #1: Pre-Commit Hook
```bash
# .git/hooks/pre-commit
#!/bin/bash

# Check for hardcoded values
if git diff --cached --name-only | grep -E '\.(py|ts|tsx)$'; then
  if git diff --cached | grep -E "= '[^']*'|= \"[^\"]*\"" | grep -v "get_config"; then
    echo "❌ ERROR: Hardcoded values detected"
    echo "Use kernel.config.get_config() instead"
    exit 1
  fi
fi
```

### Fail-Safe #2: Code Review Checklist
Before accepting any agent work:

- [ ] Agent asked clarifying questions
- [ ] Agent proposed multiple options
- [ ] Everything is configurable (no hardcoding)
- [ ] Uses `get_config()` for all values
- [ ] Detailed plan was created and approved
- [ ] Code follows existing patterns
- [ ] Documentation updated

### Fail-Safe #3: Testing Script
```python
# test_agent_compliance.py
import ast
import sys

def check_hardcoded_values(file_path):
    with open(file_path, 'r') as f:
        tree = ast.parse(f.read())

    hardcoded = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            if isinstance(node.value, (ast.Str, ast.Num)):
                # Check if it's not using get_config
                if 'get_config' not in ast.unparse(node):
                    hardcoded.append((node.lineno, ast.unparse(node)))

    return hardcoded

# Run on all Python files
# Report violations
```

---

## 📞 TROUBLESHOOTING

### Issue: Agent Not Asking Questions
**Solution**:
```
You: "Stop. AGENT_RULES.md requires you to ask clarifying questions first.
     Please read .ai/AGENT_RULES.md section 'MANDATORY QUESTIONS BEFORE STARTING'
     and ask me those questions before proceeding."
```

### Issue: Agent Hardcoding Values
**Solution**:
```
You: "This violates the no-hardcoding rule (AGENT_RULES.md #3).
     Please change:
       TAX_RATE = 0.15
     To:
       tax_rate = get_config('default_tax_rate', default=0.15)

     Make it configurable."
```

### Issue: Agent Making Solo Decisions
**Solution**:
```
You: "Please don't decide alone. Per AGENT_RULES.md #2 (Collaborative Planning),
     propose 2-3 options and let me choose."
```

### Issue: Agent Skipping Steps
**Solution**:
```
You: "You skipped steps. AGENT_RULES.md requires this workflow:
     1. Understand (ask questions) ← You're here
     2. Research (check context)
     3. Propose (offer options)
     4. Plan (detailed plan)
     5. Implement (after approval)
     6. Review (verify)

     Please start at Step 1 and ask clarifying questions."
```

---

## ✅ SUCCESS METRICS

Track these metrics to ensure agents are complying:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Questions asked per task | ≥5 | Manual review |
| Options proposed | 2-3 | Manual review |
| Hardcoded values | 0 | Automated scan |
| Plan approval requests | 100% | Manual review |
| Config usage | 100% | Code review |
| User satisfaction | High | Feedback |

---

## 🎉 SUMMARY

### To Start a New Chat Session:

**Quick Version**:
```
You: "Read .ai/AGENT_RULES.md and follow all rules for this session"
```

**Detailed Version**:
```
You: "Before we start:
     1. Read .ai/AGENT_RULES.md
     2. Read .ai/CONTEXT.md
     3. Confirm you'll follow the 6-step workflow
     4. Confirm you'll ask questions before implementing
     5. Confirm no hardcoding (use get_config)"
```

**Verification**:
Give a small task and watch if agent:
- ✅ Asks questions first
- ✅ Proposes options
- ✅ Uses get_config()

If yes → Agent is following rules ✅
If no → Remind agent to read AGENT_RULES.md

---

**Version**: 1.0.0
**Last Updated**: 2026-03-04
**Status**: ✅ Active
