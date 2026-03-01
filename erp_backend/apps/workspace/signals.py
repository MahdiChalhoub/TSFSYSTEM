"""
Workspace Module — Signals & Trigger Wiring
Connects business events from ALL modules to the auto-task engine.

This file provides:
1. Legacy signal-based approach (fire_workspace_event)
2. The new service-based approach (fire_auto_tasks from auto_task_service)
3. Convenience wrappers that any module can call
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# LEGACY: Direct task creation from rule (kept for backward compatibility)
# ─────────────────────────────────────────────────────────────────────────────

def create_auto_task(organization, rule, context_label='', context_type='', context_id=None):
    """
    Create a task from an AutoTaskRule.
    Called by signal handlers when trigger events occur.
    """
    from .models import Task
    try:
        task = Task.objects.create(
            organization=organization,
            title=f"{rule.template.name}: {context_label}" if context_label else rule.template.name,
            description=rule.template.description,
            category=rule.template.category,
            template=rule.template,
            auto_rule=rule,
            priority=rule.priority or rule.template.default_priority,
            points=rule.template.default_points,
            estimated_minutes=rule.template.estimated_minutes,
            source='AUTO',
            related_object_type=context_type,
            related_object_id=context_id,
            related_object_label=context_label,
        )
        # Auto-assign
        if rule.assign_to_user:
            task.assigned_to = rule.assign_to_user
            task.save(update_fields=['assigned_to'])
        elif rule.template.assign_to_role:
            from erp.models import User
            assignees = User.objects.filter(
                organization=organization,
                role=rule.template.assign_to_role,
                is_active=True,
            )
            first_user = assignees.first()
            if first_user:
                task.assigned_to = first_user
                task.save(update_fields=['assigned_to'])

        logger.info(f"Auto-task created: {task.title} (Rule: {rule.name})")
        return task
    except Exception as e:
        logger.error(f"Failed to create auto-task from rule {rule.name}: {e}")
        return None


def fire_workspace_event(organization, trigger_event, context_label='', context_type='', context_id=None, conditions=None):
    """
    Fire a workspace event that triggers auto-task creation.
    Called by other modules' signals.
    """
    from .models import AutoTaskRule
    rules = AutoTaskRule.objects.filter(
        organization=organization,
        trigger_event=trigger_event,
        is_active=True,
    ).select_related('template', 'template__category')

    for rule in rules:
        # Check conditions if specified
        if rule.conditions and conditions:
            match = all(
                conditions.get(k) == v
                for k, v in rule.conditions.items()
            )
            if not match:
                continue
        create_auto_task(organization, rule, context_label, context_type, context_id)


# ─────────────────────────────────────────────────────────────────────────────
# NEW: Module trigger hooks — call from anywhere in the system
# ─────────────────────────────────────────────────────────────────────────────

def trigger_inventory_event(organization, event, **kwargs):
    """
    Fire an inventory-related auto-task trigger.

    Usage:
        from apps.workspace.signals import trigger_inventory_event
        trigger_inventory_event(org, 'PRICE_CHANGE', product_name='Coca-Cola', reference='PROD-123')
        trigger_inventory_event(org, 'LOW_STOCK', product_name='Sugar', product_id=45)
        trigger_inventory_event(org, 'BARCODE_MISSING_PURCHASE', product_name='New Item', amount=50)
    """
    from .auto_task_service import fire_auto_tasks
    return fire_auto_tasks(organization, event, {
        'product_id': kwargs.get('product_id'),
        'product_name': kwargs.get('product_name', ''),
        'reference': kwargs.get('reference', ''),
        'amount': kwargs.get('amount', 0),
        'site_id': kwargs.get('site_id'),
        'user': kwargs.get('user'),
        'extra': kwargs.get('extra', {}),
    })


def trigger_purchasing_event(organization, event, **kwargs):
    """
    Fire a purchasing-related auto-task trigger.

    Usage:
        trigger_purchasing_event(org, 'PURCHASE_ENTERED', reference='PO-2026-0042')
        trigger_purchasing_event(org, 'PURCHASE_NO_ATTACHMENT', reference='PO-2026-0042')
        trigger_purchasing_event(org, 'NEW_SUPPLIER', reference='ACME Corp')
    """
    from .auto_task_service import fire_auto_tasks
    return fire_auto_tasks(organization, event, {
        'reference': kwargs.get('reference', ''),
        'amount': kwargs.get('amount', 0),
        'site_id': kwargs.get('site_id'),
        'user': kwargs.get('user'),
        'extra': kwargs.get('extra', {}),
    })


def trigger_finance_event(organization, event, **kwargs):
    """
    Fire a finance/POS-related auto-task trigger.

    Usage:
        trigger_finance_event(org, 'CREDIT_SALE', amount=500000, client_id=12, user=cashier)
        trigger_finance_event(org, 'HIGH_VALUE_SALE', amount=2000000, reference='INV-0042')
        trigger_finance_event(org, 'POS_RETURN', amount=50000, cashier_id=5)
    """
    from .auto_task_service import fire_auto_tasks
    return fire_auto_tasks(organization, event, {
        'amount': kwargs.get('amount', 0),
        'client_id': kwargs.get('client_id'),
        'cashier_id': kwargs.get('cashier_id'),
        'site_id': kwargs.get('site_id'),
        'payment_method': kwargs.get('payment_method', ''),
        'user': kwargs.get('user'),
        'reference': kwargs.get('reference', ''),
        'extra': kwargs.get('extra', {}),
    })


def trigger_crm_event(organization, event, **kwargs):
    """
    Fire a CRM-related auto-task trigger.

    Usage:
        trigger_crm_event(org, 'NEW_CLIENT', reference='John Doe', client_id=15)
        trigger_crm_event(org, 'CLIENT_COMPLAINT', reference='Complaint #42', client_id=15)
    """
    from .auto_task_service import fire_auto_tasks
    return fire_auto_tasks(organization, event, {
        'client_id': kwargs.get('client_id'),
        'reference': kwargs.get('reference', ''),
        'user': kwargs.get('user'),
        'extra': kwargs.get('extra', {}),
    })


def trigger_hr_event(organization, event, **kwargs):
    """
    Fire an HR-related auto-task trigger.

    Usage:
        trigger_hr_event(org, 'EMPLOYEE_ONBOARD', reference='Jane Smith', user=new_user)
        trigger_hr_event(org, 'LEAVE_REQUEST', reference='Vacation 2026-03', user=employee)
    """
    from .auto_task_service import fire_auto_tasks
    return fire_auto_tasks(organization, event, {
        'reference': kwargs.get('reference', ''),
        'user': kwargs.get('user'),
        'extra': kwargs.get('extra', {}),
    })


def trigger_system_event(organization, event, **kwargs):
    """
    Fire a system-level auto-task trigger.

    Usage:
        trigger_system_event(org, 'USER_REGISTRATION', reference='new_user@example.com')
        trigger_system_event(org, 'REPORT_NEEDS_REVIEW', reference='Monthly Sales Report')
    """
    from .auto_task_service import fire_auto_tasks
    return fire_auto_tasks(organization, event, {
        'reference': kwargs.get('reference', ''),
        'user': kwargs.get('user'),
        'extra': kwargs.get('extra', {}),
    })
