# ⚡ QUICK START - Copy/Paste This

**Purpose**: Quick command to start a chat session with rule enforcement
**Version**: 1.0.0

---

## 🚀 FOR CLAUDE CODE (This Agent)

### Copy This Message:
```
Read .ai/AGENT_RULES.md and confirm you will follow all rules before we start working.

Specifically confirm:
1. You will ask clarifying questions before implementing anything
2. You will propose 2-3 options for me to choose from
3. You will use kernel.config.get_config() for all configurable values (no hardcoding)
4. You will create a detailed plan and get approval before implementing

After confirming, I'll give you the task.
```

---

## 🤖 FOR ANTIGRAVITY (Gemini)

### Copy This Message:
```
System Context:
- Project: TSFSYSTEM ERP (multi-tenant, event-driven)
- Kernel: OS v2.0 complete (8 components)
- Rules: Read .ai/AGENT_RULES.md BEFORE starting

MANDATORY RULES:
1. Ask questions BEFORE implementing (no assumptions)
2. Propose 2-3 options (collaborative planning)
3. Use kernel.config.get_config() (no hardcoding)
4. Create plan and get approval (no solo decisions)

WORKFLOW (Every Task):
Step 1: UNDERSTAND (ask questions)
Step 2: RESEARCH (read .ai/CONTEXT.md)
Step 3: PROPOSE (offer 2-3 options)
Step 4: PLAN (detailed plan)
Step 5: IMPLEMENT (after approval)
Step 6: REVIEW (verify)

Confirm you've read .ai/AGENT_RULES.md and will follow all rules.
```

---

## 🧪 QUICK TEST (Verify Agent Is Following Rules)

After agent confirms, test with this:

```
Test task: "Add a discount field to invoices"
```

**Expected Agent Response** (✅ CORRECT):
```
Agent: "Let me clarify before implementing:

1. Discount type: percentage, fixed amount, or both?
2. Applied where: per invoice total, per line item, or both?
3. Limits: maximum discount allowed? Requires approval?
4. Permissions: who can apply discounts?
5. Customization: configurable per tenant?

Please answer these questions."
```

**Wrong Agent Response** (❌ INCORRECT):
```
Agent: "I'll add a discount field with 10% max discount"
[Implements without asking]
```

If you get the wrong response, say:
```
Stop. That violates AGENT_RULES.md. You must ask clarifying questions BEFORE implementing.
Please read .ai/AGENT_RULES.md and start over with questions.
```

---

## 📝 VERIFICATION CHECKLIST

After starting a session, verify agent:

- [ ] Read `.ai/AGENT_RULES.md`
- [ ] Read `.ai/CONTEXT.md`
- [ ] Confirmed they'll ask questions first
- [ ] Confirmed they'll propose options
- [ ] Confirmed they'll avoid hardcoding
- [ ] Passed the quick test (asked questions before implementing)

If all checked ✅ → Agent is ready!

---

## 🔥 ONE-LINER (Ultra Quick)

**For Claude Code**:
```
Read .ai/AGENT_RULES.md, follow 6-step workflow, ask questions before implementing
```

**For Antigravity**:
```
Read .ai/AGENT_RULES.md, .ai/CONTEXT.md, .ai/ROUTING_RULES.yaml - follow all rules
```

---

**Save This File**: Bookmark this for quick access at the start of every session!
