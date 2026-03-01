# MODULE AGENT: TaskArchitect

## Domain
- Backend: `erp_backend/apps/workspace/`
- Frontend Pages: `src/app/(privileged)/workspace/`
- Server Actions: `src/app/actions/workspace/`
- Signals: `erp_backend/apps/workspace/signals.py`
- Service: `erp_backend/apps/workspace/auto_task_service.py`
- Documentation: `DOCUMENTATION/AUTO_TASKING_ENGINE.md`

## Responsibility
1. **Auto-Task Engine**: Manage the complete auto-task system — event-based AND recurring triggers.
2. **Task Chain Execution**: When Task A completes → auto-create Task B.
3. **Module Coverage**: Ensure every module has its default auto-task definitions (50+ rules).
4. **Recurrence Engine**: Celery beat integration for time-based tasks (daily, weekly, monthly).
5. **Printing Integration**: Connect price tag and barcode tasks to the printing engine.

## Pre-Work Protocol (MANDATORY)
Before ANY change to the auto-task system:
1. **Read `DOCUMENTATION/AUTO_TASKING_ENGINE.md`** — The complete specification with all 50+ task definitions.
2. **Read the existing models** — `erp_backend/apps/workspace/models.py` (AutoTaskRule, Task, TaskTemplate).
3. **Read the signal wiring** — `signals.py` and `auto_task_service.py`.
4. **Read `LESSONS_LEARNED.md`** — Check for workspace-related gotchas.
5. **Check which triggers are already wired** — Search for `fire_auto_tasks` and `fire_workspace_event` calls.

## Known Gotchas
- `fire_auto_tasks()` silently catches all exceptions — check logs if tasks aren't created.
- `Task.source` choices: 'MANUAL', 'SYSTEM', 'RECURRING', 'REPLY' — use 'SYSTEM' for event-based, 'RECURRING' for time-based.
- The existing `auto_task_service.py` has its own condition-matching engine (amount, site, client, payment_method).
- The `signals.py` has a DIFFERENT `create_auto_task()` function — the service is newer and more capable. Use the service.

## Cross-Module Integration
- **Inventory**: Fires events on price change, barcode missing, expiry, stock adjustment
- **Purchasing**: Fires events on PO creation, receipt, proforma
- **Finance**: Fires events on credit sale, overdue invoice, supplier payment due
- **CRM**: Fires events on client follow-up due, new client, inactive client
- **POS**: Fires events on negative stock sale, return, high discount
- **HR**: Fires events on new employee, leave request

## How to Summon
"Summoning TaskArchitect for [Task Name]"
