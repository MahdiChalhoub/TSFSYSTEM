# Quick Start Guide - Claude Code Agent System

## ✅ Installation Complete!

Your complete agent system is ready. Here's how to start using it immediately.

---

## 📝 5-Minute Quick Start

### Step 1: Verify Installation (30 seconds)

```bash
# Check that all files exist
ls -R .claude/

# You should see:
# - CLAUDE.md (master config)
# - README.md (documentation)
# - commands/ (6 slash commands)
# - agents/skills/ (9 core specialists)
# - agents/modules/ (7 module orchestrators)
# - agents/module-bridge.json
# - hooks/ (automation)
```

### Step 2: Read the Master Config (2 minutes)

```bash
# Open and skim CLAUDE.md
cat .claude/CLAUDE.md | head -100

# Key sections:
# - Project Identity
# - Four Pillars (Research First, Type Safety, Module Isolation, Audit)
# - Module Map
# - Security Rules
```

### Step 3: Try Your First Command (1 minute)

In Claude Code, type:
```
/preflight
```

This will:
- Read WORKMAP.md
- Read DESIGN_CRITERIA.md
- Read LESSONS_LEARNED.md
- Prepare context for coding

### Step 4: Try a Module Agent (2 minutes)

In Claude Code, type:
```
User: /finance "Check if the Invoice model uses Decimal for money fields"

Claude will:
1. Activate finance-agent
2. Read backend code
3. Report findings
```

---

## 🎯 Common First Tasks

### Task 1: Simple Bug Fix

```
User: "Fix the tax calculation bug in the POS checkout"

Expected flow:
1. Claude runs /preflight automatically
2. sales-agent activates (POS is in sales domain)
3. Coordinates: bug-hunter → backend-architect → test-engineer
4. Fixes the bug
5. Runs verification: npm run typecheck:pos && npm run test
6. Updates LESSONS_LEARNED.md
```

### Task 2: Add New Feature

```
User: "Add customer notes field to invoices"

Expected flow:
1. /preflight runs
2. finance-agent activates
3. Coordinates skills:
   - database-expert: Design migration
   - backend-architect: Add field to model
   - api-designer: Update TypeScript interface
   - frontend-engineer: Add input to form
   - test-engineer: Write tests
4. Verification pipeline runs
5. Documentation updated
```

### Task 3: Cross-Module Feature

```
User: "Show product stock levels in the invoice creation form"

Expected flow:
1. finance-agent: "I need stock data from inventory"
2. Contacts module-bridge
3. module-bridge coordinates with inventory-agent
4. Interface contract created
5. Both modules implement independently
6. Both verified separately
```

---

## 🔧 Essential Commands

| Command | When to Use | Example |
|---------|-------------|---------|
| `/preflight` | Before any coding | Always run first |
| `/module-doc finance` | Start work on module | Learn module structure |
| `/verify-module finance` | After changes | Check quality |
| `/bug-hunt` | Debugging | Find root cause |
| `/deploy-check` | Before production | Pre-deploy verification |
| `/audit-security` | Regular audits | Security scan |

---

## 📚 Documentation Map

Start here, in order:

### 1. This File (QUICK_START.md) ✅
You are here! Continue to #2 when ready.

### 2. README.md (30 minutes)
Complete user guide with examples
```bash
cat .claude/README.md
```

### 3. CLAUDE.md (15 minutes)
Master project context and standards
```bash
cat .claude/CLAUDE.md
```

### 4. ARCHITECTURE_DIAGRAM.md (10 minutes)
Visual system architecture
```bash
cat .claude/ARCHITECTURE_DIAGRAM.md
```

### 5. IMPLEMENTATION_SUMMARY.md (10 minutes)
What was built and why
```bash
cat .claude/IMPLEMENTATION_SUMMARY.md
```

### 6. Specific Agent Files (5 minutes each)
Deep dive into individual agents
```bash
cat .claude/agents/modules/finance-agent.json
cat .claude/agents/skills/backend-architect.json
```

