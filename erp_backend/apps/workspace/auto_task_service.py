"""
WorkspaceAutoTaskService — Auto-task rule engine.

Fires tasks automatically when system events occur, matching
AutoTaskRule conditions against the event context (amount, site,
client, cashier, payment_method).

Supports:
- Event-based triggers (RECURRING rules are handled by Celery beat)
- Broadcast to all users in a role
- Priority override from rule
- Chain filtering (rules with chain_parent are only fired on parent completion)
"""
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


def fire_auto_tasks(organization, trigger_event, context: dict):
    """
    Public entry point. Call this from any part of the system when an event occurs.

    Args:
        organization: Organization instance
        trigger_event: str — one of AutoTaskRule.TRIGGER_CHOICES keys
        context: dict with any of:
            amount        — Decimal sale/invoice amount
            site_id       — warehouse/site id
            client_id     — CRM contact id
            cashier_id    — User id of the cashier
            payment_method — str, e.g. 'CREDIT', 'CASH'
            user          — User instance (cashier/actor)
            reference     — str reference (invoice no, order ref)
            extra         — any extra detail for the task description
            product_id    — int, product id for product-related triggers
            product_name  — str, product name

    Returns: list of created Task instances (may be empty)
    """
    try:
        return _fire_auto_tasks_inner(organization, trigger_event, context)
    except Exception as e:
        org_repr = getattr(organization, 'id', organization)
        ctx_keys = sorted((context or {}).keys())
        logger.exception(
            "Auto-task error [trigger=%s org=%s ctx_keys=%s]: %s",
            trigger_event, org_repr, ctx_keys, e,
        )
        return []  # Never crash the caller


