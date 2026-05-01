"""
Workspace Connector Service
==============================
Exposes workspace capabilities to other modules via the Connector Governance Layer.

Capabilities:
  - workspace.tasks.get_model          → Task model class
  - workspace.tasks.get_category_model → TaskCategory model class
  - workspace.events.trigger_inventory → trigger_inventory_event
  - workspace.events.trigger_purchasing → trigger_purchasing_event
  - workspace.events.trigger_finance   → trigger_finance_event
  - workspace.events.trigger_crm       → trigger_crm_event
  - workspace.events.trigger_hr        → trigger_hr_event
  - workspace.events.trigger_system    → trigger_system_event
  - workspace.events.fire              → fire_workspace_event (generic)
  - workspace.auto_tasks.fire          → fire_auto_tasks
"""
import logging

logger = logging.getLogger(__name__)


def register_capabilities(registry):
    """Called by auto-discovery in connector_registry.py."""

    # ─── MODELS ──────────────────────────────────────────────────────

    @_cap(registry, 'workspace.tasks.get_model',
          description='Get Task model class',
          cacheable=False, critical=False)
    def get_task_model(org_id=0, **kw):
        from apps.workspace.models import Task
        return Task

    @_cap(registry, 'workspace.tasks.get_category_model',
          description='Get TaskCategory model class',
          cacheable=False, critical=False)
    def get_task_category_model(org_id=0, **kw):
        from apps.workspace.models import TaskCategory
        return TaskCategory

    @_cap(registry, 'workspace.task_comment.get_model',
          description='Get TaskComment model class',
          cacheable=False, critical=False)
    def get_task_comment_model(org_id=0, **kw):
        from apps.workspace.models import TaskComment
        return TaskComment

    # ─── EVENT TRIGGERS ──────────────────────────────────────────────

    @_cap(registry, 'workspace.events.trigger_inventory',
          description='Fire an inventory-related auto-task trigger',
          fallback_type='WRITE', cacheable=False)
    def cap_trigger_inventory_event(org_id, organization=None, event=None, **kwargs):
        from apps.workspace.signals import trigger_inventory_event
        org = organization
        if not org:
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
        return trigger_inventory_event(org, event, **kwargs)

    @_cap(registry, 'workspace.events.trigger_purchasing',
          description='Fire a purchasing-related auto-task trigger',
          fallback_type='WRITE', cacheable=False)
    def cap_trigger_purchasing_event(org_id, organization=None, event=None, **kwargs):
        from apps.workspace.signals import trigger_purchasing_event
        org = organization
        if not org:
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
        return trigger_purchasing_event(org, event, **kwargs)

    @_cap(registry, 'workspace.events.trigger_finance',
          description='Fire a finance/POS-related auto-task trigger',
          fallback_type='WRITE', cacheable=False)
    def cap_trigger_finance_event(org_id, organization=None, event=None, **kwargs):
        from apps.workspace.signals import trigger_finance_event
        org = organization
        if not org:
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
        return trigger_finance_event(org, event, **kwargs)

    @_cap(registry, 'workspace.events.trigger_crm',
          description='Fire a CRM-related auto-task trigger',
          fallback_type='WRITE', cacheable=False)
    def cap_trigger_crm_event(org_id, organization=None, event=None, **kwargs):
        from apps.workspace.signals import trigger_crm_event
        org = organization
        if not org:
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
        return trigger_crm_event(org, event, **kwargs)

    @_cap(registry, 'workspace.events.trigger_hr',
          description='Fire an HR-related auto-task trigger',
          fallback_type='WRITE', cacheable=False)
    def cap_trigger_hr_event(org_id, organization=None, event=None, **kwargs):
        from apps.workspace.signals import trigger_hr_event
        org = organization
        if not org:
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
        return trigger_hr_event(org, event, **kwargs)

    @_cap(registry, 'workspace.events.trigger_system',
          description='Fire a system-level auto-task trigger',
          fallback_type='WRITE', cacheable=False)
    def cap_trigger_system_event(org_id, organization=None, event=None, **kwargs):
        from apps.workspace.signals import trigger_system_event
        org = organization
        if not org:
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
        return trigger_system_event(org, event, **kwargs)

    @_cap(registry, 'workspace.events.fire',
          description='Fire a generic workspace auto-task event',
          fallback_type='WRITE', cacheable=False)
    def cap_fire_workspace_event(org_id, organization=None, trigger_event=None, **kwargs):
        from apps.workspace.signals import fire_workspace_event
        org = organization
        if not org:
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
        return fire_workspace_event(org, trigger_event, **kwargs)

    @_cap(registry, 'workspace.auto_tasks.fire',
          description='Fire auto-task creation from auto_task_service',
          fallback_type='WRITE', cacheable=False)
    def cap_fire_auto_tasks(org_id, organization=None, event=None, context=None, **kwargs):
        from apps.workspace.auto_task_service import fire_auto_tasks
        org = organization
        if not org:
            from erp.models import Organization
            org = Organization.objects.get(id=org_id)
        return fire_auto_tasks(org, event, context or {})


def _cap(registry, name, **kwargs):
    """Decorator helper to register a capability."""
    def decorator(func):
        registry.register(name, func, **kwargs)
        return func
    return decorator
