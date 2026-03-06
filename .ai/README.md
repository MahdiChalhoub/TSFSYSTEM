# 🤖 AI Coordination System

**Purpose**: Coordinate Antigravity (Gemini) and Claude Code (Claude) without conflicts

---

## 📁 Files in This Directory

### **Active Files** (Read These!)

1. **[CONTEXT.md](CONTEXT.md)** 📍
   - **Source of truth** for project status
   - Read by BOTH AIs before starting work
   - Updated after every task

2. **[CURRENT_WORK.md](CURRENT_WORK.md)** 🚧
   - What's being worked on RIGHT NOW
   - Prevents both AIs from working on same thing
   - Updated in real-time

3. **[ROUTING_RULES.yaml](ROUTING_RULES.yaml)** 🎯
   - Decides which AI handles which task
   - Optimizes for cost (minimize Claude usage)
   - Decision tree + examples

4. **[AI_ORCHESTRATION.md](AI_ORCHESTRATION.md)** 📖
   - Complete guide on AI coordination
   - Workflows, examples, handoff protocol
   - Read this for full understanding

### **Subdirectories**

- **plans/** - Implementation plans (Antigravity → Claude handoffs)
- **completed/** - Task summaries (Claude → Antigravity handoffs)
- **templates/** - Reusable templates for common tasks
- **archive/** - Old/redundant documentation

---

## 🚀 Quick Start

### **For You (User)**

**Before asking for help**:
```bash
# Check what's currently being worked on
cat .ai/CURRENT_WORK.md

# Check project status
cat .ai/CONTEXT.md
```

**Decide which AI to use**:
- **File editing, terminal, git** → Claude Code
- **Research, planning, docs** → Antigravity
- **Complex multi-step tasks** → Both (Antigravity plans → Claude executes)

---

### **For Antigravity**

**Before starting work**:
1. Read `.ai/CONTEXT.md` for project status
2. Read `.ai/CURRENT_WORK.md` to avoid conflicts
3. Update `CURRENT_WORK.md` with your task

**When planning for Claude**:
1. Create plan in `.ai/plans/{task_name}.md`
2. Update `CURRENT_WORK.md` with handoff
3. Tell user: "Ready for Claude Code to execute"

---

### **For Claude Code**

**Before starting work**:
1. Read `.ai/CONTEXT.md` for project status
2. Read `.ai/CURRENT_WORK.md` to avoid conflicts
3. Update `CURRENT_WORK.md` with your task

**When executing Antigravity's plan**:
1. Read plan from `.ai/plans/{task_name}.md`
2. Execute all steps
3. Create summary in `.ai/completed/{task_name}.md`
4. Update `CURRENT_WORK.md` with completion

---

## 💰 Cost Optimization

**KEY PRINCIPLE**: Use Antigravity (cheap) for planning, Claude Code (expensive) for execution

**Example Savings**:
- **Without coordination**: 20 Claude messages = $7
- **With coordination**: 12 Antigravity + 3 Claude = $1.17
- **Savings**: 83% cost reduction! 💰

**How**:
1. Long conversations → Antigravity
2. Multiple file edits → Batch in ONE Claude message
3. Planning → Antigravity creates detailed plan
4. Execution → Claude follows plan (fewer messages)

---

## 📋 Task Routing (Quick Reference)

| Task Type | Use This AI |
|-----------|-------------|
| Edit file | Claude Code |
| Run terminal command | Claude Code |
| Git operations | Claude Code |
| Research/analyze | Antigravity |
| Plan feature | Antigravity |
| Long conversation | Antigravity |
| Code review | Antigravity |
| Documentation | Antigravity |
| Multi-step task | Both (plan → execute) |

---

## 🔄 Handoff Protocol

### Antigravity → Claude Code
```markdown
1. Create plan: .ai/plans/{task_name}.md
2. Update: CURRENT_WORK.md (handoff section)
3. Tell user: "Ready for Claude Code"
```

### Claude Code → Antigravity
```markdown
1. Create summary: .ai/completed/{task_name}.md
2. Update: CURRENT_WORK.md (completion section)
3. Tell user: "Implementation complete"
```

---

## 🎯 Example Workflow

**Task**: Implement module boundaries linter

```
1. USER → ANTIGRAVITY:
   "Design module boundaries linter"

2. ANTIGRAVITY:
   • Analyzes requirements
   • Designs solution
   • Creates plan: .ai/plans/module_boundaries.md
   • Updates CURRENT_WORK.md
   • Says: "Ready for Claude Code to execute"

3. USER → CLAUDE CODE:
   "Execute plan: .ai/plans/module_boundaries.md"

4. CLAUDE CODE:
   • Reads plan
   • Creates files
   • Writes code
   • Updates CURRENT_WORK.md
   • Says: "Implementation complete"

5. USER → ANTIGRAVITY (optional):
   "Review implementation"
```

**Result**:
- Antigravity: 12 messages (cheap)
- Claude Code: 3 messages (expensive)
- Total cost: 83% cheaper than Claude-only!

---

## ✅ Benefits

1. ✅ **No Conflicts** - Clear ownership via CURRENT_WORK.md
2. ✅ **Cost Savings** - 70-80% cheaper (use Antigravity for planning)
3. ✅ **Better Quality** - Each AI does what it's best at
4. ✅ **Shared Context** - Both read from CONTEXT.md
5. ✅ **Efficient Handoffs** - Structured plans/summaries

---

## 📚 Full Documentation

Read **[AI_ORCHESTRATION.md](AI_ORCHESTRATION.md)** for:
- Complete handoff protocols
- Cost optimization strategies
- Batch operation templates
- Auto-switch triggers
- Decision trees

---

**Version**: 1.0.0
**Created**: 2026-03-04
**Status**: ✅ Active
