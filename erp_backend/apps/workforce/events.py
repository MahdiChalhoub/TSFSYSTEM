"""
WISE Engine — Event Subscribers
=================================
Cross-module event listeners that translate domain events into
Workforce Intelligence scores. All handlers are registered on app startup.

Event Coverage:
  CRM       → crm.interaction.recorded, crm.contact.type_converted
  Finance   → invoice.created, invoice.paid, invoice.voided, finance.expense.unauthorized
  HR        → hr.attendance.late, hr.attendance.on_time, hr.absence.unexcused
  POS       → order.completed, pos.session.closed (clean/overage/shortage)
  Inventory → inventory.insufficient_stock, inventory.expiry_waste, stock_count.accurate
  Workspace → task.completed, workspace.task.overdue
  Procurement → procurement.po.on_time, procurement.po.late
  WISE      → workforce.badges_awarded (cross-module notification hook)
"""

import logging
from kernel.events import subscribe_to_event
from .services import WorkforceScoreEngine
from erp.connector_registry import connector
Employee = connector.require('hr.employees.get_model', org_id=0, source='workforce')

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_employee_by_user(user_id, organization_id):
    """Resolve user_id → Employee."""
    if not user_id:
        return None
    return Employee.objects.filter(user_id=user_id, organization_id=organization_id).first()


def _get_employee_by_id(employee_id, organization_id):
    """Resolve employee_id → Employee."""
    if not employee_id:
        return None
    return Employee.objects.filter(id=employee_id, organization_id=organization_id).first()


