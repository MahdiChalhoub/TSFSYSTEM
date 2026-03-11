from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from apps.crm.models import (
    Contact, FollowUpPolicy, ScheduledActivity, 
    ActivityReminder, InteractionLog
)

class ActivitySchedulerService:
    """
    Service for generating and managing the work queue (ScheduledActivity).
    Handles recurring tasks, reminders, and escalation logic.
    """
    @staticmethod
    def generate_task_from_policy(policy, from_date=None):
        """
        Creates a new ScheduledActivity based on a FollowUpPolicy.
        Ensures idempotency by avoiding duplicates if an open task exists for the same chain.
        """
        if not policy.active:
            return None
            
        base_date = from_date or timezone.now()
        # Ensure we are using a date/datetime format
        due_date = base_date + timedelta(days=policy.interval_days or 0)
        
        # Check for duplicates (existing planned/due task for this policy chain)
        existing = ScheduledActivity.objects.filter(
            followup_policy=policy,
            status__in=['PLANNED', 'DUE'],
            is_recurring=True
        ).exists()
        
        if existing and not getattr(policy, 'allow_multiple_open_tasks', False):
            return None

        # Create the task
        task = ScheduledActivity.objects.create(
            tenant_id=policy.tenant_id,
            contact=policy.contact,
            followup_policy=policy,
            action_type=policy.action_type,
            source_type='POLICY',
            title=f"{policy.get_action_type_display()}: {policy.name}",
            description=policy.notes_template,
            scheduled_for=due_date - timedelta(days=policy.lead_days),
            due_date=due_date,
            assigned_to=policy.assigned_to or policy.contact.assigned_owner,
            priority=policy.priority,
            status='PLANNED',
            is_auto_generated=True,
            is_recurring=True,
            recurrence_key=f"policy_{policy.id}"
        )
        
        # Create reminders
        if policy.auto_create_reminder:
            ActivitySchedulerService.create_reminders_for_task(task, policy)
            
        # Update contact summary cache
        FollowUpService.update_contact_followup_metrics(policy.contact)
        policy.contact.save()
            
        return task

    @staticmethod
    def create_reminders_for_task(task, policy=None):
        """
        Generates reminders for a given task based on policy settings.
        """
        policy = policy or task.followup_policy
        if not policy:
            return
            
        # Default reminder: X unit before due date
        unit = getattr(policy, 'reminder_offset_unit', 'DAY').lower() + "s"
        offset_val = getattr(policy, 'reminder_offset_value', 1)
        
        try:
            offset = timedelta(**{unit: offset_val})
            remind_at = task.due_date - offset
            
            if remind_at > timezone.now():
                ActivityReminder.objects.create(
                    tenant_id=task.tenant_id,
                    scheduled_activity=task,
                    user=task.assigned_to,
                    channel='IN_APP',
                    remind_at=remind_at,
                    message=f"Rappel: {task.title} pour {task.contact.name} à {task.due_date.strftime('%H:%M')}"
                )
        except Exception:
            # Fallback if unit is invalid or other error
            pass

    @staticmethod
    def scan_and_generate_all():
        """
        Global scanner to find active policies that should have a task but dont.
        Usually triggered by a cron job or manual scan.
        """
        policies = FollowUpPolicy.objects.filter(active=True)
        count = 0
        for p in policies:
            task = ActivitySchedulerService.generate_task_from_policy(p)
            if task:
                count += 1
        return count

