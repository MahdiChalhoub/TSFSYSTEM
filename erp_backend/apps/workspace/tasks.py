"""
Auto-Task Recurring Engine — Celery Beat Task
================================================
Runs periodically (every 15 minutes) to check for RECURRING auto-task rules
that are due to fire based on their interval and last_fired_at timestamp.

Add to celery beat schedule:
    'fire-recurring-auto-tasks': {
        'task': 'apps.workspace.tasks.fire_recurring_auto_tasks',
        'schedule': crontab(minute='*/15'),
    },
"""
import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


@shared_task(name='apps.workspace.tasks.fire_recurring_auto_tasks')
def fire_recurring_auto_tasks():
    """
    Scan all active RECURRING auto-task rules across all organizations.
    For each rule, check if it's due to fire based on recurrence_interval
    and last_fired_at. If due, create the task and update last_fired_at.
    """
    from apps.workspace.models import AutoTaskRule, Task
    from erp.models import Organization

    now = timezone.now()
    total_fired = 0

    rules = AutoTaskRule.objects.filter(
        rule_type='RECURRING',
        is_active=True,
    ).select_related('template', 'template__assign_to_role', 'assign_to_user', 'organization')

    for rule in rules:
        try:
            if not _is_due(rule, now):
                continue

            # Fire the rule
            created = _create_recurring_task(rule, now)
            if created:
                rule.last_fired_at = now
                rule.save(update_fields=['last_fired_at'])
                total_fired += 1

        except Exception as e:
            logger.error(f"Error firing recurring rule {rule.code or rule.id}: {e}")
            continue

    if total_fired > 0:
        logger.info(f"Recurring auto-tasks: {total_fired} tasks created")

    return total_fired


def _is_due(rule, now):
    """Check if a recurring rule is due to fire."""
    if not rule.recurrence_interval:
        return False

    last = rule.last_fired_at
    if not last:
        return True  # Never fired before

    interval = rule.recurrence_interval
    if interval == 'DAILY':
        return (now - last) >= timedelta(hours=20)  # ~daily with buffer
    elif interval == 'WEEKLY':
        return (now - last) >= timedelta(days=6)
    elif interval == 'MONTHLY':
        return (now - last) >= timedelta(days=27)
    elif interval == 'QUARTERLY':
        return (now - last) >= timedelta(days=85)

    return False


def _create_recurring_task(rule, now):
    """Create a task instance from a recurring rule."""
    from apps.workspace.models import Task
    from erp.models import User

    tmpl = rule.template
    if not tmpl:
        return None

    # Determine assignee
    assignee = rule.assign_to_user
    if not assignee and tmpl.assign_to_role:
        # Pick first active user with this role
        assignee = User.objects.filter(
            organization=rule.organization,
            role=tmpl.assign_to_role,
            is_active=True,
        ).first()

    # Build description
    description_lines = [
        f"🔄 Recurring task — auto-generated",
        f"Rule: [{rule.code}] {rule.name}" if rule.code else f"Rule: {rule.name}",
        f"Schedule: {rule.recurrence_interval}",
        f"Generated: {now.strftime('%Y-%m-%d %H:%M')}",
    ]

    # Broadcast: create task for every user in the role
    if rule.broadcast_to_role and tmpl.assign_to_role:
        users = User.objects.filter(
            organization=rule.organization,
            role=tmpl.assign_to_role,
            is_active=True,
        )
        for user in users:
            Task.objects.create(
                organization=rule.organization,
                title=f"🔄 {tmpl.name}",
                description="\n".join(description_lines),
                priority=rule.priority or tmpl.default_priority or 'MEDIUM',
                status='PENDING',
                source='RECURRING',
                auto_rule=rule,
                template=tmpl,
                assigned_to=user,
                due_date=now + timedelta(hours=24),
                points=tmpl.default_points or 1,
                estimated_minutes=tmpl.estimated_minutes or 30,
                related_object_type='AutoTaskRule',
                related_object_id=rule.id,
                related_object_label=f"Recurring: {rule.name}",
            )
        return True

    # Single assignee
    task = Task.objects.create(
        organization=rule.organization,
        title=f"🔄 {tmpl.name}",
        description="\n".join(description_lines),
        priority=rule.priority or tmpl.default_priority or 'MEDIUM',
        status='PENDING',
        source='RECURRING',
        auto_rule=rule,
        template=tmpl,
        assigned_to=assignee,
        due_date=now + timedelta(hours=24),
        points=tmpl.default_points or 1,
        estimated_minutes=tmpl.estimated_minutes or 30,
        related_object_type='AutoTaskRule',
        related_object_id=rule.id,
        related_object_label=f"Recurring: {rule.name}",
    )

    return task


@shared_task(name='apps.workspace.tasks.check_stale_orders')
def check_stale_orders():
    """
    Check for stale orders, transfer orders, POs, and pending approvals.
    Fires ORDER_STALE and APPROVAL_PENDING triggers as appropriate.
    """
    from apps.workspace.auto_task_service import fire_auto_tasks
    from apps.pos.models.purchase_order_models import PurchaseOrder
    from erp.models import Organization

    now = timezone.now()
    total_fired = 0

    # Check stale POs across all organizations
    stale_statuses = ['DRAFT', 'SUBMITTED', 'ORDERED']
    for org in Organization.objects.filter(is_active=True):
        # Get active rules for this org to know thresholds
        from apps.workspace.models import AutoTaskRule
        stale_rules = AutoTaskRule.objects.filter(
            organization=org,
            trigger_event__in=['ORDER_STALE', 'APPROVAL_PENDING'],
            is_active=True,
        )
        for rule in stale_rules:
            threshold = rule.stale_threshold_days or 3
            cutoff = now - timedelta(days=threshold)

            if rule.trigger_event == 'ORDER_STALE':
                stale_pos = PurchaseOrder.objects.filter(
                    organization=org,
                    status__in=stale_statuses,
                    created_at__lte=cutoff,
                )
                for po in stale_pos[:10]:  # Limit to avoid spam
                    tasks = fire_auto_tasks(org, 'ORDER_STALE', {
                        'reference': po.po_number or f'PO-{po.pk}',
                        'extra': {'status': po.status, 'days_stale': (now - po.created_at).days},
                    })
                    total_fired += len(tasks)

            elif rule.trigger_event == 'APPROVAL_PENDING':
                pending_pos = PurchaseOrder.objects.filter(
                    organization=org,
                    status='SUBMITTED',
                    submitted_at__lte=cutoff if hasattr(PurchaseOrder, 'submitted_at') else cutoff,
                )
                for po in pending_pos[:10]:
                    tasks = fire_auto_tasks(org, 'APPROVAL_PENDING', {
                        'reference': po.po_number or f'PO-{po.pk}',
                        'extra': {'status': po.status},
                    })
                    total_fired += len(tasks)

    logger.info(f"Stale order check: {total_fired} tasks created")
    return total_fired
