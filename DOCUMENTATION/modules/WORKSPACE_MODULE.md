# Workspace Module Documentation

## Overview

The Workspace module provides a comprehensive task management, checklist, and employee performance tracking system. It enables organizations to assign, track, and evaluate work across all employees with a points-based gamification system.

**Module Code:** `workspace`  
**Backend Path:** `erp_backend/apps/workspace/`  
**Frontend Path:** `src/app/(privileged)/workspace/`  
**API Base:** `/api/workspace/`

---

## Pages

### 1. TaskBoard (`/workspace/tasks`)

**Goal:** Assign, track, and manage tasks across the organization.

**Data Sources (READ):**
- `workspace_task` — All tasks (filtered to root-level only in list)
- `workspace_taskcategory` — Task categories for filtering
- `workspace_task.dashboard()` — Aggregated KPIs (assigned/pending/in-progress/completed/overdue)
- `erp.User` — Available assignees

**Data Written (SAVE):**
- `workspace_task` — New tasks created, status transitions (start/complete/cancel)
- `workspace_taskcomment` — Comments added to tasks

**Variables User Interacts With:**
- `title`, `description`, `priority` (LOW/MEDIUM/HIGH/URGENT), `category`, `assigned_to`, `due_date`, `points`
- Status actions: Start → In Progress, Complete → Completed, Cancel → Cancelled

**Workflow:**
1. Page loads with SSR: fetches tasks, categories, dashboard stats, and users
2. Dashboard header shows 5 KPIs: Assigned, Pending, In Progress, Done, Overdue
3. Toolbar provides search, status filter, priority filter, and "New Task" button
4. Create form: title*, description, priority, category, assignee, due date, points
5. Task list shows status icon, title, category, assignee, linked context, due date, points, priority badge
6. Hover actions: Start (play), Complete (check), Cancel (X) — with optimistic UI updates

---

### 2. Checklists (`/workspace/checklists`)

**Goal:** Assign shift checklists and daily compliance checks to employees.

**Data Sources (READ):**
- `workspace_checklistinstance` — Active checklist instances (mine=true)
- `workspace_checklisttemplate` — Available templates for assignment
- `erp.User` — Available employees

**Data Written (SAVE):**
- `workspace_checklistinstance` — New checklist assignments
- `workspace_checklistitemresponse` — Item check/uncheck toggles

**Variables User Interacts With:**
- Template selection, employee assignment, date
- Individual item toggle (checked/unchecked)

**Workflow:**
1. Page loads with SSR: fetches my checklists, templates, users
2. Template overview strip shows all available templates with item count and points
3. "Assign Checklist" button opens template/user/date picker
4. Checklist cards show: name, date, assignee, progress bar, completion %, status, points earned
5. Click to expand: reveals individual items with check/uncheck toggles
6. Required items marked in red until checked
7. Auto-completion: when all required items checked, status → COMPLETED

---

### 3. Performance (`/workspace/performance`)

**Goal:** Employee KPI tracking, leaderboard, and performance history.

**Data Sources (READ):**
- `workspace_employeescore` (leaderboard) — Top performers ranked by overall_score
- `workspace_employeescore` (my_performance) — Current user's historical scores
- `workspace_kpiconfig` — Weight configuration for scoring formula

**Data Written (SAVE):**
- None (read-only view; scores computed by backend)

**Variables User Interacts With:**
- Tab switch: Leaderboard / My History
- Period filter for leaderboard

**Workflow:**
1. Page loads with SSR: fetches leaderboard, personal performance, KPI config
2. "Your Performance" card shows 7 metrics: Score, Tier, Completed, Completion%, On-Time%, Points, Overdue
3. Leaderboard tab: ranked list with tier badges (Platinum/Gold/Silver/Bronze), score, completion%, points
4. My History tab: period-by-period scores with progress bars and tier icons
5. KPI Weights card shows the 4-factor breakdown: Tasks, On-Time, Checklists, Evaluations

---

## Database Tables

### Task Management

