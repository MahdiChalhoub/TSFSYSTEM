"""
Workspace Module — Signals
Auto-task generation from system events.
"""
import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  EMAIL NOTIFICATION ON TASK ASSIGNMENT
# ═══════════════════════════════════════════════════════════
# Two-step pattern: remember the previous assignee in pre_save, then in
# post_save compare — if assigned_to changed (or was just set on create)
# to a user with an email, send them a short heads-up.

_ASSIGNEE_CACHE: dict = {}


@receiver(pre_save, sender='workspace.Task')
def _remember_previous_assignee(sender, instance, **kwargs):
    if not instance.pk:
        _ASSIGNEE_CACHE[id(instance)] = None
        return
    try:
        prev = sender.objects.only('assigned_to_id').get(pk=instance.pk)
        _ASSIGNEE_CACHE[id(instance)] = prev.assigned_to_id
    except sender.DoesNotExist:
        _ASSIGNEE_CACHE[id(instance)] = None


@receiver(post_save, sender='workspace.Task')
def _email_on_assignment(sender, instance, created, **kwargs):
    try:
        prev_id = _ASSIGNEE_CACHE.pop(id(instance), None)
        new_id = instance.assigned_to_id
        # Only fire when assignee actually changed to a real user.
        if not new_id or new_id == prev_id:
            return
        user = instance.assigned_to
        if not user or not getattr(user, 'email', None):
            return
        subject = f"New task: {instance.title[:80]}"
        due = instance.due_date.strftime('%Y-%m-%d %H:%M') if instance.due_date else 'No due date'
        priority = (instance.priority or 'MEDIUM').title()
        lines = [
            f"Hi {user.get_full_name() or user.username},",
            '',
            f"You've been assigned a new task:",
            '',
            f"  {instance.title}",
            f"  Priority: {priority}",
            f"  Due: {due}",
        ]
        if instance.description:
            lines += ['', instance.description.strip()[:600]]
        if instance.require_completion_note:
            lines += ['', '🔒 This task requires a completion note / proof when you mark it done.']
        lines += ['', 'Open the Task Board to act on it.']
        send_mail(
            subject,
            '\n'.join(lines),
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@tsfsystem.local'),
            [user.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.warning(f"[task-assignment-email] Failed to notify: {e}")


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