def _fire_auto_tasks_inner(organization, trigger_event, context):
    from apps.workspace.models import AutoTaskRule, Task
    from django.utils import timezone
    from datetime import timedelta

    rules = AutoTaskRule.objects.filter(
        organization=organization,
        trigger_event=trigger_event,
        rule_type='EVENT',       # Only EVENT rules — RECURRING handled by Celery
        chain_parent__isnull=True,  # Chain children only fire on parent completion
        is_active=True,
    ).select_related('template', 'template__assign_to_role', 'assign_to_user', 'assign_to_user_group')

    if not rules.exists():
        return []

    amount      = Decimal(str(context.get('amount', 0)))
    site_id     = context.get('site_id')
    client_id   = context.get('client_id')
    cashier_id  = context.get('cashier_id')
    pay_method  = (context.get('payment_method') or '').upper()
    actor_user  = context.get('user')
    reference   = context.get('reference') or ''
    extra       = context.get('extra') or {}
    product_id  = context.get('product_id')
    product_name = context.get('product_name') or ''

    created_tasks = []

    for rule in rules:
        cond = rule.conditions or {}

        # ── Condition matching ───────────────────────────────────────────────
        min_amount = cond.get('min_amount')
        if min_amount is not None and amount < Decimal(str(min_amount)):
            continue

        max_amount = cond.get('max_amount')
        if max_amount is not None and amount > Decimal(str(max_amount)):
            continue

        cond_site = cond.get('site_id')
        if cond_site is not None and str(site_id) != str(cond_site):
            continue

        cond_client = cond.get('client_id')
        if cond_client is not None and str(client_id) != str(cond_client):
            continue

        cond_cashier = cond.get('cashier_id')
        if cond_cashier is not None and str(cashier_id) != str(cond_cashier):
            continue

        cond_method = cond.get('payment_method')
        if cond_method and pay_method and pay_method != cond_method.upper():
            continue

        # ── days_before: when the scheduler fires a period-reminder event it
        # passes context.days_before. A rule matches only if its own
        # conditions.days_before equals that value (or is unset → matches any).
        ctx_days_before = context.get('days_before')
        cond_days_before = cond.get('days_before')
        if ctx_days_before is not None and cond_days_before is not None and int(ctx_days_before) != int(cond_days_before):
            continue

        # ── Build task from template ─────────────────────────────────────────
        tmpl = rule.template
        if not tmpl:
            continue

        actor_name = (
            actor_user.get_full_name() or actor_user.username
            if actor_user else 'System'
        )

        # Priority: rule override > template default > 'HIGH'
        priority = rule.priority or tmpl.default_priority or 'HIGH'

        # Build rich description
        code_prefix = f"[{rule.code}] " if rule.code else ""
        description_lines = [
            f"⚡ Auto-generated by rule: {code_prefix}{rule.name}",
            f"Trigger: {rule.get_trigger_event_display()}",
            f"Module: {(rule.module or 'system').title()}",
        ]
        if reference:
            description_lines.append(f"Reference: {reference}")
        if amount:
            description_lines.append(f"Amount: {amount:,.0f}")
        if product_name:
            description_lines.append(f"Product: {product_name}")
        if actor_name != 'System':
            description_lines.append(f"Actor: {actor_name}")
        if client_id:
            description_lines.append(f"Client ID: {client_id}")
        if site_id:
            description_lines.append(f"Site ID: {site_id}")
        if isinstance(extra, dict):
            for k, v in extra.items():
                description_lines.append(f"{k}: {v}")

        # Due date: 24h from now
        due = timezone.now() + timedelta(hours=24)

        # Related object info
        related_type = extra.get('object_type', 'AutoTaskRule') if isinstance(extra, dict) else 'AutoTaskRule'
        related_id = extra.get('object_id', rule.id) if isinstance(extra, dict) else rule.id
        related_label = reference or product_name or rule.name

        try:
            # ── User-group fan-out: one task per member (ad-hoc team) ─────────
            if rule.assign_to_user_group_id and not rule.assign_to_user_id:
                members = rule.assign_to_user_group.members.filter(is_active=True)
                for user in members:
                    task = Task.objects.create(
                        organization=organization,
                        title=f"🤖 {tmpl.name}" if tmpl.name else f"Auto: {rule.get_trigger_event_display()}",
                        description="\n".join(description_lines),
                        priority=priority,
                        status='PENDING',
                        source='SYSTEM',
                        auto_rule=rule,
                        template=tmpl,
                        assigned_to=user,
                        assigned_to_user_group=rule.assign_to_user_group,
                        due_date=due,
                        related_object_type=related_type,
                        related_object_id=related_id,
                        related_object_label=related_label,
                        points=tmpl.default_points or 1,
                        estimated_minutes=tmpl.estimated_minutes or 30,
                    )
                    created_tasks.append(task)
            # ── Broadcast mode: task for every user in the role ───────────────
            elif rule.broadcast_to_role and tmpl.assign_to_role:
                from erp.models import User
                users = User.objects.filter(
                    organization=organization,
                    role=tmpl.assign_to_role,
                    is_active=True,
                )
                for user in users:
                    task = Task.objects.create(
                        organization=organization,
                        title=f"🤖 {tmpl.name}" if tmpl.name else f"Auto: {rule.get_trigger_event_display()}",
                        description="\n".join(description_lines),
                        priority=priority,
                        status='PENDING',
                        source='SYSTEM',
                        auto_rule=rule,
                        template=tmpl,
                        assigned_to=user,
                        due_date=due,
                        related_object_type=related_type,
                        related_object_id=related_id,
                        related_object_label=related_label,
                        points=tmpl.default_points or 1,
                        estimated_minutes=tmpl.estimated_minutes or 30,
                    )
                    created_tasks.append(task)
            else:
                # ── Single assignee mode ─────────────────────────────────────
                task = Task.objects.create(
                    organization=organization,
                    title=f"🤖 {tmpl.name}" if tmpl.name else f"Auto: {rule.get_trigger_event_display()}",
                    description="\n".join(description_lines),
                    priority=priority,
                    status='PENDING',
                    source='SYSTEM',
                    auto_rule=rule,
                    template=tmpl,
                    assigned_to=rule.assign_to_user or None,
                    assigned_to_group=tmpl.assign_to_role if not rule.assign_to_user else None,
                    due_date=due,
                    related_object_type=related_type,
                    related_object_id=related_id,
                    related_object_label=related_label,
                    points=tmpl.default_points or 1,
                    estimated_minutes=tmpl.estimated_minutes or 30,
                )
                created_tasks.append(task)

        except Exception as e:
            logger.error(f"Failed to create task for rule {rule.code or rule.id}: {e}")
            continue

    if created_tasks:
        logger.info(f"Auto-tasks: {len(created_tasks)} created for [{trigger_event}] in {organization}")

    return created_tasks