class FollowUpService:
    """
    Service for recording interactions and managing the lifecycle of relationship activities.
    """
    @staticmethod
    def record_interaction(contact, user, channel, outcome, notes="", **kwargs):
        """
        Logs an interaction and updates the contact's aggregate metrics.
        """
        with transaction.atomic():
            log = InteractionLog.objects.create(
                tenant_id=contact.tenant_id,
                contact=contact,
                user=user,
                channel=channel,
                outcome=outcome,
                notes=notes,
                interaction_at=kwargs.get('interaction_at', timezone.now()),
                related_order_id=kwargs.get('related_order_id'),
                related_invoice_id=kwargs.get('related_invoice_id')
            )
            
            # Update contact cache
            now = log.interaction_at
            contact.last_interaction_at = now
            if channel == 'CALL': contact.last_call_at = now
            elif channel == 'VISIT': contact.last_visit_at = now
            elif channel == 'ORDER': contact.last_order_at = now
            
            # Recompute followup_status and score
            FollowUpService.update_contact_followup_metrics(contact)
            contact.save()
            
            # Emit domain event for Global Scoring Engine
            try:
                from kernel.events import emit_event
                emit_event(
                    event_type='contact.interaction_recorded',
                    payload={
                        'contact_id': contact.id,
                        'user_id': user.id,
                        'outcome': outcome,
                        'channel': channel,
                        'contact_name': contact.name,
                        'outcome_label': outcome,
                        'tenant_id': contact.tenant_id
                    },
                    aggregate_type='crm.interaction',
                    aggregate_id=log.id,
                    triggered_by=user
                )
            except Exception as e:
                # Event emission should not block transaction
                pass
            
            return log

    @staticmethod
    def complete_activity(activity, user, outcome, notes=""):
        """
        Marks a scheduled activity as DONE, logs it as an interaction, 
        and triggers the next recurring task if applicable.
        """
        with transaction.atomic():
            activity.status = 'DONE'
            activity.completed_at = timezone.now()
            activity.completion_note = notes
            activity.save()
            
            # Ensure reminders are cancelled
            activity.reminders.filter(status='PENDING').update(status='CANCELLED')
            
            # Log as a formal interaction
            FollowUpService.record_interaction(
                activity.contact, user, 
                channel=activity.action_type, 
                outcome=outcome, 
                notes=notes
            )
            
            # Auto-generate next if policy is recurring/auto-trigger
            if activity.followup_policy and activity.followup_policy.auto_create_next:
                policy = activity.followup_policy
                
                trigger_from = getattr(policy, 'auto_schedule_next_from', 'COMPLETION_DATE')
                if trigger_from == 'DUE_DATE':
                    from_date = activity.due_date
                else:
                    from_date = activity.completed_at
                    
                ActivitySchedulerService.generate_task_from_policy(policy, from_date=from_date)

    @staticmethod
    def update_contact_followup_metrics(contact):
        """
        Updates the aggregated lookup fields on the Contact model for high-performance dashboarding.
        """
        # 1. Find the next relevant scheduled activity
        next_act = ScheduledActivity.objects.filter(
            contact=contact,
            status__in=['PLANNED', 'DUE', 'OVERDUE']
        ).order_by('due_date').first()
        
        if next_act:
            contact.next_scheduled_activity_at = next_act.due_date
            contact.next_scheduled_activity_type = next_act.action_type
            
            if next_act.due_date < timezone.now():
                contact.followup_status = 'OVERDUE'
            elif next_act.due_date < timezone.now() + timedelta(days=1):
                contact.followup_status = 'DUE_SOON'
            else:
                contact.followup_status = 'ON_TRACK'
        else:
            contact.next_scheduled_activity_at = None
            contact.next_scheduled_activity_type = None
            
            # Logic for dormant status (no activity planned AND no recent interaction)
            if contact.last_interaction_at:
                if contact.last_interaction_at < timezone.now() - timedelta(days=30):
                    contact.followup_status = 'DORMANT'
                else:
                    contact.followup_status = 'ON_TRACK'
            else:
                contact.followup_status = 'NO_OWNER' if not contact.assigned_owner else 'ON_TRACK'
        
        # 2. Interaction Score logic
        # Points calculation:
        # +10 for each SUCCESS interaction in last 30 days
        # -5 for each FAILED interaction in last 30 days
        # -2 for NO_ANSWER interaction in last 30 days
        # -20 for each OVERDUE activity currently open
        # +5 if contact is VIP tier
        
        score = 0
        cutoff = timezone.now() - timedelta(days=30)
        
        logs = InteractionLog.objects.filter(contact=contact, interaction_at__gt=cutoff)
        for log in logs:
            if log.outcome == 'SUCCESS': score += 10
            elif log.outcome == 'FAILED': score -= 5
            elif log.outcome == 'NO_ANSWER': score -= 2
            
        overdue_count = ScheduledActivity.objects.filter(
            contact=contact, 
            status__in=['PLANNED', 'DUE'], 
            due_date__lt=timezone.now()
        ).count()
        score -= (overdue_count * 20)
        
        if getattr(contact, 'tier', None) == 'VIP':
            score += 5
            
        # Bound score between 0 and 100
        contact.interaction_score = max(0, min(score, 100))
