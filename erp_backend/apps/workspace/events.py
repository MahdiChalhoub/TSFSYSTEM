"""
Workspace Module Event Handlers
================================

Kernel OS v2.0 Integration - Event subscriptions for task generation
and managerial escalations from the Workforce Intelligence Engine (WISE).
"""

import logging
from kernel.events import subscribe_to_event
from django.utils import timezone

logger = logging.getLogger(__name__)

@subscribe_to_event('workforce.risk_increased')
def on_workforce_risk_increased(event):
    """
    Handle risk escalation by creating an urgent Managerial Review task.
    """
    from .models import Task, TaskCategory
    from erp.models import User

    payload = event.payload
    employee_id = payload.get('employee_id')
    employee_name = payload.get('employee_name')
    new_risk = payload.get('new_risk')
    global_score = payload.get('global_score')
    critical_count = payload.get('critical_count')
    organization_id = event.organization_id

    logger.info(f"[Workspace] Risk escalated for {employee_name} to {new_risk}")

    # 1. Resolve Category
    category, _ = TaskCategory.objects.get_or_create(
        organization_id=organization_id,
        name='Managerial / HR',
        defaults={'color': '#ef4444', 'icon': 'ShieldAlert'}
    )

    # 2. Find a Manager to assign to (Simplified: find first superuser or role with HR/Manager)
    # In a real scenario, we'd use the employee's supervisor or a specific HR role.
    manager = User.objects.filter(organization_id=organization_id, is_staff=True).first()

    # 3. Create Task
    Task.objects.create(
        organization_id=organization_id,
        title=f"⚠️ ACE Escalation: Review {employee_name} ({new_risk})",
        description=(
            f"The Workforce Intelligence Engine (WISE) has detected a critical risk increase for {employee_name}.\n\n"
            f"Current Risk: {new_risk}\n"
            f"Global Performance: {global_score}%\n"
            f"Critical Violations: {critical_count}\n\n"
            f"Action Required: Conduct a formal performance review and verify if disciplinary action or retraining is needed."
        ),
        priority='URGENT',
        status='PENDING',
        source='SYSTEM',
        category=category,
        assigned_to=manager,
        due_date=timezone.now() + timezone.timedelta(days=1),
        related_object_type='Employee',
        related_object_id=employee_id,
        related_object_label=employee_name
    )

    return {'success': True}

@subscribe_to_event('task.created')
def handle_task_created(event):
    """Handle task creation - notify assignee"""
    logger.info(f"[Workspace] Task created event received")
    return {'success': True}

@subscribe_to_event('task.completed')
def handle_task_completed(event):
    """Handle task completion - update metrics"""
    logger.info(f"[Workspace] Task completed event received")
    return {'success': True}