---

## 🎓 Learning Path

### Beginner (Day 1)
- ✅ Read QUICK_START.md (this file)
- ✅ Run `/preflight` command
- ✅ Try one simple task with an agent
- ✅ Observe how it works

### Intermediate (Week 1)
- ✅ Read full README.md
- ✅ Complete a bug fix with agents
- ✅ Complete a feature with agents
- ✅ Understand Layer 1 vs Layer 2

### Advanced (Month 1)
- ✅ Customize slash commands
- ✅ Extend module agents
- ✅ Create custom bridges
- ✅ Optimize for your workflow

---

## 🚨 Common Issues & Solutions

### Issue: "Agent not responding"
**Solution**: Check Claude Code is running and `.claude/` directory exists.

### Issue: "TypeScript errors after edit"
**Solution**: Hook should auto-run. If not: `npm run typecheck`

### Issue: "Cross-module feature failing"
**Solution**: Use module-bridge. Never let modules edit each other directly.

### Issue: "Don't know which agent to use"
**Solution**: 
- Finance stuff → finance-agent
- POS/Sales → sales-agent
- Inventory → inventory-agent
- CRM → crm-agent
- HR → hr-agent
- Procurement → purchase-agent
- Ecommerce → ecommerce-agent

---

## 📊 Success Checklist

After your first week, you should be able to:

- [ ] Understand the two-layer architecture (Skills + Modules)
- [ ] Run `/preflight` before every task (habit)
- [ ] Use module agents for domain-specific work
- [ ] Know when to use module-bridge (cross-module needs)
- [ ] Run verification after changes (`/verify-module`)
- [ ] Understand the 14 security rules
- [ ] Know where documentation lives
- [ ] Update WORK_IN_PROGRESS.md after sessions

---

## 🎯 Next Steps

### Today
1. ✅ Complete this Quick Start
2. ✅ Read README.md
3. ✅ Try one task with an agent

### This Week
1. Complete 3-5 tasks using agents
2. Read CLAUDE.md fully
3. Familiarize with all slash commands

### This Month
1. Customize for your needs
2. Train team members
3. Measure productivity improvements

---

## 💡 Pro Tips

### Tip 1: Always Research First
> "5 minutes of research saves 50 minutes of rework."

Run `/preflight` before EVERY task. No exceptions.

### Tip 2: Let Agents Coordinate
> "Don't micromanage the agents. They know what to do."

Say "Add currency support to invoices" not "Use backend-architect to create Currency model then use api-designer to..."

### Tip 3: Trust But Verify
> "Agents are tools, not oracles."

Always run verification after changes:
```bash
/verify-module [module]
```

### Tip 4: Update Documentation
> "If it's not documented, it didn't happen."

Agents will update docs automatically, but check:
- WORK_IN_PROGRESS.md
- WORKMAP.md
- LESSONS_LEARNED.md

### Tip 5: Security First
> "Security is not optional."

Run `/audit-security` regularly. Fix critical issues immediately.

---

## 🎉 You're Ready!

The system is production-ready and waiting for your first task.

**Start with something simple, like:**
```
"Check if all invoice API endpoints have tenant isolation"
"Add a new field to the customer model"
"Fix the discount calculation in POS"
```

**Then graduate to:**
```
"Add multi-currency support to the entire finance module"
"Build a new loyalty rewards system"
"Integrate Stripe payment gateway"
```

---

## 📞 Need Help?

1. **Documentation**: Check `.claude/README.md` first
2. **Examples**: See `.claude/ARCHITECTURE_DIAGRAM.md` for workflows
3. **Troubleshooting**: Review `LESSONS_LEARNED.md`
4. **Module Docs**: Read `DOCUMENTATION/MODULE_*.md`

---

**Welcome to the future of ERP development with AI agents!** 🚀

**Version**: 1.0.0
**Created**: 2026-03-03
**Status**: Production-Ready