def _safe_record(employee, event_code, module, payload=None):
    """Fire a WISE event, suppressing all exceptions so handlers never crash callers."""
    try:
        WorkforceScoreEngine.record_event(
            employee=employee,
            event_code=event_code,
            module=module,
            metadata=payload or {}
        )
    except Exception as exc:
        logger.warning(f"WISE: Non-critical scoring error for {event_code}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# CRM MODULE
# ─────────────────────────────────────────────────────────────────────────────

@subscribe_to_event('crm.interaction.recorded')
def on_crm_interaction_recorded(event):
    """CRM follow-up outcome → scoring."""
    payload  = event.payload
    outcome  = payload.get('outcome')
    employee = _get_employee_by_user(payload.get('user_id'), event.organization_id)
    if not employee:
        return

    code_map = {'SUCCESS': 'followup_completed_success', 'FAILED': 'followup_completed_failed'}
    event_code = code_map.get(outcome)
    if event_code:
        _safe_record(employee, event_code, 'crm', payload)


@subscribe_to_event('crm.contact.type_converted')
def on_crm_contact_converted(event):
    """Lead conversion → bonus points."""
    payload  = event.payload
    employee = _get_employee_by_user(payload.get('user_id'), event.organization_id)
    if not employee:
        return

    if payload.get('old_type') == 'LEAD' and payload.get('new_type') in ('CUSTOMER', 'BOTH'):
        _safe_record(employee, 'lead_converted', 'crm', payload)


# ─────────────────────────────────────────────────────────────────────────────
# FINANCE MODULE
# ─────────────────────────────────────────────────────────────────────────────

@subscribe_to_event('invoice.created')
def on_invoice_created(event):
    """Invoice posting → accuracy score."""
    payload  = event.payload
    user_id  = event.triggered_by_id or payload.get('user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'invoice_posted', 'finance', payload)


@subscribe_to_event('invoice.paid')
def on_invoice_paid(event):
    """Payment collection → productivity score."""
    payload  = event.payload
    user_id  = event.triggered_by_id or payload.get('user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'payment_collected', 'finance', payload)


@subscribe_to_event('finance.expense.unauthorized')
def on_finance_expense_unauthorized(event):
    """
    Unauthorized or policy-violating expense submitted.
    Triggers a COMPLIANCE penalty.
    """
    payload  = event.payload
    user_id  = event.triggered_by_id or payload.get('submitted_by_user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'unauthorized_expense', 'finance', payload)


# ─────────────────────────────────────────────────────────────────────────────
# HR MODULE
# ─────────────────────────────────────────────────────────────────────────────

@subscribe_to_event('hr.attendance.late')
def on_hr_attendance_late(event):
    """Late arrival → attendance penalty."""
    payload  = event.payload
    employee = _get_employee_by_id(payload.get('employee_id'), event.organization_id)
    if employee:
        _safe_record(employee, 'attendance_late', 'hr', payload)


@subscribe_to_event('hr.attendance.on_time')
def on_hr_attendance_on_time(event):
    """On-time arrival → attendance reward (daily capped by rule)."""
    payload  = event.payload
    employee = _get_employee_by_id(payload.get('employee_id'), event.organization_id)
    if employee:
        _safe_record(employee, 'attendance_on_time', 'hr', payload)


@subscribe_to_event('hr.absence.unexcused')
def on_hr_absence_unexcused(event):
    """Unexcused absence → critical attendance penalty."""
    payload  = event.payload
    employee = _get_employee_by_id(payload.get('employee_id'), event.organization_id)
    if employee:
        _safe_record(employee, 'absence_unexcused', 'hr', payload)


# ─────────────────────────────────────────────────────────────────────────────
# POS MODULE
# ─────────────────────────────────────────────────────────────────────────────

@subscribe_to_event('order.completed')
def on_order_completed(event):
    """
    POS sale completed cleanly → productivity score for cashier.
    The `order.completed` payload includes triggered_by (the cashier user).
    """
    payload  = event.payload
    user_id  = event.triggered_by_id or payload.get('cashier_user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'invoice_posted', 'sales', payload)


@subscribe_to_event('pos.session.closed')
def on_pos_session_closed(event):
    """
    POS session close → score based on cash discrepancy.
    Payload should include: discrepancy_amount, cashier_user_id.
    """
    payload     = event.payload
    user_id     = event.triggered_by_id or payload.get('cashier_user_id')
    discrepancy = abs(float(payload.get('discrepancy_amount', 0)))
    employee    = _get_employee_by_user(user_id, event.organization_id)
    if not employee:
        return

    if discrepancy == 0:
        _safe_record(employee, 'pos_session_closed_clean', 'sales', payload)
    elif discrepancy < 5:
        # Small discrepancy — minor overage, no penalty
        _safe_record(employee, 'cash_overage', 'sales', payload)
    else:
        # Material shortage — heavier penalty (rule handles severity)
        _safe_record(employee, 'cash_shortage', 'sales', payload)


# ─────────────────────────────────────────────────────────────────────────────
# INVENTORY MODULE
# ─────────────────────────────────────────────────────────────────────────────

@subscribe_to_event('inventory.insufficient_stock')
def on_inventory_insufficient_stock(event):
    """
    Stock shortage found during stock count / fulfillment.
    Penalises the responsible warehouse user.
    """
    payload  = event.payload
    user_id  = event.triggered_by_id or payload.get('responsible_user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'stock_shortage', 'inventory', payload)


@subscribe_to_event('inventory.expiry_waste')
def on_inventory_expiry_waste(event):
    """Expired stock written off — Critical discipline penalty."""
    payload  = event.payload
    user_id  = event.triggered_by_id or payload.get('responsible_user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'expiry_waste', 'inventory', payload)


@subscribe_to_event('inventory.stock_count.accurate')
def on_stock_count_accurate(event):
    """Accurate stock count submitted — accuracy reward."""
    payload  = event.payload
    user_id  = event.triggered_by_id or payload.get('counted_by_user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'stock_count_accurate', 'inventory', payload)


# ─────────────────────────────────────────────────────────────────────────────
# WORKSPACE / TASK MODULE
# ─────────────────────────────────────────────────────────────────────────────

@subscribe_to_event('task.completed')
def on_task_completed(event):
    """Task completed → timeliness / productivity score for assignee."""
    payload  = event.payload
    # Prefer employee_id direct resolution; fall back to user lookup
    employee = _get_employee_by_id(payload.get('employee_id'), event.organization_id)
    if not employee:
        user_id = event.triggered_by_id or payload.get('assignee_user_id')
        employee = _get_employee_by_user(user_id, event.organization_id)
    if not employee:
        return

    # is_on_time is emitted by workspace models; on_time is the legacy field from events
    on_time = payload.get('is_on_time', payload.get('on_time', True))
    event_code = 'task_completed_early' if on_time else 'task_overdue'
    _safe_record(employee, event_code, 'workspace', payload)


@subscribe_to_event('workspace.task.overdue')
def on_task_overdue(event):
    """
    Task past due date without completion.
    A system cron emits this for every overdue task at daily review.
    """
    payload  = event.payload
    user_id  = payload.get('assignee_user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'task_overdue', 'workspace', payload)


# ─────────────────────────────────────────────────────────────────────────────
# PROCUREMENT MODULE
# ─────────────────────────────────────────────────────────────────────────────

@subscribe_to_event('procurement.po.on_time')
def on_procurement_po_on_time(event):
    """Purchase order received on or before expected date → reliability reward."""
    payload  = event.payload
    user_id  = event.triggered_by_id or payload.get('buyer_user_id') or payload.get('receiver_user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'po_received_on_time', 'procurement', payload)


@subscribe_to_event('procurement.po.late')
def on_procurement_po_late(event):
    """Purchase order received significantly late → timeliness penalty."""
    payload  = event.payload
    user_id  = event.triggered_by_id or payload.get('buyer_user_id') or payload.get('receiver_user_id')
    employee = _get_employee_by_user(user_id, event.organization_id)
    if employee:
        _safe_record(employee, 'po_received_late', 'procurement', payload)


# ─────────────────────────────────────────────────────────────────────────────
# WISE ENGINE — SELF-EVENTS
# ─────────────────────────────────────────────────────────────────────────────

@subscribe_to_event('workforce.badges_awarded')
def on_badges_awarded(event):
    """
    All badges for a period have been awarded.
    Notifies managers via workspace task and logs the event.

    Downstream hooks can extend this to push Slack/Email notifications.
    """
    payload = event.payload
    period_key    = payload.get('period_key', 'unknown')
    awarded_count = payload.get('awarded_count', 0)
    organization_id     = event.organization_id

    logger.info(f"[WISE] Badges awarded for period {period_key}: {awarded_count} employees.")

    try:
        Task = connector.require('workspace.tasks.get_model', org_id=0, source='workforce')
        TaskCategory = connector.require('workspace.tasks.get_category_model', org_id=0, source='workforce')
        if not Task or not TaskCategory:
            logger.warning("[WISE] Workspace module not available for badge notification task.")
            return
        from erp.models import User

        category, _ = TaskCategory.objects.get_or_create(
            organization_id=organization_id,
            name='WISE / HR Analytics',
            defaults={'color': '#a78bfa', 'icon': 'BarChart3'}
        )
        manager = User.objects.filter(
            organization_id=organization_id,
            is_staff=True
        ).first()

        if manager:
            Task.objects.create(
                organization_id=organization_id,
                title=f"📊 WISE Period Close: {period_key}",
                description=(
                    f"Workforce Intelligence badges have been awarded for period {period_key}.\n\n"
                    f"• {awarded_count} employees received performance badges.\n\n"
                    f"Review the WISE Command Console for the full leaderboard and any risk escalations."
                ),
                priority='NORMAL',
                status='PENDING',
                source='SYSTEM',
                category=category,
                assigned_to=manager,
            )
    except Exception as exc:
        logger.warning(f"[WISE] Could not create badges notification task: {exc}")
