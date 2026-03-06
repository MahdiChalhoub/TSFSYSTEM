# 🤖 AI Orchestration System

**Purpose**: Coordinate Antigravity and Claude Code to work together without conflicts

**Version**: 1.0.0
**Date**: 2026-03-04

---

## 📋 **The Problem**

You have **two AI systems** that need to work together:

1. **Antigravity** (Gemini-based) - Long conversations, research, architecture
2. **Claude Code** (Claude-based) - Code editing, file operations, terminal access

**Challenges**:
- ❌ Conflicts (both trying to edit same file)
- ❌ Duplicate work (both doing same task)
- ❌ Different context (one doesn't know what other did)
- ❌ Credit waste (using Claude when Antigravity could do it)

---

## ✅ **The Solution: Task Routing + Shared Context**

```
┌─────────────────────────────────────────────────────────────┐
│                          YOU                                │
│                   (Task Coordinator)                        │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             ▼                            ▼
┌────────────────────────┐   ┌───────────────────────────────┐
│     ANTIGRAVITY        │   │      CLAUDE CODE              │
│   (Research & Plan)    │   │   (Execute & Code)            │
│                        │   │                               │
│ • Architecture design  │   │ • File editing                │
│ • Research & analysis  │   │ • Code writing                │
│ • Documentation        │   │ • Git operations              │
│ • Long conversations   │   │ • Terminal commands           │
│ • Planning             │   │ • Quick fixes                 │
└────────────────────────┘   └───────────────────────────────┘
             │                            │
             └────────────┬───────────────┘
                          ▼
             ┌────────────────────────────┐
             │   SHARED SOURCE OF TRUTH   │
             │                            │
             │ • .ai/CONTEXT.md           │
             │ • .ai/CURRENT_WORK.md      │
             │ • .ai/ROUTING_RULES.yaml   │
             │ • .claude/ agents/skills   │
             │ • Documentation files      │
             └────────────────────────────┘
```

---

## 🎯 **Task Routing Rules**

### **When to Use Antigravity** (Gemini)

✅ **USE ANTIGRAVITY FOR**:
- Architecture design and system planning
- Research and analysis (reading lots of files)
- Documentation writing
- Long conversations (>10 back-and-forth)
- Explaining complex concepts
- Code review and suggestions
- Planning multi-step tasks
- Creating diagrams and specifications

**Why**: Antigravity has better context retention, cheaper for long conversations

---

### **When to Use Claude Code** (Claude)

✅ **USE CLAUDE CODE FOR**:
- File editing and code writing
- Creating new files
- Git operations (commit, push, PR)
- Terminal commands (npm, python, migrations)
- Quick bug fixes
- Refactoring code
- Running tests
- One-shot tasks (<5 steps)

**Why**: Claude Code has direct file access, better at precise code edits

---

### **Decision Tree**

```
Is it a CODE EDIT or FILE OPERATION?
├─ YES → Use Claude Code
└─ NO → Is it RESEARCH, PLANNING, or LONG CONVERSATION?
    ├─ YES → Use Antigravity
    └─ NO → Is it a MULTI-STEP TASK requiring PLANNING + EXECUTION?
        ├─ YES → Antigravity plans, Claude Code executes
        └─ NO → Your choice!
```

---

## 📁 **Shared Source of Truth**

### **File Structure**

```
.ai/
├── AI_ORCHESTRATION.md        # This file (how to coordinate AIs)
├── CONTEXT.md                  # Current project context (both AIs read this)
├── CURRENT_WORK.md            # What's being worked on NOW
├── ROUTING_RULES.yaml         # Task routing rules
├── HANDOFF_PROTOCOL.md        # How to hand off between AIs
└── CHANGELOG.md               # What each AI did

.claude/
├── CLAUDE.md                  # Claude Code master config
├── agents/                    # Agent definitions (both AIs use)
└── commands/                  # Slash commands

.antigravity/
├── CONTEXT.md                 # Antigravity-specific context
└── agents/                    # Antigravity agents (if separate)

Documentation/
├── KERNEL_COMPLETE_V2.md      # Source of truth for kernel
├── ARCHITECTURE_DIAGRAM.md    # System architecture
└── MODULE_BOUNDARIES.yaml     # Module ownership rules
```

---

## 📝 **Shared Context System**

### **CONTEXT.md** (Read by Both AIs)

```markdown
# Project Context (Source of Truth)

## Current Status
- Kernel OS v2.0: ✅ COMPLETE (8 components)
- Next phase: Module boundaries enforcement

## Active Work
- WHO: Claude Code
- WHAT: Implementing module boundaries linter
- STATUS: In progress
- FILES TOUCHED: scripts/check_module_boundaries.py

## Recent Changes
- 2026-03-04: Kernel OS v2.0 completed (Antigravity + Claude Code)
- 2026-03-04: Created 54 kernel files
- 2026-03-04: Added module.json for 6 modules

## Architecture Decisions
- Event-driven communication between modules
- Contracts registry for interface definitions
- Module loader for enable/disable per tenant

## Do NOT Touch (Locked Files)
- erp_backend/kernel/ (complete, don't modify unless planned)
- apps/*/module.json (reviewed and approved)
```

### **CURRENT_WORK.md** (Active Task Tracker)

```markdown
# Current Work (Updated in Real-Time)

## Active Task
**Task**: Implement module boundaries linter
**Owner**: Claude Code
**Status**: In Progress (50%)
**Started**: 2026-03-04 14:30
**ETA**: 2026-03-04 16:00

## Files Being Modified
- `scripts/check_module_boundaries.py` (Claude Code)
- `.module_boundaries.yaml` (Claude Code)

## Next Task (Queued)
**Task**: Define event contracts for finance module
**Owner**: Antigravity (planning) → Claude Code (implementation)
**Status**: Not Started

## Blocked/Waiting
- None

## Recent Completed
- ✅ Kernel OS v2.0 (Antigravity + Claude Code)
- ✅ Module.json for 6 modules (Claude Code)
```

---

## 🔄 **Handoff Protocol**

### **Antigravity → Claude Code**

**When Antigravity finishes planning**:

1. **Update CURRENT_WORK.md**:
```markdown
## Handoff to Claude Code

**Task**: Implement module boundaries linter
**Plan**: See .ai/plans/module_boundaries_plan.md
**Files to Create**:
- scripts/check_module_boundaries.py
- .module_boundaries.yaml
**Estimated Time**: 1-2 hours
**Ready**: ✅ YES
```

2. **Create detailed plan** (`.ai/plans/MODULE_NAME_plan.md`):
```markdown
# Module Boundaries Linter - Implementation Plan

## Objective
Build linter to prevent cross-module database writes

## Files to Create
1. `scripts/check_module_boundaries.py`
   - Parse .module_boundaries.yaml
   - Scan Python files for violations
   - Report violations

2. `.module_boundaries.yaml`
   - Document module ownership
   - List allowed/forbidden patterns

## Pseudocode
[Detailed implementation steps]

## Expected Output
[What success looks like]
```

3. **Tell user**:
> "✅ Planning complete! Handoff to Claude Code.
>
> **Next**: Ask Claude Code to execute the plan in `.ai/plans/module_boundaries_plan.md`"

---

### **Claude Code → Antigravity**

**When Claude Code finishes implementation**:

1. **Update CURRENT_WORK.md**:
```markdown
## Completed Task

**Task**: Implement module boundaries linter
**Owner**: Claude Code
**Status**: ✅ COMPLETE
**Completed**: 2026-03-04 16:00

**Files Created**:
- scripts/check_module_boundaries.py (150 lines)
- .module_boundaries.yaml (80 lines)

**Handoff to Antigravity**: For documentation and next steps planning
```

2. **Create summary** (`.ai/completed/TASK_NAME_summary.md`):
```markdown
# Module Boundaries Linter - Completion Summary

## What Was Built
- Linter script that detects cross-module writes
- YAML config documenting ownership
- Pre-commit hook integration

## Testing
- ✅ Detects violations in test files
- ✅ Allows valid patterns
- ✅ Reports clear error messages

## Next Steps (for Antigravity)
- Review implementation
- Update documentation
- Plan next phase
```

3. **Tell user**:
> "✅ Implementation complete!
>
> **Next**: Ask Antigravity to review and plan next steps"

---

## 🎛️ **Task Routing Config**

### **ROUTING_RULES.yaml**

Create `.ai/ROUTING_RULES.yaml`:

```yaml
# Task Routing Rules
# Determines which AI should handle which tasks

routing_rules:
  # Code operations → Claude Code
  code_editing:
    handler: claude_code
    patterns:
      - "edit file"
      - "modify code"
      - "fix bug"
      - "refactor"
      - "create file"
    confidence: 0.95

  # Terminal operations → Claude Code
  terminal:
    handler: claude_code
    patterns:
      - "run command"
      - "execute script"
      - "git commit"
      - "npm install"
      - "python manage.py"
    confidence: 0.95

  # Research & planning → Antigravity
  research:
    handler: antigravity
    patterns:
      - "explain"
      - "analyze"
      - "design architecture"
      - "plan implementation"
      - "review code"
    confidence: 0.90

  # Documentation → Antigravity
  documentation:
    handler: antigravity
    patterns:
      - "write documentation"
      - "create diagram"
      - "document API"
      - "explain system"
    confidence: 0.85

  # Multi-step tasks → Both (Antigravity plans, Claude executes)
  complex_tasks:
    handler: both
    patterns:
      - "implement feature"
      - "build system"
      - "create module"
    workflow:
      - step: "plan"
        handler: antigravity
      - step: "execute"
        handler: claude_code
      - step: "review"
        handler: antigravity
    confidence: 0.90

# Module-specific routing
module_routing:
  kernel:
    # Kernel is complete, only minor fixes
    allow_modifications: false
    exceptions:
      - "bug fix"
      - "documentation update"
    handler: claude_code  # Quick fixes only

  finance:
    allow_modifications: true
    handler: both  # Planning + execution

  inventory:
    allow_modifications: true
    handler: both

# API usage limits (to save credits)
api_limits:
  claude_code:
    max_messages_per_task: 10
    prefer_single_message: true  # Do multiple edits in one message
    auto_switch_to_antigravity_after: 8  # If conversation goes long

  antigravity:
    no_limit: true  # Cheaper, use freely
```

---

## 💰 **Credit Optimization for Claude Code**

### **Strategy 1: Batch Operations**

**BEFORE** (wasteful):
```
You: "Edit file A"
Claude: [Edits A]
You: "Now edit file B"
Claude: [Edits B]
You: "Now edit file C"
Claude: [Edits C]
# Cost: 6 messages (3 requests + 3 responses)
```

**AFTER** (optimized):
```
You: "Edit files A, B, and C with these changes:
  A: [change]
  B: [change]
  C: [change]"
Claude: [Edits all 3 files in parallel]
# Cost: 2 messages (1 request + 1 response)
```

**Savings**: 66% fewer messages!

---

### **Strategy 2: Use Antigravity for Planning**

**BEFORE**:
```
You → Claude: "How should I implement feature X?"
Claude: [Long explanation]
You: "OK implement it"
Claude: [Implements]
# Cost: 4+ messages
```

**AFTER**:
```
You → Antigravity: "How should I implement feature X?"
Antigravity: [Long explanation, creates plan]
You → Claude: "Execute plan in .ai/plans/feature_x.md"
Claude: [Implements from plan]
# Cost: Only 2 Claude messages (saved 50%!)
```

---

### **Strategy 3: Single-Message Execution**

**Create execution templates**:

`.ai/templates/multi_file_edit.md`:
```markdown
# Multi-File Edit Template

Use this when you need Claude to edit multiple files:

"Execute the following changes in a SINGLE message:

1. Edit `file1.py`:
   - Change: [description]
   - Code: [snippet]

2. Create `file2.py`:
   - Content: [full file]

3. Edit `file3.py`:
   - Change: [description]
   - Code: [snippet]

Use the parallel tool calling feature to do all edits simultaneously."
```

**Result**: 1 message instead of 3!

---

### **Strategy 4: Limit Conversation Length**

Create `.ai/AUTO_SWITCH.yaml`:
```yaml
# Auto-switch to Antigravity after N messages
auto_switch:
  enabled: true
  claude_message_limit: 8

  trigger_phrases:
    - "Let me explain more..."
    - "There are several approaches..."
    - "We need to discuss..."

  action: |
    When Claude conversation reaches 8 messages:
    1. Ask user: "Switch to Antigravity for planning?"
    2. If yes, save context to .ai/CONTEXT.md
    3. Tell user: "Continue with Antigravity using context from CONTEXT.md"
```

---

## 🔧 **Practical Workflows**

### **Workflow 1: Implement New Feature**

```
┌─────────────────────────────────────────────────────┐
│ STEP 1: Planning (Antigravity)                     │
├─────────────────────────────────────────────────────┤
│ You → Antigravity:                                  │
│   "Design a cash reconciliation feature for POS"   │
│                                                     │
│ Antigravity:                                        │
│   • Analyzes existing POS code                     │
│   • Designs database schema                        │
│   • Creates implementation plan                    │
│   • Writes to .ai/plans/cash_reconciliation.md    │
│   • Updates CURRENT_WORK.md                        │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ STEP 2: Implementation (Claude Code)               │
├─────────────────────────────────────────────────────┤
│ You → Claude Code:                                  │
│   "Execute plan: .ai/plans/cash_reconciliation.md" │
│                                                     │
│ Claude Code:                                        │
│   • Reads plan                                     │
│   • Creates models, views, migrations             │
│   • Writes tests                                   │
│   • Updates CURRENT_WORK.md                        │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ STEP 3: Review (Antigravity)                       │
├─────────────────────────────────────────────────────┤
│ You → Antigravity:                                  │
│   "Review implementation of cash reconciliation"    │
│                                                     │
│ Antigravity:                                        │
│   • Reviews code                                   │
│   • Checks for issues                              │
│   • Suggests improvements                          │
│   • Updates documentation                          │
└─────────────────────────────────────────────────────┘
```

**Cost**:
- Antigravity: ~20 messages (cheap)
- Claude Code: ~3 messages (expensive but minimal)

**Without orchestration**: Claude Code ~20 messages (4x cost!)

---

### **Workflow 2: Bug Fix**

```
Small bug → Claude Code directly (1-2 messages)
Complex bug → Antigravity diagnoses → Claude fixes
```

---

### **Workflow 3: Module Update**

```
┌────────────────────────────────────────────────┐
│ You specify: "Update inventory module"        │
└────────────────────────────────────────────────┘
                    ↓
          Check ROUTING_RULES.yaml
                    ↓
         ┌──────────┴──────────┐
         ▼                     ▼
   MODULE LOCKED?         MODULE ACTIVE?
         │                     │
         NO                   YES
         │                     │
         ▼                     ▼
   Allow updates        Use "both" workflow
         │                     │
         └──────────┬──────────┘
                    ▼
         Antigravity plans → Claude executes
```

---

## 🎯 **Implementation: Set This Up Now**

### **Step 1: Create Files**

```bash
# Create AI orchestration directory
mkdir -p .ai/{plans,completed,templates}

# Create core files
touch .ai/CONTEXT.md
touch .ai/CURRENT_WORK.md
touch .ai/ROUTING_RULES.yaml
touch .ai/HANDOFF_PROTOCOL.md
touch .ai/CHANGELOG.md
```

### **Step 2: Initialize CONTEXT.md**

I'll create this for you with current project state.

### **Step 3: Create Routing Rules**

I'll create ROUTING_RULES.yaml with your preferences.

### **Step 4: Document Handoff Protocol**

I'll create HANDOFF_PROTOCOL.md with examples.

---

## 📊 **Credit Usage Comparison**

### **Scenario: Implement Module Boundaries Linter**

**WITHOUT Orchestration (Claude only)**:
```
Messages: 15-20
Cost: ~$5-7 (assuming $0.35/message)
Time: 2-3 hours
```

**WITH Orchestration (Antigravity + Claude)**:
```
Antigravity: 12 messages ($0.01 each) = $0.12
Claude Code: 3 messages ($0.35 each) = $1.05
Total: $1.17
Time: 1.5 hours
```

**Savings**: 83% cost reduction! 💰

---

## ✅ **Quick Reference**

### **Task Decision Matrix**

| Task Type | Use This AI | Why |
|-----------|-------------|-----|
| File editing | Claude Code | Direct file access |
| Terminal commands | Claude Code | Bash integration |
| Git operations | Claude Code | Git integration |
| Architecture design | Antigravity | Better context, cheaper |
| Code review | Antigravity | Analysis strengths |
| Long conversation | Antigravity | Context retention |
| Planning | Antigravity | System thinking |
| Quick fix (<5 steps) | Claude Code | Fast execution |
| Research | Antigravity | Search & analysis |
| Documentation | Antigravity | Writing strengths |

---

## 🚀 **Next Steps**

**I can create the full orchestration system for you right now!**

**What I'll build**:
1. ✅ CONTEXT.md with current project state
2. ✅ CURRENT_WORK.md template
3. ✅ ROUTING_RULES.yaml with your rules
4. ✅ HANDOFF_PROTOCOL.md with examples
5. ✅ Templates for common tasks
6. ✅ Auto-switch detection script

**Should I create these files now?** (Yes/No)

---

**Version**: 1.0.0
**Created**: 2026-03-04
**Status**: ✅ Design Complete - Ready to Implement
