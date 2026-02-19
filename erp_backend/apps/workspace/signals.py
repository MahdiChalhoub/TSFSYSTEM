"""
Workspace Module — Signals
Auto-task generation from system events.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


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
            priority=rule.template.default_priority,
            points=rule.template.default_points,
            estimated_minutes=rule.template.estimated_minutes,
            source='AUTO',
            related_object_type=context_type,
            related_object_id=context_id,
            related_object_label=context_label,
        )
        # Auto-assign based on template's role
        if rule.template.assign_to_role:
            from erp.models import User
            assignees = User.objects.filter(
                organization=organization,
                role=rule.template.assign_to_role,
                is_active=True,
            )
            # Assign to the first available user (round-robin can be added later)
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