| Table | Purpose | Read By | Written By |
|-------|---------|---------|------------|
| `workspace_taskcategory` | Task categories with color codes | Tasks page | Admin, API |
| `workspace_tasktemplate` | Reusable task blueprints | Auto-task rules | Admin |
| `workspace_autotaskrule` | Trigger-based auto-task generation | Signals engine | Admin |
| `workspace_task` | Core tasks with hierarchy & workflow | Tasks page | Tasks page, signals |
| `workspace_taskcomment` | Bidirectional task comments | Task detail | Tasks page |
| `workspace_taskattachment` | File attachments on tasks | Task detail | Tasks page |
| `workspace_employeerequest` | Employee-initiated work requests | Admin | Employees |

### Checklists

| Table | Purpose | Read By | Written By |
|-------|---------|---------|------------|
| `workspace_checklisttemplate` | Checklist blueprints with triggers | Checklists page | Admin |
| `workspace_checklisttemplateitem` | Individual items within templates | Checklists page | Admin |
| `workspace_checklistinstance` | Assigned checklist instances | Checklists page | Checklists page |
| `workspace_checklistitemresponse` | Per-item responses (check/notes) | Checklists page | Checklists page |

### Questionnaires & Evaluations

| Table | Purpose | Read By | Written By |
|-------|---------|---------|------------|
| `workspace_questionnaire` | Evaluation questionnaire definitions | Evaluations API | Admin |
| `workspace_questionnairequestion` | Individual questions with types | Evaluations API | Admin |
| `workspace_questionnaireresponse` | Employee evaluation sessions | Performance page | Evaluators |
| `workspace_questionnaireanswer` | Individual answers | Performance page | Evaluators |

### KPI & Scoring

| Table | Purpose | Read By | Written By |
|-------|---------|---------|------------|
| `workspace_kpiconfig` | KPI weight configuration per org | Performance page | Admin |
| `workspace_employeescore` | Computed employee scores per period | Performance page | Backend (signals/tasks) |

---

## API Endpoints

| Endpoint | ViewSet | Actions |
|----------|---------|---------|
| `/api/workspace/categories/` | TaskCategoryViewSet | CRUD |
| `/api/workspace/templates/` | TaskTemplateViewSet | CRUD |
| `/api/workspace/auto-rules/` | AutoTaskRuleViewSet | CRUD |
| `/api/workspace/tasks/` | TaskViewSet | CRUD + start/complete/cancel/add_comment/dashboard |
| `/api/workspace/comments/` | TaskCommentViewSet | CRUD |
| `/api/workspace/requests/` | EmployeeRequestViewSet | CRUD + approve/reject |
| `/api/workspace/checklist-templates/` | ChecklistTemplateViewSet | CRUD + add_item |
| `/api/workspace/checklist-items/` | ChecklistTemplateItemViewSet | CRUD |
| `/api/workspace/checklists/` | ChecklistInstanceViewSet | CRUD + check_item |
| `/api/workspace/questionnaires/` | QuestionnaireViewSet | CRUD + add_question |
| `/api/workspace/questions/` | QuestionnaireQuestionViewSet | CRUD |
| `/api/workspace/evaluations/` | QuestionnaireResponseViewSet | CRUD + submit_answers |
| `/api/workspace/kpi-config/` | KPIConfigViewSet | CRUD |
| `/api/workspace/scores/` | EmployeeScoreViewSet | CRUD + leaderboard/my_performance |

---

## Auto-Task Signal Engine

The `fire_workspace_event()` function in `signals.py` is the public API for other modules to trigger auto-task creation:

```python
from apps.workspace.signals import fire_workspace_event

fire_workspace_event(
    organization=order.organization,
    trigger_event='PO_RECEIVED',
    context_label=f'PO #{order.number}',
    context_type='pos.PurchaseOrder',
    context_id=order.id,
    conditions={'supplier_id': order.supplier_id}
)
```

### Supported Trigger Events
- `ORDER_CREATED` — New sales order
- `PO_RECEIVED` — Purchase order received
- `INVOICE_OVERDUE` — Invoice past due
- `LOW_STOCK` — Stock below threshold
- `NEW_EMPLOYEE` — Employee onboarding
- Custom events via `AutoTaskRule.trigger_event`
