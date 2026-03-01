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


@shared_task(name='apps.workspace.tasks.send_task_notification_async')
def send_task_notification_async(task_id: int):
    """
    Sends an automated Email and WhatsApp notification to the task assignee.
    Runs asynchronously via Celery immediately after a task is assigned.
    """
    from apps.workspace.models import Task
    from django.core.mail import send_mail
    from django.conf import settings
    
    try:
        task = Task.objects.select_related('assigned_to', 'organization').get(id=task_id)
    except Task.DoesNotExist:
        return {'status': 'ignored', 'reason': 'Task deleted or not found'}

    user = task.assigned_to
    if not user:
        return {'status': 'ignored', 'reason': 'No assignee'}

    messages_sent = []
    
    # --- Dynamic Resolution for Client/Supplier Phone ---
    # Default to assigned employee
    target_phone = getattr(user, 'whatsapp_number', None)
    target_email = getattr(user, 'email', None)
    target_name = user.get_full_name() or user.username
    
    # Override for external contacts if related object is a PO or Order or Contact
    target_whatsapp_group = None
    if task.related_object_type and task.related_object_id:
        try:
            if task.related_object_type in ('PurchaseOrder', 'PO'):
                from apps.pos.models.purchase_order_models import PurchaseOrder
                po = PurchaseOrder.objects.filter(id=task.related_object_id).first()
                if po and po.supplier:
                    target_whatsapp_group = getattr(po.supplier, 'whatsapp_group_id', None)
                    if po.supplier.phone:
                        target_phone = po.supplier.phone
                        target_name = po.supplier.name
                    if getattr(po.supplier, 'email', None): target_email = po.supplier.email

            elif task.related_object_type in ('Order', 'Invoice'):
                from apps.pos.models import Order
                order = Order.objects.filter(id=task.related_object_id).first()
                if order and order.customer:
                    target_whatsapp_group = getattr(order.customer, 'whatsapp_group_id', None)
                    if getattr(order.customer, 'phone', None):
                        target_phone = order.customer.phone
                        target_name = order.customer.name
                    if getattr(order.customer, 'email', None): target_email = order.customer.email

            elif task.related_object_type == 'Contact':
                from apps.crm.models import Contact
                contact = Contact.objects.filter(id=task.related_object_id).first()
                if contact:
                    target_whatsapp_group = getattr(contact, 'whatsapp_group_id', None)
                    if getattr(contact, 'phone', None):
                        target_phone = contact.phone
                        target_name = contact.name
                    if getattr(contact, 'email', None): target_email = contact.email
        except ImportError:
            pass

    # ── 1. Email Notification ──
    if target_email:
        subject = f"[{task.organization.name}] New Update: {task.title}"
        message = (
            f"Hello {target_name},\n\n"
            f"A system event requires your attention:\n\n"
            f"Subject: {task.title}\n"
            f"Date: {task.due_date.strftime('%Y-%m-%d %H:%M') if task.due_date else 'N/A'}\n"
            f"Status: {task.priority}\n\n"
            f"Details:\n{task.description}\n\n"
            f"Thank you.\n"
        )
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [target_email],
                fail_silently=True,
            )
            messages_sent.append('email')
        except Exception as e:
            logger.error(f"Failed to send email to {target_email}: {e}")

    # ── 2. WhatsApp Notification ──
    if target_phone:
        whatsapp_msg = (
            f"🔔 *System Alert: {task.title}* ({task.organization.name})\n"
            f"Status: {task.priority}\n\n"
            f"{task.description}"
        )
        
        from erp.services import ConfigurationService
        wa_config = ConfigurationService.get_setting(task.organization, 'whatsapp_integration', {})
        provider = wa_config.get('provider')
        is_active = wa_config.get('is_active', False)
        
        if is_active and provider:
            import requests
            
            # Override the 'to_number' variable with target_phone instead of user.whatsapp_number
            to_number = target_phone.strip()
            if not to_number.startswith('+'):
                to_number = f"+{to_number}"
                
            try:
                if provider == 'TWILIO':
                    account_sid = wa_config.get('account_sid')
                    auth_token = wa_config.get('auth_token')
                    from_number = wa_config.get('from_number')
                    
                    if account_sid and auth_token and from_number:
                        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
                        payload = {
                            "From": from_number if from_number.startswith('whatsapp:') else f"whatsapp:{from_number}",
                            "To": target_whatsapp_group if target_whatsapp_group else f"whatsapp:{to_number}",
                            "Body": whatsapp_msg
                        }
                        res = requests.post(url, data=payload, auth=(account_sid, auth_token), timeout=5)
                        res.raise_for_status()
                        messages_sent.append('whatsapp_twilio')
                        
                elif provider == 'MESSAGEBIRD':
                    api_key = wa_config.get('api_key')
                    channel_id = wa_config.get('channel_id')
                    
                    if api_key and channel_id:
                        url = "https://conversations.messagebird.com/v1/send"
                        headers = {
                            "Authorization": f"AccessKey {api_key}",
                            "Content-Type": "application/json"
                        }
                        payload = {
                            "to": target_whatsapp_group if target_whatsapp_group else to_number,
                            "type": "text",
                            "content": {"text": whatsapp_msg},
                            "channelId": channel_id
                        }
                        res = requests.post(url, json=payload, headers=headers, timeout=5)
                        res.raise_for_status()
                        messages_sent.append('whatsapp_messagebird')
                        
                elif provider == 'META':
                    access_token = wa_config.get('access_token')
                    phone_number_id = wa_config.get('phone_number_id')
                    
                    if access_token and phone_number_id:
                        url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
                        headers = {
                            "Authorization": f"Bearer {access_token}",
                            "Content-Type": "application/json"
                        }
                        payload = {
                            "messaging_product": "whatsapp",
                            "to": target_whatsapp_group if target_whatsapp_group else to_number.replace('+', ''),  # Group ID or single number
                            "type": "text",
                            "text": {"body": whatsapp_msg}
                        }
                        res = requests.post(url, json=payload, headers=headers, timeout=5)
                        res.raise_for_status()
                        messages_sent.append('whatsapp_meta')

            except Exception as e:
                logger.error(f"WhatsApp dispatch failed via {provider}: {e}")
        else:
            # If no actual provider is configured, do not crash, just log locally
            logger.info(f"📲 [WhatsApp Traced (No Provider)] To: {target_whatsapp_group or target_phone} | Msg: {whatsapp_msg[:50]}...")
            messages_sent.append('whatsapp_mock')

    return {'status': 'success', 'channels': messages_sent}
